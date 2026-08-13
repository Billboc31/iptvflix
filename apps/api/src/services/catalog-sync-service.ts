import { and, eq, inArray, isNotNull, lt } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { db } from '../db/client.js'
import { movies } from '../db/schema/movies.js'
import { series } from '../db/schema/series.js'
import { seasons } from '../db/schema/seasons.js'
import { episodes } from '../db/schema/episodes.js'
import {
  movieAvailabilities,
  seriesAvailabilities,
  episodeAvailabilities,
} from '../db/schema/availabilities.js'
import { syncRuns } from '../db/schema/sync-runs.js'
import { titleMatchResults } from '../db/schema/title-match-results.js'
import { releaseEvents } from '../db/schema/release-lifecycle.js'
import type { XtreamCatalogSnapshot } from '../providers/xtream/types.js'
import { normalizeTitle } from '../matching/title-normalizer.js'
import type { PlexCatalogSnapshot, PlexGuid } from '../providers/plex/types.js'
import type { M3UCatalogSnapshot } from '../providers/m3u/types.js'
import { TitleMatchingService, type MatchItemInput } from './title-matching-service.js'

const MATCH_CONCURRENCY = parseInt(process.env.MATCH_CONCURRENCY ?? '5', 10) || 5
const MATCH_THROTTLE_MS = parseInt(process.env.MATCH_THROTTLE_MS ?? '250', 10) || 0

export interface CatalogSyncResult {
  runId: string
  status: 'completed' | 'failed'
  counts: {
    moviesCreated: number
    moviesUpdated: number
    seriesCreated: number
    seriesUpdated: number
    unavailableCount: number
    failedCount: number
    titleMatchedCount: number
    titleUnmatchedCount: number
  }
  error?: string
}

export class SyncAlreadyRunningError extends Error {
  constructor(sourceId: string) {
    super(`Sync already running for source ${sourceId}`)
    this.name = 'SyncAlreadyRunningError'
  }
}

interface NormalizedMovieItem {
  providerItemId: string
  title: string
  posterPath?: string | null
  synopsis?: string | null
  tmdb?: string
  rawTitle?: string | null
  audioLanguage?: string | null
  subtitleLanguage?: string | null
  videoQuality?: string | null
}

interface NormalizedSeriesItem {
  providerItemId: string
  title: string
  posterPath?: string | null
  synopsis?: string | null
  tmdb?: string
  firstAirYear?: number | null
  rawTitle?: string | null
  audioLanguage?: string | null
  subtitleLanguage?: string | null
  videoQuality?: string | null
}

interface NormalizedEpisodeItem {
  providerItemId: string
  seriesProviderItemId: string
  seasonNumber: number
  episodeNumber: number
  title?: string | null
  synopsis?: string | null
  durationMinutes?: number | null
  airDate?: string | null
  rawTitle?: string | null
  audioLanguage?: string | null
  subtitleLanguage?: string | null
  videoQuality?: string | null
  containerExtension?: string | null
}

interface NormalizedSnapshot {
  sourceId: string
  fetchedAt: Date
  movies: NormalizedMovieItem[]
  series: NormalizedSeriesItem[]
  /** undefined = provider does not supply episode data; no lifecycle action taken */
  episodes?: NormalizedEpisodeItem[]
  /** Series whose episode fetch failed — their episodes must not be marked UNAVAILABLE */
  failedSeriesProviderIds?: string[]
  /** When true, skip UNAVAILABLE lifecycle marking for movies, series, and episodes (used by backfill) */
  skipLifecycle?: boolean
}

const STALE_LOCK_MS = 2 * 60 * 60 * 1000 // large Xtream catalogs can run for a long time
/** Items committed per DB transaction — keeps progress visible and avoids multi-hour locks. */
const SYNC_CHUNK_SIZE = Math.max(50, parseInt(process.env.SYNC_CHUNK_SIZE ?? '500', 10) || 500)

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0]

type MovieAvRow = {
  id: string
  movieId: string
  status: string
}

type SeriesAvRow = {
  id: string
  seriesId: string
  status: string
}

function isUniqueConstraintViolation(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false
  const code =
    (err as { code?: string }).code ??
    (err as { cause?: { code?: string } }).cause?.code
  return code === '23505'
}

/** Clear stale RUNNING locks and insert a new RUNNING sync_run. */
export async function acquireSyncRunLock(sourceId: string): Promise<string> {
  const staleThreshold = new Date(Date.now() - STALE_LOCK_MS)
  await db
    .update(syncRuns)
    .set({ status: 'FAILED', completedAt: new Date(), errorMessage: 'stale lock cleared' })
    .where(
      and(
        eq(syncRuns.sourceId, sourceId),
        eq(syncRuns.status, 'RUNNING'),
        lt(syncRuns.startedAt, staleThreshold),
      ),
    )

  try {
    const [run] = await db
      .insert(syncRuns)
      .values({ sourceId, status: 'RUNNING' })
      .returning()
    return run.id
  } catch (err) {
    if (isUniqueConstraintViolation(err)) {
      throw new SyncAlreadyRunningError(sourceId)
    }
    throw err
  }
}

export async function failSyncRun(runId: string, errorMessage: string): Promise<void> {
  await db
    .update(syncRuns)
    .set({ status: 'FAILED', completedAt: new Date(), errorMessage })
    .where(eq(syncRuns.id, runId))
}

/** Postgres `integer` / Drizzle `integer()` range (signed int4). */
const PG_INT4_MAX = 2_147_483_647

/**
 * Parse a provider "tmdb" field into a storable id.
 * Xtream often sends garbage (stream ids, etc.) larger than int4 — reject those
 * so sync does not die with `integer out of range` on `movies.tmdb_id`.
 */
