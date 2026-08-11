import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'

const { mockListSeries, mockGetSeries } = vi.hoisted(() => ({
  mockListSeries: vi.fn(),
  mockGetSeries: vi.fn(),
}))

vi.mock('../services/catalog-service.js', () => ({
  listSeries: mockListSeries,
  getSeries: mockGetSeries,
  NotFoundError: class NotFoundError extends Error {
    readonly statusCode = 404
    constructor(entity: string, id: string) {
      super(`${entity} ${id} not found`)
    }
  },
}))

import { seriesRoutes } from './series.js'

const MOCK_SERIES = {
  id: 'a1b2c3d4-0000-0000-0000-000000000002',
  title: 'Breaking Bad',
  year: 2008,
  synopsis: 'A chemistry teacher turns to crime.',
  posterUrl: null,
  backdropUrl: null,
  genres: ['Drama', 'Crime'],
  seasonCount: 5,
  availabilityStatus: 'AVAILABLE' as const,
}

const PAGINATED = {
  items: [MOCK_SERIES],
  total: 1,
  page: 1,
  pageSize: 20,
}

const app = Fastify({ logger: false })

beforeAll(async () => {
  await app.register(seriesRoutes)
  await app.ready()
})

afterAll(async () => {
  await app.close()
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /series', () => {
  it('returns paginated list with no filters', async () => {
    mockListSeries.mockResolvedValue(PAGINATED)
    const res = await app.inject({ method: 'GET', url: '/series' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual(PAGINATED)
  })

  it('forwards q filter to service', async () => {
    mockListSeries.mockResolvedValue({ ...PAGINATED, items: [] })
    const res = await app.inject({ method: 'GET', url: '/series?q=breaking' })
    expect(res.statusCode).toBe(200)
    expect(mockListSeries).toHaveBeenCalledWith(expect.objectContaining({ q: 'breaking' }))
  })

  it('forwards genreId filter to service', async () => {
    const genreId = 'a1b2c3d4-0000-0000-0000-000000000099'
    mockListSeries.mockResolvedValue(PAGINATED)
    const res = await app.inject({ method: 'GET', url: `/series?genreId=${genreId}` })
    expect(res.statusCode).toBe(200)
    expect(mockListSeries).toHaveBeenCalledWith(expect.objectContaining({ genreId }))
  })

  it('forwards year filter to service as number', async () => {
    mockListSeries.mockResolvedValue(PAGINATED)
    const res = await app.inject({ method: 'GET', url: '/series?year=2008' })
    expect(res.statusCode).toBe(200)
    expect(mockListSeries).toHaveBeenCalledWith(expect.objectContaining({ year: 2008 }))
  })

  it('forwards availability and sortBy filters', async () => {
    mockListSeries.mockResolvedValue(PAGINATED)
    const res = await app.inject({
      method: 'GET',
      url: '/series?availability=UNAVAILABLE&sortBy=year',
    })
    expect(res.statusCode).toBe(200)
    expect(mockListSeries).toHaveBeenCalledWith(
      expect.objectContaining({ availability: 'UNAVAILABLE', sortBy: 'year' }),
    )
  })

  it('returns empty items list (no results)', async () => {
    mockListSeries.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 })
    const res = await app.inject({ method: 'GET', url: '/series?q=xyznotfound' })
    expect(res.statusCode).toBe(200)
    expect(res.json().items).toHaveLength(0)
  })

  it('returns 400 for invalid year', async () => {
    const res = await app.inject({ method: 'GET', url: '/series?year=notanumber' })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 for invalid availability', async () => {
    const res = await app.inject({ method: 'GET', url: '/series?availability=PARTIAL' })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 for invalid sortBy', async () => {
    const res = await app.inject({ method: 'GET', url: '/series?sortBy=unknown' })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 for q exceeding 200 chars', async () => {
    const longQ = 'b'.repeat(201)
    const res = await app.inject({ method: 'GET', url: `/series?q=${longQ}` })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 for invalid genreId format', async () => {
    const res = await app.inject({ method: 'GET', url: '/series?genreId=bad-id' })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 for pageSize > 100', async () => {
    const res = await app.inject({ method: 'GET', url: '/series?pageSize=200' })
    expect(res.statusCode).toBe(400)
  })
})

describe('GET /series/:id', () => {
  it('returns series when found', async () => {
    mockGetSeries.mockResolvedValue(MOCK_SERIES)
    const res = await app.inject({ method: 'GET', url: `/series/${MOCK_SERIES.id}` })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual(MOCK_SERIES)
  })

  it('returns 404 when service returns null', async () => {
    mockGetSeries.mockResolvedValue(null)
    const res = await app.inject({ method: 'GET', url: '/series/a1b2c3d4-0000-0000-0000-000000000099' })
    expect(res.statusCode).toBe(404)
  })

  it('returns 404 for non-UUID id without calling service', async () => {
    const res = await app.inject({ method: 'GET', url: '/series/not-a-uuid' })
    expect(res.statusCode).toBe(404)
    expect(mockGetSeries).not.toHaveBeenCalled()
  })
})
