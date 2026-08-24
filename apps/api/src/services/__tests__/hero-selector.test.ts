import { describe, it, expect, beforeEach, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Module mocks (hoisted)
// ---------------------------------------------------------------------------

vi.mock('../../config/env.js', () => ({
  HERO_MIN_SCORE: 0.55,
}))

const mockDb = vi.hoisted(() => ({
  select: vi.fn(),
}))
vi.mock('../../db/client.js', () => ({ db: mockDb }))

vi.mock('../../db/schema/index.js', () => ({
  explicitFeedback: {},
  movies: {},
  series: {},
  mediaVideos: {},
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  and: vi.fn(),
  inArray: vi.fn(),
}))

vi.mock('../../lib/tmdb-image.js', () => ({
  resolveMediaImageUrl: vi.fn((p: string | null) => (p ? `https://img${p}` : null)),
}))

import { selectHero } from '../hero-selector.js'
import type { ShelfCandidateItem } from '../../client/recommendation-engine-client.js'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PROFILE_ID = '00000000-0000-0000-0000-000000000001'
const MEDIA_ID_A = 'aaaaaaaa-0000-0000-0000-000000000001'
const MEDIA_ID_B = 'bbbbbbbb-0000-0000-0000-000000000002'
const MEDIA_ID_C = 'cccccccc-0000-0000-0000-000000000003'

function makeCandidate(overrides: Partial<ShelfCandidateItem> = {}): ShelfCandidateItem {
  return {
    mediaId: MEDIA_ID_A,
    mediaType: 'MOVIE',
    semanticScore: 0.8,
    profileScore: 0.8,
    finalScore: 0.8,
    reasons: [],
    available: true,
    ...overrides,
  }
}

function makeChain(resolveWith: unknown[] = []) {
  const prom = Promise.resolve(resolveWith)
  const chain: Record<string, unknown> = {
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    limit: vi.fn(() => prom),
    then: prom.then.bind(prom),
    catch: prom.catch.bind(prom),
    finally: prom.finally.bind(prom),
  }
  return chain
}

beforeEach(() => {
  // mockReset clears both calls AND the mockReturnValueOnce queue to prevent bleed between tests.
  mockDb.select.mockReset()
  mockDb.select.mockReturnValue(makeChain())
})

// ---------------------------------------------------------------------------
// Helpers for setting up DB mocks in call order.
//
// Call order in selectHero:
//   For MOVIE-only candidates:   [disliked, movies, movie_trailers]
//   For SERIES-only candidates:  [disliked, series, series_trailers]
//   For mixed candidates:        [disliked, movies, series, movie_trailers, series_trailers]
// ---------------------------------------------------------------------------

function setupMovieMocks({
  disliked = [] as string[],
  movies: movieRows = [] as { id: string; title: string; synopsis: string | null; backdropPath: string | null }[],
  movieTrailers = [] as { mediaId: string; youtubeKey: string }[],
} = {}) {
  mockDb.select
    .mockReturnValueOnce(makeChain(disliked.map((id) => ({ mediaId: id }))))
    .mockReturnValueOnce(makeChain(movieRows))
    .mockReturnValueOnce(makeChain(movieTrailers))
}

function setupSeriesMocks({
  disliked = [] as string[],
  seriesRows = [] as { id: string; title: string; synopsis: string | null; backdropPath: string | null }[],
  seriesTrailers = [] as { mediaId: string; youtubeKey: string }[],
} = {}) {
  mockDb.select
    .mockReturnValueOnce(makeChain(disliked.map((id) => ({ mediaId: id }))))
    .mockReturnValueOnce(makeChain(seriesRows))
    .mockReturnValueOnce(makeChain(seriesTrailers))
}

// ---------------------------------------------------------------------------
// Passing all quality gates → hero selected
// ---------------------------------------------------------------------------

describe('hero selected when all gates pass', () => {
  it('returns a HeroItem for the best-scoring available movie candidate', async () => {
    setupMovieMocks({
      movies: [{ id: MEDIA_ID_A, title: 'Great Film', synopsis: 'A great film.', backdropPath: '/bd/great.jpg' }],
      movieTrailers: [{ mediaId: MEDIA_ID_A, youtubeKey: 'ytKey123' }],
    })

    const result = await selectHero(PROFILE_ID, [makeCandidate()])

    expect(result).not.toBeNull()
    expect(result?.mediaId).toBe(MEDIA_ID_A)
    expect(result?.title).toBe('Great Film')
    expect(result?.backdropUrl).toBe('https://img/bd/great.jpg')
    expect(result?.trailerKey).toBe('ytKey123')
    expect(result?.availabilityStatus).toBe('available')
  })
})

// ---------------------------------------------------------------------------
// Missing backdropUrl → excluded
// ---------------------------------------------------------------------------

describe('backdropUrl gate', () => {
  it('returns null when candidate has no backdropPath', async () => {
    setupMovieMocks({
      movies: [{ id: MEDIA_ID_A, title: 'No Backdrop', synopsis: null, backdropPath: null }],
    })

    const result = await selectHero(PROFILE_ID, [makeCandidate()])
    expect(result).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Low finalScore → excluded
// ---------------------------------------------------------------------------

describe('score gate', () => {
  it('returns null when finalScore is below HERO_MIN_SCORE (0.55)', async () => {
    // Candidate is filtered before DB queries, so only 1 call for disliked (early return at eligibleCandidates.length === 0)
    const result = await selectHero(PROFILE_ID, [makeCandidate({ finalScore: 0.40 })])
    expect(result).toBeNull()
    // DB should not be called at all since eligibleCandidates is empty
    expect(mockDb.select).not.toHaveBeenCalled()
  })

  it('returns null when candidate is not available', async () => {
    const result = await selectHero(PROFILE_ID, [makeCandidate({ available: false })])
    expect(result).toBeNull()
    expect(mockDb.select).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// DISLIKE feedback → excluded
// ---------------------------------------------------------------------------

describe('dislike gate', () => {
  it('returns null when the only candidate is disliked', async () => {
    setupMovieMocks({
      disliked: [MEDIA_ID_A],
      movies: [{ id: MEDIA_ID_A, title: 'Disliked Film', synopsis: null, backdropPath: '/bd/d.jpg' }],
    })

    const result = await selectHero(PROFILE_ID, [makeCandidate()])
    expect(result).toBeNull()
  })

  it('skips disliked candidate and picks next eligible one', async () => {
    // Both candidates are MOVIE, MEDIA_ID_A is disliked. nonDisliked = [MEDIA_ID_B].
    // Call order: disliked, movies([MEDIA_ID_B]), movie_trailers
    setupMovieMocks({
      disliked: [MEDIA_ID_A],
      movies: [{ id: MEDIA_ID_B, title: 'Second Film', synopsis: null, backdropPath: '/bd/second.jpg' }],
    })

    const candidates = [
      makeCandidate({ mediaId: MEDIA_ID_A, finalScore: 0.9 }),
      makeCandidate({ mediaId: MEDIA_ID_B, finalScore: 0.7 }),
    ]

    const result = await selectHero(PROFILE_ID, candidates)
    expect(result?.mediaId).toBe(MEDIA_ID_B)
  })
})

// ---------------------------------------------------------------------------
// No passing candidate → null returned (no hero)
// ---------------------------------------------------------------------------

describe('no-hero fallback', () => {
  it('returns null when candidate list is empty', async () => {
    const result = await selectHero(PROFILE_ID, [])
    expect(result).toBeNull()
  })

  it('returns null when all candidates fail quality gates', async () => {
    const candidates = [makeCandidate({ finalScore: 0.3, available: false })]
    const result = await selectHero(PROFILE_ID, candidates)
    expect(result).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Series candidates
// ---------------------------------------------------------------------------

describe('series hero', () => {
  it('handles series candidates correctly', async () => {
    // SERIES-only candidate: call order is [disliked, series, series_trailers]
    setupSeriesMocks({
      seriesRows: [{ id: MEDIA_ID_C, title: 'Great Series', synopsis: 'A great series.', backdropPath: '/bd/series.jpg' }],
      seriesTrailers: [{ mediaId: MEDIA_ID_C, youtubeKey: 'sKey' }],
    })

    const result = await selectHero(PROFILE_ID, [makeCandidate({ mediaId: MEDIA_ID_C, mediaType: 'SERIES' })])

    expect(result?.mediaId).toBe(MEDIA_ID_C)
    expect(result?.mediaType).toBe('SERIES')
    expect(result?.title).toBe('Great Series')
    expect(result?.trailerKey).toBe('sKey')
  })
})
