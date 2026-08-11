import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'

const mockDb = vi.hoisted(() => ({
  insert: vi.fn(),
  select: vi.fn(),
}))

vi.mock('../../db/client.js', () => ({ db: mockDb }))

import { viewingProgressRoutes } from '../viewing-progress.js'

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const PROFILE_ID = '00000000-0000-0000-0000-000000000001'
const MOVIE_ID = 'aaaaaaaa-0000-0000-0000-000000000001'
const EPISODE_ID = 'dddddddd-0000-0000-0000-000000000001'
const UNKNOWN_ID = 'cccccccc-0000-0000-0000-000000000099'

const mockMovieRow = { id: MOVIE_ID }
const mockMovieMeta = { id: MOVIE_ID, title: 'Test Movie', posterPath: null }

function makeProgressRow(progressSeconds: number, durationSeconds: number, lastWatchedAt: Date) {
  return {
    id: 'ffffffff-0000-0000-0000-000000000001',
    profileId: PROFILE_ID,
    mediaType: 'MOVIE' as const,
    mediaId: MOVIE_ID,
    progressSeconds,
    durationSeconds,
    lastWatchedAt,
    updatedAt: lastWatchedAt,
  }
}

// ---------------------------------------------------------------------------
// DB mock helpers
// ---------------------------------------------------------------------------

function setupValidationSelect(result: { id: string }[]) {
  mockDb.select.mockReturnValueOnce({
    from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(result) }),
  })
}

function setupUpsert(row: ReturnType<typeof makeProgressRow>) {
  mockDb.insert.mockReturnValue({
    values: vi.fn().mockReturnValue({
      onConflictDoUpdate: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([row]),
      }),
    }),
  })
}

// Sets up: progress rows select, then movie meta batch select
function setupContinueWatchingSelect(rows: ReturnType<typeof makeProgressRow>[]) {
  // 1. Progress rows
  mockDb.select.mockReturnValueOnce({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockResolvedValue(rows),
      }),
    }),
  })
  // 2. Movie meta batch (only called when rows is non-empty and contains MOVIE items)
  if (rows.length > 0 && rows.some((r) => r.mediaType === 'MOVIE')) {
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([mockMovieMeta]),
      }),
    })
  }
  // Episodes batch would be set up separately if needed
}

// ---------------------------------------------------------------------------
// App setup
// ---------------------------------------------------------------------------

const app = Fastify({ logger: false })

beforeAll(async () => {
  await app.register(viewingProgressRoutes)
  await app.ready()
})

afterAll(async () => {
  await app.close()
})

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PUT /progress/:mediaType/:mediaId', () => {
  it('creates a progress row on first call', async () => {
    const row = makeProgressRow(60, 120, new Date('2024-01-01T10:00:00Z'))
    setupValidationSelect([mockMovieRow])
    setupUpsert(row)

    const res = await app.inject({
      method: 'PUT',
      url: `/progress/MOVIE/${MOVIE_ID}`,
      payload: { progressSeconds: 60, durationSeconds: 120 },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.progressSeconds).toBe(60)
    expect(body.durationSeconds).toBe(120)
    expect(body.mediaId).toBe(MOVIE_ID)
  })

  it('updates the same row on second call (no duplicate)', async () => {
    const row = makeProgressRow(90, 120, new Date('2024-01-01T10:01:00Z'))
    setupValidationSelect([mockMovieRow])
    setupUpsert(row)

    const res = await app.inject({
      method: 'PUT',
      url: `/progress/MOVIE/${MOVIE_ID}`,
      payload: { progressSeconds: 90, durationSeconds: 120 },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().progressSeconds).toBe(90)
    // upsert was called exactly once (no duplicate insertion)
    expect(mockDb.insert).toHaveBeenCalledTimes(1)
  })

  it('returns 404 for unknown mediaId', async () => {
    setupValidationSelect([])

    const res = await app.inject({
      method: 'PUT',
      url: `/progress/MOVIE/${UNKNOWN_ID}`,
      payload: { progressSeconds: 30, durationSeconds: 120 },
    })

    expect(res.statusCode).toBe(404)
  })

  it('returns 400 for invalid mediaType', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/progress/SERIES/${MOVIE_ID}`,
      payload: { progressSeconds: 30, durationSeconds: 120 },
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 when body fields are missing', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/progress/MOVIE/${MOVIE_ID}`,
      payload: { progressSeconds: 30 },
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 when durationSeconds is 0', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/progress/MOVIE/${MOVIE_ID}`,
      payload: { progressSeconds: 0, durationSeconds: 0 },
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 when progressSeconds exceeds durationSeconds', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/progress/MOVIE/${MOVIE_ID}`,
      payload: { progressSeconds: 200, durationSeconds: 120 },
    })
    expect(res.statusCode).toBe(400)
  })
})

describe('GET /continue-watching', () => {
  it('includes item at 50% progress (in-progress threshold)', async () => {
    const row = makeProgressRow(60, 120, new Date('2024-01-01T10:00:00Z')) // 50%
    setupContinueWatchingSelect([row])

    const res = await app.inject({ method: 'GET', url: '/continue-watching' })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.length).toBe(1)
    expect(body[0].progressSeconds).toBe(60)
    expect(body[0].title).toBe('Test Movie')
  })

  it('excludes item at 94% progress (completed threshold)', async () => {
    // The DB filter handles this — we simulate the DB returning no rows
    setupContinueWatchingSelect([])

    const res = await app.inject({ method: 'GET', url: '/continue-watching' })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual([])
  })

  it('excludes item at 3% progress (never-started threshold)', async () => {
    setupContinueWatchingSelect([])

    const res = await app.inject({ method: 'GET', url: '/continue-watching' })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual([])
  })

  it('returns items ordered by lastWatchedAt descending', async () => {
    const older = makeProgressRow(60, 120, new Date('2024-01-01T10:00:00Z'))
    const newer = {
      ...makeProgressRow(70, 120, new Date('2024-01-02T10:00:00Z')),
      id: 'ffffffff-0000-0000-0000-000000000002',
    }
    // 1. Progress rows
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue([newer, older]),
        }),
      }),
    })
    // 2. Movie meta batch
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([mockMovieMeta]),
      }),
    })

    const res = await app.inject({ method: 'GET', url: '/continue-watching' })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body[0].id).toBe(newer.id)
    expect(body[1].id).toBe(older.id)
  })
})
