import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'

// This test suite verifies that watchlist operations work for movies/series
// that exist in the canonical catalog but have zero availability rows.
// No availability guard should prevent adding an unavailable title to the watchlist.

const mockDb = vi.hoisted(() => ({
  insert: vi.fn(),
  select: vi.fn(),
  delete: vi.fn(),
}))

vi.mock('../../db/client.js', () => ({ db: mockDb }))

import { watchlistRoutes } from '../watchlist.js'

const UNAVAILABLE_MOVIE_ID = 'aaaaaaaa-0000-0000-0000-000000000099'
const PROFILE_ID = '00000000-0000-0000-0000-000000000001'

const unavailableMovieMeta = {
  id: UNAVAILABLE_MOVIE_ID,
  title: 'Upcoming Film',
  posterPath: null,
}

const watchlistEntry = {
  id: 'eeeeeeee-0000-0000-0000-000000000099',
  profileId: PROFILE_ID,
  mediaType: 'MOVIE' as const,
  mediaId: UNAVAILABLE_MOVIE_ID,
  addedAt: new Date('2024-06-01T10:00:00Z'),
}

function setupSelectWhere(rows: object[]) {
  mockDb.select.mockReturnValueOnce({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(rows),
    }),
  })
}

function setupSelectWhereOrder(rows: object[]) {
  mockDb.select.mockReturnValueOnce({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockResolvedValue(rows),
      }),
    }),
  })
}

function setupInsert(rows: object[]) {
  mockDb.insert.mockReturnValue({
    values: vi.fn().mockReturnValue({
      onConflictDoNothing: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue(rows),
      }),
    }),
  })
}

function setupDelete() {
  mockDb.delete.mockReturnValue({
    where: vi.fn().mockResolvedValue([]),
  })
}

const app = Fastify({ logger: false })

beforeAll(async () => {
  await app.register(watchlistRoutes)
  await app.ready()
})

afterAll(async () => {
  await app.close()
})

beforeEach(() => {
  vi.resetAllMocks()
})

describe('watchlist operations for unavailable (zero-availability) titles', () => {
  it('POST /watchlist succeeds for a movie with zero availability rows (201)', async () => {
    // The watchlist service only checks the movie exists in canonical DB, not availability
    setupSelectWhere([unavailableMovieMeta])
    setupInsert([watchlistEntry])

    const res = await app.inject({
      method: 'POST',
      url: '/watchlist',
      payload: { mediaType: 'MOVIE', mediaId: UNAVAILABLE_MOVIE_ID },
    })

    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.mediaId).toBe(UNAVAILABLE_MOVIE_ID)
    expect(body.title).toBe('Upcoming Film')
  })

  it('GET /watchlist returns unavailable movies in the list', async () => {
    setupSelectWhereOrder([watchlistEntry])
    // Movie meta batch
    setupSelectWhere([unavailableMovieMeta])

    const res = await app.inject({ method: 'GET', url: '/watchlist' })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Array.isArray(body)).toBe(true)
    expect(body[0].mediaId).toBe(UNAVAILABLE_MOVIE_ID)
    expect(body[0].title).toBe('Upcoming Film')
  })

  it('DELETE /watchlist/:mediaType/:mediaId removes unavailable movie entry (204)', async () => {
    setupDelete()

    const res = await app.inject({
      method: 'DELETE',
      url: `/watchlist/MOVIE/${UNAVAILABLE_MOVIE_ID}`,
    })

    expect(res.statusCode).toBe(204)
  })

  it('POST /watchlist returns 404 for a completely unknown movie (not in canonical DB)', async () => {
    const UNKNOWN_ID = 'ffffffff-0000-0000-0000-000000000000'
    setupSelectWhere([]) // movie not found in DB

    const res = await app.inject({
      method: 'POST',
      url: '/watchlist',
      payload: { mediaType: 'MOVIE', mediaId: UNKNOWN_ID },
    })

    expect(res.statusCode).toBe(404)
  })
})
