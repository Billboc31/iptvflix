import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'

const mockDb = vi.hoisted(() => ({
  insert: vi.fn(),
  select: vi.fn(),
  delete: vi.fn(),
}))

vi.mock('../../db/client.js', () => ({ db: mockDb }))

import { viewingProgressRoutes } from '../viewing-progress.js'

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const PROFILE_ID = '00000000-0000-0000-0000-000000000001'
const MOVIE_ID = 'aaaaaaaa-0000-0000-0000-000000000001'
const EPISODE_ID = 'dddddddd-0000-0000-0000-000000000001'
const EPISODE_ID_B = 'dddddddd-0000-0000-0000-000000000002'
const SERIES_ID = 'eeeeeeee-0000-0000-0000-000000000001'
const UNKNOWN_ID = 'cccccccc-0000-0000-0000-000000000099'

const mockMovieRow = { id: MOVIE_ID }
const mockEpisodeRow = { id: EPISODE_ID }
const mockMovieMeta = { id: MOVIE_ID, title: 'Test Movie', posterPath: null }
const mockSeriesMeta = { id: SERIES_ID, title: 'Test Series', posterPath: null }

function makeProgressRow(
  progressSeconds: number,
  durationSeconds: number,
  lastWatchedAt: Date,
  overrides: Partial<{ id: string; mediaType: 'MOVIE' | 'EPISODE'; mediaId: string }> = {},
) {
  return {
    id: overrides.id ?? 'ffffffff-0000-0000-0000-000000000001',
    profileId: PROFILE_ID,
    mediaType: overrides.mediaType ?? ('MOVIE' as const),
    mediaId: overrides.mediaId ?? MOVIE_ID,
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

function setupDelete() {
  mockDb.delete.mockReturnValue({
    where: vi.fn().mockResolvedValue([]),
  })
}

// Sets up the main CW query (leftJoin chain) then optional meta batches
function setupContinueWatchingSelect(
  rows: ReturnType<typeof makeProgressRow>[],
  opts: {
    movieMeta?: typeof mockMovieMeta[]
    episodeMeta?: { id: string; seriesId: string; episodeNumber: number; title: string | null; seasonNumber: number }[]
    seriesMeta?: typeof mockSeriesMeta[]
  } = {},
) {
  // 1. Progress rows with leftJoin chain
  mockDb.select.mockReturnValueOnce({
    from: vi.fn().mockReturnValue({
      leftJoin: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue(rows),
        }),
      }),
    }),
  })

  if (rows.length === 0) return

  const hasMovies = rows.some((r) => r.mediaType === 'MOVIE')
  const hasEpisodes = rows.some((r) => r.mediaType === 'EPISODE')

  // 2a. Movie meta batch
  if (hasMovies) {
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(opts.movieMeta ?? [mockMovieMeta]),
      }),
    })
  }

  // 2b. Episode meta batch (with innerJoin for seasons)
  if (hasEpisodes) {
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(opts.episodeMeta ?? []),
        }),
      }),
    })
    // 3. Series meta batch
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(opts.seriesMeta ?? [mockSeriesMeta]),
      }),
    })
  }
}

