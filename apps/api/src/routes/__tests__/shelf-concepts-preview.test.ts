import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import Fastify from 'fastify'

// ---------------------------------------------------------------------------
// DB mock
// ---------------------------------------------------------------------------

const mockDb = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}))

vi.mock('../../db/client.js', () => ({ db: mockDb }))

// ---------------------------------------------------------------------------
// Engine client mock — previewShelfConcept is the focus here
// ---------------------------------------------------------------------------

const mockPreviewShelfConcept = vi.hoisted(() => vi.fn())

vi.mock('../../client/recommendation-engine-client.js', () => ({
  RecommendationEngineClient: {
    isConfigured: () => true,
    query: vi.fn().mockResolvedValue(null),
    personalized: vi.fn().mockResolvedValue(null),
    generateShelfConcepts: vi.fn().mockResolvedValue(null),
    getShelfConcepts: vi.fn().mockResolvedValue(null),
    shelfConceptFeedback: vi.fn().mockResolvedValue(false),
    generateShelfInstance: vi.fn().mockResolvedValue(null),
    refreshShelfInstance: vi.fn().mockResolvedValue(null),
    previewShelfConcept: mockPreviewShelfConcept,
  },
}))

// ---------------------------------------------------------------------------
// Service mocks (needed by buildService() in shelf-concepts.ts)
// ---------------------------------------------------------------------------

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({})),
}))

vi.mock('../../services/embedding-service.js', () => ({
  EmbeddingService: vi.fn().mockImplementation(() => ({})),
}))

vi.mock('../../services/semantic-retrieval-service.js', () => ({
  SemanticRetrievalService: vi.fn().mockImplementation(() => ({
    retrieve: vi.fn().mockResolvedValue([]),
  })),
}))

vi.mock('../../services/embedding-provider.js', () => ({
  createDefaultProvider: vi.fn().mockReturnValue({ modelProvider: 'openai', modelName: 'text-embedding-3-small' }),
}))

vi.mock('../../services/shelf-concept-generator-service.js', () => ({
  ShelfConceptGeneratorService: vi.fn().mockImplementation(() => ({
    needsRefresh: vi.fn().mockResolvedValue(false),
    getActivePool: vi.fn().mockResolvedValue([]),
    generateConcepts: vi.fn().mockResolvedValue([]),
    buildProfileContext: vi.fn().mockResolvedValue({ coldStart: false }),
    applyFeedback: vi.fn().mockResolvedValue(undefined),
  })),
}))

vi.mock('../../config/env.js', () => ({
  DATABASE_URL: 'postgres://localhost/test',
  OPENAI_API_KEY: 'test-key',
  SHELF_CONCEPT_LLM_MODEL: 'gpt-4o-mini',
  RECOMMENDATION_ENGINE_URL: 'http://engine:3001',
  RECOMMENDATION_PREVIEW_TIMEOUT_MS: 45_000,
  JWT_SECRET: 'vitest-test-jwt-secret-minimum-32-characters-long',
  AUTH_PASSWORD_HASH: '$2b$12$vitest.placeholder.hash.for.tests.only',
}))

// ---------------------------------------------------------------------------
// App setup
// ---------------------------------------------------------------------------

import { shelfConceptsRoutes } from '../shelf-concepts.js'

let app: ReturnType<typeof Fastify>

beforeAll(async () => {
  app = Fastify()
  await app.register(shelfConceptsRoutes)
  await app.ready()
})

afterAll(async () => {
  await app.close()
})

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CONCEPT_ID = 'concept-abc'
const PROFILE_ID = 'profile-xyz'

