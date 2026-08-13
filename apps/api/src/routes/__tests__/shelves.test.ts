import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'

// ---------------------------------------------------------------------------
// DB mock (hoisted so vi.mock resolves before imports)
// ---------------------------------------------------------------------------

const mockDb = vi.hoisted(() => ({
  insert: vi.fn(),
  select: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  transaction: vi.fn(),
}))

const mockGenerateShelfFromSeeds = vi.hoisted(() => vi.fn())
const mockRefreshGeneratedShelf = vi.hoisted(() => vi.fn())

vi.mock('../../db/client.js', () => ({ db: mockDb }))

vi.mock('../../services/shelf-generation-service.js', () => ({
  generateShelfFromSeeds: mockGenerateShelfFromSeeds,
  refreshGeneratedShelf: mockRefreshGeneratedShelf,
}))

// Also mock the sub-services so system shelf resolvers don't hit real DB
vi.mock('../../services/viewing-progress-service.js', () => ({
  listContinueWatching: vi.fn().mockResolvedValue([]),
}))

vi.mock('../../services/watchlist-service.js', () => ({
  listWatchlist: vi.fn().mockResolvedValue([]),
}))

import { shelvesRoutes } from '../shelves.js'
import { validateDynamicRules } from '../../services/shelf-service.js'
import { ValidationError } from '../../errors.js'

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const PROFILE_ID = '00000000-0000-0000-0000-000000000001'
const SHELF_ID = 'aaaaaaaa-0000-0000-0000-000000000001'
const MOVIE_ID = 'bbbbbbbb-0000-0000-0000-000000000001'
const SERIES_ID = 'cccccccc-0000-0000-0000-000000000001'

const mockManualShelf = {
  id: SHELF_ID,
  profileId: PROFILE_ID,
  title: 'My Favorites',
  type: 'MANUAL' as const,
  systemKey: null,
  rules: null,
  position: 0,
  layoutHint: 'ROW' as const,
  createdAt: new Date('2024-01-01T10:00:00Z'),
  updatedAt: new Date('2024-01-01T10:00:00Z'),
}

// ---------------------------------------------------------------------------
// DB mock helpers (mirroring watchlist test pattern)
// ---------------------------------------------------------------------------

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

function setupSelectFromOrder(rows: object[]) {
  mockDb.select.mockReturnValueOnce({
    from: vi.fn().mockReturnValue({
      orderBy: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
      }),
    }),
  })
}

function setupSelectWhereOrderAsc(rows: object[]) {
  mockDb.select.mockReturnValueOnce({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockResolvedValue(rows),
      }),
    }),
  })
}

// select().from().where().orderBy() with limit
function setupSelectWhereOrderLimit(rows: object[]) {
  mockDb.select.mockReturnValueOnce({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(rows),
        }),
      }),
    }),
  })
}

// Subquery builder: select().from().where() returns a non-Promise value (used as SQL subquery arg)
function setupSelectFromWhere(returnValue: unknown = {}) {
  mockDb.select.mockReturnValueOnce({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue(returnValue),
    }),
  })
}

// For MAX(position) queries: select().from().where()
function setupSelectMaxPos(maxPos: number) {
  mockDb.select.mockReturnValueOnce({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([{ maxPos }]),
    }),
  })
}

function setupInsert(rows: object[]) {
  mockDb.insert.mockReturnValue({
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue(rows),
    }),
  })
}

function setupInsertOnConflict(rows: object[]) {
  mockDb.insert.mockReturnValue({
    values: vi.fn().mockReturnValue({
      onConflictDoNothing: vi.fn().mockResolvedValue(rows),
    }),
  })
}