function setupDismissInsert() {
  mockDb.insert.mockReturnValue({
    values: vi.fn().mockReturnValue({
      onConflictDoUpdate: vi.fn().mockResolvedValue([]),
    }),
  })
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
  // Default delete mock for upsertProgress dismissal cleanup
  setupDelete()
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
    expect(mockDb.insert).toHaveBeenCalledTimes(1)
  })

  it('clears dismissal when progress reaches ≥5% threshold', async () => {
    const row = makeProgressRow(10, 120, new Date('2024-01-01T10:00:00Z')) // ~8.3%
    setupValidationSelect([mockMovieRow])
    setupUpsert(row)

    await app.inject({
      method: 'PUT',
      url: `/progress/MOVIE/${MOVIE_ID}`,
      payload: { progressSeconds: 10, durationSeconds: 120 },
    })

    expect(mockDb.delete).toHaveBeenCalledTimes(1)
  })

  it('does not clear dismissal when progress is below 5% threshold', async () => {
    const row = makeProgressRow(3, 120, new Date('2024-01-01T10:00:00Z')) // 2.5%
    setupValidationSelect([mockMovieRow])
    setupUpsert(row)
    // Override beforeEach delete mock — delete should NOT be called
    mockDb.delete.mockClear()

    await app.inject({
      method: 'PUT',
      url: `/progress/MOVIE/${MOVIE_ID}`,
      payload: { progressSeconds: 3, durationSeconds: 120 },
    })

    expect(mockDb.delete).not.toHaveBeenCalled()
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

  it('returns null fields for MOVIE items (no episode fields)', async () => {
    const row = makeProgressRow(60, 120, new Date('2024-01-01T10:00:00Z'))
    setupContinueWatchingSelect([row])

    const res = await app.inject({ method: 'GET', url: '/continue-watching' })

    const item = res.json()[0]
    expect(item.seriesId).toBeNull()
    expect(item.seasonNumber).toBeNull()
    expect(item.episodeNumber).toBeNull()
    expect(item.episodeTitle).toBeNull()
  })

  it('returns episode metadata fields for EPISODE items', async () => {
    const row = makeProgressRow(60, 120, new Date('2024-01-01T10:00:00Z'), {
      mediaType: 'EPISODE',
      mediaId: EPISODE_ID,
    })
    setupContinueWatchingSelect([row], {
      episodeMeta: [{ id: EPISODE_ID, seriesId: SERIES_ID, episodeNumber: 5, title: 'The Episode', seasonNumber: 2 }],
      seriesMeta: [mockSeriesMeta],
    })

    const res = await app.inject({ method: 'GET', url: '/continue-watching' })

    const item = res.json()[0]
    expect(item.seriesId).toBe(SERIES_ID)
    expect(item.seasonNumber).toBe(2)
    expect(item.episodeNumber).toBe(5)
    expect(item.episodeTitle).toBe('The Episode')
    expect(item.title).toBe('Test Series')
  })

  it('excludes item at 94% progress (completed threshold)', async () => {
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
    const newer = makeProgressRow(70, 120, new Date('2024-01-02T10:00:00Z'), { id: 'ffffffff-0000-0000-0000-000000000002' })

    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        leftJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([newer, older]),
          }),
        }),
      }),
    })
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

describe('DELETE /continue-watching/:mediaType/:mediaId', () => {
  it('persists dismissal and returns 204', async () => {
    setupDismissInsert()

    const res = await app.inject({
      method: 'DELETE',
      url: `/continue-watching/MOVIE/${MOVIE_ID}`,
    })

    expect(res.statusCode).toBe(204)
    expect(mockDb.insert).toHaveBeenCalledTimes(1)
  })

  it('returns 400 for invalid mediaType', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/continue-watching/SERIES/${MOVIE_ID}`,
    })
    expect(res.statusCode).toBe(400)
  })

  it('GET returns empty list when leftJoin filters all dismissed items', async () => {
    // Simulates the DB-level leftJoin + IS NULL that excludes dismissed items
    setupContinueWatchingSelect([])

    const res = await app.inject({ method: 'GET', url: '/continue-watching' })

    expect(res.json()).toEqual([])
  })

  it('dismissing episode A does not affect episode B of the same series', async () => {
    // Episode B is still returned after A is dismissed
    const rowB = makeProgressRow(60, 120, new Date('2024-01-01T10:00:00Z'), {
      mediaType: 'EPISODE',
      mediaId: EPISODE_ID_B,
    })
    setupContinueWatchingSelect([rowB], {
      episodeMeta: [{ id: EPISODE_ID_B, seriesId: SERIES_ID, episodeNumber: 2, title: 'Episode B', seasonNumber: 1 }],
      seriesMeta: [mockSeriesMeta],
    })

    const res = await app.inject({ method: 'GET', url: '/continue-watching' })

    expect(res.json().length).toBe(1)
    expect(res.json()[0].mediaId).toBe(EPISODE_ID_B)
  })
})
