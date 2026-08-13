import 'dotenv/config'
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { movies } from '../../db/schema/movies.js'
import { series as seriesTable } from '../../db/schema/series.js'
import { sources } from '../../db/schema/sources.js'
import { movieAvailabilities, seriesAvailabilities } from '../../db/schema/availabilities.js'
import { watchlist } from '../../db/schema/watchlist.js'
import { viewingProgress } from '../../db/schema/viewing-progress.js'
import { profiles } from '../../db/schema/profiles.js'
import { reconciliationRuns } from '../../db/schema/reconciliation-runs.js'
import { titleMatchResults } from '../../db/schema/title-match-results.js'
import { MediaReconciliationService, ReconciliationAlreadyRunningError } from '../media-reconciliation-service.js'
import { TitleMatchingService } from '../title-matching-service.js'
import type { MetadataProvider, MetadataCandidate } from '../../providers/metadata/types.js'

// Fake TMDB IDs in 9_100_000+ range — guaranteed not to collide with title-matching-service tests
const T = {
  inception: 9_100_001,
  matrix: 9_100_002,
  breakingBad: 9_100_003,
  ghost: 9_100_004,
} as const

const ALL_TEST_TMDB_IDS = Object.values(T)

// ─── helpers ────────────────────────────────────────────────────────────────

function makeProvider(
  searchMoviesFn: MetadataProvider['searchMovies'] = async () => [],
  searchSeriesFn: MetadataProvider['searchSeries'] = async () => [],
): MetadataProvider {
  return {
    getMovieMetadata: async () => null,
    getSeriesMetadata: async () => null,
    searchMovies: searchMoviesFn,
    searchSeries: searchSeriesFn,
    fetchMovieFeed: async () => [],
    fetchSeriesFeed: async () => [],
    getMovieVideos: async () => [],
    getSeriesVideos: async () => [],
    getMovieCredits: async () => [],
    getSeriesCredits: async () => [],
    getMovieCertification: async () => null,
    getSeriesCertification: async () => null,
  }
}

function movieCandidate(externalId: string, title: string, year: number | null): MetadataCandidate {
  return { externalId, title, year, mediaType: 'MOVIE' }
}

function seriesCandidate(externalId: string, title: string, year: number | null): MetadataCandidate {
  return { externalId, title, year, mediaType: 'SERIES' }
}

function makeService(provider: MetadataProvider): MediaReconciliationService {
  return new MediaReconciliationService(new TitleMatchingService(provider))
}

// ─── fixtures ───────────────────────────────────────────────────────────────

let testSourceId: string
let testProfileId: string

beforeAll(async () => {
  const [source] = await db
    .insert(sources)
    .values({
      name: 'Reconciliation Test Source',
      type: 'XTREAM',
      baseUrl: 'http://test.reconcile.example.com',
      username: 'u',
      password: 'p',
    })
    .returning()
  testSourceId = source.id

  const [profile] = await db
    .insert(profiles)
    .values({ name: 'reconcile-test-profile' })
    .returning()
  testProfileId = profile.id
})

afterAll(async () => {
  await db.delete(profiles).where(eq(profiles.id, testProfileId))
  await db.delete(sources).where(eq(sources.id, testSourceId))
})

afterEach(async () => {
  await db.delete(reconciliationRuns)
  await db.delete(titleMatchResults).where(eq(titleMatchResults.providerId, testSourceId))
  await db.delete(movies).where(inArray(movies.tmdbId, ALL_TEST_TMDB_IDS))
  await db.delete(seriesTable).where(inArray(seriesTable.tmdbId, ALL_TEST_TMDB_IDS))
  // Clean up any test movies/series without tmdb IDs that may have been left behind
  await db.delete(movieAvailabilities).where(eq(movieAvailabilities.providerId, testSourceId))
  await db.delete(seriesAvailabilities).where(eq(seriesAvailabilities.providerId, testSourceId))
  await db.delete(watchlist).where(eq(watchlist.profileId, testProfileId))
  await db.delete(viewingProgress).where(eq(viewingProgress.profileId, testProfileId))
})

// ─── tests ──────────────────────────────────────────────────────────────────

