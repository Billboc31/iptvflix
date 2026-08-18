import { resolveMediaImageUrl } from '../lib/tmdb-image.js'
import { eq, and, inArray } from 'drizzle-orm'
import { db } from '../db/client.js'
import { mediaVideos, recommendationHomeSessions, movies, series } from '../db/schema/index.js'
import { signCursor, verifyCursor } from '../lib/home-cursor.js'
import {
  getOrCreateSession,
  countUnserved,
  serveBatch,
  buildFixedShelves,
  fillPool,
  fillPoolAsync,
  buildFallbackShelf,
  persistFixedShelvesForSession,
} from './home-pool-service.js'
import {
  HOME_BATCH_SIZE,
  HOME_POOL_MIN,
  HOME_POOL_TARGET,
} from '../config/env.js'
import type { HomePageResponse, ShelfResponse, ShelfItem } from '@iptvflix/api-contracts'

// ---------------------------------------------------------------------------
// buildHome — cursor-based entry point
// ---------------------------------------------------------------------------

export async function buildHome(profileId: string, cursor?: string): Promise<HomePageResponse> {
  // ── Cursor request ────────────────────────────────────────────────────────
  if (cursor) {
    const decoded = verifyCursor(cursor)
    if (!decoded) {
      throw Object.assign(new Error('Invalid or expired cursor'), { status: 403 })
    }

    const [session] = await db
      .select()
      .from(recommendationHomeSessions)
      .where(eq(recommendationHomeSessions.id, decoded.sessionId))
      .limit(1)

    if (!session || session.profileId !== profileId) {
      throw Object.assign(new Error('Cursor profile mismatch'), { status: 403 })
    }

    const { shelves: batchRows, newNextPosition, hasMore } = await serveBatch(
      decoded.sessionId,
      decoded.nextPosition,
      HOME_BATCH_SIZE,
    )

    const generatedShelves = await batchRowsToShelfResponses(batchRows)

    if ((await countUnserved(decoded.sessionId)) < HOME_POOL_MIN) {
      fillPool(decoded.sessionId, profileId, HOME_POOL_TARGET)
    }

    return {
      coldStart: false,
      sessionId: decoded.sessionId,
      shelves: generatedShelves,
      nextCursor: hasMore ? signCursor(decoded.sessionId, newNextPosition) : null,
    }
  }

  // ── First request (no cursor) ─────────────────────────────────────────────
  const session = await getOrCreateSession(profileId)

  const [fixed, initialUnserved] = await Promise.all([
    buildFixedShelves(profileId),
    countUnserved(session.id),
  ])

  // If pool is empty synchronously fill it on first load (user waits once).
  if (initialUnserved === 0 && session.cursorReference !== 'exhausted') {
    try {
      await fillPoolAsync(session.id, profileId, HOME_POOL_TARGET)
    } catch (err) {
      console.error('[home-service] sync fillPool failed, will use fallback:', err)
    }
  }

  const afterFillUnserved = await countUnserved(session.id)
  let coldStart = false
  let generatedShelves: ShelfResponse[] = []

  if (afterFillUnserved > 0) {
    const { shelves: batchRows } = await serveBatch(session.id, 0, HOME_BATCH_SIZE)
    generatedShelves = await batchRowsToShelfResponses(batchRows)
  } else {
    coldStart = true
    try {
      const fallback = await buildFallbackShelf()
      if (fallback.items.length > 0) generatedShelves = [fallback]
    } catch (err) {
      console.error('[home-service] fallback shelf failed:', err)
    }
  }

  // Persist fixed shelves into session for cross-shelf dedup (fire-and-forget).
  if (fixed.length > 0) {
    persistFixedShelvesForSession(profileId, session.id, fixed).catch((err) => {
      console.error('[home-service] persistFixedShelves error (swallowed):', err)
    })
  }

  // Replenish pool asynchronously if running low.
  const remaining = await countUnserved(session.id)
  if (remaining < HOME_POOL_MIN) {
    fillPool(session.id, profileId, HOME_POOL_TARGET)
  }

  const hasMore = remaining > 0 || session.cursorReference !== 'exhausted'
  const nextPosition = generatedShelves.length

  return {
    coldStart,
    sessionId: session.id,
    shelves: [...fixed, ...generatedShelves],
    nextCursor: hasMore && generatedShelves.length > 0 ? signCursor(session.id, nextPosition) : null,
  }
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
  const movieIds = allItems.filter((i) => i.mediaType === 'MOVIE').map((i) => i.mediaId)
  const seriesIds = allItems.filter((i) => i.mediaType === 'SERIES').map((i) => i.mediaId)

  const [movieRows, seriesRows, movieTrailerRows, seriesTrailerRows] = await Promise.all([
    movieIds.length > 0
      ? db.select({ id: movies.id, title: movies.title, posterPath: movies.posterPath }).from(movies).where(inArray(movies.id, movieIds))
      : Promise.resolve([]),
    seriesIds.length > 0
      ? db.select({ id: series.id, title: series.title, posterPath: series.posterPath }).from(series).where(inArray(series.id, seriesIds))
      : Promise.resolve([]),
    movieIds.length > 0
      ? db.select({ mediaId: mediaVideos.mediaId, youtubeKey: mediaVideos.youtubeKey }).from(mediaVideos).where(and(eq(mediaVideos.mediaType, 'movie'), inArray(mediaVideos.mediaId, movieIds)))
      : Promise.resolve([]),
    seriesIds.length > 0
      ? db.select({ mediaId: mediaVideos.mediaId, youtubeKey: mediaVideos.youtubeKey }).from(mediaVideos).where(and(eq(mediaVideos.mediaType, 'series'), inArray(mediaVideos.mediaId, seriesIds)))
      : Promise.resolve([]),
  ])

  const titleMap = new Map<string, string>()
  const posterMap = new Map<string, string | null>()
  for (const r of movieRows) { titleMap.set(r.id, r.title); posterMap.set(r.id, r.posterPath) }
  for (const r of seriesRows) { titleMap.set(r.id, r.title); posterMap.set(r.id, r.posterPath) }

  const trailerKeyMap = new Map<string, string>()
  for (const r of [...movieTrailerRows, ...seriesTrailerRows]) {
    if (!trailerKeyMap.has(r.mediaId)) trailerKeyMap.set(r.mediaId, r.youtubeKey)
  }

  return batchRows.map((row) => ({
    id: row.instanceId,
    title: row.title,
    type: 'GENERATED' as const,
    layoutHint: 'ROW' as const,
    shelfInstanceId: row.instanceId,
    items: row.items.map((item): ShelfItem => ({
      mediaType: item.mediaType as 'MOVIE' | 'SERIES',
      mediaId: item.mediaId,
      title: titleMap.get(item.mediaId) ?? '',
      posterUrl: resolveMediaImageUrl(posterMap.get(item.mediaId) ?? null),
      trailerKey: trailerKeyMap.get(item.mediaId) ?? null,
    })),
  }))
}
