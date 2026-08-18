import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'

const mockDb = vi.hoisted(() => ({
  insert: vi.fn(),
  select: vi.fn(),
  delete: vi.fn(),
}))

vi.mock('../../db/client.js', () => ({ db: mockDb }))

import { followReleaseRoutes } from '../follow-release.js'

// ---------------------------------------------------------------------------
// Fixture data
// ---------------------------------------------------------------------------

const MOVIE_ID = 'aaaaaaaa-0000-0000-0000-000000000001'
const SERIES_ID = 'bbbbbbbb-0000-0000-0000-000000000001'
const PROFILE_ID = '00000000-0000-0000-0000-000000000001'

const mockFollowEntry = {
  id: 'eeeeeeee-0000-0000-0000-000000000001',
  profileId: PROFILE_ID,
  mediaType: 'MOVIE' as 'MOVIE' | 'SERIES',
  mediaId: MOVIE_ID,
  followedAt: new Date('2025-01-01T10:00:00Z'),
}

// ---------------------------------------------------------------------------
// DB mock helpers
// ---------------------------------------------------------------------------

function setupInsertConflictDoNothingReturning(rows: typeof mockFollowEntry[]) {
  mockDb.insert.mockReturnValueOnce({
    values: vi.fn().mockReturnValue({
      onConflictDoNothing: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue(rows),
      }),
    }),
  })
}

function setupSelectWhere(rows: object[]) {
  mockDb.select.mockReturnValueOnce({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(rows),
    }),
  })
}

function setupSelectWhereOrder(rows: typeof mockFollowEntry[]) {
  mockDb.select.mockReturnValueOnce({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockResolvedValue(rows),
      }),
    }),
  })
}

function setupDelete() {
  mockDb.delete.mockReturnValueOnce({
    where: vi.fn().mockResolvedValue([]),
  })
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

const app = Fastify({ logger: false })

beforeAll(async () => {
  app.addHook('preHandler', async (request) => {
    request.profileId = PROFILE_ID
  })
  await app.register(followReleaseRoutes)
  await app.ready()
})

afterAll(async () => {
  await app.close()
})

beforeEach(() => {
  vi.resetAllMocks()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /follow-release', () => {
  it('follows a movie with zero availabilities and returns 201', async () => {
    setupInsertConflictDoNothingReturning([mockFollowEntry])

    const res = await app.inject({
      method: 'POST',
      url: '/follow-release',
      payload: { mediaType: 'MOVIE', mediaId: MOVIE_ID },
    })

    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.mediaId).toBe(MOVIE_ID)
    expect(body.mediaType).toBe('MOVIE')
  })

  it('follows a series and returns 201', async () => {
    const seriesEntry = { ...mockFollowEntry, mediaType: 'SERIES' as 'MOVIE' | 'SERIES', mediaId: SERIES_ID }
    setupInsertConflictDoNothingReturning([seriesEntry])

    const res = await app.inject({
      method: 'POST',
      url: '/follow-release',
      payload: { mediaType: 'SERIES', mediaId: SERIES_ID },
    })

    expect(res.statusCode).toBe(201)
    expect(res.json().mediaType).toBe('SERIES')
  })

  it('is idempotent — returns existing entry when duplicate', async () => {
    setupInsertConflictDoNothingReturning([])
    setupSelectWhere([mockFollowEntry])

    const res = await app.inject({
      method: 'POST',
      url: '/follow-release',
      payload: { mediaType: 'MOVIE', mediaId: MOVIE_ID },
    })

    expect(res.statusCode).toBe(201)
    expect(res.json().id).toBe(mockFollowEntry.id)
  })

  it('returns 400 when mediaType is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/follow-release',
      payload: { mediaId: MOVIE_ID },
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 for invalid mediaType', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/follow-release',
      payload: { mediaType: 'EPISODE', mediaId: MOVIE_ID },
    })
    expect(res.statusCode).toBe(400)
  })
})

describe('DELETE /follow-release/:mediaType/:mediaId', () => {
  it('unfollows and returns 204', async () => {
    setupDelete()
    const res = await app.inject({
      method: 'DELETE',
      url: `/follow-release/MOVIE/${MOVIE_ID}`,
    })
    expect(res.statusCode).toBe(204)
  })

  it('returns 204 even when entry does not exist (no-op)', async () => {
    setupDelete()
    const res = await app.inject({
      method: 'DELETE',
      url: `/follow-release/SERIES/${SERIES_ID}`,
    })
    expect(res.statusCode).toBe(204)
  })

  it('returns 400 for invalid mediaType', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/follow-release/UNKNOWN/${MOVIE_ID}`,
    })
    expect(res.statusCode).toBe(400)
  })
})

describe('GET /follow-release', () => {
  it('returns followed entries ordered by followedAt desc', async () => {
    const entry2 = { ...mockFollowEntry, id: 'eeeeeeee-0000-0000-0000-000000000002', followedAt: new Date('2025-01-02T10:00:00Z') }
    setupSelectWhereOrder([entry2, mockFollowEntry])

    const res = await app.inject({ method: 'GET', url: '/follow-release' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Array.isArray(body)).toBe(true)
    expect(body[0].id).toBe(entry2.id)
    expect(body[1].id).toBe(mockFollowEntry.id)
  })

  it('lists only the active profile — another profile returns empty', async () => {
    setupSelectWhereOrder([])
    const res = await app.inject({ method: 'GET', url: '/follow-release' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual([])
  })
})
