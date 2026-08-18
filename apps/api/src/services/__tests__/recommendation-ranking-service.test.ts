import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockDb = vi.hoisted(() => ({
  select: vi.fn(),
}))

vi.mock('../../db/client.js', () => ({ db: mockDb }))

import { rankRecommendations } from '../recommendation-ranking-service.js'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROFILE_ID = '00000000-0000-0000-0000-000000000001'
const MOVIE_ID_A = 'aaaaaaaa-0000-0000-0000-000000000001'
const MOVIE_ID_B = 'aaaaaaaa-0000-0000-0000-000000000002'
const MOVIE_ID_C = 'aaaaaaaa-0000-0000-0000-000000000003'
const SERIES_ID_A = 'bbbbbbbb-0000-0000-0000-000000000001'
const DISCOVERY_ID_1 = 'dddddddd-0000-0000-0000-000000000001'
const DISCOVERY_ID_2 = 'dddddddd-0000-0000-0000-000000000002'

const GENRE_ACTION = { id: 'genre-action-0000-0000-000000000001', slug: 'action', name: 'Action' }
const GENRE_DRAMA = { id: 'genre-drama-0000-0000-000000000001', slug: 'drama', name: 'Drama' }

const PROFILE_ROW = [{ id: PROFILE_ID }]

const WARM_TASTE = {
  profileId: PROFILE_ID,
  genreScores: { [GENRE_ACTION.id]: 3 },
  genreMeta: { [GENRE_ACTION.id]: { slug: GENRE_ACTION.slug, name: GENRE_ACTION.name } },
  positiveMediaIds: [],
  negativeMediaIds: [],
  signalCount: 2,
  builtAt: new Date('2024-01-01'),
}

const COLD_TASTE = {
  profileId: PROFILE_ID,
  genreScores: {},
  genreMeta: {},
  positiveMediaIds: [],
  negativeMediaIds: [],
  signalCount: 0,
  builtAt: new Date('2024-01-01'),
}

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

// db.select({...}).from(X).where(Y) → rows
function setupSelectWhere(rows: unknown[]) {
  mockDb.select.mockReturnValueOnce({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(rows),
    }),
  })
}

// db.select({...}).from(X) → rows (no .where())
function setupSelectFrom(rows: unknown[]) {
  mockDb.select.mockReturnValueOnce({
    from: vi.fn().mockResolvedValue(rows),
  })
}

// Standard 10-query setup matching the Promise.all order in the service:
// 1. profile check (where)
// 2. taste row (where)
// 3. movies (from)
// 4. series (from)
// 5. movie genres (from)
// 6. series genres (from)
// 7. discovery candidates (where)
// 8. movie availabilities (where)
// 9. series availabilities (where)
// 10. viewing progress (where)
function setupQueries({
  profileExists = true,
  tasteRow = WARM_TASTE as object | null,
  movieRows = [] as object[],
  seriesRows = [] as object[],
  movieGenreRows = [] as object[],
  seriesGenreRows = [] as object[],
  discoveryCandidates = [] as object[],
  availableMovieRows = [] as object[],
  availableSeriesRows = [] as object[],
  progressRows = [] as object[],
} = {}) {
  setupSelectWhere(profileExists ? PROFILE_ROW : [])
  setupSelectWhere(tasteRow ? [tasteRow] : [])
  setupSelectFrom(movieRows)
  setupSelectFrom(seriesRows)
  setupSelectFrom(movieGenreRows)
  setupSelectFrom(seriesGenreRows)
  setupSelectWhere(discoveryCandidates)
  setupSelectWhere(availableMovieRows)
  setupSelectWhere(availableSeriesRows)
  setupSelectWhere(progressRows)
}

beforeEach(() => {
  vi.resetAllMocks()
})

// ---------------------------------------------------------------------------
// Scenario 1: Positive genre affinity
// ---------------------------------------------------------------------------