function parseTmdbId(tmdb: string | undefined): number | null {
  if (!tmdb) return null
  const n = parseInt(tmdb, 10)
  if (Number.isNaN(n) || n <= 0 || n > PG_INT4_MAX) return null
  return n
}

function parseYear(dateStr: string | undefined): number | null {
  if (!dateStr || dateStr.length < 4) return null
  const n = parseInt(dateStr.substring(0, 4), 10)
  return isNaN(n) ? null : n
}

function extractPlexTmdbId(guids: PlexGuid[] | undefined): string | undefined {
  const found = guids?.find((g) => g.id.startsWith('tmdb://'))
  return found ? found.id.slice('tmdb://'.length) : undefined
}

async function resolveMovieId(
  tx: DbTx,
  item: NormalizedMovieItem,
  tmdbCache?: Map<number, string>,
): Promise<string> {
  const tmdbId = parseTmdbId(item.tmdb)

  if (tmdbId != null) {
    const cached = tmdbCache?.get(tmdbId)
    if (cached) return cached

    const [existingByTmdb] = await tx
      .select({ id: movies.id })
      .from(movies)
      .where(eq(movies.tmdbId, tmdbId))
      .limit(1)
    if (existingByTmdb) {
      tmdbCache?.set(tmdbId, existingByTmdb.id)
      return existingByTmdb.id
    }

    const inserted = await tx
      .insert(movies)
      .values({
        title: item.title,
        posterPath: item.posterPath ?? null,
        synopsis: item.synopsis ?? null,
        year: null,
        tmdbId,
        matchStatus: 'MATCHED',
      })
      .onConflictDoNothing({ target: movies.tmdbId })
      .returning({ id: movies.id })

    if (inserted[0]) {
      tmdbCache?.set(tmdbId, inserted[0].id)
      return inserted[0].id
    }

    const [row] = await tx
      .select({ id: movies.id })
      .from(movies)
      .where(eq(movies.tmdbId, tmdbId))
      .limit(1)
    if (row) {
      tmdbCache?.set(tmdbId, row.id)
      return row.id
    }
    throw new Error(`Failed to resolve movie for tmdbId=${tmdbId}`)
  }

  const [inserted] = await tx
    .insert(movies)
    .values({
      title: item.title,
      posterPath: item.posterPath ?? null,
      synopsis: item.synopsis ?? null,
      year: null,
      tmdbId: null,
      matchStatus: 'UNMATCHED',
    })
    .returning({ id: movies.id })
  return inserted.id
}

async function resolveSeriesId(
  tx: DbTx,
  item: NormalizedSeriesItem,
  tmdbCache?: Map<number, string>,
): Promise<string> {
  const tmdbId = parseTmdbId(item.tmdb)

  if (tmdbId != null) {
    const cached = tmdbCache?.get(tmdbId)
    if (cached) return cached

    const [existingByTmdb] = await tx
      .select({ id: series.id })
      .from(series)
      .where(eq(series.tmdbId, tmdbId))
      .limit(1)
    if (existingByTmdb) {
      tmdbCache?.set(tmdbId, existingByTmdb.id)
      return existingByTmdb.id
    }

    const inserted = await tx
      .insert(series)
      .values({
        title: item.title,
        posterPath: item.posterPath ?? null,
        synopsis: item.synopsis ?? null,
        firstAirYear: item.firstAirYear ?? null,
        tmdbId,
        matchStatus: 'MATCHED',
      })
      .onConflictDoNothing({ target: series.tmdbId })
      .returning({ id: series.id })

    if (inserted[0]) {
      tmdbCache?.set(tmdbId, inserted[0].id)
      return inserted[0].id
    }

    const [row] = await tx
      .select({ id: series.id })
      .from(series)
      .where(eq(series.tmdbId, tmdbId))
      .limit(1)
    if (row) {
      tmdbCache?.set(tmdbId, row.id)
      return row.id
    }
    throw new Error(`Failed to resolve series for tmdbId=${tmdbId}`)
  }

  const [inserted] = await tx
    .insert(series)
    .values({
      title: item.title,
      posterPath: item.posterPath ?? null,
      synopsis: item.synopsis ?? null,
      firstAirYear: item.firstAirYear ?? null,
      tmdbId: null,
      matchStatus: 'UNMATCHED',
    })
    .returning({ id: series.id })
  return inserted.id
}

async function resolveEpisodeId(
  tx: DbTx,
  seriesId: string,
  seasonNumber: number,
  episodeNumber: number,
  meta?: { title?: string | null; synopsis?: string | null; durationMinutes?: number | null; airDate?: string | null },
): Promise<string> {
  let seasonId: string
  const [existingSeason] = await tx
    .select({ id: seasons.id })
    .from(seasons)
    .where(and(eq(seasons.seriesId, seriesId), eq(seasons.seasonNumber, seasonNumber)))
    .limit(1)

  if (existingSeason) {
    seasonId = existingSeason.id
  } else {
    const inserted = await tx
      .insert(seasons)
      .values({ seriesId, seasonNumber })
      .onConflictDoNothing()
      .returning({ id: seasons.id })
    if (inserted[0]) {
      seasonId = inserted[0].id
    } else {
      const [row] = await tx
        .select({ id: seasons.id })
        .from(seasons)
        .where(and(eq(seasons.seriesId, seriesId), eq(seasons.seasonNumber, seasonNumber)))
        .limit(1)
      if (!row) throw new Error(`Failed to resolve season seriesId=${seriesId} season=${seasonNumber}`)
      seasonId = row.id
    }
  }

  const [existingEpisode] = await tx
    .select({ id: episodes.id })
    .from(episodes)
    .where(and(eq(episodes.seasonId, seasonId), eq(episodes.episodeNumber, episodeNumber)))
    .limit(1)

  if (existingEpisode) {
    if (meta) {
      const updates: Partial<typeof episodes.$inferInsert> = {}
      if (meta.title != null) updates.title = meta.title
      if (meta.synopsis != null) updates.synopsis = meta.synopsis
      if (meta.durationMinutes != null) updates.durationMinutes = meta.durationMinutes
      if (meta.airDate != null) updates.airDate = meta.airDate
      if (Object.keys(updates).length > 0) {
        updates.updatedAt = new Date()
        await tx.update(episodes).set(updates).where(eq(episodes.id, existingEpisode.id))
      }
    }
    return existingEpisode.id
  }

  const insertedEp = await tx
    .insert(episodes)
    .values({
      seasonId,
      seriesId,
      episodeNumber,
      title: meta?.title ?? null,
      synopsis: meta?.synopsis ?? null,
      durationMinutes: meta?.durationMinutes ?? null,
      airDate: meta?.airDate ?? null,
    })
    .onConflictDoNothing()
    .returning({ id: episodes.id })
  if (insertedEp[0]) return insertedEp[0].id

  const [row] = await tx
    .select({ id: episodes.id })
    .from(episodes)
    .where(and(eq(episodes.seasonId, seasonId), eq(episodes.episodeNumber, episodeNumber)))
    .limit(1)
  if (!row) throw new Error(`Failed to resolve episode seasonId=${seasonId} episode=${episodeNumber}`)
  return row.id
}

