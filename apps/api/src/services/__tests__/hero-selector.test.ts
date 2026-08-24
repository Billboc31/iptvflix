import { describe, it, expect, beforeEach, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Module mocks (hoisted)
// ---------------------------------------------------------------------------

vi.mock('../../config/env.js', () => ({
  HERO_MIN_SCORE: 0.55,
  HERO_POOL_SIZE: 15,
  HERO_SCORE_WEIGHTS: {
    version: 'v1',
    profileRelevance: 0.45,
    semanticConfidence: 0.25,
    qualityPrior: 0.20,
    languageAffinity: 0.10,
  },
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

import { selectHero, computeHeroScore } from '../hero-selector.js'
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
    qualityPrior: 0.5,
    languageAffinity: 0.5,
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

// ---------------------------------------------------------------------------
// Hero ranking — first eligible is NOT automatically selected
// ---------------------------------------------------------------------------

describe('hero ranking', () => {
  it('test 1: picks the highest heroScore candidate, not the first eligible one', async () => {
    // A (profileScore=0.6): heroScore = 0.45*0.6 + 0.25*0.8 + 0.20*0.5 + 0.10*0.5 = 0.62
    // B (profileScore=0.7): heroScore = 0.665
    // C (profileScore=0.9): heroScore = 0.755  ← winner
    const candidates = [
      makeCandidate({ mediaId: MEDIA_ID_A, profileScore: 0.6, finalScore: 0.7 }),
      makeCandidate({ mediaId: MEDIA_ID_B, profileScore: 0.7, finalScore: 0.7 }),
      makeCandidate({ mediaId: MEDIA_ID_C, profileScore: 0.9, finalScore: 0.9 }),
    ]

    setupMovieMocks({
      movies: [
        { id: MEDIA_ID_A, title: 'Film A', synopsis: null, backdropPath: '/bd/a.jpg' },
        { id: MEDIA_ID_B, title: 'Film B', synopsis: null, backdropPath: '/bd/b.jpg' },
        { id: MEDIA_ID_C, title: 'Film C', synopsis: null, backdropPath: '/bd/c.jpg' },
      ],
    })

    const result = await selectHero(PROFILE_ID, candidates)

    expect(result?.mediaId).toBe(MEDIA_ID_C)
    expect(result?.title).toBe('Film C')
  })

  it('test 2: a later candidate (index 7 of 10) with materially stronger heroScore wins', async () => {
    // Candidates 0-6 and 8-9: profileScore=0.7
    // Candidate 7 (MEDIA_ID_B): profileScore=0.95 → clearly highest heroScore
    const WINNER_ID = 'winner00-0000-0000-0000-000000000007'
    const otherIds = Array.from({ length: 9 }, (_, i) => `other000-0000-0000-0000-00000000000${i}`)

    const candidates: ShelfCandidateItem[] = [
      ...otherIds.slice(0, 7).map((id) => makeCandidate({ mediaId: id, profileScore: 0.7, finalScore: 0.7 })),
      makeCandidate({ mediaId: WINNER_ID, profileScore: 0.95, finalScore: 0.95 }),
      ...otherIds.slice(7, 9).map((id) => makeCandidate({ mediaId: id, profileScore: 0.7, finalScore: 0.7 })),
    ]

    const allIds = [...otherIds.slice(0, 7), WINNER_ID, ...otherIds.slice(7, 9)]
    setupMovieMocks({
      movies: allIds.map((id) => ({
        id,
        title: id === WINNER_ID ? 'The Winner' : `Film ${id}`,
        synopsis: null,
        backdropPath: `/bd/${id}.jpg`,
      })),
    })

    const result = await selectHero(PROFILE_ID, candidates)

    expect(result?.mediaId).toBe(WINNER_ID)
    expect(result?.title).toBe('The Winner')
  })

  it('test 3: high qualityPrior defeats marginally stronger profileScore candidate', async () => {
    // A: profileScore=0.85, qualityPrior=0.1
    //   heroScore = 0.45*0.85 + 0.25*0.8 + 0.20*0.1 + 0.10*0.5 = 0.3825+0.20+0.02+0.05 = 0.6525
    // B: profileScore=0.80, qualityPrior=0.95
    //   heroScore = 0.45*0.80 + 0.25*0.8 + 0.20*0.95 + 0.10*0.5 = 0.36+0.20+0.19+0.05 = 0.80  ← winner
    const candidates = [
      makeCandidate({ mediaId: MEDIA_ID_A, profileScore: 0.85, qualityPrior: 0.1, finalScore: 0.8 }),
      makeCandidate({ mediaId: MEDIA_ID_B, profileScore: 0.80, qualityPrior: 0.95, finalScore: 0.8 }),
    ]

    setupMovieMocks({
      movies: [
        { id: MEDIA_ID_A, title: 'Obscure Film', synopsis: null, backdropPath: '/bd/a.jpg' },
        { id: MEDIA_ID_B, title: 'Quality Film', synopsis: null, backdropPath: '/bd/b.jpg' },
      ],
    })

    const result = await selectHero(PROFILE_ID, candidates)

    expect(result?.mediaId).toBe(MEDIA_ID_B)
    expect(result?.title).toBe('Quality Film')
  })

  it('test 4: disliked candidate cannot win even when its heroScore would be highest', async () => {
    // A (disliked): profileScore=1.0 → heroScore would be 0.45+0.20+0.10+0.05 = 0.80
    // B: profileScore=0.7 → heroScore = 0.665
    const candidates = [
      makeCandidate({ mediaId: MEDIA_ID_A, profileScore: 1.0, finalScore: 1.0 }),
      makeCandidate({ mediaId: MEDIA_ID_B, profileScore: 0.7, finalScore: 0.7 }),
    ]

    setupMovieMocks({
      disliked: [MEDIA_ID_A],
      movies: [{ id: MEDIA_ID_B, title: 'The Real Winner', synopsis: null, backdropPath: '/bd/b.jpg' }],
    })

    const result = await selectHero(PROFILE_ID, candidates)

    expect(result?.mediaId).toBe(MEDIA_ID_B)
    expect(result?.title).toBe('The Real Winner')
  })

  it('test 5: unavailable candidate is excluded before ranking', async () => {
    // A (available=false): would have highest heroScore but is excluded before ranking
    // B (available=true): wins by default
    const candidates = [
      makeCandidate({ mediaId: MEDIA_ID_A, available: false, profileScore: 1.0, finalScore: 1.0 }),
      makeCandidate({ mediaId: MEDIA_ID_B, available: true, profileScore: 0.7, finalScore: 0.7 }),
    ]

    setupMovieMocks({
      movies: [{ id: MEDIA_ID_B, title: 'Available Film', synopsis: null, backdropPath: '/bd/b.jpg' }],
    })

    const result = await selectHero(PROFILE_ID, candidates)

    expect(result?.mediaId).toBe(MEDIA_ID_B)
    expect(mockDb.select).not.toHaveBeenCalledWith(
      expect.objectContaining({ mediaId: MEDIA_ID_A }),
    )
  })

  it('test 6: no-backdrop candidate is excluded from ranking', async () => {
    // A has no backdrop → excluded from ranking
    // B has backdrop → wins
    const candidates = [
      makeCandidate({ mediaId: MEDIA_ID_A, profileScore: 0.95, finalScore: 0.9 }),
      makeCandidate({ mediaId: MEDIA_ID_B, profileScore: 0.70, finalScore: 0.7 }),
    ]

    setupMovieMocks({
      movies: [
        { id: MEDIA_ID_A, title: 'No Backdrop Film', synopsis: null, backdropPath: null },
        { id: MEDIA_ID_B, title: 'Has Backdrop Film', synopsis: null, backdropPath: '/bd/b.jpg' },
      ],
    })

    const result = await selectHero(PROFILE_ID, candidates)

    expect(result?.mediaId).toBe(MEDIA_ID_B)
    expect(result?.title).toBe('Has Backdrop Film')
  })

  it('test 7: foreign-language content wins when its heroScore is highest (no language hard-filter)', async () => {
    // A (high languageAffinity=0.95, good profileScore=0.85): heroScore = 0.45*0.85+0.25*0.8+0.20*0.5+0.10*0.95
    //   = 0.3825+0.20+0.10+0.095 = 0.7775  ← winner
    // B (low languageAffinity=0.1, profileScore=0.75): heroScore = 0.45*0.75+0.25*0.8+0.20*0.5+0.10*0.1
    //   = 0.3375+0.20+0.10+0.01 = 0.6475
    const candidates = [
      makeCandidate({ mediaId: MEDIA_ID_A, profileScore: 0.85, languageAffinity: 0.95, finalScore: 0.85 }),
      makeCandidate({ mediaId: MEDIA_ID_B, profileScore: 0.75, languageAffinity: 0.10, finalScore: 0.75 }),
    ]

    setupMovieMocks({
      movies: [
        { id: MEDIA_ID_A, title: 'Parasite', synopsis: 'A Korean masterpiece.', backdropPath: '/bd/parasite.jpg' },
        { id: MEDIA_ID_B, title: 'Domestic Film', synopsis: null, backdropPath: '/bd/b.jpg' },
      ],
    })

    const result = await selectHero(PROFILE_ID, candidates)

    expect(result?.mediaId).toBe(MEDIA_ID_A)
    expect(result?.title).toBe('Parasite')
  })

  it('test 8: no sufficiently strong candidate after backdrop/enrichment filter returns null', async () => {
    // All candidates pass eligibility gate but none have a backdrop in the DB
    const candidates = [
      makeCandidate({ mediaId: MEDIA_ID_A, profileScore: 0.9, finalScore: 0.9 }),
      makeCandidate({ mediaId: MEDIA_ID_B, profileScore: 0.8, finalScore: 0.8 }),
    ]

    setupMovieMocks({
      movies: [
        { id: MEDIA_ID_A, title: 'Film A', synopsis: null, backdropPath: null },
        { id: MEDIA_ID_B, title: 'Film B', synopsis: null, backdropPath: null },
      ],
    })

    const result = await selectHero(PROFILE_ID, candidates)
    expect(result).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// computeHeroScore — pure function unit test
// ---------------------------------------------------------------------------

describe('computeHeroScore', () => {
  it('test 9: computes the weighted sum correctly with known inputs', () => {
    const weights = {
      version: 'v1' as const,
      profileRelevance: 0.5,
      semanticConfidence: 0.3,
      qualityPrior: 0.15,
      languageAffinity: 0.05,
    }
    const candidate = makeCandidate({
      profileScore: 0.8,
      semanticScore: 0.6,
      qualityPrior: 0.7,
      languageAffinity: 0.4,
    })

    // 0.5*0.8 + 0.3*0.6 + 0.15*0.7 + 0.05*0.4 = 0.4 + 0.18 + 0.105 + 0.02 = 0.705
    const score = computeHeroScore(candidate, weights)
    expect(score).toBeCloseTo(0.705, 5)
  })

  it('higher profileScore yields higher heroScore with identical other signals', () => {
    const weights = {
      version: 'v1' as const,
      profileRelevance: 0.45,
      semanticConfidence: 0.25,
      qualityPrior: 0.20,
      languageAffinity: 0.10,
    }
    const base = makeCandidate({ semanticScore: 0.7, qualityPrior: 0.5, languageAffinity: 0.5 })

    const scoreHigh = computeHeroScore({ ...base, profileScore: 0.9 }, weights)
    const scoreLow = computeHeroScore({ ...base, profileScore: 0.5 }, weights)

    expect(scoreHigh).toBeGreaterThan(scoreLow)
  })
})