function setupUpdate(rows: object[]) {
  mockDb.update.mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
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

// ---------------------------------------------------------------------------
// App setup
// ---------------------------------------------------------------------------

const app = Fastify({ logger: false })

beforeAll(async () => {
  await app.register(shelvesRoutes)
  await app.ready()
})

afterAll(async () => {
  await app.close()
})

beforeEach(() => {
  vi.resetAllMocks()
})

// ---------------------------------------------------------------------------
// validateDynamicRules unit tests
// ---------------------------------------------------------------------------

describe('validateDynamicRules', () => {
  it('accepts valid rules', () => {
    const result = validateDynamicRules({ mediaType: 'MOVIE', yearFrom: 2000, yearTo: 2024, availableToMe: true })
    expect(result.mediaType).toBe('MOVIE')
    expect(result.yearFrom).toBe(2000)
    expect(result.availableToMe).toBe(true)
  })

  it('rejects unknown fields', () => {
    expect(() => validateDynamicRules({ sql: 'DROP TABLE movies' })).toThrow('Unknown rule field')
  })

  it('rejects invalid mediaType', () => {
    expect(() => validateDynamicRules({ mediaType: 'BOOK' })).toThrow('mediaType')
  })

  it('rejects non-integer yearFrom', () => {
    expect(() => validateDynamicRules({ yearFrom: 2000.5 })).toThrow('yearFrom')
  })

  it('rejects negative yearTo', () => {
    expect(() => validateDynamicRules({ yearTo: -1 })).toThrow('yearTo')
  })

  it('rejects invalid watchState', () => {
    expect(() => validateDynamicRules({ watchState: 'PARTIAL' })).toThrow('watchState')
  })

  it('rejects watchState with mediaType SERIES', () => {
    expect(() => validateDynamicRules({ mediaType: 'SERIES', watchState: 'IN_PROGRESS' })).toThrow(
      "watchState is only supported when mediaType is 'MOVIE'",
    )
  })

  it('rejects watchState without mediaType', () => {
    expect(() => validateDynamicRules({ watchState: 'COMPLETED' })).toThrow(
      "watchState is only supported when mediaType is 'MOVIE'",
    )
  })

  it('accepts watchState with mediaType MOVIE', () => {
    const result = validateDynamicRules({ mediaType: 'MOVIE', watchState: 'IN_PROGRESS' })
    expect(result.mediaType).toBe('MOVIE')
    expect(result.watchState).toBe('IN_PROGRESS')
  })

  it('rejects non-array genreIds', () => {
    expect(() => validateDynamicRules({ genreIds: 'action' })).toThrow('genreIds')
  })

  it('accepts empty rules object', () => {
    expect(validateDynamicRules({})).toEqual({})
  })
})

// ---------------------------------------------------------------------------
// GET /shelves
// ---------------------------------------------------------------------------

describe('GET /shelves', () => {
  it('returns system shelves followed by user shelves', async () => {
    // user shelves query
    setupSelectWhereOrder([mockManualShelf])

    const res = await app.inject({ method: 'GET', url: '/shelves' })

    expect(res.statusCode).toBe(200)
    const body = res.json() as Array<{ id: string; type: string }>
    // System shelves first
    expect(body[0].id).toBe('sys_continue_watching')
    expect(body[0].type).toBe('SYSTEM')
    // User shelf last
    const userShelf = body.find((s) => s.id === SHELF_ID)
    expect(userShelf).toBeDefined()
    expect(userShelf!.type).toBe('MANUAL')
  })

  it('returns only system shelves when profile has no user shelves', async () => {
    setupSelectWhereOrder([])

    const res = await app.inject({ method: 'GET', url: '/shelves' })

    expect(res.statusCode).toBe(200)
    const body = res.json() as Array<{ type: string }>
    expect(body.every((s) => s.type === 'SYSTEM')).toBe(true)
    expect(body).toHaveLength(4)
  })
})

// ---------------------------------------------------------------------------
// POST /shelves
// ---------------------------------------------------------------------------

describe('POST /shelves', () => {
  it('creates a MANUAL shelf and returns 201', async () => {
    setupSelectMaxPos(2)
    setupInsert([{ ...mockManualShelf, position: 3 }])

    const res = await app.inject({
      method: 'POST',
      url: '/shelves',
      payload: { title: 'My Favorites', type: 'MANUAL' },
    })

    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.title).toBe('My Favorites')
    expect(body.type).toBe('MANUAL')
  })

  it('creates a DYNAMIC shelf with valid rules and returns 201', async () => {
    setupSelectMaxPos(0)
    setupInsert([{
      ...mockManualShelf,
      type: 'DYNAMIC',
      rules: { mediaType: 'MOVIE', availableToMe: true },
      position: 1,
    }])

    const res = await app.inject({
      method: 'POST',
      url: '/shelves',
      payload: { title: 'Available Movies', type: 'DYNAMIC', rules: { mediaType: 'MOVIE', availableToMe: true } },
    })

    expect(res.statusCode).toBe(201)
    expect(res.json().type).toBe('DYNAMIC')
  })

  it('returns 400 for DYNAMIC shelf with invalid rules', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/shelves',
      payload: { title: 'Bad Shelf', type: 'DYNAMIC', rules: { sql: 'DROP TABLE movies' } },
    })

    expect(res.statusCode).toBe(400)
    expect(res.json().validationError).toBe(true)
  })

  it('returns 400 when title is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/shelves',
      payload: { type: 'MANUAL' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 for watchState with mediaType SERIES', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/shelves',
      payload: { title: 'Bad Shelf', type: 'DYNAMIC', rules: { mediaType: 'SERIES', watchState: 'IN_PROGRESS' } },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().error).toContain("watchState is only supported when mediaType is 'MOVIE'")
  })

  it('returns 400 for watchState without mediaType', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/shelves',
      payload: { title: 'Bad Shelf', type: 'DYNAMIC', rules: { watchState: 'COMPLETED' } },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().error).toContain("watchState is only supported when mediaType is 'MOVIE'")
  })

  it('accepts watchState with mediaType MOVIE', async () => {
    setupSelectMaxPos(0)
    setupInsert([{
      ...mockManualShelf,
      type: 'DYNAMIC',
      rules: { mediaType: 'MOVIE', watchState: 'IN_PROGRESS' },
      position: 1,
    }])

    const res = await app.inject({
      method: 'POST',
      url: '/shelves',
      payload: { title: 'In Progress Movies', type: 'DYNAMIC', rules: { mediaType: 'MOVIE', watchState: 'IN_PROGRESS' } },
    })
    expect(res.statusCode).toBe(201)
  })
})

