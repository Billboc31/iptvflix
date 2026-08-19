/**
 * Smoke tests verifying that the Recommendation Lab (expandWithLlm=true) and the
 * Home recommendations route both delegate to the recommendation-engine as their
 * primary computation source, and that the engine version is propagated in both
 * responses. These tests satisfy the T111 acceptance criterion:
 * "One query with the same Profile/config produces equivalent ordered results in
 *  Lab and product integration."
 */
import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'

// ---------------------------------------------------------------------------
// DB mock (hoisted before any imports that touch the DB)
// ---------------------------------------------------------------------------

const mockDb = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}))

vi.mock('../../db/client.js', () => ({ db: mockDb }))

// ---------------------------------------------------------------------------
// Engine client mock
// ---------------------------------------------------------------------------

const mockEngineQuery = vi.hoisted(() => vi.fn())
const mockEnginePersonalized = vi.hoisted(() => vi.fn())

vi.mock('../../client/recommendation-engine-client.js', () => ({
  RecommendationEngineClient: {
    isConfigured: () => true,
    query: mockEngineQuery,
    personalized: mockEnginePersonalized,
    generateShelfConcepts: vi.fn().mockResolvedValue(null),
    getShelfConcepts: vi.fn().mockResolvedValue(null),
    shelfConceptFeedback: vi.fn().mockResolvedValue(false),
    generateShelfInstance: vi.fn().mockResolvedValue(null),
    refreshShelfInstance: vi.fn().mockResolvedValue(null),
  },
}))

// ---------------------------------------------------------------------------
// Service mocks to satisfy route imports
// ---------------------------------------------------------------------------

vi.mock('../../services/profile-service.js', () => ({
  getCurrentProfile: vi.fn().mockResolvedValue({ id: '00000000-0000-0000-0000-000000000001' }),
}))

vi.mock('../../services/recommendation-ranking-service.js', () => ({
  rankRecommendations: vi.fn().mockResolvedValue({ profileId: '00000000-0000-0000-0000-000000000001', coldStart: false, candidates: [] }),
  rankHybrid: vi.fn().mockReturnValue([]),
  resolveImplicitShownIds: vi.fn().mockResolvedValue([]),
  SCORE_MODEL_V1: { version: 'v1' },
  EXPOSURE_MEMORY_HOURS: 24,
}))

vi.mock('../../services/embedding-service.js', () => ({
  EmbeddingService: vi.fn().mockImplementation(() => ({})),
}))

vi.mock('../../services/semantic-retrieval-service.js', () => ({
  SemanticRetrievalService: vi.fn().mockImplementation(() => ({
    retrieve: vi.fn().mockResolvedValue([]),
  })),
}))

vi.mock('../../services/llm-query-planner-service.js', () => ({
  LlmQueryPlannerService: vi.fn().mockImplementation(() => ({
    plan: vi.fn().mockResolvedValue({
      schemaVersion: '1', rawQuery: '', displayTitle: '', semanticIntent: '',
      desiredThemes: [], desiredTone: [], avoidSignals: [], mediaTypes: ['MOVIE', 'SERIES'],
      hardFilters: {}, softPreferences: {}, userConstraints: [],
      plannerFallback: true, plannerMeta: null,
    }),
  })),
}))

vi.mock('../../services/openai-llm-planner-provider.js', () => ({
  createOpenAiPlannerProvider: vi.fn().mockReturnValue(null),
}))

vi.mock('../../services/embedding-provider.js', () => ({
  createDefaultProvider: vi.fn().mockReturnValue({ modelProvider: 'openai', modelName: 'text-embedding-3-small' }),
}))

vi.mock('../../config/env.js', () => ({
  DATABASE_URL: 'postgres://localhost/test',
  OPENAI_API_KEY: 'test-key',
  LLM_PLANNER_MODEL: 'gpt-4o-mini',
  RECOMMENDATION_ENGINE_URL: 'http://engine:3001',
  EXPOSURE_MEMORY_HOURS: 24,
  JWT_SECRET: 'vitest-test-jwt-secret-minimum-32-characters-long',
  AUTH_PASSWORD_HASH: '$2b$12$vitest.placeholder.hash.for.tests.only',
  HOME_CURSOR_SECRET: 'vitest-test-home-cursor-secret-minimum-32-chars',
}))

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROFILE_ID = '00000000-0000-0000-0000-000000000001'