const PREVIEW_DATA = {
  rawVector: [{ id: 'media-1', title: 'Film A', vectorScore: 0.95 }],
  finalPersonalized: [{ id: 'media-1', title: 'Film A', finalScore: 0.9 }],
  candidatePoolSize: 10,
  queryPlan: { schemaVersion: '1', rawQuery: 'action favorites' },
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /shelf-concepts/:id/preview — error mapping', () => {
  it('returns 200 with preview payload on success', async () => {
    mockPreviewShelfConcept.mockResolvedValue({ ok: true, data: PREVIEW_DATA })

    const res = await app.inject({
      method: 'POST',
      url: `/shelf-concepts/${CONCEPT_ID}/preview`,
      payload: { profileId: PROFILE_ID },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual(PREVIEW_DATA)
    expect(mockPreviewShelfConcept).toHaveBeenCalledWith(CONCEPT_ID, { profileId: PROFILE_ID, debug: undefined })
  })

  it('returns 404 when engine reports not-found (route not yet deployed)', async () => {
    mockPreviewShelfConcept.mockResolvedValue({ ok: false, kind: 'not-found', status: 404 })

    const res = await app.inject({
      method: 'POST',
      url: `/shelf-concepts/${CONCEPT_ID}/preview`,
      payload: { profileId: PROFILE_ID },
    })

    expect(res.statusCode).toBe(404)
    expect(res.json().error).toBe('Recommendation preview endpoint not deployed')
  })

  it('returns 504 on timeout', async () => {
    mockPreviewShelfConcept.mockResolvedValue({ ok: false, kind: 'timeout' })

    const res = await app.inject({
      method: 'POST',
      url: `/shelf-concepts/${CONCEPT_ID}/preview`,
      payload: { profileId: PROFILE_ID },
    })

    expect(res.statusCode).toBe(504)
    expect(res.json().error).toBe('Recommendation preview timed out')
  })

  it('returns 503 when circuit breaker is open', async () => {
    mockPreviewShelfConcept.mockResolvedValue({ ok: false, kind: 'circuit-open' })

    const res = await app.inject({
      method: 'POST',
      url: `/shelf-concepts/${CONCEPT_ID}/preview`,
      payload: { profileId: PROFILE_ID },
    })

    expect(res.statusCode).toBe(503)
    expect(res.json().error).toBe('Recommendation engine circuit open')
  })

  it('returns 502 with HTTP status on engine 5xx error', async () => {
    mockPreviewShelfConcept.mockResolvedValue({ ok: false, kind: 'server-error', status: 500 })

    const res = await app.inject({
      method: 'POST',
      url: `/shelf-concepts/${CONCEPT_ID}/preview`,
      payload: { profileId: PROFILE_ID },
    })

    expect(res.statusCode).toBe(502)
    expect(res.json().error).toBe('Recommendation engine error (HTTP 500)')
  })

  it('returns 502 when engine is unreachable', async () => {
    mockPreviewShelfConcept.mockResolvedValue({ ok: false, kind: 'unreachable' })

    const res = await app.inject({
      method: 'POST',
      url: `/shelf-concepts/${CONCEPT_ID}/preview`,
      payload: { profileId: PROFILE_ID },
    })

    expect(res.statusCode).toBe(502)
    expect(res.json().error).toBe('Recommendation engine unreachable')
  })

  it('returns 400 when profileId is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/shelf-concepts/${CONCEPT_ID}/preview`,
      payload: {},
    })

    expect(res.statusCode).toBe(400)
    expect(mockPreviewShelfConcept).not.toHaveBeenCalled()
  })

  it('error messages are different from the previous generic "Recommendation engine unavailable"', async () => {
    const cases = [
      { kind: 'not-found', status: 404 } as const,
      { kind: 'timeout' } as const,
      { kind: 'circuit-open' } as const,
      { kind: 'server-error', status: 500 } as const,
      { kind: 'unreachable' } as const,
    ]

    for (const errorResult of cases) {
      mockPreviewShelfConcept.mockResolvedValue({ ok: false, ...errorResult })
      const res = await app.inject({
        method: 'POST',
        url: `/shelf-concepts/${CONCEPT_ID}/preview`,
        payload: { profileId: PROFILE_ID },
      })
      expect(res.json().error).not.toBe('Recommendation engine unavailable')
    }
  })
})
