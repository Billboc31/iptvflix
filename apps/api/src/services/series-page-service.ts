import { eq, and, inArray, asc } from 'drizzle-orm'
import { db } from '../db/client.js'
import {
  recommendationSeriesSessions,
  series,
  mediaVideos,
  shelfInstances,
  shelfInstanceItems,
} from '../db/schema/index.js'
import { resolveMediaImageUrl } from '../lib/tmdb-image.js'
import { signCursor, verifyCursor } from '../lib/series-cursor.js'
import {
  getOrCreateSeriesSession,
  countUnservedSeries,
  serveSeriesBatch,
  buildSeriesDeclaredRails,
  fillSeriesPool,
  buildSeriesFallbackShelf,
  resolveSeriesNextServePosition,
  resolveSeriesAppendPosition,
} from './series-pool-service.js'
import {
  getSeriesSnapshot,
  saveSeriesSnapshot,
  isSeriesSnapshotValid,
  isSeriesSnapshotStale,
} from './series-snapshot-service.js'
import {
  SERIES_BATCH_SIZE,
  SERIES_POOL_MIN,
  SERIES_POOL_TARGET,
  SERIES_SNAPSHOT_TTL_HOURS,
} from '../config/env.js'
import type { SeriesPageResponse, ShelfResponse, ShelfItem } from '@iptvflix/api-contracts'

// ---------------------------------------------------------------------------
// buildSeriesPage — cursor-based entry point
// ---------------------------------------------------------------------------

export async function buildSeriesPage(profileId: string, cursor?: string): Promise<SeriesPageResponse> {
  // ── Cursor request ────────────────────────────────────────────────────────
  if (cursor) {
    const decoded = verifyCursor(cursor)
    if (!decoded) {
      throw Object.assign(new Error('Invalid or expired cursor'), { status: 403 })
    }

    const [session] = await db
      .select()
      .from(recommendationSeriesSessions)
      .where(eq(recommendationSeriesSessions.id, decoded.sessionId))
      .limit(1)

    if (!session || session.profileId !== profileId) {
      throw Object.assign(new Error('Cursor profile mismatch'), { status: 403 })
    }

    const { shelves: batchRows, newNextPosition, hasMore } = await serveSeriesBatch(
      decoded.sessionId,
      decoded.nextPosition,
      SERIES_BATCH_SIZE,
    )

    const generatedShelves = await batchRowsToShelfResponses(batchRows)

    if ((await countUnservedSeries(decoded.sessionId)) < SERIES_POOL_MIN) {
      fillSeriesPool(decoded.sessionId, profileId, SERIES_POOL_TARGET)
    }

    return {
      coldStart: false,
      sessionId: decoded.sessionId,
      shelves: generatedShelves,
      nextCursor: hasMore ? signCursor(decoded.sessionId, newNextPosition) : null,
    }
  }

  // ── First request (no cursor) ─────────────────────────────────────────────
  const session = await getOrCreateSeriesSession(profileId)
  const snapshot = await getSeriesSnapshot(profileId)

  // ── HIT: valid snapshot exists ────────────────────────────────────────────
  if (snapshot && isSeriesSnapshotValid(snapshot)) {
    console.log(`[SERIES_SNAPSHOT] HIT profileId=${profileId}`)
    const shelves = await reconstructShelvesFromSnapshot(snapshot.declaredShelfInstanceIds)
    const hasMore = session.cursorReference !== 'exhausted'
    const nextPosition = await resolveSeriesNextServePosition(session.id)
    if ((await countUnservedSeries(session.id)) < SERIES_POOL_MIN) {
      fillSeriesPool(session.id, profileId, SERIES_POOL_TARGET)
    }
    return {
      coldStart: shelves.length === 0,
      sessionId: session.id,
      shelves,
      nextCursor: hasMore && shelves.length > 0 ? signCursor(session.id, nextPosition) : null,
    }
  }

  // ── STALE: serve previous snapshot while regenerating async ───────────────
  if (snapshot && isSeriesSnapshotStale(snapshot)) {
    console.log(`[SERIES_SNAPSHOT] STALE_SERVED profileId=${profileId} regeneration=triggered`)
    const shelves = await reconstructShelvesFromSnapshot(snapshot.declaredShelfInstanceIds)
    const hasMore = session.cursorReference !== 'exhausted'
    const nextPosition = await resolveSeriesNextServePosition(session.id)

    _regenerateSeriesSnapshot(profileId, session.id).catch((err) => {
      console.error('[SERIES_SNAPSHOT] async regeneration error:', err)
    })
    if ((await countUnservedSeries(session.id)) < SERIES_POOL_MIN) {
      fillSeriesPool(session.id, profileId, SERIES_POOL_TARGET)
    }

    return {
      coldStart: shelves.length === 0,
      sessionId: session.id,
      shelves,
      nextCursor: hasMore && shelves.length > 0 ? signCursor(session.id, nextPosition) : null,
    }
  }

  // ── MISS: no usable snapshot — build declared rails ───────────────────────
  console.log(`[SERIES_SNAPSHOT] MISS profileId=${profileId}`)

  let shelves: ShelfResponse[] = []
  let nextPoolPosition = 0

  try {
    const declared = await buildSeriesDeclaredRails(profileId, session.id)
    shelves = declared.shelves
    nextPoolPosition = declared.nextPoolPosition

    const expiresAt = new Date(Date.now() + SERIES_SNAPSHOT_TTL_HOURS * 60 * 60 * 1000)
    saveSeriesSnapshot(
      profileId,
      session.id,
      declared.shelfInstanceIds,
      expiresAt,
    ).catch((err) => {
      console.error('[SERIES_SNAPSHOT] saveSnapshot error (swallowed):', err)
    })
  } catch (err) {
    console.error('[series-page-service] buildSeriesDeclaredRails failed:', err)
  }

  const coldStart = shelves.length === 0
  if (coldStart) {
    try {
      const fallback = await buildSeriesFallbackShelf()
      if (fallback.items.length > 0) shelves = [fallback]
    } catch (err) {
      console.error('[series-page-service] fallback shelf failed:', err)
    }
  }

  fillSeriesPool(session.id, profileId, SERIES_POOL_TARGET)

  const hasMore = session.cursorReference !== 'exhausted'

  return {
    coldStart,
    sessionId: session.id,
    shelves,
    nextCursor: hasMore && shelves.length > 0 ? signCursor(session.id, nextPoolPosition) : null,
  }
}