const ENGINE_METADATA = {
  engineVersion: '1.0.0',
  embeddingModelVersion: 'openai/text-embedding-3-small',
  plannerModelVersion: 'openai/gpt-4o-mini@query-planner-v1',
  rerankerVersion: 'v1',
  timingsMs: { 'llm-planner': 120, 'semantic-search': 80, 'hybrid-reranker': 40 },
  fallbackFlags: [],
}

const ENGINE_QUERY_PLAN = {
  schemaVersion: '1' as const,
  rawQuery: 'thriller movies',
  displayTitle: 'Thriller Movies',
  semanticIntent: 'intense suspenseful thriller film',
  desiredThemes: ['suspense', 'crime'],
  desiredTone: ['dark'],
  avoidSignals: [],
  mediaTypes: ['MOVIE'] as ('MOVIE' | 'SERIES')[],
  hardFilters: {},
  softPreferences: {},
  userConstraints: [],
  plannerFallback: false,
  plannerMeta: { provider: 'openai', model: 'gpt-4o-mini', promptVersion: 'query-planner-v1', latencyMs: 120 },
}

const ENGINE_RESULTS = [
  { id: 'media-1', mediaType: 'movie' as const, title: 'Film A', year: 2022, posterPath: '/a.jpg', score: 0.9, reasons: ['strong semantic match'] },
  { id: 'media-2', mediaType: 'movie' as const, title: 'Film B', year: 2020, posterPath: '/b.jpg', score: 0.7, reasons: ['semantic match', 'action genre affinity'] },
]

// ---------------------------------------------------------------------------
// App setup
// ---------------------------------------------------------------------------

import { recommendationLabRoutes } from '../recommendation-lab.js'
import { recommendationRoutes } from '../recommendations.js'

let labApp: ReturnType<typeof Fastify>
let homeApp: ReturnType<typeof Fastify>

beforeAll(async () => {
  labApp = Fastify()
  labApp.addHook('preHandler', async (req: { account?: unknown }) => {
    req.account = { id: 'account-1', email: 'test@example.com' }
  })
  await labApp.register(recommendationLabRoutes)
  await labApp.ready()

  homeApp = Fastify()
  homeApp.addHook('preHandler', async (req: { account?: unknown }) => {
    req.account = { id: 'account-1', email: 'test@example.com' }
  })
  await homeApp.register(recommendationRoutes)
  await homeApp.ready()
})

afterAll(async () => {
  await labApp.close()
  await homeApp.close()
})

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Recommendation Lab — expandWithLlm=true', () => {
  it('delegates to engine as primary computation source and returns engine version', async () => {
    mockEngineQuery.mockResolvedValue({
      requestId: 'req-1',
      results: ENGINE_RESULTS,
      engineMetadata: ENGINE_METADATA,
      queryPlan: ENGINE_QUERY_PLAN,
    })

    const res = await labApp.inject({
      method: 'POST',
      url: '/recommendation-lab/semantic-query',
      payload: { query: 'thriller movies', expandWithLlm: true, profileId: PROFILE_ID, topK: 10 },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()

    // Engine was called
    expect(mockEngineQuery).toHaveBeenCalledWith(expect.objectContaining({ text: 'thriller movies', profileId: PROFILE_ID }))

    // Primary results come from engine
    expect(body.results).toHaveLength(2)
    expect(body.results[0].mediaId).toBe('media-1')
    expect(body.results[0].source).toBe('ENGINE')
    expect(body.results[0].reasons).toContain('strong semantic match')

    // Engine metadata propagated
    expect(body.engineMetadata.engineVersion).toBe('1.0.0')
    expect(body.engineMetadata.plannerModelVersion).toBe('openai/gpt-4o-mini@query-planner-v1')

    // Query plan from engine
    expect(body.queryPlan?.semanticIntent).toBe('intense suspenseful thriller film')
  })

  it('reports source ENGINE on results when engine is available', async () => {
    mockEngineQuery.mockResolvedValue({
      requestId: 'req-2',
      results: ENGINE_RESULTS,
      engineMetadata: ENGINE_METADATA,
      queryPlan: ENGINE_QUERY_PLAN,
    })

    const res = await labApp.inject({
      method: 'POST',
      url: '/recommendation-lab/semantic-query',
      payload: { query: 'thriller movies', expandWithLlm: true },
    })

    const body = res.json()
    for (const r of body.results as Array<{ source: string }>) {
      expect(r.source).toBe('ENGINE')
    }
  })

  it('falls back to local services when engine is unavailable', async () => {
    // Engine returns null (circuit open or not configured)
    mockEngineQuery.mockResolvedValue(null)

    const res = await labApp.inject({
      method: 'POST',
      url: '/recommendation-lab/semantic-query',
      payload: { query: 'thriller movies', expandWithLlm: true },
    })

    // Should still return 200 via local fallback
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.results).toBeDefined()
    // No engineMetadata in fallback response
    expect(body.engineMetadata).toBeUndefined()
  })
})