// ---------------------------------------------------------------------------
// POST /shelves/:id/members — SYSTEM shelf returns 403
// ---------------------------------------------------------------------------

describe('POST /shelves/:id/members', () => {
  it('returns 403 when adding a member to a system shelf', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/shelves/sys_continue_watching/members',
      payload: { mediaType: 'MOVIE', mediaId: MOVIE_ID },
    })
    expect(res.statusCode).toBe(403)
  })

  it('adds a member to a MANUAL shelf', async () => {
    // Shelf lookup
    setupSelectWhere([mockManualShelf])
    // Movie validation
    setupSelectWhere([{ id: MOVIE_ID }])
    // MAX(position)
    setupSelectWhere([{ maxPos: 0 }])
    // Insert member
    setupInsertOnConflict([])

    const res = await app.inject({
      method: 'POST',
      url: `/shelves/${SHELF_ID}/members`,
      payload: { mediaType: 'MOVIE', mediaId: MOVIE_ID },
    })
    expect(res.statusCode).toBe(204)
  })

  it('returns 400 when mediaType is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/shelves/${SHELF_ID}/members`,
      payload: { mediaId: MOVIE_ID },
    })
    expect(res.statusCode).toBe(400)
  })
})

// ---------------------------------------------------------------------------
// PUT /shelves/:id/members/order — manual ordering round-trip
// ---------------------------------------------------------------------------

