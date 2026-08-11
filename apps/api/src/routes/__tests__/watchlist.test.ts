import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'

const mockDb = vi.hoisted(() => ({
  insert: vi.fn(),
  select: vi.fn(),
  delete: vi.fn(),
}))

vi.mock('../../db/client.js', () => ({ db: mockDb }))

import { watchlistRoutes } from '../watchlist.js'

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOVIE_ID = 'aaaaaaaa-0000-0000-0000-000000000001'
const SERIES_ID = 'bbbbbbbb-0000-0000-0000-000000000001'
const UNKNOWN_ID = 'cccccccc-0000-0000-0000-000000000099'
const PROFILE_ID = '00000000-0000-0000-0000-000000000001'

const mockEntry: {
  id: string
  profileId: string
  mediaType: 'MOVIE' | 'SERIES'
  mediaId: string
  addedAt: Date
} = {
  id: 'eeeeeeee-0000-0000-0000-000000000001',
  profileId: PROFILE_ID,
  mediaType: 'MOVIE',
  mediaId: MOVIE_ID,
  addedAt: new Date('2024-01-01T10:00:00Z'),
}

const mockMovieMeta = { id: MOVIE_ID, title: 'Test Movie', posterPath: null }
const mockSeriesMeta = { id: SERIES_ID, title: 'Test Series', posterPath: null }

// ---------------------------------------------------------------------------
// DB mock helpers
// ---------------------------------------------------------------------------

// select().from().where() → Promise<rows>
function setupSelectWhere(rows: object[]) {
  mockDb.select.mockReturnValueOnce({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(rows),
    }),
  })
}

// select().from().where().orderBy() → Promise<rows>
function setupSelectWhereOrder(rows: typeof mockEntry[]) {
  mockDb.select.mockReturnValueOnce({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockResolvedValue(rows),
      }),
    }),
  })
}

// insert().values().onConflictDoNothing().returning() → Promise<rows>
function setupInsert(rows: typeof mockEntry[]) {
  mockDb.insert.mockReturnValue({
    values: vi.fn().mockReturnValue({
      onConflictDoNothing: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue(rows),
      }),
    }),
  })
}

// delete().where() → Promise
function setupDelete() {
  mockDb.delete.mockReturnValue({
    where: vi.fn().mockResolvedValue([]),
  })
}

// ---------------------------------------------------------------------------
// App setup
// ---------------------------------------------------------------------------

const app = Fastify({ logger: false })

beforeAll(async () => {
  await app.register(watchlistRoutes)
  await app.ready()
})

afterAll(async () => {
  await app.close()
})

// resetAllMocks clears mockReturnValueOnce queues AND implementations between tests
beforeEach(() => {
  vi.resetAllMocks()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /watchlist', () => {
  it('adds a valid movie and returns 201', async () => {
    // fetchMediaMeta: movie exists + returns title
    setupSelectWhere([mockMovieMeta])
    setupInsert([mockEntry])

    const res = await app.inject({
      method: 'POST',
      url: '/watchlist',
      payload: { mediaType: 'MOVIE', mediaId: MOVIE_ID },
    })

    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.mediaId).toBe(MOVIE_ID)
    expect(body.mediaType).toBe('MOVIE')
    expect(body.title).toBe('Test Movie')
  })

  it('adds a valid series and returns 201', async () => {
    // fetchMediaMeta: series exists + returns title
    setupSelectWhere([mockSeriesMeta])
    const seriesEntry = {
      id: 'eeeeeeee-0000-0000-0000-000000000002',
      profileId: PROFILE_ID,
      mediaType: 'SERIES' as const,
      mediaId: SERIES_ID,
      addedAt: new Date('2024-01-01T10:00:00Z'),
    }
    setupInsert([seriesEntry])

    const res = await app.inject({
      method: 'POST',
      url: '/watchlist',
      payload: { mediaType: 'SERIES', mediaId: SERIES_ID },
    })

    expect(res.statusCode).toBe(201)
    expect(res.json().mediaType).toBe('SERIES')
    expect(res.json().title).toBe('Test Series')
  })

  it('is idempotent — returns existing entry when duplicate', async () => {
    // fetchMediaMeta: found
    setupSelectWhere([mockMovieMeta])
    // insert: conflict (empty)
    mockDb.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      }),
    })
    // fetch existing watchlist row
    setupSelectWhere([mockEntry])

    const res = await app.inject({
      method: 'POST',
      url: '/watchlist',
      payload: { mediaType: 'MOVIE', mediaId: MOVIE_ID },
    })

    expect(res.statusCode).toBe(201)
    expect(res.json().id).toBe(mockEntry.id)
  })

  it('returns 404 for unknown mediaId', async () => {
    setupSelectWhere([])

    const res = await app.inject({
      method: 'POST',
      url: '/watchlist',
      payload: { mediaType: 'MOVIE', mediaId: UNKNOWN_ID },
    })

    expect(res.statusCode).toBe(404)
  })

  it('returns 400 when mediaType is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/watchlist',
      payload: { mediaId: MOVIE_ID },
    })
    expect(res.statusCode).toBe(400)
  })
})

describe('DELETE /watchlist/:mediaType/:mediaId', () => {
  it('returns 204 when deleting a present entry', async () => {
    setupDelete()
    const res = await app.inject({ method: 'DELETE', url: `/watchlist/MOVIE/${MOVIE_ID}` })
    expect(res.statusCode).toBe(204)
  })

  it('returns 204 even when entry is absent (no-op)', async () => {
    setupDelete()
    const res = await app.inject({ method: 'DELETE', url: `/watchlist/MOVIE/${UNKNOWN_ID}` })
    expect(res.statusCode).toBe(204)
  })

  it('returns 400 for invalid mediaType', async () => {
    const res = await app.inject({ method: 'DELETE', url: `/watchlist/UNKNOWN/${MOVIE_ID}` })
    expect(res.statusCode).toBe(400)
  })
})

describe('GET /watchlist', () => {
  it('returns entries ordered by addedAt desc', async () => {
    const entry2 = {
      ...mockEntry,
      id: 'eeeeeeee-0000-0000-0000-000000000002',
      addedAt: new Date('2024-01-02T10:00:00Z'),
    }
    // 1. Watchlist rows
    setupSelectWhereOrder([entry2, mockEntry])
    // 2. Movie titles batch (both entries are MOVIE type)
    setupSelectWhere([mockMovieMeta])
    // No series batch (no SERIES entries)

    const res = await app.inject({ method: 'GET', url: '/watchlist' })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Array.isArray(body)).toBe(true)
    expect(body[0].id).toBe(entry2.id)
    expect(body[1].id).toBe(mockEntry.id)
    expect(body[0].title).toBe('Test Movie')
  })

  it('returns empty array when watchlist is empty', async () => {
    setupSelectWhereOrder([])
    // No batch calls for empty list

    const res = await app.inject({ method: 'GET', url: '/watchlist' })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual([])
  })
})
