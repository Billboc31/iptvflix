import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockGetSimilarMovies, mockGetSimilarSeries } = vi.hoisted(() => ({
  mockGetSimilarMovies: vi.fn(),
  mockGetSimilarSeries: vi.fn(),
}))

vi.mock('../../services/similar-titles-service.js', () => ({
  SimilarTitlesService: vi.fn().mockImplementation(() => ({
    getSimilarMovies: mockGetSimilarMovies,
    getSimilarSeries: mockGetSimilarSeries,
  })),
}))

vi.mock('../../services/catalog-service.js', () => ({
  listMovies: vi.fn(),
  listSeries: vi.fn(),
  getMovie: vi.fn(),
  getSeries: vi.fn(),
  NotFoundError: class NotFoundError extends Error {
    readonly statusCode = 404
    constructor(entity: string, id: string) {
      super(`${entity} ${id} not found`)
    }
  },
}))

import { moviesRoutes } from '../movies.js'
import { seriesRoutes } from '../series.js'
import { SimilarTitlesService } from '../../services/similar-titles-service.js'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MOVIE_ID = 'aaaaaaaa-0000-0000-0000-000000000001'
const SERIES_ID = 'bbbbbbbb-0000-0000-0000-000000000002'
const UNKNOWN_ID = 'cccccccc-0000-0000-0000-000000000099'

const MOCK_CARD = {
  id: 'dddddddd-0000-0000-0000-000000000001',
  tmdbId: 603,
  title: 'The Matrix',
  posterPath: '/poster.jpg',
  year: 1999,
  voteAverage: 8.2,
  isAvailable: true,
}

const MOCK_SERIES_CARD = {
  id: 'eeeeeeee-0000-0000-0000-000000000001',
  tmdbId: 1396,
  title: 'Breaking Bad',
  posterPath: '/bb.jpg',
  year: 2008,
  voteAverage: 9.5,
  isAvailable: false,
}

// ---------------------------------------------------------------------------
// App setup
// ---------------------------------------------------------------------------

const similarTitlesService = new SimilarTitlesService(null as any, null as any)
const app = Fastify({ logger: false })

beforeAll(async () => {
  await app.register(moviesRoutes, { similarTitlesService })
  await app.register(seriesRoutes, { similarTitlesService })
  await app.ready()
})

afterAll(async () => {
  await app.close()
})

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// Movie similar tests
// ---------------------------------------------------------------------------

describe('GET /movies/:id/similar', () => {
  it('returns 200 with { items } containing correct card fields', async () => {
    mockGetSimilarMovies.mockResolvedValue([MOCK_CARD])

    const res = await app.inject({ method: 'GET', url: `/movies/${MOVIE_ID}/similar` })

    expect(res.statusCode).toBe(200)
    const body = res.json<{ items: typeof MOCK_CARD[] }>()
    expect(body.items).toHaveLength(1)
    const card = body.items[0]
    expect(card.id).toBe(MOCK_CARD.id)
    expect(card.tmdbId).toBe(MOCK_CARD.tmdbId)
    expect(card.title).toBe(MOCK_CARD.title)
    expect(card.posterPath).toBe(MOCK_CARD.posterPath)
    expect(card.year).toBe(MOCK_CARD.year)
    expect(card.voteAverage).toBe(MOCK_CARD.voteAverage)
    expect(card.isAvailable).toBe(MOCK_CARD.isAvailable)
  })

  it('returns 200 with empty items when no similar titles', async () => {
    mockGetSimilarMovies.mockResolvedValue([])

    const res = await app.inject({ method: 'GET', url: `/movies/${MOVIE_ID}/similar` })

    expect(res.statusCode).toBe(200)
    expect(res.json().items).toEqual([])
  })

  it('returns 404 for unknown movie id', async () => {
    const { NotFoundError } = await import('../../services/catalog-service.js')
    mockGetSimilarMovies.mockRejectedValue(new NotFoundError('Movie', UNKNOWN_ID))

    const res = await app.inject({ method: 'GET', url: `/movies/${UNKNOWN_ID}/similar` })

    expect(res.statusCode).toBe(404)
  })

  it('passes limit param to service', async () => {
    mockGetSimilarMovies.mockResolvedValue([MOCK_CARD])

    const res = await app.inject({ method: 'GET', url: `/movies/${MOVIE_ID}/similar?limit=5` })

    expect(res.statusCode).toBe(200)
    expect(mockGetSimilarMovies).toHaveBeenCalledWith(MOVIE_ID, 5)
  })

  it('returns 400 for limit=0', async () => {
    const res = await app.inject({ method: 'GET', url: `/movies/${MOVIE_ID}/similar?limit=0` })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 for limit=99', async () => {
    const res = await app.inject({ method: 'GET', url: `/movies/${MOVIE_ID}/similar?limit=99` })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 for non-UUID id', async () => {
    const res = await app.inject({ method: 'GET', url: '/movies/not-a-uuid/similar' })
    expect(res.statusCode).toBe(400)
  })
})

// ---------------------------------------------------------------------------
// Series similar tests
// ---------------------------------------------------------------------------

describe('GET /series/:id/similar', () => {
  it('returns 200 with { items } containing correct card fields', async () => {
    mockGetSimilarSeries.mockResolvedValue([MOCK_SERIES_CARD])

    const res = await app.inject({ method: 'GET', url: `/series/${SERIES_ID}/similar` })

    expect(res.statusCode).toBe(200)
    const body = res.json<{ items: typeof MOCK_SERIES_CARD[] }>()
    expect(body.items).toHaveLength(1)
    const card = body.items[0]
    expect(card.id).toBe(MOCK_SERIES_CARD.id)
    expect(card.tmdbId).toBe(MOCK_SERIES_CARD.tmdbId)
    expect(card.title).toBe(MOCK_SERIES_CARD.title)
    expect(card.isAvailable).toBe(MOCK_SERIES_CARD.isAvailable)
  })

  it('returns 404 for unknown series id', async () => {
    const { NotFoundError } = await import('../../services/catalog-service.js')
    mockGetSimilarSeries.mockRejectedValue(new NotFoundError('Series', UNKNOWN_ID))

    const res = await app.inject({ method: 'GET', url: `/series/${UNKNOWN_ID}/similar` })

    expect(res.statusCode).toBe(404)
  })

  it('returns at most limit items when limit=5', async () => {
    const cards = Array.from({ length: 3 }, (_, i) => ({ ...MOCK_SERIES_CARD, id: `id-${i}`, tmdbId: 1000 + i }))
    mockGetSimilarSeries.mockResolvedValue(cards)

    const res = await app.inject({ method: 'GET', url: `/series/${SERIES_ID}/similar?limit=5` })

    expect(res.statusCode).toBe(200)
    expect(mockGetSimilarSeries).toHaveBeenCalledWith(SERIES_ID, 5)
  })

  it('returns 400 for limit=0', async () => {
    const res = await app.inject({ method: 'GET', url: `/series/${SERIES_ID}/similar?limit=0` })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 for limit=99', async () => {
    const res = await app.inject({ method: 'GET', url: `/series/${SERIES_ID}/similar?limit=99` })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 for non-UUID id', async () => {
    const res = await app.inject({ method: 'GET', url: '/series/not-a-uuid/similar' })
    expect(res.statusCode).toBe(400)
  })
})