async function persistSyncRunProgress(
  runId: string,
  counts: CatalogSyncResult['counts'],
): Promise<void> {
  await db
    .update(syncRuns)
    .set({
      moviesCreated: counts.moviesCreated,
      moviesUpdated: counts.moviesUpdated,
      seriesCreated: counts.seriesCreated,
      seriesUpdated: counts.seriesUpdated,
      unavailableCount: counts.unavailableCount,
      failedCount: counts.failedCount,
      titleMatchedCount: counts.titleMatchedCount,
      titleUnmatchedCount: counts.titleUnmatchedCount,
    })
    .where(eq(syncRuns.id, runId))
}

async function runTitleMatchPrePass(
  sourceId: string,
  items: Array<{ providerItemId: string; rawTitle: string; mediaType: 'MOVIE' | 'SERIES' }>,
  matchingService: TitleMatchingService,
): Promise<{ prePassMap: Map<string, string | null>; matchedCount: number; unmatchedCount: number }> {
  if (items.length === 0) {
    return { prePassMap: new Map(), matchedCount: 0, unmatchedCount: 0 }
  }

  // Guard: skip items already MATCHED in a previous sync run
  const existingMatched = await db
    .select({ providerItemId: titleMatchResults.providerItemId, movieId: titleMatchResults.movieId, seriesId: titleMatchResults.seriesId })
    .from(titleMatchResults)
    .where(
      and(
        eq(titleMatchResults.providerId, sourceId),
        eq(titleMatchResults.matchState, 'MATCHED'),
        inArray(titleMatchResults.providerItemId, items.map((i) => i.providerItemId)),
      ),
    )

  const prePassMap = new Map<string, string | null>()
  const alreadyMatchedIds = new Set<string>()
  for (const row of existingMatched) {
    const canonicalId = row.movieId ?? row.seriesId ?? null
    prePassMap.set(row.providerItemId, canonicalId)
    alreadyMatchedIds.add(row.providerItemId)
  }

  // Deduplicate by (normalizedTitle, extractedYear) to avoid redundant TMDB calls
  const dedupeKey = (rawTitle: string): string => {
    const { normalizedTitle, extractedYear } = normalizeTitle(rawTitle)
    return `${normalizedTitle}::${extractedYear ?? ''}`
  }
  const dedupeMap = new Map<string, string>() // key → canonicalId (from first resolved item)

  const pendingItems = items.filter((i) => !alreadyMatchedIds.has(i.providerItemId))
  const inputs: MatchItemInput[] = pendingItems.map((i) => ({
    providerId: sourceId,
    providerItemId: i.providerItemId,
    rawTitle: i.rawTitle,
    mediaType: i.mediaType,
  }))

  let matchedCount = existingMatched.filter((r) => (r.movieId ?? r.seriesId) !== null).length
  let unmatchedCount = 0

  const results = await matchingService.matchBatch(inputs, {
    concurrency: MATCH_CONCURRENCY,
    throttleMs: MATCH_THROTTLE_MS,
  })

  for (let idx = 0; idx < results.length; idx++) {
    const result = results[idx]
    const item = pendingItems[idx]
    if (!item || !result) continue

    const key = dedupeKey(item.rawTitle)
    if (result.matchState === 'MATCHED') {
      const canonicalId = result.movieId ?? result.seriesId ?? null
      prePassMap.set(item.providerItemId, canonicalId)
      if (canonicalId) dedupeMap.set(key, canonicalId)
      matchedCount++
    } else {
      // Check dedupe — same normalized title already resolved this sync
      const deduped = dedupeMap.get(key)
      if (deduped) {
        prePassMap.set(item.providerItemId, deduped)
        matchedCount++
      } else {
        prePassMap.set(item.providerItemId, null)
        unmatchedCount++
      }
    }
  }

  return { prePassMap, matchedCount, unmatchedCount }
}

