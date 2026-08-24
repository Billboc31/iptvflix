import { eq, and, inArray, asc } from 'drizzle-orm'
import { db } from '../db/client.js'
import {
  shelfInstances,
  shelfInstanceItems,
  movies,
  mediaVideos,
} from '../db/schema/index.js'
import { signCursor, verifyCursor } from '../lib/home-cursor.js'
import {
  getOrCreateMoviesSession,
  getMoviesSessionById,
  countMoviesUnserved,
  serveMoviesBatch,
  buildMoviesDeclaredRails,
  fillMoviesPool,
  buildMoviesFallbackShelf,
} from './movies-pool-service.js'
import {
  getMoviesSnapshot,
  saveMoviesSnapshot,
  isMoviesSnapshotValid,
  isMoviesSnapshotStale,
} from './movies-snapshot-service.js'
import { resolveMediaImageUrl } from '../lib/tmdb-image.js'
import {
  MOVIES_BATCH_SIZE,
  MOVIES_POOL_MIN,
  MOVIES_POOL_TARGET,
  MOVIES_SNAPSHOT_TTL_HOURS,
} from '../config/env.js'
import type { MoviesPageResponse, ShelfResponse, ShelfItem } from '@iptvflix/api-contracts'

// ---------------------------------------------------------------------------
// buildMoviesPage — cursor-based entry point
// ---------------------------------------------------------------------------

export async function buildMoviesPage(profileId: string, cursor?: string): Promise<MoviesPageResponse> {
  // ── Cursor request ────────────────────────────────────────────────────────
  if (cursor) {
    const decoded = verifyCursor(cursor)
    if (!decoded) {
      throw Object.assign(new Error('Invalid or expired cursor'), { status: 403 })
    }

    const session = await getMoviesSessionById(decoded.sessionId)
    if (!session || session.profileId !== profileId) {
      throw Object.assign(new Error('Cursor profile mismatch'), { status: 403 })
    }

    const { shelves: batchRows, newNextPosition, hasMore } = await serveMoviesBatch(
      decoded.sessionId,
      decoded.nextPosition,
      MOVIES_BATCH_SIZE,
    )

    const enrichedShelves = await batchRowsToShelfResponses(batchRows)

    if ((await countMoviesUnserved(decoded.sessionId)) < MOVIES_POOL_MIN) {
      fillMoviesPool(decoded.sessionId, profileId, MOVIES_POOL_TARGET)
    }

    return {
      sessionId: decoded.sessionId,
      shelves: enrichedShelves,
      nextCursor: hasMore ? signCursor(decoded.sessionId, newNextPosition) : null,
    }
  }

  // ── First request (no cursor) ─────────────────────────────────────────────
  const session = await getOrCreateMoviesSession(profileId)
  const snapshot = await getMoviesSnapshot(profileId)

  // ── HIT: valid snapshot exists ────────────────────────────────────────────
  if (snapshot && isMoviesSnapshotValid(snapshot)) {
    console.log(`[MOVIES_SNAPSHOT] HIT profileId=${profileId}`)
    const shelves = await reconstructMoviesShelves(snapshot.declaredShelfInstanceIds)
    const hasMore = session.cursorReference !== 'exhausted'
    const nextPosition = snapshot.declaredShelfInstanceIds.length
    fillMoviesPool(session.id, profileId, MOVIES_POOL_TARGET)
    return {
      sessionId: session.id,
      shelves,
      nextCursor: hasMore && shelves.length > 0 ? signCursor(session.id, nextPosition) : null,
    }
  }

  // ── STALE: serve previous snapshot while regenerating async ───────────────
  if (snapshot && isMoviesSnapshotStale(snapshot)) {
    console.log(`[MOVIES_SNAPSHOT] STALE_SERVED profileId=${profileId} regeneration=triggered`)
    const shelves = await reconstructMoviesShelves(snapshot.declaredShelfInstanceIds)
    const hasMore = session.cursorReference !== 'exhausted'
    const nextPosition = snapshot.declaredShelfInstanceIds.length

    _regenerateMoviesSnapshot(profileId, session.id).catch((err) => {
      console.error('[MOVIES_SNAPSHOT] async regeneration error:', err)
    })
    fillMoviesPool(session.id, profileId, MOVIES_POOL_TARGET)

    return {
      sessionId: session.id,
      shelves,
      nextCursor: hasMore && shelves.length > 0 ? signCursor(session.id, nextPosition) : null,
    }
  }

  // ── MISS: no usable snapshot — build declared rails ───────────────────────
  console.log(`[MOVIES_SNAPSHOT] MISS profileId=${profileId}`)

  let shelves: ShelfResponse[] = []
  let nextPoolPosition = 0

  try {
    const declared = await buildMoviesDeclaredRails(profileId, session.id)
    shelves = declared.shelves
    nextPoolPosition = declared.nextPoolPosition

    const expiresAt = new Date(Date.now() + MOVIES_SNAPSHOT_TTL_HOURS * 60 * 60 * 1000)
    saveMoviesSnapshot(profileId, declared.shelfInstanceIds, expiresAt).catch((err) => {
      console.error('[MOVIES_SNAPSHOT] saveMoviesSnapshot error (swallowed):', err)
    })
  } catch (err) {
    console.error('[movies-service] buildMoviesDeclaredRails failed:', err)
  }

  if (shelves.length === 0) {
    try {
      const fallback = await buildMoviesFallbackShelf()
      if (fallback.items.length > 0) shelves = [fallback]
    } catch (err) {
      console.error('[movies-service] fallback shelf failed:', err)
    }
  }

  fillMoviesPool(session.id, profileId, MOVIES_POOL_TARGET)

  const hasMore = session.cursorReference !== 'exhausted'

  return {
    sessionId: session.id,
    shelves,
    nextCursor: hasMore && shelves.length > 0 ? signCursor(session.id, nextPoolPosition) : null,
  }
}