describe('PUT /shelves/:id/members/order', () => {
  it('reorders members and returns 204', async () => {
    // Shelf lookup
    setupSelectWhere([mockManualShelf])
    // transaction
    mockDb.transaction.mockImplementationOnce(async (fn: (tx: typeof mockDb) => Promise<void>) => {
      const txMock = {
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }),
      }
      await fn(txMock as unknown as typeof mockDb)
    })

    const res = await app.inject({
      method: 'PUT',
      url: `/shelves/${SHELF_ID}/members/order`,
      payload: {
        members: [
          { mediaType: 'MOVIE', mediaId: MOVIE_ID },
          { mediaType: 'SERIES', mediaId: SERIES_ID },
        ],
      },
    })
    expect(res.statusCode).toBe(204)
  })

  it('returns 403 when reordering members of a system shelf', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/shelves/sys_my_list/members/order',
      payload: { members: [] },
    })
    expect(res.statusCode).toBe(403)
  })
})

// ---------------------------------------------------------------------------
// PATCH /shelves/:id — system shelf returns 403
// ---------------------------------------------------------------------------

describe('PATCH /shelves/:id', () => {
  it('returns 403 when updating a system shelf', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/shelves/sys_recently_added_movies',
      payload: { title: 'Hacked' },
    })
    expect(res.statusCode).toBe(403)
  })

  it('updates a user shelf title', async () => {
    setupSelectWhere([mockManualShelf])
    setupUpdate([{ ...mockManualShelf, title: 'Renamed' }])

    const res = await app.inject({
      method: 'PATCH',
      url: `/shelves/${SHELF_ID}`,
      payload: { title: 'Renamed' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().title).toBe('Renamed')
  })
})

// ---------------------------------------------------------------------------
// DELETE /shelves/:id — system shelf returns 403
// ---------------------------------------------------------------------------

describe('DELETE /shelves/:id', () => {
  it('returns 403 when deleting a system shelf', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/shelves/sys_my_list',
    })
    expect(res.statusCode).toBe(403)
  })

  it('deletes a user shelf and returns 204', async () => {
    setupSelectWhere([mockManualShelf])
    setupDelete()

    const res = await app.inject({
      method: 'DELETE',
      url: `/shelves/${SHELF_ID}`,
    })
    expect(res.statusCode).toBe(204)
  })
})

// ---------------------------------------------------------------------------
// Profile isolation — shelf belonging to another profile returns 403
// ---------------------------------------------------------------------------

describe('Profile isolation', () => {
  it('returns 403 for shelf owned by a different profile', async () => {
    setupSelectWhere([{ ...mockManualShelf, profileId: 'other-profile-id' }])

    const res = await app.inject({
      method: 'DELETE',
      url: `/shelves/${SHELF_ID}`,
    })
    expect(res.statusCode).toBe(403)
  })
})

// ---------------------------------------------------------------------------
// GET /shelves/:id — dynamic shelf availability tri-state evaluation
// ---------------------------------------------------------------------------

