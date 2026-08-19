/**
 * Ranking divergence integration test.
 *
 * Verifies that two profiles with different interaction histories produce
 * materially different rankings for the same semantic query, and that the
 * scoreBreakdown attributes the difference to at least one new signal dimension
 * (language, decade, keyword, people, or franchise).
 *
 * The DB is fully mocked so the test runs without a real database.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock DB before importing the stage
// ---------------------------------------------------------------------------

const mockDb = vi.hoisted(() => ({
  select: vi.fn(),
}))

vi.mock('../db/client.js', () => ({ db: mockDb }))

import { runHybridReranker } from '../pipeline/stages/hybrid-reranker.js'
import type { PipelineContext, CandidateItem } from '../pipeline/types.js'
import type { FastifyBaseLogger } from 'fastify'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLogger(): FastifyBaseLogger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn(() => makeLogger()),
    level: 'info',
    silent: vi.fn(),
  } as unknown as FastifyBaseLogger
}

function makeContext(profileId: string): PipelineContext {
  return {
    requestId: 'test-req',
    request: { text: 'something thrilling', profileId, limit: 20 },
    startedAt: Date.now(),
    log: makeLogger(),
    queryPlan: {
      schemaVersion: '1',
      rawQuery: 'something thrilling',
      displayTitle: 'Thrilling picks',
      semanticIntent: 'Thrilling movies and series',
      desiredThemes: ['thriller'],
      desiredTone: ['suspense'],
      avoidSignals: [],
      mediaTypes: ['MOVIE', 'SERIES'],
      hardFilters: {},
      softPreferences: {},
      userConstraints: [],
      plannerFallback: true,
      plannerMeta: null,
    },
  }
}

const MOVIE_FR_1980: CandidateItem = { id: 'mov-fr-80', mediaType: 'movie', title: 'French 80s Thriller', year: 1982, similarity: 0.7 }
const MOVIE_EN_2010: CandidateItem = { id: 'mov-en-10', mediaType: 'movie', title: 'English 2010s Comedy', year: 2012, similarity: 0.65 }
const MOVIE_NEUTRAL: CandidateItem = { id: 'mov-neutral', mediaType: 'movie', title: 'Neutral Drama', year: 2000, similarity: 0.6 }

const CANDIDATES: CandidateItem[] = [MOVIE_FR_1980, MOVIE_EN_2010, MOVIE_NEUTRAL]

type TasteRow = {
  genreScores: Record<string, number>
  positiveMediaIds: string[]
  negativeMediaIds: string[]
  dislikedMediaIds: string[]
  notInterestedMediaIds: string[]
  signalCount: number
  personScores: Record<string, number>
  keywordScores: Record<string, number>
  franchiseScores: Record<string, number>
  languageScores: Record<string, number>
  countryScores: Record<string, number>
  decadeScores: Record<string, number>
  mediaTypePreferences: Record<string, number>
}

// Profile A: loves French 1980s films + horror/suspense keywords
const TASTE_A: TasteRow = {
  genreScores: { 'genre-horror': 9, 'genre-drama': 1 },
  positiveMediaIds: ['mov-fr-80'],
  negativeMediaIds: [],
  dislikedMediaIds: [],
  notInterestedMediaIds: [],
  signalCount: 5,
  personScores: {},
  keywordScores: { 'serial-killer': 3, 'suspense': 4 },
  franchiseScores: {},
  languageScores: { 'fr': 8 },
  countryScores: { 'FR': 6 },
  decadeScores: { '1980s': 7, '2010s': 1 },
  mediaTypePreferences: { 'movie': 6, 'series': 1 },
}

// Profile B: loves English 2010s comedy + different keywords
const TASTE_B: TasteRow = {
  genreScores: { 'genre-comedy': 9, 'genre-drama': 3 },
  positiveMediaIds: ['mov-en-10'],
  negativeMediaIds: [],
  dislikedMediaIds: [],
  notInterestedMediaIds: [],
  signalCount: 5,
  personScores: {},
  keywordScores: { 'romantic-comedy': 4, 'buddy': 3 },
  franchiseScores: {},
  languageScores: { 'en': 8 },
  countryScores: { 'US': 6 },
  decadeScores: { '2010s': 7, '1980s': 1 },
  mediaTypePreferences: { 'movie': 5, 'series': 2 },
}

// Per-movie enrichment metadata
const ALL_GENRES = [
  { id: 'genre-horror', name: 'Horror' },
  { id: 'genre-comedy', name: 'Comedy' },
  { id: 'genre-drama', name: 'Drama' },
]

const MOVIE_GENRE_ROWS = [
  { movieId: 'mov-fr-80', genreId: 'genre-horror' },
  { movieId: 'mov-en-10', genreId: 'genre-comedy' },
  { movieId: 'mov-neutral', genreId: 'genre-drama' },
]

const MOVIE_META_ROWS = [
  { id: 'mov-fr-80', durationMinutes: 110, originalLanguage: 'fr', productionCountries: ['FR'], collectionId: null, popularity: 40, voteAverage: 7.5, keywords: ['serial-killer', 'suspense'] },
  { id: 'mov-en-10', durationMinutes: 95, originalLanguage: 'en', productionCountries: ['US'], collectionId: null, popularity: 55, voteAverage: 7.0, keywords: ['romantic-comedy', 'buddy'] },
  { id: 'mov-neutral', durationMinutes: 105, originalLanguage: 'en', productionCountries: ['GB'], collectionId: null, popularity: 30, voteAverage: 6.5, keywords: ['family', 'drama'] },
]

const AVAIL_MOVIE_ROWS = [
  { movieId: 'mov-fr-80' },
  { movieId: 'mov-en-10' },
  { movieId: 'mov-neutral' },
]

// ---------------------------------------------------------------------------
// DB mock helpers
// ---------------------------------------------------------------------------

// db.select().from().where() → rows
function mockSelectWhere(rows: unknown[]) {
  mockDb.select.mockReturnValueOnce({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(rows),
    }),
  })
}

// db.select().from() → rows  (no .where(), e.g. genres table)
function mockSelectFrom(rows: unknown[]) {
  mockDb.select.mockReturnValueOnce({
    from: vi.fn().mockResolvedValue(rows),
  })
}

/**
 * Set up the 8 DB mocks consumed per run of runHybridReranker with all-movie candidates:
 *
 * Order (all candidates are movies, so series queries short-circuit):
 *  0. loadExposureCounts → profileMediaExposure .where()
 *  1. loadTasteSignals   → profileTaste         .where()
 *  --- enrichCandidates Promise.all ---
 *  2. movieGenreRows     → movie_genres          .where()
 *  3. allGenreRows       → genres                (no .where)
 *  4. availMovieRows     → movie_availabilities  .where()
 *  5. movieMetaRows      → movies                .where()
 *  6. creditRows         → media_credits         .where()
 *  7. progressRows       → viewing_progress      .where()
 */
