import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'

const { mockSearchContent } = vi.hoisted(() => ({
  mockSearchContent: vi.fn(),
}))

vi.mock('../services/catalog-service.js', () => ({
  searchContent: mockSearchContent,
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

const app = Fastify({ logger: false })

beforeAll(async () => {
  await app.register(searchRoutes)
  await app.ready()
})

afterAll(async () => {
  await app.close()
})

beforeEach(() => {
  vi.clearAllMocks()
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