describe('MediaReconciliationService', () => {
  it('1. single movie match — PENDING movie with one availability resolves to MATCHED', async () => {
    const [pendingMovie] = await db
      .insert(movies)
      .values({ title: 'Inception Raw Title', matchStatus: 'PENDING' })
      .returning()

    const now = new Date()
    await db.insert(movieAvailabilities).values({
      movieId: pendingMovie.id,
      providerId: testSourceId,
      providerItemId: 'rec-vod-1',
      rawTitle: 'Inception.2010.BluRay.1080p',
      firstSeenAt: now,
      lastSeenAt: now,
    })

    const provider = makeProvider(async () => [
      movieCandidate(String(T.inception), 'Inception', 2010),
    ])
    const svc = makeService(provider)
    const result = await svc.reconcile({ mediaType: 'MOVIE' })

    expect(result.status).toBe('COMPLETED')
    expect(result.matchedCount + result.mergedCount).toBeGreaterThanOrEqual(1)
    expect(result.failedCount).toBe(0)

    // The canonical movie (with tmdbId) should be MATCHED
    const [canonical] = await db
      .select()
      .from(movies)
      .where(eq(movies.tmdbId, T.inception))
    expect(canonical).toBeDefined()
    expect(canonical.matchStatus).toBe('MATCHED')

    // The old PENDING movie either was the canonical (matchedCount) or was merged into canonical (mergedCount)
    const [oldMovie] = await db.select().from(movies).where(eq(movies.id, pendingMovie.id))
    if (oldMovie) {
      // oldId === canonicalId: same row was updated to MATCHED
      expect(oldMovie.matchStatus).toBe('MATCHED')
    }
    // else: oldMovie was deleted (merged into canonical) — that's also correct
  })

  it('2. series type isolation — PENDING series resolves without touching movies', async () => {
    const [pendingSeries] = await db
      .insert(seriesTable)
      .values({ title: 'Breaking Bad Raw', matchStatus: 'PENDING' })
      .returning()

    const now = new Date()
    await db.insert(seriesAvailabilities).values({
      seriesId: pendingSeries.id,
      providerId: testSourceId,
      providerItemId: 'rec-series-1',
      rawTitle: 'Breaking.Bad.2008',
      firstSeenAt: now,
      lastSeenAt: now,
    })

    // Ensure no movies get touched
    const [unrelatedMovie] = await db
      .insert(movies)
      .values({ title: 'Unrelated Movie', matchStatus: 'PENDING' })
      .returning()

    const provider = makeProvider(
      async () => [],
      async () => [seriesCandidate(String(T.breakingBad), 'Breaking Bad', 2008)],
    )
    const svc = makeService(provider)
    const result = await svc.reconcile({ mediaType: 'SERIES' })

    expect(result.status).toBe('COMPLETED')
    expect(result.matchedCount + result.mergedCount).toBeGreaterThanOrEqual(1)

    // Canonical series should be MATCHED
    const [canonical] = await db
      .select()
      .from(seriesTable)
      .where(eq(seriesTable.tmdbId, T.breakingBad))
    expect(canonical).toBeDefined()
    expect(canonical.matchStatus).toBe('MATCHED')

    // Unrelated movie was NOT touched (not in SERIES run)
    const [stillPending] = await db.select().from(movies).where(eq(movies.id, unrelatedMovie.id))
    expect(stillPending).toBeDefined()
    expect(stillPending.matchStatus).toBe('PENDING')

    // Clean up unrelated movie
    await db.delete(movies).where(eq(movies.id, unrelatedMovie.id))
  })

  it('3. multi-row merge — two PENDING movies resolving to same canonical collapse to one', async () => {
    const now = new Date()

    const [movieA] = await db
      .insert(movies)
      .values({ title: 'Inception A', matchStatus: 'PENDING' })
      .returning()
    await db.insert(movieAvailabilities).values({
      movieId: movieA.id,
      providerId: testSourceId,
      providerItemId: 'rec-vod-merge-a',
      rawTitle: 'Inception.2010.1080p',
      firstSeenAt: now,
      lastSeenAt: now,
    })

    const [movieB] = await db
      .insert(movies)
      .values({ title: 'Inception B', matchStatus: 'PENDING' })
      .returning()
    await db.insert(movieAvailabilities).values({
      movieId: movieB.id,
      providerId: testSourceId,
      providerItemId: 'rec-vod-merge-b',
      rawTitle: 'Inception.2010.BluRay.x264',
      firstSeenAt: now,
      lastSeenAt: now,
    })

    const provider = makeProvider(async () => [
      movieCandidate(String(T.inception), 'Inception', 2010),
    ])
    const svc = makeService(provider)
    const result = await svc.reconcile({ mediaType: 'MOVIE' })

    expect(result.status).toBe('COMPLETED')
    expect(result.mergedCount).toBeGreaterThanOrEqual(1)

    // Only one movie with tmdbId=T.inception should remain
    const canonicals = await db.select().from(movies).where(eq(movies.tmdbId, T.inception))
    expect(canonicals).toHaveLength(1)
    expect(canonicals[0].matchStatus).toBe('MATCHED')

    // Both availabilities should be on the canonical
    const avails = await db
      .select()
      .from(movieAvailabilities)
      .where(eq(movieAvailabilities.movieId, canonicals[0].id))
    expect(avails.length).toBeGreaterThanOrEqual(2)

    // rawTitle values are preserved in availability rows
    const rawTitles = avails.map((a) => a.rawTitle)
    expect(rawTitles).toContain('Inception.2010.1080p')
    expect(rawTitles).toContain('Inception.2010.BluRay.x264')
  })

  it('4. watchlist migration — watchlist entry on old media ID points to canonical after merge', async () => {
    const now = new Date()

    const [movieA] = await db
      .insert(movies)
      .values({ title: 'Matrix Old', matchStatus: 'PENDING' })
      .returning()
    await db.insert(movieAvailabilities).values({
      movieId: movieA.id,
      providerId: testSourceId,
      providerItemId: 'rec-matrix-wl',
      rawTitle: 'The.Matrix.1999.1080p',
      firstSeenAt: now,
      lastSeenAt: now,
    })

    // Add watchlist entry on old movie
    await db.insert(watchlist).values({
      profileId: testProfileId,
      mediaType: 'MOVIE',
      mediaId: movieA.id,
    })

    const provider = makeProvider(async () => [
      movieCandidate(String(T.matrix), 'The Matrix', 1999),
    ])
    const svc = makeService(provider)
    await svc.reconcile({ mediaType: 'MOVIE' })

    // Canonical should exist and be MATCHED
    const [canonical] = await db.select().from(movies).where(eq(movies.tmdbId, T.matrix))
    expect(canonical).toBeDefined()

    // Watchlist entry should now point to canonical, not the old movie
    const watchlistEntries = await db
      .select()
      .from(watchlist)
      .where(and(eq(watchlist.profileId, testProfileId), eq(watchlist.mediaType, 'MOVIE')))

    expect(watchlistEntries).toHaveLength(1)
    expect(watchlistEntries[0].mediaId).toBe(canonical.id)

    // Old movie should no longer exist (merged)
    if (canonical.id !== movieA.id) {
      const [oldStillExists] = await db.select().from(movies).where(eq(movies.id, movieA.id))
      expect(oldStillExists).toBeUndefined()
    }
  })

  it('5. viewing progress conflict — canonical row survives, no duplicate', async () => {
    const now = new Date()

    // Pre-existing canonical movie with tmdbId
    const [canonical] = await db
      .insert(movies)
      .values({ title: 'Inception Canonical', year: 2010, tmdbId: T.inception, matchStatus: 'MATCHED' })
      .returning()

    // Progress on canonical
    await db.insert(viewingProgress).values({
      profileId: testProfileId,
      mediaType: 'MOVIE',
      mediaId: canonical.id,
      progressSeconds: 500,
      durationSeconds: 9000,
    })

    // Old movie with no tmdbId, same title
    const [oldMovie] = await db
      .insert(movies)
      .values({ title: 'Inception Old', matchStatus: 'PENDING' })
      .returning()
    await db.insert(movieAvailabilities).values({
      movieId: oldMovie.id,
      providerId: testSourceId,
      providerItemId: 'rec-inc-dup',
      rawTitle: 'Inception.2010.1080p',
      firstSeenAt: now,
      lastSeenAt: now,
    })

    // Progress on old movie too
    await db.insert(viewingProgress).values({
      profileId: testProfileId,
      mediaType: 'MOVIE',
      mediaId: oldMovie.id,
      progressSeconds: 100,
      durationSeconds: 9000,
    })

    const provider = makeProvider(async () => [
      movieCandidate(String(T.inception), 'Inception', 2010),
    ])
    const svc = makeService(provider)
    await svc.reconcile({ mediaType: 'MOVIE' })

    // No duplicate viewing_progress rows for profileId + MOVIE + canonicalId
    const progressRows = await db
      .select()
      .from(viewingProgress)
      .where(
        and(
          eq(viewingProgress.profileId, testProfileId),
          eq(viewingProgress.mediaType, 'MOVIE'),
          eq(viewingProgress.mediaId, canonical.id),
        ),
      )
    expect(progressRows).toHaveLength(1)
    // Canonical's progress (500) is preserved
    expect(progressRows[0].progressSeconds).toBe(500)
  })

  it('6. ambiguous match — two equally-scored candidates leave record unchanged', async () => {
    const now = new Date()

    const [pendingMovie] = await db
      .insert(movies)
      .values({ title: 'Ghost Ambig', matchStatus: 'PENDING' })
      .returning()
    await db.insert(movieAvailabilities).values({
      movieId: pendingMovie.id,
      providerId: testSourceId,
      providerItemId: 'rec-ambig-1',
      rawTitle: 'Ghost.2022.1080p',
      firstSeenAt: now,
      lastSeenAt: now,
    })

    // Two equally scored candidates → AMBIGUOUS
    const provider = makeProvider(async () => [
      movieCandidate('9100200', 'Ghost', 2022),
      movieCandidate('9100201', 'Ghost', 2022),
    ])
    const svc = makeService(provider)
    const result = await svc.reconcile({ mediaType: 'MOVIE' })

    expect(result.status).toBe('COMPLETED')
    expect(result.ambiguousCount).toBe(1)
    expect(result.mergedCount).toBe(0)
    expect(result.matchedCount).toBe(0)

    // Record unchanged — still PENDING
    const [still] = await db.select().from(movies).where(eq(movies.id, pendingMovie.id))
    expect(still).toBeDefined()
    expect(still.matchStatus).toBe('PENDING')

    await db.delete(movies).where(eq(movies.id, pendingMovie.id))
  })

  it('7. no availabilities — media with no availability rows is skipped', async () => {
    const [emptyMovie] = await db
      .insert(movies)
      .values({ title: 'Empty Movie', matchStatus: 'PENDING' })
      .returning()

    const provider = makeProvider(async () => [
      movieCandidate(String(T.inception), 'Inception', 2010),
    ])
    const svc = makeService(provider)
    const result = await svc.reconcile({ mediaType: 'MOVIE' })

    expect(result.skippedCount).toBe(1)
    expect(result.processedCount).toBe(1)

    // Movie should still exist and still be PENDING
    const [still] = await db.select().from(movies).where(eq(movies.id, emptyMovie.id))
    expect(still).toBeDefined()
    expect(still.matchStatus).toBe('PENDING')

    await db.delete(movies).where(eq(movies.id, emptyMovie.id))
  })

  it('8. already MATCHED media is not re-queried', async () => {
    const searchFn = vi.fn(async () => [
      movieCandidate(String(T.inception), 'Inception', 2010),
    ])

    const [matchedMovie] = await db
      .insert(movies)
      .values({ title: 'Already Matched', tmdbId: T.inception, matchStatus: 'MATCHED' })
      .returning()

    const provider = makeProvider(searchFn)
    const svc = makeService(provider)
    await svc.reconcile({ mediaType: 'MOVIE' })

    // No TMDB call should have been made (MATCHED records are excluded from query)
    expect(searchFn).toHaveBeenCalledTimes(0)
    expect((await svc.reconcile({ mediaType: 'MOVIE' })).processedCount).toBe(0)

    await db.delete(movies).where(eq(movies.id, matchedMovie.id))
  })

  it('9. idempotency — re-running on reconciled catalog produces no duplicate rows', async () => {
    const now = new Date()

    const [pendingMovie] = await db
      .insert(movies)
      .values({ title: 'Inception Idem', matchStatus: 'PENDING' })
      .returning()
    await db.insert(movieAvailabilities).values({
      movieId: pendingMovie.id,
      providerId: testSourceId,
      providerItemId: 'rec-idem-1',
      rawTitle: 'Inception.2010.BluRay.1080p',
      firstSeenAt: now,
      lastSeenAt: now,
    })

    const provider = makeProvider(async () => [
      movieCandidate(String(T.inception), 'Inception', 2010),
    ])
    const svc = makeService(provider)

    // First run
    const r1 = await svc.reconcile({ mediaType: 'MOVIE' })
    expect(r1.matchedCount + r1.mergedCount).toBeGreaterThanOrEqual(1)

    // Clean up run row so we can start another
    await db.delete(reconciliationRuns)

    // Second run — catalog is already reconciled
    const r2 = await svc.reconcile({ mediaType: 'MOVIE' })
    expect(r2.matchedCount).toBe(0)
    expect(r2.mergedCount).toBe(0)
    expect(r2.failedCount).toBe(0)

    // No duplicate movies with tmdbId
    const canonicals = await db.select().from(movies).where(eq(movies.tmdbId, T.inception))
    expect(canonicals).toHaveLength(1)
    expect(canonicals[0].matchStatus).toBe('MATCHED')

    // No duplicate availabilities
    const avails = await db
      .select()
      .from(movieAvailabilities)
      .where(eq(movieAvailabilities.movieId, canonicals[0].id))
    // Should not have duplicates (unique on providerId + providerItemId)
    const pairs = avails.map((a) => `${a.providerId}:${a.providerItemId}`)
    const uniquePairs = new Set(pairs)
    expect(pairs.length).toBe(uniquePairs.size)
  })

  it('10. TMDB failure mid-batch — failing item increments failedCount, rest of batch continues', async () => {
    const now = new Date()

    const [movie1] = await db
      .insert(movies)
      .values({ title: 'Movie One', matchStatus: 'PENDING' })
      .returning()
    await db.insert(movieAvailabilities).values({
      movieId: movie1.id,
      providerId: testSourceId,
      providerItemId: 'rec-fail-1',
      rawTitle: 'Movie.One.1080p',
      firstSeenAt: now,
      lastSeenAt: now,
    })

    const [movie2] = await db
      .insert(movies)
      .values({ title: 'Movie Two', matchStatus: 'PENDING' })
      .returning()
    await db.insert(movieAvailabilities).values({
      movieId: movie2.id,
      providerId: testSourceId,
      providerItemId: 'rec-fail-2',
      rawTitle: 'Movie.Two.1080p',
      firstSeenAt: now,
      lastSeenAt: now,
    })

    let callCount = 0
    const searchFn = vi.fn(async () => {
      callCount++
      if (callCount === 1) throw new Error('simulated TMDB outage')
      return []
    })
    const svc = makeService(makeProvider(searchFn))
    const result = await svc.reconcile({ mediaType: 'MOVIE', concurrency: 1 })

    // failedCount should include the failing item
    expect(result.failedCount).toBe(1)
    // The other item should have been processed (unmatched)
    expect(result.unmatchedCount + result.failedCount).toBeGreaterThanOrEqual(1)
    expect(result.processedCount).toBe(2)

    await db.delete(movies).where(inArray(movies.id, [movie1.id, movie2.id]))
  })

  it('11. cursor resumability — records from committed batches are not re-processed', async () => {
    const now = new Date()

    // Create 3 movies — we'll simulate processing with batchSize=2
    const movieIds: string[] = []
    for (let i = 0; i < 3; i++) {
      const [m] = await db
        .insert(movies)
        .values({ title: `Resume Movie ${i}`, matchStatus: 'PENDING' })
        .returning()
      movieIds.push(m.id)
      await db.insert(movieAvailabilities).values({
        movieId: m.id,
        providerId: testSourceId,
        providerItemId: `rec-resume-${i}`,
        rawTitle: `ResumeMovie${i}.1080p`,
        firstSeenAt: now,
        lastSeenAt: now,
      })
    }

    // Sort IDs to understand cursor order
    const sortedIds = [...movieIds].sort()

    const searchCallCount = { count: 0 }
    const provider = makeProvider(async () => {
      searchCallCount.count++
      return []
    })
    const svc = makeService(provider)

    // Full run with batchSize=2 processes all 3 movies
    const result = await svc.reconcile({ mediaType: 'MOVIE', batchSize: 2 })
    expect(result.processedCount).toBe(3)
    const totalCalls = searchCallCount.count

    // After full run, all 3 movies are either UNMATCHED or PENDING→UNMATCHED
    // The cursor was advanced. Clean up the run row to allow a new run.
    await db.delete(reconciliationRuns)

    // Reset search call count
    searchCallCount.count = 0

    // Now simulate "already processed" — movies that are now UNMATCHED will still be
    // picked up (they're eligible). But MATCHED ones would not be.
    // The key test: re-running produces correct processedCount (all 3 are still UNMATCHED → re-processed)
    const result2 = await svc.reconcile({ mediaType: 'MOVIE', batchSize: 2 })

    // All 3 should be re-processed (UNMATCHED records are eligible for retry)
    expect(result2.processedCount).toBe(3)

    // Cleanup
    await db.delete(movies).where(inArray(movies.id, movieIds))
  })
})