// ---------------------------------------------------------------------------
// Internal: regenerate snapshot async
// ---------------------------------------------------------------------------

async function _regenerateMoviesSnapshot(profileId: string, sessionId: string): Promise<void> {
  try {
    const declared = await buildMoviesDeclaredRails(profileId, sessionId)
    const expiresAt = new Date(Date.now() + MOVIES_SNAPSHOT_TTL_HOURS * 60 * 60 * 1000)
    await saveMoviesSnapshot(profileId, declared.shelfInstanceIds, expiresAt)
  } catch (err) {
    console.error('[MOVIES_SNAPSHOT] regeneration failed:', err)
  }
}

// ---------------------------------------------------------------------------
// Internal: reconstruct shelves from snapshot shelf_instance_ids
// ---------------------------------------------------------------------------

async function reconstructMoviesShelves(shelfInstanceIds: string[]): Promise<ShelfResponse[]> {
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
// Enrich batch rows with DB data
// ---------------------------------------------------------------------------

type BatchRow = {
  instanceId: string
  title: string
  verticalPosition: number
  items: Array<{ mediaType: string; mediaId: string }>
}

async function batchRowsToShelfResponses(batchRows: BatchRow[]): Promise<ShelfResponse[]> {
  if (batchRows.length === 0) return []

  const movieIds = batchRows.flatMap((r) => r.items.map((i) => i.mediaId))
  if (movieIds.length === 0) return []

  const [movieRows, trailerRows] = await Promise.all([
    db.select({ id: movies.id, title: movies.title, posterPath: movies.posterPath })
      .from(movies)
      .where(inArray(movies.id, movieIds)),
    db.select({ mediaId: mediaVideos.mediaId, youtubeKey: mediaVideos.youtubeKey })
      .from(mediaVideos)
      .where(and(eq(mediaVideos.mediaType, 'movie'), inArray(mediaVideos.mediaId, movieIds))),
  ])

  const titleMap = new Map<string, string>()
  const posterMap = new Map<string, string | null>()
  for (const r of movieRows) {
    titleMap.set(r.id, r.title)
    posterMap.set(r.id, r.posterPath)
  }

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
      mediaType: item.mediaType as 'MOVIE',
      mediaId: item.mediaId,
      title: titleMap.get(item.mediaId) ?? '',
      posterUrl: resolveMediaImageUrl(posterMap.get(item.mediaId) ?? null),
      trailerKey: trailerKeyMap.get(item.mediaId) ?? null,
    })),
  }))
}