describe('scenario 1 — positive genre affinity', () => {
  it('candidate with matching liked genre scores higher than unrelated one', async () => {
    setupQueries({
      movieRows: [
        { id: MOVIE_ID_A, title: 'Action Movie', year: 2021, posterPath: null },
        { id: MOVIE_ID_B, title: 'Other Movie', year: 2022, posterPath: null },
      ],
      movieGenreRows: [{ movieId: MOVIE_ID_A, genreId: GENRE_ACTION.id }],
    })

    const result = await rankRecommendations(PROFILE_ID)

    expect(result.coldStart).toBe(false)
    expect(result.candidates).toHaveLength(2)
    const [first, second] = result.candidates
    expect(first.mediaId).toBe(MOVIE_ID_A)
    expect(first.score).toBe(3)
    expect(first.reasons).toContain('Action')
    expect(second.mediaId).toBe(MOVIE_ID_B)
    expect(second.score).toBe(0)
    expect(second.reasons).toEqual(['discovery'])
  })
})

// ---------------------------------------------------------------------------
// Scenario 2: Negative feedback exclusion
// ---------------------------------------------------------------------------

describe('scenario 2 — negative feedback exclusion', () => {
  it('media in negativeMediaIds is absent from results', async () => {
    setupQueries({
      tasteRow: { ...WARM_TASTE, negativeMediaIds: [MOVIE_ID_C] },
      movieRows: [
        { id: MOVIE_ID_A, title: 'Good Movie', year: 2021, posterPath: null },
        { id: MOVIE_ID_C, title: 'Disliked Movie', year: 2020, posterPath: null },
      ],
    })

    const result = await rankRecommendations(PROFILE_ID)

    const ids = result.candidates.map((c) => c.mediaId)
    expect(ids).toContain(MOVIE_ID_A)
    expect(ids).not.toContain(MOVIE_ID_C)
  })
})

// ---------------------------------------------------------------------------
// Scenario 3: availableToMe = true
// ---------------------------------------------------------------------------