async function syncNormalized(
  sourceId: string,
  snapshot: NormalizedSnapshot,
  existingRunId?: string,
  matchingService?: TitleMatchingService,
): Promise<CatalogSyncResult> {
  // Acquire lock by inserting a RUNNING run record (unless caller already did).
  let runId: string
  if (existingRunId) {
    runId = existingRunId
  } else {
    runId = await acquireSyncRunLock(sourceId)
  }

  const counts: CatalogSyncResult['counts'] = {
    moviesCreated: 0,
    moviesUpdated: 0,
    seriesCreated: 0,
    seriesUpdated: 0,
    unavailableCount: 0,
    failedCount: snapshot.failedSeriesProviderIds?.length ?? 0,
    titleMatchedCount: 0,
    titleUnmatchedCount: 0,
  }
  let syncError: Error | undefined

  try {
    // Prefetch maps once — avoids 1 SELECT per catalog item on large Xtream syncs.
    const prevMovieRows = await db
      .select({
        id: movieAvailabilities.id,
        movieId: movieAvailabilities.movieId,
        providerItemId: movieAvailabilities.providerItemId,
        status: movieAvailabilities.status,
      })
      .from(movieAvailabilities)
      .where(eq(movieAvailabilities.providerId, sourceId))
    const movieAvByProviderItemId = new Map<string, MovieAvRow>()
    const previouslyAvailableMovieIds = new Set<string>()
    for (const row of prevMovieRows) {
      movieAvByProviderItemId.set(row.providerItemId, {
        id: row.id,
        movieId: row.movieId,
        status: row.status,
      })
      if (row.status === 'AVAILABLE') previouslyAvailableMovieIds.add(row.providerItemId)
    }

    const prevSeriesRows = await db
      .select({
        id: seriesAvailabilities.id,
        seriesId: seriesAvailabilities.seriesId,
        providerItemId: seriesAvailabilities.providerItemId,
        status: seriesAvailabilities.status,
      })
      .from(seriesAvailabilities)
      .where(eq(seriesAvailabilities.providerId, sourceId))
    const seriesAvByProviderItemId = new Map<string, SeriesAvRow>()
    const previouslyAvailableSeriesIds = new Set<string>()
    for (const row of prevSeriesRows) {
      seriesAvByProviderItemId.set(row.providerItemId, {
        id: row.id,
        seriesId: row.seriesId,
        status: row.status,
      })
      if (row.status === 'AVAILABLE') previouslyAvailableSeriesIds.add(row.providerItemId)
    }

    const movieTmdbRows = await db
      .select({ id: movies.id, tmdbId: movies.tmdbId })
      .from(movies)
      .where(isNotNull(movies.tmdbId))
    const movieTmdbCache = new Map<number, string>()
    for (const row of movieTmdbRows) {
      if (row.tmdbId != null) movieTmdbCache.set(row.tmdbId, row.id)
    }

    const seriesTmdbRows = await db
      .select({ id: series.id, tmdbId: series.tmdbId })
      .from(series)
      .where(isNotNull(series.tmdbId))
    const seriesTmdbCache = new Map<number, string>()
    for (const row of seriesTmdbRows) {
      if (row.tmdbId != null) seriesTmdbCache.set(row.tmdbId, row.id)
    }

    // Title-matching pre-pass: resolve canonical IDs for items without a TMDB ID
    let moviePrePassMap = new Map<string, string | null>()
    let seriesPrePassMap = new Map<string, string | null>()
    if (matchingService) {
      const moviesWithoutTmdb = snapshot.movies
        .filter((m) => !movieAvByProviderItemId.has(m.providerItemId) && !parseTmdbId(m.tmdb))
        .map((m) => ({ providerItemId: m.providerItemId, rawTitle: m.rawTitle ?? m.title, mediaType: 'MOVIE' as const }))

      const seriesWithoutTmdb = snapshot.series
        .filter((s) => !seriesAvByProviderItemId.has(s.providerItemId) && !parseTmdbId(s.tmdb))
        .map((s) => ({ providerItemId: s.providerItemId, rawTitle: s.rawTitle ?? s.title, mediaType: 'SERIES' as const }))

      const [moviePass, seriesPass] = await Promise.all([
        runTitleMatchPrePass(sourceId, moviesWithoutTmdb, matchingService).catch(() => ({
          prePassMap: new Map<string, string | null>(),
          matchedCount: 0,
          unmatchedCount: moviesWithoutTmdb.length,
        })),
        runTitleMatchPrePass(sourceId, seriesWithoutTmdb, matchingService).catch(() => ({
          prePassMap: new Map<string, string | null>(),
          matchedCount: 0,
          unmatchedCount: seriesWithoutTmdb.length,
        })),
      ])
      moviePrePassMap = moviePass.prePassMap
      seriesPrePassMap = seriesPass.prePassMap
      counts.titleMatchedCount += moviePass.matchedCount + seriesPass.matchedCount
      counts.titleUnmatchedCount += moviePass.unmatchedCount + seriesPass.unmatchedCount
    }

    const seenMovieProviderItemIds = new Set<string>()
    const totalMovies = snapshot.movies.length
    console.info(
      `[catalog-sync] upserting ${totalMovies} movies + ${snapshot.series.length} series ` +
        `(chunk=${SYNC_CHUNK_SIZE})`,
    )

    for (let offset = 0; offset < totalMovies; offset += SYNC_CHUNK_SIZE) {
      const chunk = snapshot.movies.slice(offset, offset + SYNC_CHUNK_SIZE)
      await db.transaction(async (tx) => {
        const moviesToInsert: (typeof movies.$inferInsert)[] = []
        const newAvails: (typeof movieAvailabilities.$inferInsert)[] = []
        const appearEvents: (typeof releaseEvents.$inferInsert)[] = []

        for (const movie of chunk) {
          const providerItemId = movie.providerItemId
          const existing = movieAvByProviderItemId.get(providerItemId)

          if (!existing) {
            const tmdbId = parseTmdbId(movie.tmdb)
            let movieId: string
            if (tmdbId != null) {
              movieId = await resolveMovieId(tx, movie, movieTmdbCache)
            } else {
              const prePassId = moviePrePassMap.get(providerItemId)
              if (prePassId != null) {
                // Title match found a canonical movie for this item
                movieId = prePassId
              } else {
                // No TMDB ID and no title match — create an UNMATCHED local skeleton
                movieId = randomUUID()
                moviesToInsert.push({
                  id: movieId,
                  title: movie.title,
                  posterPath: movie.posterPath ?? null,
                  synopsis: movie.synopsis ?? null,
                  year: null,
                  tmdbId: null,
                  matchStatus: 'UNMATCHED',
                })
              }
            }
            const avId = randomUUID()
            newAvails.push({
              id: avId,
              movieId,
              providerId: sourceId,
              providerItemId,
              firstSeenAt: snapshot.fetchedAt,
              lastSeenAt: snapshot.fetchedAt,
              status: 'AVAILABLE',
              rawTitle: movie.rawTitle ?? null,
              audioLanguage: movie.audioLanguage ?? null,
              subtitleLanguage: movie.subtitleLanguage ?? null,
              videoQuality: movie.videoQuality ?? null,
            })
            appearEvents.push({
              mediaType: 'MOVIE',
              mediaId: movieId,
              eventType: 'SOURCE_APPEARED',
              occurredAt: snapshot.fetchedAt,
              sourceId,
            })
            movieAvByProviderItemId.set(providerItemId, {
              id: avId,
              movieId,
              status: 'AVAILABLE',
            })
            counts.moviesCreated++
          } else {
            const wasUnavailable = existing.status === 'UNAVAILABLE'
            await tx
              .update(movieAvailabilities)
              .set({
                lastSeenAt: snapshot.fetchedAt,
                status: 'AVAILABLE',
                unavailableAt: null,
                rawTitle: movie.rawTitle ?? null,
                audioLanguage: movie.audioLanguage ?? null,
                subtitleLanguage: movie.subtitleLanguage ?? null,
                videoQuality: movie.videoQuality ?? null,
              })
              .where(eq(movieAvailabilities.id, existing.id))
            if (wasUnavailable) {
              appearEvents.push({
                mediaType: 'MOVIE',
                mediaId: existing.movieId,
                eventType: 'SOURCE_APPEARED',
                occurredAt: snapshot.fetchedAt,
                sourceId,
              })
            }
            existing.status = 'AVAILABLE'
            counts.moviesUpdated++
          }
          seenMovieProviderItemIds.add(providerItemId)
        }

        if (moviesToInsert.length > 0) {
          await tx.insert(movies).values(moviesToInsert)
        }
        if (newAvails.length > 0) {
          await tx.insert(movieAvailabilities).values(newAvails)
        }
        if (appearEvents.length > 0) {
          await tx.insert(releaseEvents).values(appearEvents).onConflictDoNothing()
        }
      })

      const done = Math.min(offset + SYNC_CHUNK_SIZE, totalMovies)
      if (done === totalMovies || done % (SYNC_CHUNK_SIZE * 4) === 0 || offset === 0) {
        await persistSyncRunProgress(runId, counts)
        console.info(`[catalog-sync] movies ${done}/${totalMovies} (created=${counts.moviesCreated})`)
      }
    }

    const seenSeriesProviderItemIds = new Set<string>()
    const totalSeries = snapshot.series.length
    for (let offset = 0; offset < totalSeries; offset += SYNC_CHUNK_SIZE) {
      const chunk = snapshot.series.slice(offset, offset + SYNC_CHUNK_SIZE)
      await db.transaction(async (tx) => {
        const seriesToInsert: (typeof series.$inferInsert)[] = []
        const newAvails: (typeof seriesAvailabilities.$inferInsert)[] = []
        const appearEvents: (typeof releaseEvents.$inferInsert)[] = []

        for (const s of chunk) {
          const providerItemId = s.providerItemId
          const existing = seriesAvByProviderItemId.get(providerItemId)

          if (!existing) {
            const tmdbId = parseTmdbId(s.tmdb)
            let seriesId: string
            if (tmdbId != null) {
              seriesId = await resolveSeriesId(tx, s, seriesTmdbCache)
            } else {
              const prePassId = seriesPrePassMap.get(providerItemId)
              if (prePassId != null) {
                // Title match found a canonical series for this item
                seriesId = prePassId
              } else {
                // No TMDB ID and no title match — create an UNMATCHED local skeleton
                seriesId = randomUUID()
                seriesToInsert.push({
                  id: seriesId,
                  title: s.title,
                  posterPath: s.posterPath ?? null,
                  synopsis: s.synopsis ?? null,
                  firstAirYear: s.firstAirYear ?? null,
                  tmdbId: null,
                  matchStatus: 'UNMATCHED',
                })
              }
            }
            const avId = randomUUID()
            newAvails.push({
              id: avId,
              seriesId,
              providerId: sourceId,
              providerItemId,
              firstSeenAt: snapshot.fetchedAt,
              lastSeenAt: snapshot.fetchedAt,
              status: 'AVAILABLE',
              rawTitle: s.rawTitle ?? null,
              audioLanguage: s.audioLanguage ?? null,
              subtitleLanguage: s.subtitleLanguage ?? null,
              videoQuality: s.videoQuality ?? null,
            })
            appearEvents.push({
              mediaType: 'SERIES',
              mediaId: seriesId,
              eventType: 'SOURCE_APPEARED',
              occurredAt: snapshot.fetchedAt,
              sourceId,
            })
            seriesAvByProviderItemId.set(providerItemId, {
              id: avId,
              seriesId,
              status: 'AVAILABLE',
            })
            counts.seriesCreated++
          } else {
            const wasUnavailable = existing.status === 'UNAVAILABLE'
            await tx
              .update(seriesAvailabilities)
              .set({
                lastSeenAt: snapshot.fetchedAt,
                status: 'AVAILABLE',
                unavailableAt: null,
                rawTitle: s.rawTitle ?? null,
                audioLanguage: s.audioLanguage ?? null,
                subtitleLanguage: s.subtitleLanguage ?? null,
                videoQuality: s.videoQuality ?? null,
              })
              .where(eq(seriesAvailabilities.id, existing.id))
            if (wasUnavailable) {
              appearEvents.push({
                mediaType: 'SERIES',
                mediaId: existing.seriesId,
                eventType: 'SOURCE_APPEARED',
                occurredAt: snapshot.fetchedAt,
                sourceId,
              })
            }
            existing.status = 'AVAILABLE'
            counts.seriesUpdated++
          }
          seenSeriesProviderItemIds.add(providerItemId)
        }

        if (seriesToInsert.length > 0) {
          await tx.insert(series).values(seriesToInsert)
        }
        if (newAvails.length > 0) {
          await tx.insert(seriesAvailabilities).values(newAvails)
        }
        if (appearEvents.length > 0) {
          await tx.insert(releaseEvents).values(appearEvents).onConflictDoNothing()
        }
      })

      const done = Math.min(offset + SYNC_CHUNK_SIZE, totalSeries)
      if (totalSeries > 0 && (done === totalSeries || done % (SYNC_CHUNK_SIZE * 4) === 0 || offset === 0)) {
        await persistSyncRunProgress(runId, counts)
        console.info(`[catalog-sync] series ${done}/${totalSeries} (created=${counts.seriesCreated})`)
      }
    }

    await db.transaction(async (tx) => {
      // Mark previously available items not in this snapshot as UNAVAILABLE.
      // Skipped in backfill mode to avoid corrupting availability for unrelated items.
      const missingMovieIds = snapshot.skipLifecycle
        ? []
        : [...previouslyAvailableMovieIds].filter((id) => !seenMovieProviderItemIds.has(id))
      if (missingMovieIds.length > 0) {
        const disappearedMovies = await tx
          .update(movieAvailabilities)
          .set({ status: 'UNAVAILABLE', unavailableAt: snapshot.fetchedAt })
          .where(
            and(
              eq(movieAvailabilities.providerId, sourceId),
              eq(movieAvailabilities.status, 'AVAILABLE'),
              inArray(movieAvailabilities.providerItemId, missingMovieIds),
            ),
          )
          .returning({ movieId: movieAvailabilities.movieId })
        if (disappearedMovies.length > 0) {
          await tx
            .insert(releaseEvents)
            .values(
              disappearedMovies.map(({ movieId }) => ({
                mediaType: 'MOVIE' as const,
                mediaId: movieId,
                eventType: 'SOURCE_DISAPPEARED' as const,
                occurredAt: snapshot.fetchedAt,
                sourceId,
              })),
            )
            .onConflictDoNothing()
        }
        counts.unavailableCount += missingMovieIds.length
      }

      const missingSeriesIds = snapshot.skipLifecycle
        ? []
        : [...previouslyAvailableSeriesIds].filter((id) => !seenSeriesProviderItemIds.has(id))
      if (missingSeriesIds.length > 0) {
        const disappearedSeries = await tx
          .update(seriesAvailabilities)
          .set({ status: 'UNAVAILABLE', unavailableAt: snapshot.fetchedAt })
          .where(
            and(
              eq(seriesAvailabilities.providerId, sourceId),
              eq(seriesAvailabilities.status, 'AVAILABLE'),
              inArray(seriesAvailabilities.providerItemId, missingSeriesIds),
            ),
          )
          .returning({ seriesId: seriesAvailabilities.seriesId })
        if (disappearedSeries.length > 0) {
          await tx
            .insert(releaseEvents)
            .values(
              disappearedSeries.map(({ seriesId }) => ({
                mediaType: 'SERIES' as const,
                mediaId: seriesId,
                eventType: 'SOURCE_DISAPPEARED' as const,
                occurredAt: snapshot.fetchedAt,
                sourceId,
              })),
            )
            .onConflictDoNothing()
        }
        counts.unavailableCount += missingSeriesIds.length
      }

      // Episode availability lifecycle — only runs when snapshot carries authoritative episode data.
      // When snapshot.episodes is undefined, existing episode availabilities are left untouched.
      if (snapshot.episodes !== undefined) {
        const prevEpisodeRows = await tx
          .select({ providerItemId: episodeAvailabilities.providerItemId })
          .from(episodeAvailabilities)
          .where(
            and(
              eq(episodeAvailabilities.providerId, sourceId),
              eq(episodeAvailabilities.status, 'AVAILABLE'),
            ),
          )
        const previouslyAvailableEpisodeIds = new Set(
          prevEpisodeRows.map((r) => r.providerItemId),
        )

        const seenEpisodeProviderItemIds = new Set<string>()
        for (const ep of snapshot.episodes) {
          const [seriesAv] = await tx
            .select({ seriesId: seriesAvailabilities.seriesId })
            .from(seriesAvailabilities)
            .where(
              and(
                eq(seriesAvailabilities.providerId, sourceId),
                eq(seriesAvailabilities.providerItemId, ep.seriesProviderItemId),
              ),
            )
            .limit(1)
          if (!seriesAv) continue

          const episodeId = await resolveEpisodeId(
            tx,
            seriesAv.seriesId,
            ep.seasonNumber,
            ep.episodeNumber,
            { title: ep.title, synopsis: ep.synopsis, durationMinutes: ep.durationMinutes, airDate: ep.airDate },
          )

          const [existing] = await tx
            .select({
              id: episodeAvailabilities.id,
              episodeId: episodeAvailabilities.episodeId,
              status: episodeAvailabilities.status,
            })
            .from(episodeAvailabilities)
            .where(
              and(
                eq(episodeAvailabilities.providerId, sourceId),
                eq(episodeAvailabilities.providerItemId, ep.providerItemId),
              ),
            )
            .limit(1)

          if (!existing) {
            await tx.insert(episodeAvailabilities).values({
              episodeId,
              providerId: sourceId,
              providerItemId: ep.providerItemId,
              firstSeenAt: snapshot.fetchedAt,
              lastSeenAt: snapshot.fetchedAt,
              status: 'AVAILABLE',
              rawTitle: ep.rawTitle ?? null,
              audioLanguage: ep.audioLanguage ?? null,
              subtitleLanguage: ep.subtitleLanguage ?? null,
              videoQuality: ep.videoQuality ?? null,
              containerExtension: ep.containerExtension ?? null,
            })
            await tx
              .insert(releaseEvents)
              .values({
                mediaType: 'EPISODE',
                mediaId: episodeId,
                eventType: 'SOURCE_APPEARED',
                occurredAt: snapshot.fetchedAt,
                sourceId,
              })
              .onConflictDoNothing()
          } else if (existing.episodeId !== episodeId) {
            console.warn(
              `[catalog-sync] provider item ${sourceId}/${ep.providerItemId} already assigned to episode ${existing.episodeId}, skipping reassignment to ${episodeId}`,
            )
            seenEpisodeProviderItemIds.add(ep.providerItemId)
            continue
          } else {
            const wasUnavailable = existing.status === 'UNAVAILABLE'
            await tx
              .update(episodeAvailabilities)
              .set({
                lastSeenAt: snapshot.fetchedAt,
                status: 'AVAILABLE',
                unavailableAt: null,
                rawTitle: ep.rawTitle ?? null,
                audioLanguage: ep.audioLanguage ?? null,
                subtitleLanguage: ep.subtitleLanguage ?? null,
                videoQuality: ep.videoQuality ?? null,
                containerExtension: ep.containerExtension ?? null,
              })
              .where(eq(episodeAvailabilities.id, existing.id))
            if (wasUnavailable) {
              await tx
                .insert(releaseEvents)
                .values({
                  mediaType: 'EPISODE',
                  mediaId: episodeId,
                  eventType: 'SOURCE_APPEARED',
                  occurredAt: snapshot.fetchedAt,
                  sourceId,
                })
                .onConflictDoNothing()
            }
          }
          seenEpisodeProviderItemIds.add(ep.providerItemId)
        }

        if (!snapshot.skipLifecycle) {
          const protectedEpisodeIds = new Set<string>()
          const failedProviderIds = snapshot.failedSeriesProviderIds
          if (failedProviderIds && failedProviderIds.length > 0) {
            const protectedRows = await tx
              .select({ providerItemId: episodeAvailabilities.providerItemId })
              .from(episodeAvailabilities)
              .innerJoin(episodes, eq(episodeAvailabilities.episodeId, episodes.id))
              .innerJoin(
                seriesAvailabilities,
                and(
                  eq(episodes.seriesId, seriesAvailabilities.seriesId),
                  eq(seriesAvailabilities.providerId, sourceId),
                  inArray(seriesAvailabilities.providerItemId, failedProviderIds),
                ),
              )
              .where(
                and(
                  eq(episodeAvailabilities.providerId, sourceId),
                  eq(episodeAvailabilities.status, 'AVAILABLE'),
                ),
              )
            for (const row of protectedRows) {
              protectedEpisodeIds.add(row.providerItemId)
            }
          }

          const missingEpisodeIds = [...previouslyAvailableEpisodeIds].filter(
            (id) => !seenEpisodeProviderItemIds.has(id) && !protectedEpisodeIds.has(id),
          )
          if (missingEpisodeIds.length > 0) {
            const disappearedEpisodes = await tx
              .update(episodeAvailabilities)
              .set({ status: 'UNAVAILABLE', unavailableAt: snapshot.fetchedAt })
              .where(
                and(
                  eq(episodeAvailabilities.providerId, sourceId),
                  eq(episodeAvailabilities.status, 'AVAILABLE'),
                  inArray(episodeAvailabilities.providerItemId, missingEpisodeIds),
                ),
              )
              .returning({ episodeId: episodeAvailabilities.episodeId })
            for (const { episodeId } of disappearedEpisodes) {
              await tx
                .insert(releaseEvents)
                .values({
                  mediaType: 'EPISODE',
                  mediaId: episodeId,
                  eventType: 'SOURCE_DISAPPEARED',
                  occurredAt: snapshot.fetchedAt,
                  sourceId,
                })
                .onConflictDoNothing()
            }
            counts.unavailableCount += missingEpisodeIds.length
          }
        }
      }
    })
  } catch (err) {
    syncError = err instanceof Error ? err : new Error(String(err))
  }

  // Release lock — always runs regardless of sync outcome
  if (syncError) {
    await db
      .update(syncRuns)
      .set({ status: 'FAILED', completedAt: new Date(), errorMessage: syncError.message })
      .where(eq(syncRuns.id, runId))
    return { runId, status: 'failed', counts, error: syncError.message }
  }

  await db
    .update(syncRuns)
    .set({
      status: 'COMPLETED',
      completedAt: new Date(),
      moviesCreated: counts.moviesCreated,
      moviesUpdated: counts.moviesUpdated,
      seriesCreated: counts.seriesCreated,
      seriesUpdated: counts.seriesUpdated,
      unavailableCount: counts.unavailableCount,
      failedCount: counts.failedCount,
      titleMatchedCount: counts.titleMatchedCount,
      titleUnmatchedCount: counts.titleUnmatchedCount,
    })
    .where(eq(syncRuns.id, runId))

  return { runId, status: 'completed', counts }
}