function setupMocks(tasteRow: TasteRow) {
  mockSelectWhere([])             // 0: exposureCounts (empty)
  mockSelectWhere([tasteRow])     // 1: tasteSignals
  mockSelectWhere(MOVIE_GENRE_ROWS)  // 2: movie genres
  mockSelectFrom(ALL_GENRES)      // 3: genres (no where)
  mockSelectWhere(AVAIL_MOVIE_ROWS)  // 4: movie availabilities
  mockSelectWhere(MOVIE_META_ROWS)   // 5: movie meta
  mockSelectWhere([])             // 6: creditRows (no credits)
  mockSelectWhere([])             // 7: progressRows (no progress)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.resetAllMocks()
})

describe('ranking divergence', () => {
  it('profile A (French 1980s horror) ranks the French 80s film first', async () => {
    setupMocks(TASTE_A)

    const ctx = makeContext('profile-a')
    const result = await runHybridReranker(ctx, CANDIDATES)

    expect(result.available).toBe(true)
    expect(result.candidates!.length).toBeGreaterThan(0)
    expect(result.candidates![0].id).toBe('mov-fr-80')
  })

  it('profile B (English 2010s comedy) ranks the English comedy first', async () => {
    setupMocks(TASTE_B)

    const ctx = makeContext('profile-b')
    const result = await runHybridReranker(ctx, CANDIDATES)

    expect(result.available).toBe(true)
    expect(result.candidates![0].id).toBe('mov-en-10')
  })

  it('profiles A and B produce different top-1 results for the same query', async () => {
    setupMocks(TASTE_A)
    const ctxA = makeContext('profile-a')
    const resultA = await runHybridReranker(ctxA, CANDIDATES)

    setupMocks(TASTE_B)
    const ctxB = makeContext('profile-b')
    const resultB = await runHybridReranker(ctxB, CANDIDATES)

    expect(resultA.candidates![0].id).not.toBe(resultB.candidates![0].id)
  })

  it('scoreBreakdown on top result includes all v2 dimensions', async () => {
    setupMocks(TASTE_A)

    const ctx = makeContext('profile-a')
    const result = await runHybridReranker(ctx, CANDIDATES)

    const bd = result.candidates![0].scoreBreakdown!
    expect(bd.modelVersion).toBe('v2')
    expect(typeof bd.keywordAffinity).toBe('number')
    expect(typeof bd.franchiseAffinity).toBe('number')
    expect(typeof bd.languageAffinity).toBe('number')
    expect(typeof bd.decadeAffinity).toBe('number')
    expect(typeof bd.mediaTypeAffinity).toBe('number')

    // French 80s film: language 'fr' preferred by profile A → high languageAffinity
    expect(bd.languageAffinity).toBeGreaterThan(0.5)
    // 1982 → 1980s preferred by profile A → high decadeAffinity
    expect(bd.decadeAffinity).toBeGreaterThan(0.5)
  })

  it('DISLIKE penalty (−2.0) is stronger than NOT_INTERESTED penalty (−1.2)', async () => {
    const tasteWithPenalties = {
      ...TASTE_A,
      dislikedMediaIds: ['mov-fr-80'],
      notInterestedMediaIds: ['mov-en-10'],
    }

    setupMocks(tasteWithPenalties)
    const ctx = makeContext('profile-penalties')
    const result = await runHybridReranker(ctx, CANDIDATES)

    const frMovie = result.candidates!.find((c) => c.id === 'mov-fr-80')!
    const enMovie = result.candidates!.find((c) => c.id === 'mov-en-10')!

    expect(frMovie.scoreBreakdown!.dislikedPenalty).toBe(2.0)
    expect(enMovie.scoreBreakdown!.dislikedPenalty).toBe(1.2)
    // The DISLIKED title must score lower than the NOT_INTERESTED title
    expect(frMovie.score!).toBeLessThan(enMovie.score!)
  })

  it('profile data isolation: French film has higher languageAffinity for profile A than B', async () => {
    setupMocks(TASTE_A)
    const ctxA = makeContext('profile-a')
    const resultA = await runHybridReranker(ctxA, CANDIDATES)

    setupMocks(TASTE_B)
    const ctxB = makeContext('profile-b')
    const resultB = await runHybridReranker(ctxB, CANDIDATES)

    const frFilmA = resultA.candidates!.find((c) => c.id === 'mov-fr-80')!
    const frFilmB = resultB.candidates!.find((c) => c.id === 'mov-fr-80')!

    // Profile A has 'fr' in languageScores; profile B does not → A gets higher affinity
    expect(frFilmA.scoreBreakdown!.languageAffinity).toBeGreaterThan(
      frFilmB.scoreBreakdown!.languageAffinity,
    )
  })
})
