import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'

// --- Mocks ---

const mockStart = vi.hoisted(() => vi.fn())

vi.mock('../../services/catalog-bootstrap-service.js', () => ({
  CatalogBootstrapService: vi.fn().mockImplementation(() => ({ start: mockStart })),
  BootstrapAlreadyRunningError: class BootstrapAlreadyRunningError extends Error {
    constructor() {
      super('A catalog bootstrap run is already in progress')
      this.name = 'BootstrapAlreadyRunningError'
    }
  },
}))

const mockLimit = vi.hoisted(() => vi.fn())
vi.mock('../../db/client.js', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: mockLimit,
  },
}))

vi.mock('../../db/schema/catalog-bootstrap-runs.js', () => ({
  catalogBootstrapRuns: { startedAt: 'started_at', id: 'id', status: 'status' },
}))

vi.mock('drizzle-orm', () => ({ desc: vi.fn((col) => col) }))

import { catalogBootstrapRoutes } from '../catalog-bootstrap.js'
import { BootstrapAlreadyRunningError } from '../../services/catalog-bootstrap-service.js'

// --- Route test setup ---

const RUN_ID = 'aaaaaaaa-0000-0000-0000-000000000001'
const mockService = { start: mockStart }

const app = Fastify({ logger: false })

beforeAll(async () => {
  await app.register(catalogBootstrapRoutes, { service: mockService as never })
  await app.ready()
})

afterAll(async () => {
  await app.close()
})

beforeEach(() => {
  // clearAllMocks preserves mockReturnThis() implementations on the db mock
  vi.clearAllMocks()
})

describe('POST /catalog-bootstrap', () => {
  it('returns 201 with runId and status RUNNING', async () => {
    mockStart.mockResolvedValueOnce(RUN_ID)

    const res = await app.inject({ method: 'POST', url: '/catalog-bootstrap' })

    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.runId).toBe(RUN_ID)
    expect(body.status).toBe('RUNNING')
  })

  it('returns 409 when a run is already in progress', async () => {
    mockStart.mockRejectedValueOnce(new BootstrapAlreadyRunningError())

    const res = await app.inject({ method: 'POST', url: '/catalog-bootstrap' })

    expect(res.statusCode).toBe(409)
    expect(res.json().error).toBeTruthy()
  })
})

describe('GET /catalog-bootstrap/status', () => {
  it('returns 404 when no run exists', async () => {
    mockLimit.mockResolvedValueOnce([])

    const res = await app.inject({ method: 'GET', url: '/catalog-bootstrap/status' })

    expect(res.statusCode).toBe(404)
  })

  it('returns the latest run with all counter fields', async () => {
    const mockRun = {
      id: RUN_ID,
      status: 'COMPLETED',
      startedAt: new Date('2026-01-01T00:00:00Z'),
      completedAt: new Date('2026-01-01T01:00:00Z'),
      moviesCreated: 500,
      moviesUpdated: 0,
      seriesCreated: 200,
      seriesUpdated: 0,
      failedCount: 2,
      errorMessage: null,
      checkpoint: {},
    }
    mockLimit.mockResolvedValueOnce([mockRun])

    const res = await app.inject({ method: 'GET', url: '/catalog-bootstrap/status' })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.id).toBe(RUN_ID)
    expect(body.status).toBe('COMPLETED')
    expect(body.moviesCreated).toBe(500)
    expect(body.seriesCreated).toBe(200)
    expect(body.failedCount).toBe(2)
  })
})
