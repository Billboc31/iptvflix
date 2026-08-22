/**
 * Tests for the central recommendation service.
 *
 * Verifies that SCORE_MODEL_V2 can promote a candidate that ranks poorly in raw
 * vector similarity to a top position in the final output, and that the service
 * handles cold-start (no semantic intent) without error.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// DB mock — must be hoisted before any module that imports db/client
// ---------------------------------------------------------------------------

const mockDb = vi.hoisted(() => ({ select: vi.fn() }))
vi.mock('../../db/client.js', () => ({ db: mockDb, pgClient: vi.fn() }))

// Semantic search mock — controls the candidate pool returned to the service
const mockSemanticFn = vi.hoisted(() => vi.fn())
vi.mock('../stages/semantic-search.js', () => ({ runSemanticSearch: mockSemanticFn }))

// Text search mock — not used in the rerank test
const mockTextFn = vi.hoisted(() => vi.fn())
vi.mock('../stages/text-search.js', () => ({ runTextSearch: mockTextFn }))

// runHybridReranker is NOT mocked — we run the real V2 scoring with mocked DB

import { runRecommendationFromPlan } from '../recommendation-service.js'
import type { CandidateItem, PipelineContext } from '../types.js'
import type { RecommendationQueryPlan } from '@iptvflix/api-contracts'
import type { FastifyBaseLogger } from 'fastify'

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeLogger(): FastifyBaseLogger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn(),
    level: 'info',
    silent: vi.fn(),
  } as unknown as FastifyBaseLogger
}

function makePlan(semanticIntent: string): RecommendationQueryPlan {
  return {
    schemaVersion: '1',
    rawQuery: '',
    displayTitle: 'Test',
    semanticIntent,
    desiredThemes: [],
    desiredTone: [],
    avoidSignals: [],
    mediaTypes: ['MOVIE'],
    hardFilters: {},
    softPreferences: {},
    userConstraints: [],
    plannerFallback: true,
    plannerMeta: null,
  }
}

// DB helpers matching the call order in runHybridReranker (all-movie candidates):
//   0. loadExposureCounts → profileMediaExposure .where()
//   1. loadTasteSignals   → profileTaste         .where()
//   2. movieGenreRows     → movie_genres          .where()
//   3. allGenreRows       → genres                (no .where)
//   4. availMovieRows     → movie_availabilities  .where()
//   5. movieMetaRows      → movies                .where()
//   6. creditRows         → media_credits         .where()
//   7. progressRows       → viewing_progress      .where()

function mockSelectWhere(rows: unknown[]) {
  mockDb.select.mockReturnValueOnce({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(rows),
    }),
  })
}

function mockSelectFrom(rows: unknown[]) {
  mockDb.select.mockReturnValueOnce({
    from: vi.fn().mockResolvedValue(rows),
  })
}

// Mock the popularity fallback pool (select().from().orderBy().limit())
function mockSelectFromOrderByLimit(rows: unknown[]) {
  mockDb.select.mockReturnValueOnce({
    from: vi.fn().mockReturnValue({
      orderBy: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
      }),
    }),
  })
}

const ALL_GENRES = [
  { id: 'genre-suspense', name: 'Suspense' },
  { id: 'genre-drama', name: 'Drama' },
]

// Profile loves suspense genre + French language
const TASTE_ROW = {
  genreScores: { 'genre-suspense': 10 },
  positiveMediaIds: [],
  negativeMediaIds: [],
  dislikedMediaIds: [],
  notInterestedMediaIds: [],
  signalCount: 5,
  personScores: {},
  keywordScores: { 'suspense': 4 },
  franchiseScores: {},
  languageScores: { 'fr': 8 },
  countryScores: {},
  decadeScores: {},
  mediaTypePreferences: {},
}

// 8 movie candidates ordered by descending vector similarity.
// Candidates 0–6 have no genre affinity; candidate 7 has genre + language match
// despite the lowest vector similarity (0.1).
const CANDIDATES: CandidateItem[] = [
  { id: 'mov-0', mediaType: 'movie', title: 'Generic 0', year: 2010, similarity: 0.90 },
  { id: 'mov-1', mediaType: 'movie', title: 'Generic 1', year: 2011, similarity: 0.80 },
  { id: 'mov-2', mediaType: 'movie', title: 'Generic 2', year: 2012, similarity: 0.70 },
  { id: 'mov-3', mediaType: 'movie', title: 'Generic 3', year: 2013, similarity: 0.60 },
  { id: 'mov-4', mediaType: 'movie', title: 'Generic 4', year: 2014, similarity: 0.50 },
  { id: 'mov-5', mediaType: 'movie', title: 'Generic 5', year: 2015, similarity: 0.40 },
  { id: 'mov-6', mediaType: 'movie', title: 'Generic 6', year: 2016, similarity: 0.30 },
  { id: 'mov-7', mediaType: 'movie', title: 'Perfect Match', year: 2017, similarity: 0.10 },
]

// Enrichment data returned by the DB for each movie
const MOVIE_GENRE_ROWS = [
  // mov-7 only has genre-suspense
  { movieId: 'mov-7', genreId: 'genre-suspense' },
  // mov-0 through mov-6 have genre-drama (not preferred by profile)
  ...(['mov-0', 'mov-1', 'mov-2', 'mov-3', 'mov-4', 'mov-5', 'mov-6'] as const).map((id) => ({
    movieId: id,
    genreId: 'genre-drama',
  })),
]

const AVAIL_ALL = CANDIDATES.map((c) => ({ movieId: c.id }))

const MOVIE_META_ROWS = CANDIDATES.map((c) => ({
  id: c.id,
  durationMinutes: 100,
  originalLanguage: c.id === 'mov-7' ? 'fr' : 'en',
  productionCountries: [],
  collectionId: null,
  popularity: 50,
  voteAverage: 7.0,
  keywords: c.id === 'mov-7' ? ['suspense'] : [],
}))

function setupRerankerMocks() {
  mockSelectWhere([])              // 0: exposureCounts
  mockSelectWhere([TASTE_ROW])    // 1: tasteSignals
  mockSelectWhere(MOVIE_GENRE_ROWS) // 2: movie genres
  mockSelectFrom(ALL_GENRES)      // 3: all genres (no where)
  mockSelectWhere(AVAIL_ALL)      // 4: movie availabilities
  mockSelectWhere(MOVIE_META_ROWS) // 5: movie meta
  mockSelectWhere([])             // 6: credits
  mockSelectWhere([])             // 7: progress
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.resetAllMocks()
})

describe('runRecommendationFromPlan', () => {
  it('promotes candidate at vector rank >5 to final top-3 via SCORE_MODEL_V2', async () => {
    // Mock semantic search to return candidates in vector order (best first)
    mockSemanticFn.mockResolvedValueOnce({
      stage: 'semantic-search',
      available: true,
      durationMs: 10,
      inputCount: 0,
      outputCount: CANDIDATES.length,
      candidates: CANDIDATES,
    })

    setupRerankerMocks()

    const plan = makePlan('Suspense films with strong atmosphere')
    const result = await runRecommendationFromPlan(
      plan,
      { profileId: 'profile-a', mediaTypes: ['movie'], limit: 8 },
      'test-req',
      makeLogger(),
    )

    expect(result.results.length).toBeGreaterThan(0)

    // 'mov-7' was vector rank 8 (worst) but should be in final top-3
    // because it has genre-suspense + French language + keyword 'suspense'
    const finalIds = result.results.map((r) => r.id)
    const positionOf7 = finalIds.indexOf('mov-7')

    expect(positionOf7, '"Perfect Match" (vector rank 8) must appear in final top-3').toBeGreaterThanOrEqual(0)
    expect(positionOf7, '"Perfect Match" must be in top-3 after V2 scoring').toBeLessThan(3)
  })

  it('returns SCORE_MODEL_V2 version in engineMetadata for all paths', async () => {
    mockSemanticFn.mockResolvedValueOnce({
      stage: 'semantic-search',
      available: true,
      durationMs: 5,
      inputCount: 0,
      outputCount: CANDIDATES.length,
      candidates: CANDIDATES,
    })

    setupRerankerMocks()

    const plan = makePlan('Suspense films')
    const result = await runRecommendationFromPlan(
      plan,
      { profileId: 'profile-a', mediaTypes: ['movie'], limit: 8 },
      'test-req-v2',
      makeLogger(),
    )

    expect(result.engineMetadata.rerankerVersion).toBe('v2')
  })

  it('cold-start: empty semanticIntent falls back to popularity pool without error', async () => {
    // With empty semanticIntent, semantic search is skipped.
    // The service falls back to the popularity pool (2 DB queries for movies + series).
    mockSelectFromOrderByLimit([
      { id: 'pop-1', title: 'Popular Movie', year: 2020, posterPath: null },
    ])

    // Then the reranker runs on these — but with no profileId, taste is null.
    // Only 1 candidate so some DB calls simplify.
    mockSelectWhere([])    // exposureCounts (no profileId → short-circuit, but mock anyway)
    // With no profileId, loadTasteSignals is skipped → goes straight to enrichCandidates
    // Actually with no profileId: loadExposureCounts returns empty, loadTasteSignals returns null (skipped)
    // enrichCandidates for 1 movie:
    mockSelectWhere([])    // movieGenreRows
    mockSelectFrom(ALL_GENRES) // allGenreRows
    mockSelectWhere([{ movieId: 'pop-1' }]) // availMovieRows
    mockSelectWhere([{     // movieMetaRows
      id: 'pop-1',
      durationMinutes: 90,
      originalLanguage: 'en',
      productionCountries: [],
      collectionId: null,
      popularity: 80,
      voteAverage: 7.5,
      keywords: [],
    }])
    mockSelectWhere([])    // creditRows
    // progressRows: profileId is undefined → skipped

    const plan = makePlan('')
    const result = await runRecommendationFromPlan(
      plan,
      { mediaTypes: ['movie'], limit: 5 },
      'test-cold',
      makeLogger(),
    )

    expect(result).toBeDefined()
    expect(result.engineMetadata.rerankerVersion).toBe('v2')
    expect(result.engineMetadata.fallbackFlags).toContain('popularity-fallback')
  })
})
