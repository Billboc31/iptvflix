import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'

// Mock db and env before any imports that would trigger their evaluation
const mockDb = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
}))

vi.mock('../../db/client.js', () => ({ db: mockDb }))

vi.mock('../../config/env.js', () => ({
  OPENAI_API_KEY: undefined,
  DATABASE_URL: 'postgresql://localhost/test',
  PORT: 3000,
}))

// Mock the services so we don't pull in openai at import time
vi.mock('../../services/embedding-service.js', () => ({ EmbeddingService: vi.fn() }))
vi.mock('../../services/embedding-backfill-service.js', () => ({ runBackfill: vi.fn() }))
vi.mock('../../services/embedding-provider.js', () => ({ createDefaultProvider: vi.fn() }))

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

function setupSelectFromWhere(rows: object[]) {
  mockDb.select.mockReturnValueOnce({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(rows),
    }),
  })
}

// For select().from() with no where clause (embeddedCount)
function setupSelectFrom(rows: object[]) {
  mockDb.select.mockReturnValueOnce({
    from: vi.fn().mockResolvedValue(rows),
  })
}

describe('POST /admin/embedding-backfill', () => {
  it('returns 503 when OPENAI_API_KEY is not configured', async () => {
    const res = await app.inject({ method: 'POST', url: '/admin/embedding-backfill' })
    expect(res.statusCode).toBe(503)
    const body = res.json()
    expect(body.error).toContain('OPENAI_API_KEY')
  })
})

describe('GET /admin/embedding-backfill/coverage', () => {
  it('returns coverage summary', async () => {
    // movies enriched count
    setupSelectFromWhere([{ cnt: 100 }])
    // series enriched count
    setupSelectFromWhere([{ cnt: 50 }])
    // embedded count (no where clause)
    setupSelectFrom([{ cnt: 80 }])
    // movies field coverage
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ withOverview: 95, withKeywords: 60, withLanguage: 100 }]),
      }),
    })
    // series field coverage
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ withOverview: 48, withKeywords: 25, withLanguage: 50 }]),
      }),
    })

    const res = await app.inject({ method: 'GET', url: '/admin/embedding-backfill/coverage' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.total).toBe(150)
    expect(body.embedded).toBe(80)
    expect(body.coverageByField).toBeDefined()
  })
})