describe('scenario 3 — availableToMe filter', () => {
  it('returns only candidates with AVAILABLE status when availableToMe=true', async () => {
    setupQueries({
      movieRows: [
        { id: MOVIE_ID_A, title: 'Available Movie', year: 2021, posterPath: null },
        { id: MOVIE_ID_B, title: 'Unavailable Movie', year: 2022, posterPath: null },
      ],
      availableMovieRows: [{ movieId: MOVIE_ID_A }],
    })

    const result = await rankRecommendations(PROFILE_ID, { availableToMe: true })

    expect(result.candidates).toHaveLength(1)
    expect(result.candidates[0].mediaId).toBe(MOVIE_ID_A)
    expect(result.candidates[0].available).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Scenario 4: Seen-content suppression (movie ≥ 90%)
// ---------------------------------------------------------------------------

describe('scenario 4 — seen-content suppression', () => {
  it('completed movie ranks below unseen movie with identical genre match', async () => {
    setupQueries({
      movieRows: [
        { id: MOVIE_ID_A, title: 'Seen Movie', year: 2020, posterPath: null },
        { id: MOVIE_ID_B, title: 'Unseen Movie', year: 2021, posterPath: null },
      ],
      movieGenreRows: [
        { movieId: MOVIE_ID_A, genreId: GENRE_ACTION.id },
        { movieId: MOVIE_ID_B, genreId: GENRE_ACTION.id },
      ],
      progressRows: [{ mediaId: MOVIE_ID_A, progressSeconds: 95, durationSeconds: 100 }],
    })

    const result = await rankRecommendations(PROFILE_ID)

    const seen = result.candidates.find((c) => c.mediaId === MOVIE_ID_A)!
    const unseen = result.candidates.find((c) => c.mediaId === MOVIE_ID_B)!
    expect(seen.score).toBeLessThan(unseen.score)
    expect(result.candidates[0].mediaId).toBe(MOVIE_ID_B)
  })

  it('completed movie is present and unpenalised when includeSeen=true', async () => {
    setupQueries({
      movieRows: [{ id: MOVIE_ID_A, title: 'Seen Movie', year: 2020, posterPath: null }],
      movieGenreRows: [{ movieId: MOVIE_ID_A, genreId: GENRE_ACTION.id }],
      progressRows: [{ mediaId: MOVIE_ID_A, progressSeconds: 95, durationSeconds: 100 }],
    })

    const result = await rankRecommendations(PROFILE_ID, { includeSeen: true })

    expect(result.candidates[0].mediaId).toBe(MOVIE_ID_A)
    expect(result.candidates[0].score).toBe(3) // no penalty
  })
})

// ---------------------------------------------------------------------------
// Scenario 5: Local + discovery mix / deduplication
// ---------------------------------------------------------------------------

describe('scenario 5 — local and discovery candidates with deduplication', () => {
  it('discovery candidate without canonical link appears in results', async () => {
    setupQueries({
      movieRows: [{ id: MOVIE_ID_A, title: 'Local Movie', year: 2020, posterPath: null }],
      discoveryCandidates: [
        {
          id: DISCOVERY_ID_1,
          title: 'Discovery Movie',
          year: 2023,
          posterPath: null,
          mediaType: 'MOVIE',
          popularity: 10,
          voteAverage: 8,
          canonicalMovieId: null,
          canonicalSeriesId: null,
          expiresAt: new Date(Date.now() + 86400000),
        },
      ],
    })

    const result = await rankRecommendations(PROFILE_ID)

    const ids = result.candidates.map((c) => c.mediaId)
    expect(ids).toContain(MOVIE_ID_A)
    expect(ids).toContain(DISCOVERY_ID_1)
    const discoveryCand = result.candidates.find((c) => c.mediaId === DISCOVERY_ID_1)!
    expect(discoveryCand.source).toBe('DISCOVERY')
  })

  it('discovery candidate linked to a local movie is deduped (local kept)', async () => {
    setupQueries({
      movieRows: [{ id: MOVIE_ID_A, title: 'Local Movie', year: 2020, posterPath: null }],
      discoveryCandidates: [
        {
          id: DISCOVERY_ID_2,
          title: 'Duplicate via Discovery',
          year: 2020,
          posterPath: null,
          mediaType: 'MOVIE',
          popularity: 50,
          voteAverage: 9,
          canonicalMovieId: MOVIE_ID_A,
          canonicalSeriesId: null,
          expiresAt: new Date(Date.now() + 86400000),
        },
      ],
    })

    const result = await rankRecommendations(PROFILE_ID)

    expect(result.candidates).toHaveLength(1)
    expect(result.candidates[0].mediaId).toBe(MOVIE_ID_A)
    expect(result.candidates[0].source).toBe('LOCAL')
  })
})

// ---------------------------------------------------------------------------
// Scenario 6: Cold-start
// ---------------------------------------------------------------------------

describe('scenario 6 — cold-start', () => {
  it('signalCount=0 → sorted by popularity×voteAverage, coldStart=true, reasons=["popular pick"]', async () => {
    setupQueries({
      tasteRow: COLD_TASTE,
      discoveryCandidates: [
        {
          id: DISCOVERY_ID_1,
          title: 'Popular',
          year: 2023,
          posterPath: null,
          mediaType: 'MOVIE',
          popularity: 100,
          voteAverage: 8,
          canonicalMovieId: null,
          canonicalSeriesId: null,
          expiresAt: new Date(Date.now() + 86400000),
        },
        {
          id: DISCOVERY_ID_2,
          title: 'Less Popular',
          year: 2023,
          posterPath: null,
          mediaType: 'MOVIE',
          popularity: 50,
          voteAverage: 7,
          canonicalMovieId: null,
          canonicalSeriesId: null,
          expiresAt: new Date(Date.now() + 86400000),
        },
      ],
    })

    const result = await rankRecommendations(PROFILE_ID)

    expect(result.coldStart).toBe(true)
    expect(result.candidates[0].mediaId).toBe(DISCOVERY_ID_1) // 100*8=800 > 50*7=350
    expect(result.candidates[1].mediaId).toBe(DISCOVERY_ID_2)
    for (const c of result.candidates) {
      expect(c.reasons).toEqual(['popular pick'])
    }
  })

  it('no taste row at all is treated as cold-start', async () => {
    setupQueries({ tasteRow: null })

    const result = await rankRecommendations(PROFILE_ID)

    expect(result.coldStart).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Scenario 7: Determinism
// ---------------------------------------------------------------------------

describe('scenario 7 — determinism', () => {
  it('same inputs called twice return identical ordering', async () => {
    const makeSetup = () =>
      setupQueries({
        movieRows: [
          { id: MOVIE_ID_A, title: 'Movie A', year: 2020, posterPath: null },
          { id: MOVIE_ID_B, title: 'Movie B', year: 2021, posterPath: null },
        ],
        movieGenreRows: [{ movieId: MOVIE_ID_A, genreId: GENRE_ACTION.id }],
      })

    makeSetup()
    const result1 = await rankRecommendations(PROFILE_ID)

    makeSetup()
    const result2 = await rankRecommendations(PROFILE_ID)

    expect(result1.candidates.map((c) => c.mediaId)).toEqual(result2.candidates.map((c) => c.mediaId))
    expect(result1.candidates.map((c) => c.score)).toEqual(result2.candidates.map((c) => c.score))
  })
})

// ---------------------------------------------------------------------------
// Scenario 8: positiveMediaIds bonus
// ---------------------------------------------------------------------------

describe('scenario 8 — positiveMediaIds bonus', () => {
  it('explicitly liked media ranks at top even without genre match', async () => {
    setupQueries({
      tasteRow: {
        ...WARM_TASTE,
        positiveMediaIds: [MOVIE_ID_B],
        genreScores: { [GENRE_ACTION.id]: 3 },
        genreMeta: { [GENRE_ACTION.id]: { slug: 'action', name: 'Action' } },
      },
      movieRows: [
        { id: MOVIE_ID_A, title: 'Action Movie', year: 2020, posterPath: null },
        { id: MOVIE_ID_B, title: 'Liked Movie (no genre)', year: 2021, posterPath: null },
      ],
      // MOVIE_A has Action genre, MOVIE_B has no genre but is in positiveMediaIds
      movieGenreRows: [{ movieId: MOVIE_ID_A, genreId: GENRE_ACTION.id }],
    })

    const result = await rankRecommendations(PROFILE_ID)

    // MOVIE_B: 0 (genre) + 5 (positive) = 5 > MOVIE_A: 3 (genre) + 0 = 3
    expect(result.candidates[0].mediaId).toBe(MOVIE_ID_B)
    expect(result.candidates[0].reasons).toContain('liked')
    expect(result.candidates[0].score).toBe(5)
    expect(result.candidates[1].mediaId).toBe(MOVIE_ID_A)
  })
})

// ---------------------------------------------------------------------------
// Scenario 9: mediaType filter
// ---------------------------------------------------------------------------

describe('scenario 9 — mediaType filter', () => {
  it('mediaType=MOVIE returns no series candidates', async () => {
    setupQueries({
      movieRows: [{ id: MOVIE_ID_A, title: 'Movie A', year: 2020, posterPath: null }],
      seriesRows: [{ id: SERIES_ID_A, title: 'Series A', year: 2021, posterPath: null }],
      discoveryCandidates: [
        {
          id: DISCOVERY_ID_1,
          title: 'Discovery Series',
          year: 2022,
          posterPath: null,
          mediaType: 'SERIES',
          popularity: 100,
          voteAverage: 9,
          canonicalMovieId: null,
          canonicalSeriesId: null,
          expiresAt: new Date(Date.now() + 86400000),
        },
      ],
    })

    const result = await rankRecommendations(PROFILE_ID, { mediaType: 'MOVIE' })

    const types = result.candidates.map((c) => c.mediaType)
    expect(types.every((t) => t === 'MOVIE')).toBe(true)
    expect(result.candidates.find((c) => c.mediaId === SERIES_ID_A)).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Scenario 10: availabilityPolicy
// ---------------------------------------------------------------------------

describe('scenario 10 — availabilityPolicy', () => {
  it('WATCH_NOW policy excludes movie with no availability', async () => {
    setupQueries({
      movieRows: [
        { id: MOVIE_ID_A, title: 'Available Movie', year: 2021, posterPath: null, status: null },
        { id: MOVIE_ID_B, title: 'Unavailable Movie', year: 2022, posterPath: null, status: null },
      ],
      availableMovieRows: [{ movieId: MOVIE_ID_A }],
    })

    const result = await rankRecommendations(PROFILE_ID, { availabilityPolicy: 'WATCH_NOW' })

    expect(result.candidates).toHaveLength(1)
    expect(result.candidates[0].mediaId).toBe(MOVIE_ID_A)
  })

  it('DISCOVERY policy includes movie with no availability', async () => {
    setupQueries({
      movieRows: [
        { id: MOVIE_ID_A, title: 'Available Movie', year: 2021, posterPath: null, status: null },
        { id: MOVIE_ID_B, title: 'Unavailable Movie', year: 2022, posterPath: null, status: null },
      ],
      availableMovieRows: [{ movieId: MOVIE_ID_A }],
    })

    const result = await rankRecommendations(PROFILE_ID, { availabilityPolicy: 'DISCOVERY' })

    const ids = result.candidates.map((c) => c.mediaId)
    expect(ids).toContain(MOVIE_ID_A)
    expect(ids).toContain(MOVIE_ID_B)
  })

  it('UPCOMING policy returns only movies with upcoming status', async () => {
    setupQueries({
      movieRows: [
        { id: MOVIE_ID_A, title: 'Released Movie', year: 2021, posterPath: null, status: 'Released' },
        { id: MOVIE_ID_B, title: 'Upcoming Movie', year: 2025, posterPath: null, status: 'In Production' },
      ],
    })

    const result = await rankRecommendations(PROFILE_ID, { availabilityPolicy: 'UPCOMING' })

    expect(result.candidates).toHaveLength(1)
    expect(result.candidates[0].mediaId).toBe(MOVIE_ID_B)
  })

  it('ALL policy includes unavailable titles (same as DISCOVERY)', async () => {
    setupQueries({
      movieRows: [
        { id: MOVIE_ID_A, title: 'Available Movie', year: 2021, posterPath: null, status: null },
        { id: MOVIE_ID_B, title: 'Unavailable Movie', year: 2022, posterPath: null, status: null },
      ],
      availableMovieRows: [{ movieId: MOVIE_ID_A }],
    })

    const result = await rankRecommendations(PROFILE_ID, { availabilityPolicy: 'ALL' })

    const ids = result.candidates.map((c) => c.mediaId)
    expect(ids).toContain(MOVIE_ID_A)
    expect(ids).toContain(MOVIE_ID_B)
  })
})

// ============================================================================
// rankHybrid — pure-function tests (no DB mocking required)
// ============================================================================

import { rankHybrid } from '../recommendation-ranking-service.js'
import type {
  HybridCandidate,
  TasteSignals,
} from '../recommendation-ranking-service.js'

const GENRE_ACTION_ID = 'genre-action-0000-0000-000000000001'
const GENRE_DRAMA_ID = 'genre-drama-0000-0000-000000000001'
const GENRE_FAMILY_ID = 'genre-family-0000-0000-000000000001'
const GENRE_THRILLER_ID = 'genre-thriller-000-0000-000000000001'

function makeCandidate(
  id: string,
  overrides: Partial<HybridCandidate> = {},
): HybridCandidate {
  return {
    mediaId: id,
    mediaType: 'MOVIE',
    title: `Title ${id}`,
    year: 2020,
    posterPath: null,
    source: 'LOCAL',
    similarity: 0.6,
    genreIds: [],
    genreNames: [],
    popularity: 50,
    voteAverage: 7,
    available: true,
    status: null,
    collectionId: null,
    directors: [],
    keywords: [],
    durationMinutes: null,
    originalLanguage: null,
    completionRatio: null,
    ...overrides,
  }
}

const EMPTY_QUERY_PLAN = {
  schemaVersion: '1' as const,
  rawQuery: 'test',
  displayTitle: 'test',
  semanticIntent: 'test',
  desiredThemes: [],
  desiredTone: [],
  avoidSignals: [],
  mediaTypes: [] as ('MOVIE' | 'SERIES')[],
  hardFilters: {},
  softPreferences: {},
  userConstraints: [],
  plannerFallback: true,
  plannerMeta: null,
}

// ---------------------------------------------------------------------------
// Scenario 11 — Profile A vs Profile B produce different orderings
// ---------------------------------------------------------------------------

describe('scenario 11 — profile taste separates results', () => {
  it('Profile A (action) and Profile B (family/drama) top-5 overlap ≤ 3 on same pool', () => {
    const actionCandidates = Array.from({ length: 10 }, (_, i) =>
      makeCandidate(`action-${i}`, {
        genreIds: [GENRE_ACTION_ID, GENRE_THRILLER_ID],
        genreNames: ['Action', 'Thriller'],
        similarity: 0.6,
      }),
    )
    const familyCandidates = Array.from({ length: 10 }, (_, i) =>
      makeCandidate(`family-${i}`, {
        genreIds: [GENRE_FAMILY_ID, GENRE_DRAMA_ID],
        genreNames: ['Family', 'Drama'],
        similarity: 0.6,
      }),
    )
    const pool = [...actionCandidates, ...familyCandidates]

    const tasteA: TasteSignals = {
      genreScores: { [GENRE_ACTION_ID]: 5, [GENRE_THRILLER_ID]: 4, [GENRE_DRAMA_ID]: 1, [GENRE_FAMILY_ID]: 0 },
      genreNames: { [GENRE_ACTION_ID]: 'Action', [GENRE_THRILLER_ID]: 'Thriller' },
      positiveMediaIds: new Set(),
      negativeMediaIds: new Set(),
      signalCount: 10,
    }

    const tasteB: TasteSignals = {
      genreScores: { [GENRE_FAMILY_ID]: 5, [GENRE_DRAMA_ID]: 4, [GENRE_ACTION_ID]: 1, [GENRE_THRILLER_ID]: 0 },
      genreNames: { [GENRE_FAMILY_ID]: 'Family', [GENRE_DRAMA_ID]: 'Drama' },
      positiveMediaIds: new Set(),
      negativeMediaIds: new Set(),
      signalCount: 10,
    }

    const opts = { limit: 10, diversityEnabled: false, explorationLevel: 'exploit' as const }
    const topA = rankHybrid(pool, EMPTY_QUERY_PLAN, tasteA, opts).slice(0, 5).map((c) => c.mediaId)
    const topB = rankHybrid(pool, EMPTY_QUERY_PLAN, tasteB, opts).slice(0, 5).map((c) => c.mediaId)

    const setA = new Set(topA)
    const overlap = topB.filter((id) => setA.has(id)).length
    expect(overlap).toBeLessThanOrEqual(3)
  })
})

// ---------------------------------------------------------------------------
// Scenario 12 — hardFilters.maxRuntimeMinutes removes violating candidates
// ---------------------------------------------------------------------------

describe('scenario 12 — hard filter maxRuntimeMinutes', () => {
  it('candidate exceeding maxRuntimeMinutes is absent regardless of similarity', () => {
    const longMovie = makeCandidate('long-movie', { durationMinutes: 200, similarity: 0.99 })
    const shortMovie = makeCandidate('short-movie', { durationMinutes: 90, similarity: 0.50 })

    const plan = {
      ...EMPTY_QUERY_PLAN,
      hardFilters: { maxRuntimeMinutes: 120 },
    }

    const result = rankHybrid([longMovie, shortMovie], plan, null, { diversityEnabled: false })
    const ids = result.map((c) => c.mediaId)

    expect(ids).not.toContain('long-movie')
    expect(ids).toContain('short-movie')
  })
})

// ---------------------------------------------------------------------------
// Scenario 13 — negativeMediaIds never in top-10 when 10+ alternatives exist
// ---------------------------------------------------------------------------

describe('scenario 13 — negative media penalty', () => {
  it('disliked item does not appear in top-10 when 10+ other candidates exist', () => {
    const dislikedId = 'disliked-media-id'
    const others = Array.from({ length: 12 }, (_, i) => makeCandidate(`other-${i}`))
    const disliked = makeCandidate(dislikedId, { similarity: 0.99 })

    const taste: TasteSignals = {
      genreScores: {},
      genreNames: {},
      positiveMediaIds: new Set(),
      negativeMediaIds: new Set([dislikedId]),
      signalCount: 5,
    }

    const result = rankHybrid([disliked, ...others], EMPTY_QUERY_PLAN, taste, {
      limit: 24,
      diversityEnabled: false,
    })

    const top10Ids = result.slice(0, 10).map((c) => c.mediaId)
    expect(top10Ids).not.toContain(dislikedId)
  })
})

// ---------------------------------------------------------------------------
// Scenario 14 — franchise diversity cap
// ---------------------------------------------------------------------------

describe('scenario 14 — franchise diversity cap', () => {
  it('same collection capped at maxPerCollection in output', () => {
    const COLL = 'franchise-coll-id'
    const franchiseCandidates = Array.from({ length: 5 }, (_, i) =>
      makeCandidate(`franchise-${i}`, { collectionId: COLL, similarity: 0.9 - i * 0.01 }),
    )
    const others = Array.from({ length: 15 }, (_, i) =>
      makeCandidate(`other-${i}`, { similarity: 0.5 }),
    )

    const result = rankHybrid([...franchiseCandidates, ...others], EMPTY_QUERY_PLAN, null, {
      limit: 10,
      diversityEnabled: true,
      maxPerCollection: 2,
    })

    const franchiseCount = result.filter((c) => c.collectionId === COLL).length
    expect(franchiseCount).toBeLessThanOrEqual(2)
  })
})

// ---------------------------------------------------------------------------
// Scenario 15 — explorationLevel "discover" promotes high-quality item
// ---------------------------------------------------------------------------

describe('scenario 15 — explorationLevel discover', () => {
  it('discover mode promotes high qualityPrior item above taste-aligned obscure item', () => {
    // Taste-aligned but obscure: good genre match, low popularity
    const tasteAligned = makeCandidate('taste-aligned', {
      genreIds: [GENRE_ACTION_ID],
      genreNames: ['Action'],
      popularity: 5,
      voteAverage: 6,
      similarity: 0.3,
    })
    // High quality but no genre affinity, popular
    const highQuality = makeCandidate('high-quality', {
      genreIds: [GENRE_DRAMA_ID],
      genreNames: ['Drama'],
      popularity: 90,
      voteAverage: 9,
      similarity: 0.3,
    })

    const taste: TasteSignals = {
      genreScores: { [GENRE_ACTION_ID]: 5 },
      genreNames: { [GENRE_ACTION_ID]: 'Action' },
      positiveMediaIds: new Set(),
      negativeMediaIds: new Set(),
      signalCount: 10,
    }

    const result = rankHybrid(
      [tasteAligned, highQuality],
      EMPTY_QUERY_PLAN,
      taste,
      { explorationLevel: 'discover', diversityEnabled: false },
    )

    expect(result[0].mediaId).toBe('high-quality')
  })
})

// ---------------------------------------------------------------------------
// Scenario 16 — debug mode populates scoreBreakdown.reasons
// ---------------------------------------------------------------------------

describe('scenario 16 — debug scoreBreakdown', () => {
  it('debug:true gives every result a scoreBreakdown with at least one reason', () => {
    const candidates = Array.from({ length: 5 }, (_, i) => makeCandidate(`m-${i}`))

    const result = rankHybrid(candidates, EMPTY_QUERY_PLAN, null, {
      debug: true,
      diversityEnabled: false,
    })

    for (const c of result) {
      expect(c.scoreBreakdown).toBeDefined()
      expect(c.scoreBreakdown!.reasons.length).toBeGreaterThanOrEqual(1)
      expect(c.scoreBreakdown!.modelVersion).toBe('v1')
    }
  })

  it('debug:false gives no scoreBreakdown', () => {
    const candidates = [makeCandidate('m-1')]
    const result = rankHybrid(candidates, EMPTY_QUERY_PLAN, null, { debug: false })
    expect(result[0].scoreBreakdown).toBeUndefined()
  })
})
