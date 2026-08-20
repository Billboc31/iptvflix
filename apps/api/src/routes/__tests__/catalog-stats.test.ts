import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'

const mockDb = vi.hoisted(() => ({
  select: vi.fn(),
}))

vi.mock('../../db/client.js', () => ({ db: mockDb }))

import { catalogStatsRoutes } from '../catalog-stats.js'

const app = Fastify({ logger: false })

beforeAll(async () => {
  await app.register(catalogStatsRoutes)
  await app.ready()
})

afterAll(async () => {
  await app.close()
})

beforeEach(() => {
  vi.resetAllMocks()
})

// Each Promise.all slot: select().from() or select().from().where()
function setupSelectFrom(row: object) {
  mockDb.select.mockReturnValueOnce({
    from: vi.fn().mockResolvedValue([row]),
  })
}

function setupSelectFromWhere(row: object) {
  mockDb.select.mockReturnValueOnce({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([row]),
    }),
  })
}

describe('GET /admin/catalog-stats', () => {
  it('returns valid shape with correct field structure', async () => {
    // 13 queries: movieStats, seriesStats, episodeCount, movieAvail, seriesAvail, episodeAvail,
    // oldestMovieSync, oldestSeriesSync, movieFailureCount, seriesFailureCount,
    // seriesSeasonFailureCount, movieEmbeddingCount, seriesEmbeddingCount
    setupSelectFrom({ total: 150, withAvailability: 40, upcoming: 10, neverEnriched: 70, partiallyEnriched: 20, fullyEnriched: 60, stale: 5 })
    setupSelectFrom({ total: 60, withAvailability: 20, upcoming: 5, neverEnriched: 30, partiallyEnriched: 10, fullyEnriched: 20, stale: 2 })
    setupSelectFrom({ cnt: 500 })
    setupSelectFrom({ cnt: 40 })
    setupSelectFrom({ cnt: 20 })
    setupSelectFrom({ cnt: 1000 })
    setupSelectFromWhere({ syncedAt: '2025-01-01T00:00:00.000Z' })
    setupSelectFromWhere({ syncedAt: '2025-02-01T00:00:00.000Z' })
    setupSelectFromWhere({ cnt: 3 })
    setupSelectFromWhere({ cnt: 1 })
    setupSelectFromWhere({ cnt: 0 })
    setupSelectFrom({ eligible: 80, pending: 50 })
    setupSelectFrom({ eligible: 30, pending: 15 })

    const res = await app.inject({ method: 'GET', url: '/admin/catalog-stats' })

    expect(res.statusCode).toBe(200)
    const body = res.json()

    expect(body.movies.total).toBe(150)
    expect(body.movies.withAvailability).toBe(40)
    expect(body.movies.withoutAvailability).toBe(110) // 150 - 40
    expect(body.movies.upcoming).toBe(10)
    expect(body.movies.neverEnriched).toBe(70)
    expect(body.movies.partiallyEnriched).toBe(20)
    expect(body.movies.fullyEnriched).toBe(60)
    expect(body.movies.enriched).toBe(80) // partiallyEnriched + fullyEnriched
    expect(body.movies.failedLastEnrichment).toBe(3)
    expect(body.movies.embeddingEligible).toBe(80)
    expect(body.movies.embeddingPending).toBe(50)

    expect(body.series.total).toBe(60)
    expect(body.series.withoutAvailability).toBe(40) // 60 - 20
    expect(body.series.failedLastEnrichment).toBe(1)
    expect(body.series.embeddingPending).toBe(15)

    expect(body.episodeCount).toBe(500)
    expect(body.availabilityRows.movie).toBe(40)
    expect(body.availabilityRows.series).toBe(20)
    expect(body.availabilityRows.episode).toBe(1000)

    expect(body.tmdbSyncAge).toHaveProperty('oldestMovieSyncedAt')
    expect(body.tmdbSyncAge).toHaveProperty('oldestSeriesSyncedAt')
  })

  it('withoutAvailability is positive when catalog has titles with no availability', async () => {
    setupSelectFrom({ total: 200, withAvailability: 50, upcoming: 0, neverEnriched: 200, partiallyEnriched: 0, fullyEnriched: 0, stale: 0 })
    setupSelectFrom({ total: 80, withAvailability: 10, upcoming: 0, neverEnriched: 80, partiallyEnriched: 0, fullyEnriched: 0, stale: 0 })
    setupSelectFrom({ cnt: 0 })
    setupSelectFrom({ cnt: 50 })
    setupSelectFrom({ cnt: 10 })
    setupSelectFrom({ cnt: 0 })
    setupSelectFromWhere({ syncedAt: null })
    setupSelectFromWhere({ syncedAt: null })
    setupSelectFromWhere({ cnt: 0 })
    setupSelectFromWhere({ cnt: 0 })
    setupSelectFromWhere({ cnt: 0 })
    setupSelectFrom({ eligible: 0, pending: 0 })
    setupSelectFrom({ eligible: 0, pending: 0 })

    const res = await app.inject({ method: 'GET', url: '/admin/catalog-stats' })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    // 200 total movies with only 50 available → 150 without availability
    expect(body.movies.withoutAvailability).toBeGreaterThan(0)
    expect(body.movies.withoutAvailability).toBe(150)
  })
})