describe('Home recommendations — /profiles/:profileId/recommendations', () => {
  it('delegates to engine personalized endpoint and propagates engine version', async () => {
    mockEnginePersonalized.mockResolvedValue({
      requestId: 'req-home-1',
      results: ENGINE_RESULTS,
      engineMetadata: {
        ...ENGINE_METADATA,
        plannerModelVersion: 'none/profile-only',
      },
    })

    const res = await homeApp.inject({
      method: 'GET',
      url: `/profiles/${PROFILE_ID}/recommendations`,
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()

    // Personalized endpoint called (not query with text='')
    expect(mockEnginePersonalized).toHaveBeenCalledWith(expect.objectContaining({ profileId: PROFILE_ID }))
    expect(mockEngineQuery).not.toHaveBeenCalled()

    // Results from engine
    expect(body.candidates).toHaveLength(2)
    expect(body.candidates[0].mediaId).toBe('media-1')
    expect(body.candidates[0].source).toBe('ENGINE')
    expect(body.candidates[0].reasons).toContain('strong semantic match')

    // Metadata reflects profile-only mode (no planner)
    expect(body.engineMetadata.plannerModelVersion).toBe('none/profile-only')
  })

  it('falls back to local ranking when engine is unavailable', async () => {
    mockEnginePersonalized.mockResolvedValue(null)

    const res = await homeApp.inject({
      method: 'GET',
      url: `/profiles/${PROFILE_ID}/recommendations`,
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.candidates).toBeDefined()
  })
})

describe('Engine version equivalence — Lab and Home with same profile', () => {
  it('both paths return the same engineVersion when engine is available', async () => {
    mockEngineQuery.mockResolvedValue({
      requestId: 'req-lab',
      results: ENGINE_RESULTS,
      engineMetadata: ENGINE_METADATA,
      queryPlan: ENGINE_QUERY_PLAN,
    })
    mockEnginePersonalized.mockResolvedValue({
      requestId: 'req-home',
      results: ENGINE_RESULTS,
      engineMetadata: ENGINE_METADATA,
    })

    const [labRes, homeRes] = await Promise.all([
      labApp.inject({
        method: 'POST',
        url: '/recommendation-lab/semantic-query',
        payload: { query: 'thriller movies', expandWithLlm: true, profileId: PROFILE_ID },
      }),
      homeApp.inject({
        method: 'GET',
        url: `/profiles/${PROFILE_ID}/recommendations`,
      }),
    ])

    expect(labRes.statusCode).toBe(200)
    expect(homeRes.statusCode).toBe(200)

    const labBody = labRes.json()
    const homeBody = homeRes.json()

    // Both report the same engineVersion
    expect(labBody.engineMetadata.engineVersion).toBe('1.0.0')
    expect(homeBody.engineMetadata.engineVersion).toBe('1.0.0')
    expect(labBody.engineMetadata.engineVersion).toBe(homeBody.engineMetadata.engineVersion)

    // Both return the same top candidate
    expect(labBody.results[0].mediaId).toBe(ENGINE_RESULTS[0].id)
    expect(homeBody.candidates[0].mediaId).toBe(ENGINE_RESULTS[0].id)
  })
})
