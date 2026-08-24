import { resolveMediaImageUrl } from '../lib/tmdb-image.js'
import { eq, and, inArray, asc } from 'drizzle-orm'
import { db } from '../db/client.js'
import {
  mediaVideos,
  recommendationHomeSessions,
  movies,
  series,
  shelfInstances,
  shelfInstanceItems,
} from '../db/schema/index.js'
import { signCursor, verifyCursor } from '../lib/home-cursor.js'
import {
  getOrCreateSession,
  countUnserved,
  serveBatch,
  buildDeclaredRails,
  fillPool,
  buildFallbackShelf,
} from './home-pool-service.js'
import {
  getSnapshot,
  saveSnapshot,
  isSnapshotValid,
  isStale,
} from './home-snapshot-service.js'
import { getShelf } from './shelf-service.js'
import {
  HOME_BATCH_SIZE,
  HOME_POOL_MIN,
  HOME_POOL_TARGET,
  HOME_SNAPSHOT_TTL_HOURS,
} from '../config/env.js'
import type { HomePageResponse, ShelfResponse, ShelfItem, HeroItem } from '@iptvflix/api-contracts'

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
      hero: null,
    }
  }

  // ── First request (no cursor) ─────────────────────────────────────────────
  const session = await getOrCreateSession(profileId)
  const snapshot = await getSnapshot(profileId)

  // ── HIT: valid snapshot exists ────────────────────────────────────────────
  if (snapshot && isSnapshotValid(snapshot)) {
    console.log(`[HOME_SNAPSHOT] HIT profileId=${profileId}`)
    const shelves = await reconstructShelvesFromSnapshot(profileId, snapshot.declaredShelfInstanceIds)
    const hero = await reconstructHero(snapshot.heroMediaId, snapshot.heroMediaType)
    const hasMore = session.cursorReference !== 'exhausted'
    const nextPosition = snapshot.declaredShelfInstanceIds.length
    return {
      coldStart: shelves.length === 0,
      sessionId: session.id,
      shelves,
      nextCursor: hasMore && shelves.length > 0 ? signCursor(session.id, nextPosition) : null,
      hero,
    }
  }

  // ── STALE: serve previous snapshot while regenerating async ───────────────
  if (snapshot && isStale(snapshot)) {
    console.log(`[HOME_SNAPSHOT] STALE_SERVED profileId=${profileId} regeneration=triggered`)
    const shelves = await reconstructShelvesFromSnapshot(profileId, snapshot.declaredShelfInstanceIds)
    const hero = await reconstructHero(snapshot.heroMediaId, snapshot.heroMediaType)
    const hasMore = session.cursorReference !== 'exhausted'
    const nextPosition = snapshot.declaredShelfInstanceIds.length

    // Kick off async regeneration (fire-and-forget)
    _regenerateSnapshot(profileId, session.id).catch((err) => {
      console.error('[HOME_SNAPSHOT] async regeneration error:', err)
    })
    fillPool(session.id, profileId, HOME_POOL_TARGET)

    return {
      coldStart: shelves.length === 0,
      sessionId: session.id,
      shelves,
      nextCursor: hasMore && shelves.length > 0 ? signCursor(session.id, nextPosition) : null,
      hero,
    }
  }

  // ── MISS: no usable snapshot — build declared rails ───────────────────────
  console.log(`[HOME_SNAPSHOT] MISS profileId=${profileId}`)

  let shelves: ShelfResponse[] = []
  let nextPoolPosition = 0
  let hero: HeroItem | null = null

  try {
    const declared = await buildDeclaredRails(profileId, session.id)
    shelves = declared.shelves
    nextPoolPosition = declared.nextPoolPosition
    hero = declared.hero

    const expiresAt = new Date(Date.now() + HOME_SNAPSHOT_TTL_HOURS * 60 * 60 * 1000)
    saveSnapshot(
      profileId,
      session.id,
      declared.shelfInstanceIds,
      expiresAt,
      hero?.mediaId ?? null,
      hero?.mediaType ?? null,
    ).catch((err) => {
      console.error('[HOME_SNAPSHOT] saveSnapshot error (swallowed):', err)
    })
  } catch (err) {
    console.error('[home-service] buildDeclaredRails failed:', err)
  }

  const coldStart = shelves.length === 0
  if (coldStart) {
    try {
      const fallback = await buildFallbackShelf()
      if (fallback.items.length > 0) shelves = [fallback]
    } catch (err) {
      console.error('[home-service] fallback shelf failed:', err)
    }
  }

  // Kick off pool fill for subsequent infinite-scroll pages (fire-and-forget).
  fillPool(session.id, profileId, HOME_POOL_TARGET)

  const hasMore = session.cursorReference !== 'exhausted'

  return {
    coldStart,
    sessionId: session.id,
    shelves,
    nextCursor: hasMore && shelves.length > 0 ? signCursor(session.id, nextPoolPosition) : null,
    hero,
  }
}

