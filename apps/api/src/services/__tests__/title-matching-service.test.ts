import 'dotenv/config'
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { eq, and, inArray } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { sources } from '../../db/schema/sources.js'
import { movies } from '../../db/schema/movies.js'
import { series as seriesTable } from '../../db/schema/series.js'
import { titleMatchResults } from '../../db/schema/title-match-results.js'
import { TitleMatchingService } from '../title-matching-service.js'
import type { MetadataProvider, MetadataCandidate } from '../../providers/metadata/types.js'

// Fake TMDB IDs in 9_000_000+ range — guaranteed not to exist in real TMDB data
const T = {
  dunePt2: 9_000_001,
  inception: 9_000_002,
  matrix: 9_000_003,
  interstellar: 9_000_004,
  ghostMovie: 9_000_005,
  ghostShow: 9_000_006,
  heat1995: 9_000_007,
  heat2024: 9_000_008,
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

// ─── test fixtures ──────────────────────────────────────────────────────────

let testSourceId: string
const cleanupMovieIds: string[] = []
const cleanupSeriesIds: string[] = []

beforeAll(async () => {
  const [source] = await db
    .insert(sources)
    .values({
      name: 'Title Match Test Source',
      type: 'XTREAM',
      baseUrl: 'http://test.match.example.com',
      username: 'u',
      password: 'p',
    })
    .returning()
  testSourceId = source.id
})

afterAll(async () => {
  await db.delete(sources).where(eq(sources.id, testSourceId))
})

afterEach(async () => {
  await db.delete(titleMatchResults).where(eq(titleMatchResults.providerId, testSourceId))
  // Delete by ID (when test succeeded) or by tmdbId (when test failed mid-way and left stale data)
  if (cleanupMovieIds.length > 0) {
    await db.delete(movies).where(inArray(movies.id, cleanupMovieIds))
    cleanupMovieIds.length = 0
  }
  await db.delete(movies).where(inArray(movies.tmdbId, ALL_TEST_TMDB_IDS))
  if (cleanupSeriesIds.length > 0) {
    await db.delete(seriesTable).where(inArray(seriesTable.id, cleanupSeriesIds))
    cleanupSeriesIds.length = 0
  }
  await db.delete(seriesTable).where(inArray(seriesTable.tmdbId, ALL_TEST_TMDB_IDS))
})

// ─── tests ──────────────────────────────────────────────────────────────────

describe('TitleMatchingService', () => {
  it('first match — high-confidence single candidate produces MATCHED row with movieId', async () => {
    const [movie] = await db
      .insert(movies)
      .values({ title: 'Dune Part Two', year: 2024, tmdbId: T.dunePt2 })
      .returning()
    cleanupMovieIds.push(movie.id)

    const provider = makeProvider(async () => [
      movieCandidate(String(T.dunePt2), 'Dune Part Two', 2024),
    ])
    const svc = new TitleMatchingService(provider)

    const result = await svc.matchItem({
      providerId: testSourceId,
      providerItemId: 'vod-dune2',
      rawTitle: 'Dune.Part.Two.2024.MULTI.1080p',
      mediaType: 'MOVIE',
    })

    expect(result.matchState).toBe('MATCHED')
    expect(result.confidence).not.toBeNull()
    expect(result.confidence!).toBeGreaterThanOrEqual(0.85)
    expect(result.movieId).toBe(movie.id)
    expect(result.seriesId).toBeNull()

    // Verify the DB row
    const [row] = await db
      .select()
      .from(titleMatchResults)
      .where(eq(titleMatchResults.providerId, testSourceId))
    expect(row.matchState).toBe('MATCHED')
    expect(row.matchedAt).not.toBeNull()
  })

  it('re-match with zero candidates does not downgrade an existing MATCHED row', async () => {
    const [movie] = await db
      .insert(movies)
      .values({ title: 'Inception', year: 2010, tmdbId: T.inception })
      .returning()
    cleanupMovieIds.push(movie.id)

    // First pass — establish MATCHED
    const svc1 = new TitleMatchingService(
      makeProvider(async () => [movieCandidate(String(T.inception), 'Inception', 2010)]),
    )
    await svc1.matchItem({
      providerId: testSourceId,
      providerItemId: 'vod-inception',
      rawTitle: 'Inception.2010.BluRay.1080p',
      mediaType: 'MOVIE',
    })

    // Second pass — provider returns nothing
    const svc2 = new TitleMatchingService(makeProvider())
    const result = await svc2.matchItem({
      providerId: testSourceId,
      providerItemId: 'vod-inception',
      rawTitle: 'Inception.2010.BluRay.1080p',
      mediaType: 'MOVIE',
    })

    expect(result.matchState).toBe('MATCHED')
    expect(result.movieId).toBe(movie.id)
  })

  it('two equally-scored candidates produce AMBIGUOUS with no canonical links', async () => {
    const provider = makeProvider(async () => [
      movieCandidate('9000100', 'Dune', 2021),
      movieCandidate('9000101', 'Dune', 2021),
    ])
    const svc = new TitleMatchingService(provider)

    const result = await svc.matchItem({
      providerId: testSourceId,
      providerItemId: 'vod-dune-ambig',
      rawTitle: 'Dune.1080p',
      mediaType: 'MOVIE',
    })

    expect(result.matchState).toBe('AMBIGUOUS')
    expect(result.movieId).toBeNull()
    expect(result.seriesId).toBeNull()
  })

  it('zero candidates produce UNMATCHED with no canonical links', async () => {
    const svc = new TitleMatchingService(makeProvider())

    const result = await svc.matchItem({
      providerId: testSourceId,
      providerItemId: 'vod-nomatch',
      rawTitle: 'Xzqwerty.Unknown.Title.2099.1080p',
      mediaType: 'MOVIE',
    })

    expect(result.matchState).toBe('UNMATCHED')
    expect(result.movieId).toBeNull()
    expect(result.seriesId).toBeNull()
  })

  it('MOVIE input with only SERIES candidates produces UNMATCHED', async () => {
    const provider = makeProvider(
      async () => [seriesCandidate('100', 'Breaking Bad', 2008)] as never,
    )
    const svc = new TitleMatchingService(provider)

    const result = await svc.matchItem({
      providerId: testSourceId,
      providerItemId: 'vod-crosstype',
      rawTitle: 'Breaking.Bad.S01.BluRay',
      mediaType: 'MOVIE',
    })

    expect(result.matchState).toBe('UNMATCHED')
  })

  it('UNMATCHED row is upgraded to MATCHED on retry with a clear winner', async () => {
    const [movie] = await db
      .insert(movies)
      .values({ title: 'The Matrix', year: 1999, tmdbId: T.matrix })
      .returning()
    cleanupMovieIds.push(movie.id)

    // First pass — no candidates → UNMATCHED
    const svc1 = new TitleMatchingService(makeProvider())
    await svc1.matchItem({
      providerId: testSourceId,
      providerItemId: 'vod-matrix',
      rawTitle: 'The.Matrix.1999.BluRay.1080p',
      mediaType: 'MOVIE',
    })

    // Verify UNMATCHED
    const [before] = await db
      .select({ state: titleMatchResults.matchState })
      .from(titleMatchResults)
      .where(eq(titleMatchResults.providerId, testSourceId))
    expect(before.state).toBe('UNMATCHED')

    // Retry — provider now has a clear winner
    const svc2 = new TitleMatchingService(
      makeProvider(async () => [movieCandidate(String(T.matrix), 'The Matrix', 1999)]),
    )
    const result = await svc2.matchItem({
      providerId: testSourceId,
      providerItemId: 'vod-matrix',
      rawTitle: 'The.Matrix.1999.BluRay.1080p',
      mediaType: 'MOVIE',
    })

    expect(result.matchState).toBe('MATCHED')
    expect(result.movieId).toBe(movie.id)
  })

  it('MATCHED and AMBIGUOUS rows both carry non-empty diagnostic notes', async () => {
    const [movie] = await db
      .insert(movies)
      .values({ title: 'Interstellar', year: 2014, tmdbId: T.interstellar })
      .returning()
    cleanupMovieIds.push(movie.id)

    const matchedSvc = new TitleMatchingService(
      makeProvider(async () => [movieCandidate(String(T.interstellar), 'Interstellar', 2014)]),
    )
    const matchedResult = await matchedSvc.matchItem({
      providerId: testSourceId,
      providerItemId: 'vod-interstellar',
      rawTitle: 'Interstellar.2014.BluRay.1080p',
      mediaType: 'MOVIE',
    })
    expect(matchedResult.notes.length).toBeGreaterThan(0)
    // Notes must not expose credentials or secret-bearing URLs
    expect(matchedResult.notes).not.toContain('http://')
    expect(matchedResult.notes).not.toMatch(/password|secret|token/i)

    const ambigSvc = new TitleMatchingService(
      makeProvider(async () => [
        movieCandidate('9000200', 'Interstellar', 2014),
        movieCandidate('9000201', 'Interstellar', 2014),
      ]),
    )
    const ambigResult = await ambigSvc.matchItem({
      providerId: testSourceId,
      providerItemId: 'vod-interstellar-ambig',
      rawTitle: 'Interstellar.2014.BluRay.1080p',
      mediaType: 'MOVIE',
    })
    expect(ambigResult.notes.length).toBeGreaterThan(0)

    // UNMATCHED also gets a notes string explaining the absence
    const unmatchedSvc = new TitleMatchingService(makeProvider())
    const unmatchedResult = await unmatchedSvc.matchItem({
      providerId: testSourceId,
      providerItemId: 'vod-interstellar-unmatched',
      rawTitle: 'Interstellar.2014.BluRay.1080p',
      mediaType: 'MOVIE',
    })
    expect(unmatchedResult.notes).toContain('no candidates')
  })

  it('resolveMovieId creates a canonical movie skeleton when TMDB ID is not in DB', async () => {
    const provider = makeProvider(async () => [movieCandidate(String(T.ghostMovie), 'Ghost Movie', 2022)])
    const svc = new TitleMatchingService(provider)

    const result = await svc.matchItem({
      providerId: testSourceId,
      providerItemId: 'vod-ghost',
      rawTitle: 'Ghost.Movie.2022.1080p',
      mediaType: 'MOVIE',
    })

    expect(result.matchState).toBe('MATCHED')
    expect(result.movieId).not.toBeNull()

    const [movie] = await db.select().from(movies).where(eq(movies.id, result.movieId!))
    expect(movie.title).toBe('Ghost Movie')
    expect(movie.tmdbId).toBe(T.ghostMovie)
    expect(movie.matchStatus).toBe('MATCHED')
    cleanupMovieIds.push(movie.id)
  })

  it('resolveSeriesId creates a canonical series skeleton when TMDB ID is not in DB', async () => {
    const provider = makeProvider(
      async () => [],
      async () => [seriesCandidate(String(T.ghostShow), 'Ghost Show', 2022)],
    )
    const svc = new TitleMatchingService(provider)

    const result = await svc.matchItem({
      providerId: testSourceId,
      providerItemId: 'series-ghost',
      rawTitle: 'Ghost.Show.2022',
      mediaType: 'SERIES',
    })

    expect(result.matchState).toBe('MATCHED')
    expect(result.seriesId).not.toBeNull()

    const [ser] = await db.select().from(seriesTable).where(eq(seriesTable.id, result.seriesId!))
    expect(ser.title).toBe('Ghost Show')
    expect(ser.tmdbId).toBe(T.ghostShow)
    expect(ser.matchStatus).toBe('MATCHED')
    cleanupSeriesIds.push(ser.id)
  })

  it('matchBatch bounded concurrency — peak in-flight calls never exceeds the limit', async () => {
    let peak = 0
    let inflight = 0
    const limit = 2

    const provider = makeProvider(async () => {
      inflight++
      peak = Math.max(peak, inflight)
      await new Promise<void>((resolve) => setTimeout(resolve, 20))
      inflight--
      return []
    })

    const svc = new TitleMatchingService(provider)
    const inputs = Array.from({ length: 6 }, (_, i) => ({
      providerId: testSourceId,
      providerItemId: `vod-batch-${i}`,
      rawTitle: `BatchMovie${i}.1080p`,
      mediaType: 'MOVIE' as const,
    }))

    await svc.matchBatch(inputs, { concurrency: limit })
    expect(peak).toBeLessThanOrEqual(limit)
  })

  it('same title different year — provider title year breaks the tie to correct candidate', async () => {
    const [movie1995] = await db
      .insert(movies)
      .values({ title: 'Heat', year: 1995, tmdbId: T.heat1995 })
      .returning()
    cleanupMovieIds.push(movie1995.id)

    const [movie2024] = await db
      .insert(movies)
      .values({ title: 'Heat', year: 2024, tmdbId: T.heat2024 })
      .returning()
    cleanupMovieIds.push(movie2024.id)

    const provider = makeProvider(async () => [
      movieCandidate(String(T.heat1995), 'Heat', 1995),
      movieCandidate(String(T.heat2024), 'Heat', 2024),
    ])
    const svc = new TitleMatchingService(provider)

    // Raw title has 2024 → extractedYear=2024 → year score +0.15 for 2024 candidate, -0.10 for 1995
    // rawScores: [1.15, 0.90], gap=0.25 > 0.15 → MATCHED to 2024 candidate
    const result = await svc.matchItem({
      providerId: testSourceId,
      providerItemId: 'vod-heat-2024',
      rawTitle: 'Heat.2024.BluRay.1080p',
      mediaType: 'MOVIE',
    })

    expect(result.matchState).toBe('MATCHED')
    expect(result.movieId).toBe(movie2024.id)
  })
})
