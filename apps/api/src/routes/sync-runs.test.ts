import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgres://iptvflix:iptvflix@localhost:5433/iptvflix'
})

const mockList = vi.hoisted(() => vi.fn())
const mockTrigger = vi.hoisted(() => vi.fn())

vi.mock('../services/sync-runs-service.js', () => ({
  listSyncRuns: mockList,
  triggerSync: mockTrigger,
}))

import { syncRunsRoutes } from './sync-runs.js'
import { NotFoundError } from '../services/source-service.js'

const app = Fastify()

beforeAll(async () => {
  await app.register(syncRunsRoutes)
  await app.ready()
})

afterAll(async () => {
  await app.close()
})

beforeEach(() => {
  mockList.mockReset()
  mockTrigger.mockReset()
})

describe('GET /sync-runs', () => {
  it('returns listed runs', async () => {
    mockList.mockResolvedValue([
      {
        id: 'run-1',
        sourceId: 'src-1',
        status: 'DONE',
        startedAt: '2026-01-01T00:00:00.000Z',
        finishedAt: '2026-01-01T00:01:00.000Z',
        moviesAdded: 2,
        seriesAdded: 1,
        error: null,
      },
    ])
    const res = await app.inject({ method: 'GET', url: '/sync-runs' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toHaveLength(1)
  })
})

describe('POST /sync-runs', () => {
  it('returns 201 on success', async () => {
    mockTrigger.mockResolvedValue({
      id: 'run-2',
      sourceId: 'src-1',
      status: 'DONE',
      startedAt: '2026-01-01T00:00:00.000Z',
      finishedAt: '2026-01-01T00:01:00.000Z',
      moviesAdded: 3,
      seriesAdded: 0,
      error: null,
    })
    const res = await app.inject({
      method: 'POST',
      url: '/sync-runs',
      payload: { sourceId: 'src-1' },
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().id).toBe('run-2')
  })

  it('returns 404 when source is missing', async () => {
    mockTrigger.mockRejectedValue(new NotFoundError('missing'))
    const res = await app.inject({
      method: 'POST',
      url: '/sync-runs',
      payload: { sourceId: 'missing' },
    })
    expect(res.statusCode).toBe(404)
  })
})