// ---------------------------------------------------------------------------
// Internal: regenerate snapshot async
// ---------------------------------------------------------------------------

async function _regenerateSeriesSnapshot(profileId: string, sessionId: string): Promise<void> {
  try {
    const startPosition = await resolveSeriesAppendPosition(sessionId)
    const declared = await buildSeriesDeclaredRails(profileId, sessionId, startPosition)
    const expiresAt = new Date(Date.now() + SERIES_SNAPSHOT_TTL_HOURS * 60 * 60 * 1000)
    await saveSeriesSnapshot(profileId, sessionId, declared.shelfInstanceIds, expiresAt)
  } catch (err) {
    console.error('[SERIES_SNAPSHOT] regeneration failed:', err)
  }
}

// ---------------------------------------------------------------------------
// Internal: reconstruct shelves from snapshot shelf_instance_ids
// ---------------------------------------------------------------------------

async function reconstructShelvesFromSnapshot(shelfInstanceIds: string[]): Promise<ShelfResponse[]> {
  if (shelfInstanceIds.length === 0) return []

  const instanceRows = await db
    .select()
    .from(shelfInstances)
    .where(inArray(shelfInstances.id, shelfInstanceIds))

  const itemRows = await db
    .select()
    .from(shelfInstanceItems)
    .where(inArray(shelfInstanceItems.shelfInstanceId, shelfInstanceIds))
    .orderBy(asc(shelfInstanceItems.rankPosition))

  const itemsByInstance = new Map<string, typeof itemRows>()
  for (const item of itemRows) {
    const list = itemsByInstance.get(item.shelfInstanceId) ?? []
    list.push(item)
    itemsByInstance.set(item.shelfInstanceId, list)
  }

  const idOrder = new Map(shelfInstanceIds.map((id, i) => [id, i]))
  const sorted = [...instanceRows].sort((a, b) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0))

  const batchRows = sorted.map((r) => ({
    instanceId: r.id,
    title: r.title,
    verticalPosition: r.verticalPosition ?? 0,
    items: (itemsByInstance.get(r.id) ?? []).map((i) => ({ mediaType: i.mediaType, mediaId: i.mediaId })),
  }))

  return batchRowsToShelfResponses(batchRows)
}

// ---------------------------------------------------------------------------
// Convert batch rows → ShelfResponse (with DB enrichment)
// ---------------------------------------------------------------------------

type BatchRow = {
  instanceId: string
  title: string
  verticalPosition: number
  items: Array<{ mediaType: string; mediaId: string }>
}

async function batchRowsToShelfResponses(batchRows: BatchRow[]): Promise<ShelfResponse[]> {
  if (batchRows.length === 0) return []

  const allItems = batchRows.flatMap((r) => r.items)
  const seriesIds = allItems.filter((i) => i.mediaType === 'SERIES').map((i) => i.mediaId)

  const [seriesRows, trailerRows] = await Promise.all([
    seriesIds.length > 0
      ? db.select({ id: series.id, title: series.title, posterPath: series.posterPath })
          .from(series)
          .where(inArray(series.id, seriesIds))
      : Promise.resolve([]),
    seriesIds.length > 0
      ? db.select({ mediaId: mediaVideos.mediaId, youtubeKey: mediaVideos.youtubeKey })
          .from(mediaVideos)
          .where(and(eq(mediaVideos.mediaType, 'series'), inArray(mediaVideos.mediaId, seriesIds)))
      : Promise.resolve([]),
  ])

  const titleMap = new Map<string, string>()
  const posterMap = new Map<string, string | null>()
  for (const r of seriesRows) { titleMap.set(r.id, r.title); posterMap.set(r.id, r.posterPath) }

  const trailerKeyMap = new Map<string, string>()
  for (const r of trailerRows) {
    if (!trailerKeyMap.has(r.mediaId)) trailerKeyMap.set(r.mediaId, r.youtubeKey)
  }

  return batchRows.map((row) => ({
    id: row.instanceId,
    title: row.title,
    type: 'GENERATED' as const,
    layoutHint: 'ROW' as const,
    shelfInstanceId: row.instanceId,
    items: row.items.map((item): ShelfItem => ({
      mediaType: item.mediaType as 'SERIES',
      mediaId: item.mediaId,
      title: titleMap.get(item.mediaId) ?? '',
      posterUrl: resolveMediaImageUrl(posterMap.get(item.mediaId) ?? null),
      trailerKey: trailerKeyMap.get(item.mediaId) ?? null,
    })),
  }))
}
