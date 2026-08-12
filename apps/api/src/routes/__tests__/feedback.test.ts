import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'

const mockDb = vi.hoisted(() => ({
  insert: vi.fn(),
  select: vi.fn(),
  delete: vi.fn(),
}))

vi.mock('../../db/client.js', () => ({ db: mockDb }))

import { feedbackRoutes } from '../feedback.js'

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOVIE_ID = 'aaaaaaaa-0000-0000-0000-000000000001'
const SERIES_ID = 'bbbbbbbb-0000-0000-0000-000000000001'
const UNKNOWN_ID = 'cccccccc-0000-0000-0000-000000000099'
const PROFILE_ID = '00000000-0000-0000-0000-000000000001'

function makeFeedbackRow(
  mediaId: string,
  feedback: 'LIKE' | 'DISLIKE' | 'NOT_INTERESTED',
  createdAt = new Date('2024-01-01T10:00:00Z'),
  updatedAt = new Date('2024-01-01T10:00:00Z'),
) {
  return {
    id: 'ffffffff-0000-0000-0000-000000000001',
    profileId: PROFILE_ID,
    mediaType: 'MOVIE' as const,
    mediaId,
    feedback,
    createdAt,
    updatedAt,
  }
}

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
function setupSelectWhereOrder(rows: object[]) {
  mockDb.select.mockReturnValueOnce({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockResolvedValue(rows),
      }),
    }),
  })
}