export const CatalogSyncService = {
  async syncCatalog(
    sourceId: string,
    snapshot: XtreamCatalogSnapshot,
    options?: { runId?: string; matchingService?: TitleMatchingService; skipLifecycle?: boolean },
  ): Promise<CatalogSyncResult> {
    const normalizedEpisodes: NormalizedEpisodeItem[] | undefined = snapshot.seriesInfo
      ? Object.entries(snapshot.seriesInfo).flatMap(([seriesIdStr, info]) =>
          Object.entries(info.episodes).flatMap(([seasonKey, episodeList]) => {
            const seasonNumber = parseInt(seasonKey, 10)
            return episodeList.map((ep) => {
              const { variantAttributes } = normalizeTitle(ep.title)
              return {
                providerItemId: ep.id,
                seriesProviderItemId: seriesIdStr,
                seasonNumber,
                episodeNumber: ep.episode_num,
                title: ep.title ?? null,
                durationMinutes: ep.info.duration_secs
                  ? Math.round(ep.info.duration_secs / 60)
                  : null,
                airDate: ep.info.releasedate ?? null,
                rawTitle: ep.title ?? null,
                containerExtension: ep.container_extension ?? null,
                audioLanguage: variantAttributes.audioLanguage,
                subtitleLanguage: variantAttributes.subtitleLanguage,
                videoQuality: variantAttributes.videoQuality,
              }
            })
          }),
        )
      : undefined

    return syncNormalized(
      sourceId,
      {
        sourceId: snapshot.sourceId,
        fetchedAt: snapshot.fetchedAt,
        movies: snapshot.vodStreams.map((s) => {
          const { variantAttributes } = normalizeTitle(s.name)
          return {
            providerItemId: s.stream_id.toString(),
            title: s.name,
            posterPath: s.cover,
            synopsis: s.plot ?? s.description,
            tmdb: s.tmdb,
            rawTitle: s.name,
            audioLanguage: variantAttributes.audioLanguage,
            subtitleLanguage: variantAttributes.subtitleLanguage,
            videoQuality: variantAttributes.videoQuality,
          }
        }),
        series: snapshot.series.map((s) => {
          const { variantAttributes } = normalizeTitle(s.name)
          return {
            providerItemId: s.series_id.toString(),
            title: s.name,
            posterPath: s.cover,
            synopsis: s.plot,
            tmdb: snapshot.seriesInfo?.[s.series_id]?.info.tmdb_id,
            firstAirYear: parseYear(s.releaseDate),
            rawTitle: s.name,
            audioLanguage: variantAttributes.audioLanguage,
            subtitleLanguage: variantAttributes.subtitleLanguage,
            videoQuality: variantAttributes.videoQuality,
          }
        }),
        episodes: normalizedEpisodes,
        failedSeriesProviderIds: snapshot.failedSeriesIds?.map(String),
        skipLifecycle: options?.skipLifecycle,
      },
      options?.runId,
      options?.matchingService,
    )
  },

  async syncPlexCatalog(
    sourceId: string,
    snapshot: PlexCatalogSnapshot,
    options?: { runId?: string },
  ): Promise<CatalogSyncResult> {
    return syncNormalized(
      sourceId,
      {
        sourceId: snapshot.sourceId,
        fetchedAt: snapshot.fetchedAt,
        movies: snapshot.movies.map((m) => ({
          providerItemId: m.ratingKey,
          title: m.title,
          posterPath: m.thumb,
          synopsis: m.summary,
          tmdb: extractPlexTmdbId(m.Guid),
        })),
        series: snapshot.shows.map((s) => ({
          providerItemId: s.ratingKey,
          title: s.title,
          posterPath: s.thumb,
          synopsis: s.summary,
          tmdb: extractPlexTmdbId(s.Guid),
          firstAirYear: s.year ?? null,
        })),
        episodes: snapshot.episodes.map((ep) => ({
          providerItemId: ep.ratingKey,
          seriesProviderItemId: ep.grandparentRatingKey,
          seasonNumber: ep.parentIndex,
          episodeNumber: ep.index,
          title: ep.title,
          synopsis: ep.summary ?? null,
          durationMinutes: ep.duration ? Math.round(ep.duration / 60000) : null,
          airDate: ep.originallyAvailableAt ?? null,
        })),
      },
      options?.runId,
    )
  },

  async syncM3UCatalog(
    sourceId: string,
    snapshot: M3UCatalogSnapshot,
    options?: { runId?: string },
  ): Promise<CatalogSyncResult> {
    // Derive unique series entries from episode seriesKeys
    const seriesMap = new Map<string, NormalizedSeriesItem>()
    for (const ep of snapshot.episodes) {
      const key = ep.seriesKey ?? ep.streamUrl
      if (!seriesMap.has(key)) {
        const { variantAttributes } = normalizeTitle(ep.rawTitle)
        seriesMap.set(key, {
          providerItemId: key,
          title: ep.tvgName ?? ep.rawTitle,
          posterPath: ep.tvgLogo ?? null,
          synopsis: null,
          tmdb: undefined,
          firstAirYear: null,
          rawTitle: ep.rawTitle,
          audioLanguage: variantAttributes.audioLanguage,
          subtitleLanguage: variantAttributes.subtitleLanguage,
          videoQuality: variantAttributes.videoQuality,
        })
      }
    }

    return syncNormalized(
      sourceId,
      {
        sourceId: snapshot.sourceId,
        fetchedAt: snapshot.fetchedAt,
        movies: snapshot.movies.map((entry) => {
          const { variantAttributes } = normalizeTitle(entry.rawTitle)
          return {
            providerItemId: entry.tvgId ?? entry.streamUrl,
            title: entry.tvgName ?? entry.rawTitle,
            posterPath: entry.tvgLogo ?? null,
            synopsis: null,
            tmdb: undefined,
            rawTitle: entry.rawTitle,
            audioLanguage: variantAttributes.audioLanguage,
            subtitleLanguage: variantAttributes.subtitleLanguage,
            videoQuality: variantAttributes.videoQuality,
          }
        }),
        series: [...seriesMap.values()],
        episodes: snapshot.episodes.map((entry) => ({
          providerItemId: entry.tvgId ?? entry.streamUrl,
          seriesProviderItemId: entry.seriesKey ?? entry.streamUrl,
          seasonNumber: entry.seasonNumber ?? 1,
          episodeNumber: entry.episodeNumber ?? 1,
        })),
      },
      options?.runId,
    )
  },
}