describe('GET /shelves/:id dynamic availability evaluation', () => {
  const DYNAMIC_SHELF_ID = 'dddddddd-0000-0000-0000-000000000001'

  const makeDynamicShelf = (rules: object) => ({
    ...mockManualShelf,
    id: DYNAMIC_SHELF_ID,
    type: 'DYNAMIC' as const,
    rules,
  })

  const movieUnavailable = { id: 'movie-upcoming', title: 'Upcoming Film', posterPath: null }
  const movieAvailable = { id: 'movie-live', title: 'Live Film', posterPath: '/live.jpg' }
  const seriesUnavailable = { id: 'series-upcoming', title: 'Upcoming Series', posterPath: null }
  const seriesAvailable = { id: 'series-live', title: 'Live Series', posterPath: '/series.jpg' }

  it('availableToMe: false for movies — returns only movies with no AVAILABLE record', async () => {
    setupSelectWhere([makeDynamicShelf({ mediaType: 'MOVIE', availableToMe: false })])
    setupSelectFromWhere({}) // notInArray subquery
    setupSelectWhereOrderLimit([movieUnavailable])
    setupSelectWhere([]) // fetchTrailerKeys

    const res = await app.inject({ method: 'GET', url: `/shelves/${DYNAMIC_SHELF_ID}` })

    expect(res.statusCode).toBe(200)
    const body = res.json() as { items: Array<{ mediaId: string }> }
    expect(body.items).toHaveLength(1)
    expect(body.items[0].mediaId).toBe('movie-upcoming')
  })

  it('availableToMe: undefined for movies — returns movies regardless of availability', async () => {
    setupSelectWhere([makeDynamicShelf({ mediaType: 'MOVIE' })])
    setupSelectWhereOrderLimit([movieUnavailable, movieAvailable])
    setupSelectWhere([]) // fetchTrailerKeys

    const res = await app.inject({ method: 'GET', url: `/shelves/${DYNAMIC_SHELF_ID}` })

    expect(res.statusCode).toBe(200)
    const body = res.json() as { items: Array<{ mediaId: string }> }
    expect(body.items).toHaveLength(2)
  })

  it('availableToMe: false for series — returns only series with no AVAILABLE record', async () => {
    setupSelectWhere([makeDynamicShelf({ mediaType: 'SERIES', availableToMe: false })])
    setupSelectFromWhere({}) // notInArray subquery
    setupSelectWhereOrderLimit([seriesUnavailable])
    setupSelectWhere([]) // fetchTrailerKeys

    const res = await app.inject({ method: 'GET', url: `/shelves/${DYNAMIC_SHELF_ID}` })

    expect(res.statusCode).toBe(200)
    const body = res.json() as { items: Array<{ mediaId: string }> }
    expect(body.items).toHaveLength(1)
    expect(body.items[0].mediaId).toBe('series-upcoming')
  })

  it('availableToMe: undefined for series — returns series regardless of availability', async () => {
    setupSelectWhere([makeDynamicShelf({ mediaType: 'SERIES' })])
    setupSelectWhereOrderLimit([seriesUnavailable, seriesAvailable])
    setupSelectWhere([]) // fetchTrailerKeys

    const res = await app.inject({ method: 'GET', url: `/shelves/${DYNAMIC_SHELF_ID}` })

    expect(res.statusCode).toBe(200)
    const body = res.json() as { items: Array<{ mediaId: string }> }
    expect(body.items).toHaveLength(2)
  })

  it('availableToMe: true for movies — returns only movies with an AVAILABLE record', async () => {
    setupSelectWhere([makeDynamicShelf({ mediaType: 'MOVIE', availableToMe: true })])
    setupSelectFromWhere({}) // inArray subquery
    setupSelectWhereOrderLimit([movieAvailable])
    setupSelectWhere([]) // fetchTrailerKeys

    const res = await app.inject({ method: 'GET', url: `/shelves/${DYNAMIC_SHELF_ID}` })

    expect(res.statusCode).toBe(200)
    const body = res.json() as { items: Array<{ mediaId: string }> }
    expect(body.items).toHaveLength(1)
    expect(body.items[0].mediaId).toBe('movie-live')
  })

  it('availableToMe: true for series — returns only series with an AVAILABLE record', async () => {
    setupSelectWhere([makeDynamicShelf({ mediaType: 'SERIES', availableToMe: true })])
    setupSelectFromWhere({}) // inArray subquery
    setupSelectWhereOrderLimit([seriesAvailable])
    setupSelectWhere([]) // fetchTrailerKeys

    const res = await app.inject({ method: 'GET', url: `/shelves/${DYNAMIC_SHELF_ID}` })

    expect(res.statusCode).toBe(200)
    const body = res.json() as { items: Array<{ mediaId: string }> }
    expect(body.items).toHaveLength(1)
    expect(body.items[0].mediaId).toBe('series-live')
  })
})

// ---------------------------------------------------------------------------
// POST /shelves/generate
// ---------------------------------------------------------------------------

