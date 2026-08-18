import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'

const mockDb = vi.hoisted(() => ({
  select: vi.fn(),
}))

vi.mock('../../db/client.js', () => ({ db: mockDb }))

import { embeddingBackfillRoutes } from '../embedding-backfill.js'

const app = Fastify({ logger: false })

beforeAll(async () => {
  await app.register(embeddingBackfillRoutes)
  await app.ready()
})

afterAll(async () => {
  await app.close()
})

beforeEach(() => {
  vi.resetAllMocks()
})

function setupSelectFromWhere(row: object) {
  mockDb.select.mockReturnValueOnce({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([row]),
    }),
  })
}

describe('POST /admin/embedding-backfill', () => {
  it('returns 501 with eligibleMovies and eligibleSeries counts', async () => {
    setupSelectFromWhere({ cnt: 42 }) // movies with metadataEnrichedAt
    setupSelectFromWhere({ cnt: 17 }) // series with metadataEnrichedAt

    const res = await app.inject({ method: 'POST', url: '/admin/embedding-backfill' })

    expect(res.statusCode).toBe(501)
    const body = res.json()
    expect(body.eligibleMovies).toBe(42)
    expect(body.eligibleSeries).toBe(17)
    expect(body.message).toContain('#205')
  })

  it('returns 501 with zero counts when no enriched titles exist', async () => {
    setupSelectFromWhere({ cnt: 0 })
    setupSelectFromWhere({ cnt: 0 })

    const res = await app.inject({ method: 'POST', url: '/admin/embedding-backfill' })

    expect(res.statusCode).toBe(501)
    const body = res.json()
    expect(body.eligibleMovies).toBe(0)
    expect(body.eligibleSeries).toBe(0)
  })
})
