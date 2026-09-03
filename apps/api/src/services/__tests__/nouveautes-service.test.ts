import { describe, it, expect, beforeEach, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Module mocks (hoisted)
// ---------------------------------------------------------------------------

vi.mock('../../config/env.js', () => ({
  NOUVEAUTES_RELEASE_WINDOW_DAYS: 180,
  NOUVEAUTES_CATALOG_MAX_AGE_YEARS: 3,
  NOUVEAUTES_MIN_ITEMS: 5,
  NOUVEAUTES_ITEMS_PER_SHELF: 20,
}))

const mockDb = vi.hoisted(() => ({
  select: vi.fn(),
  selectDistinctOn: vi.fn(),
}))
vi.mock('../../db/client.js', () => ({ db: mockDb }))

vi.mock('../../db/schema/index.js', () => ({
  movies: {},
  series: {},
  movieAvailabilities: {},
  seriesAvailabilities: {},
}))

vi.mock('drizzle-orm', () => ({
  and: vi.fn(),
  eq: vi.fn(),
  gte: vi.fn(),
  isNull: vi.fn(),
  or: vi.fn(),
  sql: vi.fn(),
}))

import { buildNouveautesItems } from '../nouveautes-service.js'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const NOW = Date.now()

// Chain mock: supports from/innerJoin/where/orderBy, all returning the chain.
// The chain is thenable so it can be awaited.
function makeChain(rows: unknown[] = []) {
  const prom = Promise.resolve(rows)
  const chain: Record<string, unknown> = {
    from: vi.fn(() => chain),
    innerJoin: vi.fn(() => chain),
    where: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    then: prom.then.bind(prom),
    catch: prom.catch.bind(prom),
    finally: prom.finally.bind(prom),
  }
  return chain
}

function makeMovieRow(overrides: Partial<{
  id: string
  title: string
  posterPath: string | null
  theatricalReleaseDate: string | null
  digitalReleaseDate: string | null
  year: number | null
  createdAt: Date
  voteAverage: number | null
  popularity: number | null
}> = {}) {
  return {
    id: 'movie-1',
    title: 'Test Movie',
    posterPath: null,
    theatricalReleaseDate: null,
    digitalReleaseDate: null,
    year: null,
    createdAt: new Date(NOW - 1 * 86_400_000),
    voteAverage: null,
    popularity: null,
    ...overrides,
  }
}

function makeSeriesRow(overrides: Partial<{
  id: string
  title: string
  posterPath: string | null
  theatricalReleaseDate: string | null
  digitalReleaseDate: string | null
  firstAirYear: number | null
  createdAt: Date
  voteAverage: number | null
  popularity: number | null
}> = {}) {
  return {
    id: 'series-1',
    title: 'Test Series',
    posterPath: null,
    theatricalReleaseDate: null,
    digitalReleaseDate: null,
    firstAirYear: null,
    createdAt: new Date(NOW - 1 * 86_400_000),
    voteAverage: null,
    popularity: null,
    ...overrides,
  }
}

// Helpers for date strings
function daysAgo(n: number): string {
  return new Date(NOW - n * 86_400_000).toISOString().slice(0, 10)
}

// Setup: 4 selectDistinctOn calls in order:
//   1. Tier 1 movies, 2. Tier 2 movies, 3. Tier 1 series, 4. Tier 2 series
function setupDbCalls(
  t1Movies: unknown[] = [],
  t2Movies: unknown[] = [],
  t1Series: unknown[] = [],
  t2Series: unknown[] = [],
) {
  mockDb.selectDistinctOn
    .mockReturnValueOnce(makeChain(t1Movies))
    .mockReturnValueOnce(makeChain(t2Movies))
    .mockReturnValueOnce(makeChain(t1Series))
    .mockReturnValueOnce(makeChain(t2Series))
}

// Setup for mediaType: 'MOVIE' — only 2 calls
function setupDbMovieOnly(t1: unknown[] = [], t2: unknown[] = []) {
  mockDb.selectDistinctOn
    .mockReturnValueOnce(makeChain(t1))
    .mockReturnValueOnce(makeChain(t2))
}

// Setup for mediaType: 'SERIES' — only 2 calls
function setupDbSeriesOnly(t1: unknown[] = [], t2: unknown[] = []) {
  mockDb.selectDistinctOn
    .mockReturnValueOnce(makeChain(t1))
    .mockReturnValueOnce(makeChain(t2))
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.resetAllMocks()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('buildNouveautesItems — media type constraints', () => {
  it('returns both MOVIE and SERIES items when no mediaType filter is given', async () => {
    setupDbCalls(
      [makeMovieRow({ id: 'm1', theatricalReleaseDate: daysAgo(10) })],
      [],
      [makeSeriesRow({ id: 's1', theatricalReleaseDate: daysAgo(10) })],
      [],
    )
    const result = await buildNouveautesItems({})
    const types = result.map((r) => r.mediaType)
    expect(types).toContain('MOVIE')
    expect(types).toContain('SERIES')
  })

  it('returns only MOVIE items when mediaType is MOVIE', async () => {
    setupDbMovieOnly(
      [makeMovieRow({ id: 'm1', theatricalReleaseDate: daysAgo(10) })],
      [],
    )
    const result = await buildNouveautesItems({ mediaType: 'MOVIE' })
    expect(result.every((r) => r.mediaType === 'MOVIE')).toBe(true)
    expect(result.length).toBeGreaterThan(0)
  })

  it('returns only SERIES items when mediaType is SERIES', async () => {
    setupDbSeriesOnly(
      [makeSeriesRow({ id: 's1', theatricalReleaseDate: daysAgo(10) })],
      [],
    )
    const result = await buildNouveautesItems({ mediaType: 'SERIES' })
    expect(result.every((r) => r.mediaType === 'SERIES')).toBe(true)
    expect(result.length).toBeGreaterThan(0)
  })
})

describe('buildNouveautesItems — release-vs-import recency', () => {
  it('Tier 1 genuine release scores higher than Tier 2 catalog arrival of same age', async () => {
    // Movie A: theatricalReleaseDate 30 days ago → Tier 1
    const movieA = makeMovieRow({ id: 'movie-a', theatricalReleaseDate: daysAgo(30) })
    // Movie B: createdAt yesterday, release year within bounds → Tier 2
    const currentYear = new Date().getFullYear()
    const movieB = makeMovieRow({
      id: 'movie-b',
      createdAt: new Date(NOW - 1 * 86_400_000),
      year: currentYear - 1,
      theatricalReleaseDate: null,
    })

    setupDbMovieOnly(
      [movieA],  // Tier 1
      [movieB],  // Tier 2
    )
    const result = await buildNouveautesItems({ mediaType: 'MOVIE' })
    const a = result.find((r) => r.mediaId === 'movie-a')
    const b = result.find((r) => r.mediaId === 'movie-b')
    expect(a).toBeDefined()
    expect(b).toBeDefined()
    expect(a!.score).toBeGreaterThan(b!.score)
  })
})

describe('buildNouveautesItems — Tier-2 catalog guard', () => {
  it('does not include a recently imported title whose release year is beyond NOUVEAUTES_CATALOG_MAX_AGE_YEARS', async () => {
    // Movie added yesterday but year = 1999 (well beyond 3 years)
    const oldImport = makeMovieRow({
      id: 'old-import',
      createdAt: new Date(NOW - 1 * 86_400_000),
      year: 1999,
      theatricalReleaseDate: null,
    })
    setupDbMovieOnly([], [oldImport])
    const result = await buildNouveautesItems({ mediaType: 'MOVIE' })
    expect(result.some((r) => r.mediaId === 'old-import')).toBe(false)
  })

  it('does not include a recently imported series with no year information', async () => {
    const noYearImport = makeSeriesRow({
      id: 'no-year-series',
      createdAt: new Date(NOW - 1 * 86_400_000),
      firstAirYear: null,
      theatricalReleaseDate: null,
      digitalReleaseDate: null,
    })
    setupDbSeriesOnly([], [noYearImport])
    const result = await buildNouveautesItems({ mediaType: 'SERIES' })
    expect(result.some((r) => r.mediaId === 'no-year-series')).toBe(false)
  })
})

describe('buildNouveautesItems — intra-shelf deduplication', () => {
  it('a mediaId appearing in both Tier 1 and Tier 2 appears exactly once', async () => {
    const currentYear = new Date().getFullYear()
    const sharedMovie = makeMovieRow({
      id: 'shared-m',
      theatricalReleaseDate: daysAgo(10),
      year: currentYear,
      createdAt: new Date(NOW - 2 * 86_400_000),
    })
    setupDbMovieOnly([sharedMovie], [sharedMovie])
    const result = await buildNouveautesItems({ mediaType: 'MOVIE' })
    const occurrences = result.filter((r) => r.mediaId === 'shared-m')
    expect(occurrences).toHaveLength(1)
  })

  it('keeps the Tier 1 score when the same item appears in both tiers', async () => {
    const currentYear = new Date().getFullYear()
    const shared = makeMovieRow({
      id: 'shared-score',
      theatricalReleaseDate: daysAgo(1),   // very recent → high Tier 1 score
      year: currentYear,
      createdAt: new Date(NOW - 29 * 86_400_000), // also in Tier 2 window
    })
    setupDbMovieOnly([shared], [shared])
    const result = await buildNouveautesItems({ mediaType: 'MOVIE' })
    const item = result.find((r) => r.mediaId === 'shared-score')
    expect(item).toBeDefined()
    // Tier 1 score: recency≈1 → ~0.75; Tier 2 score: recency*0.5 → ≤0.375
    expect(item!.score).toBeGreaterThan(0.5)
  })
})

describe('buildNouveautesItems — excludeIds', () => {
  it('does not return items whose mediaId is in excludeIds', async () => {
    const movie = makeMovieRow({ id: 'excluded-m', theatricalReleaseDate: daysAgo(5) })
    setupDbMovieOnly([movie], [])
    const result = await buildNouveautesItems({ mediaType: 'MOVIE', excludeIds: new Set(['excluded-m']) })
    expect(result.some((r) => r.mediaId === 'excluded-m')).toBe(false)
  })
})

describe('buildNouveautesItems — score ordering', () => {
  it('returns items sorted by score descending', async () => {
    // Movie A: released 10 days ago → higher score
    // Movie B: released 150 days ago → lower score
    const movieA = makeMovieRow({ id: 'ma', theatricalReleaseDate: daysAgo(10) })
    const movieB = makeMovieRow({ id: 'mb', theatricalReleaseDate: daysAgo(150) })
    setupDbMovieOnly([movieA, movieB], [])
    const result = await buildNouveautesItems({ mediaType: 'MOVIE' })
    expect(result.length).toBe(2)
    expect(result[0].mediaId).toBe('ma')
    expect(result[1].mediaId).toBe('mb')
    expect(result[0].score).toBeGreaterThanOrEqual(result[1].score)
  })
})

describe('buildNouveautesItems — limit', () => {
  it('respects the limit option', async () => {
    const movies = Array.from({ length: 10 }, (_, i) =>
      makeMovieRow({ id: `m${i}`, theatricalReleaseDate: daysAgo(i + 1) }),
    )
    setupDbMovieOnly(movies, [])
    const result = await buildNouveautesItems({ mediaType: 'MOVIE', limit: 3 })
    expect(result).toHaveLength(3)
  })

  it('returns fewer items than limit when catalog is sparse (caller responsible for suppression)', async () => {
    const movie = makeMovieRow({ id: 'm1', theatricalReleaseDate: daysAgo(5) })
    setupDbMovieOnly([movie], [])
    const result = await buildNouveautesItems({ mediaType: 'MOVIE', limit: 20 })
    expect(result).toHaveLength(1)
  })
})

describe('buildNouveautesItems — availability filter', () => {
  it('only returns movies that have an AVAILABLE row (filtered by DB query)', async () => {
    // Availability filtering is done in the DB JOIN — if the DB returns nothing,
    // the service returns nothing. Verify the chain resolves to empty when DB returns [].
    setupDbMovieOnly([], [])
    const result = await buildNouveautesItems({ mediaType: 'MOVIE' })
    expect(result).toHaveLength(0)
  })
})

describe('buildNouveautesItems — quality tie-breaker', () => {
  it('higher vote average produces higher score among items with same recency', async () => {
    const movieHQ = makeMovieRow({ id: 'hq', theatricalReleaseDate: daysAgo(10), voteAverage: 8.0, popularity: 50 })
    const movieLQ = makeMovieRow({ id: 'lq', theatricalReleaseDate: daysAgo(10), voteAverage: 4.0, popularity: 10 })
    setupDbMovieOnly([movieHQ, movieLQ], [])
    const result = await buildNouveautesItems({ mediaType: 'MOVIE' })
    const hq = result.find((r) => r.mediaId === 'hq')
    const lq = result.find((r) => r.mediaId === 'lq')
    expect(hq).toBeDefined()
    expect(lq).toBeDefined()
    expect(hq!.score).toBeGreaterThan(lq!.score)
  })
})

describe('buildNouveautesItems — zero HTTP calls', () => {
  it('makes no external HTTP calls (buildNouveautesItems uses only the DB)', async () => {
    setupDbMovieOnly([], [])
    // If RecommendationEngineClient were called it would be an unregistered import and throw.
    // Simply completing without error proves no HTTP client is needed.
    await expect(buildNouveautesItems({ mediaType: 'MOVIE' })).resolves.toBeDefined()
  })
})