describe('POST /shelves/generate', () => {
  const MOVIE_ID_2 = 'bbbbbbbb-0000-0000-0000-000000000002'
  const MOVIE_ID_3 = 'bbbbbbbb-0000-0000-0000-000000000003'

  const THREE_SEEDS = [
    { mediaType: 'MOVIE', mediaId: MOVIE_ID },
    { mediaType: 'MOVIE', mediaId: MOVIE_ID_2 },
    { mediaType: 'MOVIE', mediaId: MOVIE_ID_3 },
  ]

  const mockGenerateResponse = {
    shelf: { id: SHELF_ID, title: 'Generated', type: 'GENERATED', layoutHint: 'ROW', position: 0 },
    explanation: { inferredGenreIds: [], seedTitles: ['Movie A', 'Movie B', 'Movie C'] },
  }

  it('creates a GENERATED shelf and returns 201', async () => {
    mockGenerateShelfFromSeeds.mockResolvedValueOnce(mockGenerateResponse)

    const res = await app.inject({
      method: 'POST',
      url: '/shelves/generate',
      payload: { title: 'My Generated Shelf', seedMediaIds: THREE_SEEDS },
    })

    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.shelf.type).toBe('GENERATED')
    expect(body.explanation.seedTitles).toHaveLength(3)
  })

  it('returns 400 when title is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/shelves/generate',
      payload: { seedMediaIds: THREE_SEEDS },
    })

    expect(res.statusCode).toBe(400)
  })

  it('returns 400 for fewer than 3 seeds', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/shelves/generate',
      payload: {
        title: 'Test',
        seedMediaIds: [
          { mediaType: 'MOVIE', mediaId: MOVIE_ID },
          { mediaType: 'MOVIE', mediaId: MOVIE_ID_2 },
        ],
      },
    })

    expect(res.statusCode).toBe(400)
    expect(res.json().validationError).toBe(true)
  })

  it('returns 400 for invalid seed mediaType', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/shelves/generate',
      payload: {
        title: 'Test',
        seedMediaIds: [
          { mediaType: 'BOOK', mediaId: MOVIE_ID },
          { mediaType: 'MOVIE', mediaId: MOVIE_ID_2 },
          { mediaType: 'MOVIE', mediaId: MOVIE_ID_3 },
        ],
      },
    })

    expect(res.statusCode).toBe(400)
    expect(res.json().validationError).toBe(true)
  })

  it('returns 400 for invalid top-level mediaType', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/shelves/generate',
      payload: { title: 'Test', seedMediaIds: THREE_SEEDS, mediaType: 'BOOK' },
    })

    expect(res.statusCode).toBe(400)
    expect(res.json().validationError).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// POST /shelves/:id/refresh
// ---------------------------------------------------------------------------

describe('POST /shelves/:id/refresh', () => {
  const mockRefreshResponse = {
    shelf: { id: SHELF_ID, title: 'Refreshed', type: 'GENERATED', layoutHint: 'ROW', position: 0 },
    explanation: { inferredGenreIds: [], seedTitles: ['Movie A', 'Movie B', 'Movie C'] },
  }

  it('refreshes a GENERATED shelf and returns 200', async () => {
    mockRefreshGeneratedShelf.mockResolvedValueOnce(mockRefreshResponse)

    const res = await app.inject({ method: 'POST', url: `/shelves/${SHELF_ID}/refresh` })

    expect(res.statusCode).toBe(200)
    expect(res.json().shelf.type).toBe('GENERATED')
    expect(res.json().explanation.seedTitles).toHaveLength(3)
  })

  it('returns 400 for non-GENERATED shelf', async () => {
    mockRefreshGeneratedShelf.mockRejectedValueOnce(new ValidationError('Shelf is not a GENERATED shelf'))

    const res = await app.inject({ method: 'POST', url: `/shelves/${SHELF_ID}/refresh` })

    expect(res.statusCode).toBe(400)
    expect(res.json().validationError).toBe(true)
  })

  it('returns 404 when shelf does not exist', async () => {
    const { NotFoundError } = await import('../../errors.js')
    mockRefreshGeneratedShelf.mockRejectedValueOnce(new NotFoundError('Shelf', SHELF_ID))

    const res = await app.inject({ method: 'POST', url: `/shelves/${SHELF_ID}/refresh` })

    expect(res.statusCode).toBe(404)
  })
})
