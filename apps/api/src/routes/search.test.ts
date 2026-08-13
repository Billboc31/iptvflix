import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'

const { mockSearchContent, mockGetMovieTmdbIds, mockGetSeriesTmdbIds } = vi.hoisted(() => ({
  mockSearchContent: vi.fn(),
  mockGetMovieTmdbIds: vi.fn(),
  mockGetSeriesTmdbIds: vi.fn(),
}))

vi.mock('../services/catalog-service.js', () => ({
  searchContent: mockSearchContent,
  getMovieTmdbIds: mockGetMovieTmdbIds,
  getSeriesTmdbIds: mockGetSeriesTmdbIds,
}))

import { searchRoutes } from './search.js'

const MOCK_RESULT = {
  movies: [
    {
      id: 'a1b2c3d4-0000-0000-0000-000000000001',
      title: 'Batman Begins',
      year: 2005,
      synopsis: null,
      posterUrl: null,
      backdropUrl: null,
      runtime: 140,
      genres: ['Action'],
      quality: null,
      availabilityStatus: 'AVAILABLE' as const,
    },
  ],
  series: [
    {
      id: 'a1b2c3d4-0000-0000-0000-000000000002',
      title: 'Batman: The Animated Series',
      year: 1992,
      synopsis: null,
      posterUrl: null,
      backdropUrl: null,
      genres: ['Animation'],
      seasonCount: 4,
      availabilityStatus: 'AVAILABLE' as const,
    },
  ],
}

const MOCK_EXTERNAL_MOVIE = {
  tmdbId: '9999',
  title: 'Batman Forever',
  year: 1995,
  synopsis: null,
  posterUrl: null,
  releaseStatus: 'Released',
  releaseDate: '1995-06-16',
}

const MOCK_EXTERNAL_SERIES = {
  tmdbId: '8888',
  title: 'Gotham',
  year: 2014,
  synopsis: null,
  posterUrl: null,
  releaseStatus: 'Ended',
  firstAirDate: '2014-09-22',
}

const mockDiscoveryService = {
  discoverMovies: vi.fn(),
  discoverSeries: vi.fn(),
}

const app = Fastify({ logger: false })
const appWithDiscovery = Fastify({ logger: false })

beforeAll(async () => {
  await app.register(searchRoutes)
  await app.ready()

  await appWithDiscovery.register(searchRoutes, { discoveryService: mockDiscoveryService as any })
  await appWithDiscovery.ready()
})

afterAll(async () => {
  await app.close()
  await appWithDiscovery.close()
})

beforeEach(() => {
  vi.clearAllMocks()
  mockGetMovieTmdbIds.mockResolvedValue(new Set())
  mockGetSeriesTmdbIds.mockResolvedValue(new Set())
})

describe('GET /search', () => {
  it('returns movies and series for valid q', async () => {
    mockSearchContent.mockResolvedValue(MOCK_RESULT)
    const res = await app.inject({ method: 'GET', url: '/search?q=batman' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body).toHaveProperty('movies')
    expect(body).toHaveProperty('series')
    expect(body.movies[0].title).toBe('Batman Begins')
    expect(mockSearchContent).toHaveBeenCalledWith('batman')
  })

  it('does not return externalMovies or externalSeries', async () => {
    mockSearchContent.mockResolvedValue(MOCK_RESULT)
    const res = await app.inject({ method: 'GET', url: '/search?q=batman' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body).not.toHaveProperty('externalMovies')
    expect(body).not.toHaveProperty('externalSeries')
  })

  it('returns empty arrays when no results found', async () => {
    mockSearchContent.mockResolvedValue({ movies: [], series: [] })
    const res = await app.inject({ method: 'GET', url: '/search?q=xyznotfound' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.movies).toHaveLength(0)
    expect(body.series).toHaveLength(0)
  })

  it('returns 400 when q is missing', async () => {
    const res = await app.inject({ method: 'GET', url: '/search' })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 when q is empty string', async () => {
    const res = await app.inject({ method: 'GET', url: '/search?q=' })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 when q is whitespace only', async () => {
    const res = await app.inject({ method: 'GET', url: '/search?q=%20%20' })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 when q exceeds 200 characters', async () => {
    const longQ = 'a'.repeat(201)
    const res = await app.inject({ method: 'GET', url: `/search?q=${longQ}` })
    expect(res.statusCode).toBe(400)
  })

  it('response does not include any Xtream provider DTO fields', async () => {
    mockSearchContent.mockResolvedValue(MOCK_RESULT)
    const res = await app.inject({ method: 'GET', url: '/search?q=batman' })
    const body = res.json()
    for (const movie of body.movies) {
      expect(movie).not.toHaveProperty('stream_id')
      expect(movie).not.toHaveProperty('category_id')
      expect(movie).not.toHaveProperty('container_extension')
    }
    for (const s of body.series) {
      expect(s).not.toHaveProperty('series_id')
      expect(s).not.toHaveProperty('category_id')
    }
  })
})

describe('GET /search/remote', () => {
  it('returns externalMovies and externalSeries from discoveryService', async () => {
    mockSearchContent.mockResolvedValue(MOCK_RESULT)
    mockDiscoveryService.discoverMovies.mockResolvedValue([MOCK_EXTERNAL_MOVIE])
    mockDiscoveryService.discoverSeries.mockResolvedValue([MOCK_EXTERNAL_SERIES])

    const res = await appWithDiscovery.inject({ method: 'GET', url: '/search/remote?q=batman' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.externalMovies).toHaveLength(1)
    expect(body.externalMovies[0].tmdbId).toBe('9999')
    expect(body.externalSeries).toHaveLength(1)
    expect(body.externalSeries[0].tmdbId).toBe('8888')
  })

  it('returns empty arrays when no discoveryService is configured', async () => {
    const res = await app.inject({ method: 'GET', url: '/search/remote?q=batman' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.externalMovies).toHaveLength(0)
    expect(body.externalSeries).toHaveLength(0)
  })

  it('returns empty arrays when discoveryService throws', async () => {
    mockSearchContent.mockRejectedValue(new Error('TMDB down'))

    const res = await appWithDiscovery.inject({ method: 'GET', url: '/search/remote?q=batman' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.externalMovies).toHaveLength(0)
    expect(body.externalSeries).toHaveLength(0)
  })

  it('excludes locally known TMDB IDs from remote results', async () => {
    mockSearchContent.mockResolvedValue(MOCK_RESULT)
    mockGetMovieTmdbIds.mockResolvedValue(new Set(['9999']))
    mockGetSeriesTmdbIds.mockResolvedValue(new Set())
    mockDiscoveryService.discoverMovies.mockResolvedValue([])
    mockDiscoveryService.discoverSeries.mockResolvedValue([MOCK_EXTERNAL_SERIES])

    const res = await appWithDiscovery.inject({ method: 'GET', url: '/search/remote?q=batman' })
    expect(res.statusCode).toBe(200)
    expect(mockDiscoveryService.discoverMovies).toHaveBeenCalledWith('batman', new Set(['9999']))
  })

  it('returns 400 when q is missing', async () => {
    const res = await app.inject({ method: 'GET', url: '/search/remote' })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 when q exceeds 200 characters', async () => {
    const longQ = 'a'.repeat(201)
    const res = await app.inject({ method: 'GET', url: `/search/remote?q=${longQ}` })
    expect(res.statusCode).toBe(400)
  })
})
