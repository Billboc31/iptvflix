import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'

const { mockListMovies } = vi.hoisted(() => ({
  mockListMovies: vi.fn(),
}))

vi.mock('../services/catalog-service.js', () => ({
  listMovies: mockListMovies,
  NotFoundError: class NotFoundError extends Error {
    readonly statusCode = 404
    constructor(entity: string, id: string) {
      super(`${entity} ${id} not found`)
    }
  },
}))

import { moviesRoutes } from './movies.js'

const MOCK_MOVIE = {
  id: 'a1b2c3d4-0000-0000-0000-000000000001',
  title: 'Inception',
  year: 2010,
  synopsis: 'A dream within a dream.',
  posterUrl: null,
  backdropUrl: null,
  runtime: 148,
  genres: ['Action', 'Sci-Fi'],
  quality: null,
  availabilityCount: 1,
  availabilityStatus: 'AVAILABLE' as const,
}

const PAGINATED = {
  items: [MOCK_MOVIE],
  total: 1,
  page: 1,
  pageSize: 20,
}

const app = Fastify({ logger: false })

beforeAll(async () => {
  await app.register(moviesRoutes)
  await app.ready()
})

afterAll(async () => {
  await app.close()
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /movies', () => {
  it('returns paginated list with no filters', async () => {
    mockListMovies.mockResolvedValue(PAGINATED)
    const res = await app.inject({ method: 'GET', url: '/movies' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual(PAGINATED)
    expect(mockListMovies).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, pageSize: 20 }),
    )
  })

  it('forwards q filter to service', async () => {
    mockListMovies.mockResolvedValue({ ...PAGINATED, items: [] })
    const res = await app.inject({ method: 'GET', url: '/movies?q=inception' })
    expect(res.statusCode).toBe(200)
    expect(mockListMovies).toHaveBeenCalledWith(expect.objectContaining({ q: 'inception' }))
  })

  it('forwards genreId filter to service', async () => {
    const genreId = 'a1b2c3d4-0000-0000-0000-000000000099'
    mockListMovies.mockResolvedValue(PAGINATED)
    const res = await app.inject({ method: 'GET', url: `/movies?genreId=${genreId}` })
    expect(res.statusCode).toBe(200)
    expect(mockListMovies).toHaveBeenCalledWith(expect.objectContaining({ genreId }))
  })

  it('forwards year filter to service as number', async () => {
    mockListMovies.mockResolvedValue(PAGINATED)
    const res = await app.inject({ method: 'GET', url: '/movies?year=2010' })
    expect(res.statusCode).toBe(200)
    expect(mockListMovies).toHaveBeenCalledWith(expect.objectContaining({ year: 2010 }))
  })

  it('forwards availability filter to service', async () => {
    mockListMovies.mockResolvedValue(PAGINATED)
    const res = await app.inject({ method: 'GET', url: '/movies?availability=AVAILABLE' })
    expect(res.statusCode).toBe(200)
    expect(mockListMovies).toHaveBeenCalledWith(
      expect.objectContaining({ availability: 'AVAILABLE' }),
    )
  })

  it('forwards sortBy filter to service', async () => {
    mockListMovies.mockResolvedValue(PAGINATED)
    const res = await app.inject({ method: 'GET', url: '/movies?sortBy=recentAvailability' })
    expect(res.statusCode).toBe(200)
    expect(mockListMovies).toHaveBeenCalledWith(
      expect.objectContaining({ sortBy: 'recentAvailability' }),
    )
  })

  it('returns 400 for invalid year', async () => {
    const res = await app.inject({ method: 'GET', url: '/movies?year=abc' })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 for year out of range', async () => {
    const res = await app.inject({ method: 'GET', url: '/movies?year=1000' })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 for fractional year', async () => {
    const res = await app.inject({ method: 'GET', url: '/movies?year=2010.5' })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 for invalid availability', async () => {
    const res = await app.inject({ method: 'GET', url: '/movies?availability=MAYBE' })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 for invalid sortBy', async () => {
    const res = await app.inject({ method: 'GET', url: '/movies?sortBy=random' })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 for q exceeding 200 chars', async () => {
    const longQ = 'a'.repeat(201)
    const res = await app.inject({ method: 'GET', url: `/movies?q=${longQ}` })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 for invalid genreId format', async () => {
    const res = await app.inject({ method: 'GET', url: '/movies?genreId=not-a-uuid' })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 for page < 1', async () => {
    const res = await app.inject({ method: 'GET', url: '/movies?page=0' })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 for pageSize > 100', async () => {
    const res = await app.inject({ method: 'GET', url: '/movies?pageSize=101' })
    expect(res.statusCode).toBe(400)
  })

  it('returns availabilityCount: 0 for a movie with no available source', async () => {
    const zeroAvailMovie = { ...MOCK_MOVIE, availabilityCount: 0, availabilityStatus: 'UNAVAILABLE' as const }
    mockListMovies.mockResolvedValue({ items: [zeroAvailMovie], total: 1, page: 1, pageSize: 20 })
    const res = await app.inject({ method: 'GET', url: '/movies' })
    expect(res.statusCode).toBe(200)
    const data = res.json<{ items: any[] }>()
    expect(data.items[0].availabilityCount).toBe(0)
    expect(data.items[0].availabilityStatus).toBe('UNAVAILABLE')
  })

  it('returns availabilityCount: 2 for a movie available from two sources', async () => {
    const multiAvailMovie = { ...MOCK_MOVIE, availabilityCount: 2, availabilityStatus: 'AVAILABLE' as const }
    mockListMovies.mockResolvedValue({ items: [multiAvailMovie], total: 1, page: 1, pageSize: 20 })
    const res = await app.inject({ method: 'GET', url: '/movies' })
    expect(res.statusCode).toBe(200)
    const data = res.json<{ items: any[] }>()
    expect(data.items[0].availabilityCount).toBe(2)
    expect(data.items[0].availabilityStatus).toBe('AVAILABLE')
  })
})

