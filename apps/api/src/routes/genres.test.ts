import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'

const { mockListGenres } = vi.hoisted(() => ({
  mockListGenres: vi.fn(),
}))

vi.mock('../services/catalog-service.js', () => ({
  listGenres: mockListGenres,
}))

import { genresRoutes } from './genres.js'

const MOCK_GENRES = [
  { id: 'a1b2c3d4-0000-0000-0000-000000000010', name: 'Action' },
  { id: 'a1b2c3d4-0000-0000-0000-000000000011', name: 'Drama' },
  { id: 'a1b2c3d4-0000-0000-0000-000000000012', name: 'Sci-Fi' },
]

const app = Fastify({ logger: false })

beforeAll(async () => {
  await app.register(genresRoutes)
  await app.ready()
})

afterAll(async () => {
  await app.close()
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /genres', () => {
  it('returns an array of genres with id and name', async () => {
    mockListGenres.mockResolvedValue(MOCK_GENRES)
    const res = await app.inject({ method: 'GET', url: '/genres' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Array.isArray(body)).toBe(true)
    for (const genre of body) {
      expect(genre).toHaveProperty('id')
      expect(genre).toHaveProperty('name')
      expect(typeof genre.id).toBe('string')
      expect(typeof genre.name).toBe('string')
    }
  })

  it('returns an empty array when no genres exist', async () => {
    mockListGenres.mockResolvedValue([])
    const res = await app.inject({ method: 'GET', url: '/genres' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual([])
  })

  it('returns genres in the order provided by the service', async () => {
    mockListGenres.mockResolvedValue(MOCK_GENRES)
    const res = await app.inject({ method: 'GET', url: '/genres' })
    const body = res.json()
    expect(body[0].name).toBe('Action')
    expect(body[1].name).toBe('Drama')
    expect(body[2].name).toBe('Sci-Fi')
  })
})