// ---------------------------------------------------------------------------
// Internal: regenerate snapshot async
// ---------------------------------------------------------------------------

async function _regenerateSnapshot(profileId: string, sessionId: string): Promise<void> {
  try {
    const declared = await buildDeclaredRails(profileId, sessionId)
    const expiresAt = new Date(Date.now() + HOME_SNAPSHOT_TTL_HOURS * 60 * 60 * 1000)
    await saveSnapshot(
      profileId,
      sessionId,
      declared.shelfInstanceIds,
      expiresAt,
      declared.hero?.mediaId ?? null,
      declared.hero?.mediaType ?? null,
    )
  } catch (err) {
    console.error('[HOME_SNAPSHOT] regeneration failed:', err)
  }
}

// ---------------------------------------------------------------------------
// Internal: reconstruct shelves from snapshot shelf_instance_ids
// ---------------------------------------------------------------------------

async function reconstructShelvesFromSnapshot(
  profileId: string,
  shelfInstanceIds: string[],
): Promise<ShelfResponse[]> {
  if (shelfInstanceIds.length === 0) return []

  // Add live CW shelf first (always fresh)
  const cwShelf = await getShelf('sys_continue_watching', profileId).catch(() => null)

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

  // Preserve snapshot order
  const idOrder = new Map(shelfInstanceIds.map((id, i) => [id, i]))
  const sorted = [...instanceRows].sort((a, b) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0))

  const batchRows = sorted.map((r) => ({
    instanceId: r.id,
    title: r.title,
    verticalPosition: r.verticalPosition ?? 0,
    items: (itemsByInstance.get(r.id) ?? []).map((i) => ({ mediaType: i.mediaType, mediaId: i.mediaId })),
  }))

  const generatedShelves = await batchRowsToShelfResponses(batchRows)

  const result: ShelfResponse[] = []
  if (cwShelf && cwShelf.items.length > 0) result.push(cwShelf)
  result.push(...generatedShelves)
  return result
}

// ---------------------------------------------------------------------------
// Internal: reconstruct hero from snapshot hero_media_id / hero_media_type
// ---------------------------------------------------------------------------

async function reconstructHero(
  heroMediaId: string | null,
  heroMediaType: string | null,
): Promise<HeroItem | null> {
  if (!heroMediaId || !heroMediaType) return null

  if (heroMediaType === 'MOVIE') {
    const [movie] = await db
      .select({ id: movies.id, title: movies.title, synopsis: movies.synopsis, backdropPath: movies.backdropPath })
      .from(movies)
      .where(eq(movies.id, heroMediaId))
      .limit(1)
    if (!movie) return null

    const [trailer] = await db
      .select({ youtubeKey: mediaVideos.youtubeKey })
      .from(mediaVideos)
      .where(and(eq(mediaVideos.mediaType, 'movie'), eq(mediaVideos.mediaId, heroMediaId)))
      .limit(1)

    const backdropUrl = resolveMediaImageUrl(movie.backdropPath)
    if (!backdropUrl) return null

    return {
      mediaId: movie.id,
      mediaType: 'MOVIE',
      title: movie.title,
      synopsis: movie.synopsis ?? null,
      backdropUrl,
      availabilityStatus: 'AVAILABLE',
      trailerKey: trailer?.youtubeKey ?? null,
    }
  }

  if (heroMediaType === 'SERIES') {
    const [show] = await db
      .select({ id: series.id, title: series.title, synopsis: series.synopsis, backdropPath: series.backdropPath })
      .from(series)
      .where(eq(series.id, heroMediaId))
      .limit(1)
    if (!show) return null

    const [trailer] = await db
      .select({ youtubeKey: mediaVideos.youtubeKey })
      .from(mediaVideos)
      .where(and(eq(mediaVideos.mediaType, 'series'), eq(mediaVideos.mediaId, heroMediaId)))
      .limit(1)

    const backdropUrl = resolveMediaImageUrl(show.backdropPath)
    if (!backdropUrl) return null

    return {
      mediaId: show.id,
      mediaType: 'SERIES',
      title: show.title,
      synopsis: show.synopsis ?? null,
      backdropUrl,
      availabilityStatus: 'AVAILABLE',
      trailerKey: trailer?.youtubeKey ?? null,
    }
  }

  return null
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