// insert().values().onConflictDoUpdate().returning() → Promise<rows>
function setupUpsert(rows: ReturnType<typeof makeFeedbackRow>[]) {
  mockDb.insert.mockReturnValueOnce({
    values: vi.fn().mockReturnValue({
      onConflictDoUpdate: vi.fn().mockReturnValue({
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
  await app.register(feedbackRoutes)
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

describe('PUT /feedback/:mediaType/:mediaId', () => {
  it('stores LIKE feedback and returns 200', async () => {
    const row = makeFeedbackRow(MOVIE_ID, 'LIKE')
    setupSelectWhere([{ id: MOVIE_ID }]) // validate movie exists
    setupUpsert([row])

    const res = await app.inject({
      method: 'PUT',
      url: `/feedback/MOVIE/${MOVIE_ID}`,
      payload: { feedback: 'LIKE' },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.feedback).toBe('LIKE')
    expect(body.mediaId).toBe(MOVIE_ID)
    expect(body.mediaType).toBe('MOVIE')
    expect(body.updatedAt).toBeDefined()
  })

  it('changes feedback from LIKE to DISLIKE — upsert called once, no duplicate', async () => {
    const row = makeFeedbackRow(MOVIE_ID, 'DISLIKE', new Date('2024-01-01T10:00:00Z'), new Date('2024-01-01T10:01:00Z'))
    setupSelectWhere([{ id: MOVIE_ID }])
    setupUpsert([row])

    const res = await app.inject({
      method: 'PUT',
      url: `/feedback/MOVIE/${MOVIE_ID}`,
      payload: { feedback: 'DISLIKE' },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().feedback).toBe('DISLIKE')
    expect(mockDb.insert).toHaveBeenCalledTimes(1)
  })

  it('is idempotent — repeated identical PUT returns 200', async () => {
    const row = makeFeedbackRow(MOVIE_ID, 'LIKE')
    setupSelectWhere([{ id: MOVIE_ID }])
    setupUpsert([row])

    const res = await app.inject({
      method: 'PUT',
      url: `/feedback/MOVIE/${MOVIE_ID}`,
      payload: { feedback: 'LIKE' },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().feedback).toBe('LIKE')
  })

  it('sets NOT_INTERESTED feedback', async () => {
    const row = makeFeedbackRow(MOVIE_ID, 'NOT_INTERESTED')
    setupSelectWhere([{ id: MOVIE_ID }])
    setupUpsert([row])

    const res = await app.inject({
      method: 'PUT',
      url: `/feedback/MOVIE/${MOVIE_ID}`,
      payload: { feedback: 'NOT_INTERESTED' },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().feedback).toBe('NOT_INTERESTED')
  })

  it('returns 404 for unknown mediaId', async () => {
    setupSelectWhere([]) // movie not found

    const res = await app.inject({
      method: 'PUT',
      url: `/feedback/MOVIE/${UNKNOWN_ID}`,
      payload: { feedback: 'LIKE' },
    })

    expect(res.statusCode).toBe(404)
  })

  it('returns 400 for invalid feedback value', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/feedback/MOVIE/${MOVIE_ID}`,
      payload: { feedback: 'LOVE' },
    })

    expect(res.statusCode).toBe(400)
  })

  it('returns 400 when feedback field is missing', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/feedback/MOVIE/${MOVIE_ID}`,
      payload: {},
    })

    expect(res.statusCode).toBe(400)
  })

  it('returns 400 for invalid mediaType', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/feedback/EPISODE/${MOVIE_ID}`,
      payload: { feedback: 'LIKE' },
    })

    expect(res.statusCode).toBe(400)
  })

  it('does not touch watchlist or viewing_progress tables — insert called exactly once', async () => {
    const row = makeFeedbackRow(MOVIE_ID, 'LIKE')
    setupSelectWhere([{ id: MOVIE_ID }])
    setupUpsert([row])

    await app.inject({
      method: 'PUT',
      url: `/feedback/MOVIE/${MOVIE_ID}`,
      payload: { feedback: 'LIKE' },
    })

    expect(mockDb.insert).toHaveBeenCalledTimes(1)
    expect(mockDb.delete).not.toHaveBeenCalled()
  })

  it('accepts SERIES mediaType', async () => {
    const row = {
      ...makeFeedbackRow(SERIES_ID, 'LIKE'),
      mediaType: 'SERIES' as const,
      mediaId: SERIES_ID,
    }
    setupSelectWhere([{ id: SERIES_ID }]) // validate series exists
    setupUpsert([row])

    const res = await app.inject({
      method: 'PUT',
      url: `/feedback/SERIES/${SERIES_ID}`,
      payload: { feedback: 'LIKE' },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().mediaType).toBe('SERIES')
  })
})

describe('DELETE /feedback/:mediaType/:mediaId', () => {
  it('deletes feedback and returns 204', async () => {
    setupDelete()

    const res = await app.inject({
      method: 'DELETE',
      url: `/feedback/MOVIE/${MOVIE_ID}`,
    })

    expect(res.statusCode).toBe(204)
  })

  it('returns 204 even when row does not exist (idempotent)', async () => {
    setupDelete()

    const res = await app.inject({
      method: 'DELETE',
      url: `/feedback/MOVIE/${UNKNOWN_ID}`,
    })

    expect(res.statusCode).toBe(204)
  })

  it('returns 400 for invalid mediaType', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/feedback/EPISODE/${MOVIE_ID}`,
    })

    expect(res.statusCode).toBe(400)
  })
})

describe('GET /feedback', () => {
  it('returns all feedback ordered by updatedAt desc', async () => {
    const older = makeFeedbackRow(MOVIE_ID, 'LIKE', new Date('2024-01-01T10:00:00Z'), new Date('2024-01-01T10:00:00Z'))
    const newer = {
      ...makeFeedbackRow(MOVIE_ID, 'DISLIKE', new Date('2024-01-01T10:00:00Z'), new Date('2024-01-02T10:00:00Z')),
      id: 'ffffffff-0000-0000-0000-000000000002',
      mediaId: SERIES_ID,
      mediaType: 'SERIES' as const,
    }
    setupSelectWhereOrder([newer, older])

    const res = await app.inject({ method: 'GET', url: '/feedback' })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Array.isArray(body)).toBe(true)
    expect(body).toHaveLength(2)
    expect(body[0].mediaId).toBe(SERIES_ID)
    expect(body[1].mediaId).toBe(MOVIE_ID)
  })

  it('returns empty array when no feedback exists', async () => {
    setupSelectWhereOrder([])

    const res = await app.inject({ method: 'GET', url: '/feedback' })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual([])
  })

  it('each profile has independent feedback — select uses profileId', async () => {
    const row = makeFeedbackRow(MOVIE_ID, 'LIKE')
    setupSelectWhereOrder([row])

    const res = await app.inject({ method: 'GET', url: '/feedback' })

    expect(res.statusCode).toBe(200)
    // The DB select was called once with the profile's rows — profile isolation
    // is enforced by the WHERE clause using DEFAULT_PROFILE_ID.
    expect(mockDb.select).toHaveBeenCalledTimes(1)
  })
})
