import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'

// ---------------------------------------------------------------------------
// Module mocks (hoisted)
// ---------------------------------------------------------------------------

vi.mock('../../config/env.js', () => ({
  SERIES_CURSOR_SECRET: 'test-secret',
}))

const { mockBuildSeriesPage } = vi.hoisted(() => ({
  mockBuildSeriesPage: vi.fn(),
}))

vi.mock('../../services/series-page-service.js', () => ({
  buildSeriesPage: mockBuildSeriesPage,
}))

const { mockGetCurrentProfile } = vi.hoisted(() => ({
  mockGetCurrentProfile: vi.fn(),
}))

vi.mock('../../services/profile-service.js', () => ({
  getCurrentProfile: mockGetCurrentProfile,
}))

vi.mock('../../services/catalog-service.js', () => ({
  listSeries: vi.fn(),
  getSeries: vi.fn(),
  NotFoundError: class NotFoundError extends Error {
    readonly statusCode = 404
    constructor(entity: string, id: string) {
      super(`${entity} ${id} not found`)
    }
  },
}))

import { seriesPersonalizedRoutes } from '../series.js'
import jwt from '@fastify/jwt'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PROFILE_ID = '00000000-0000-0000-0000-000000000001'
const ACCOUNT_ID = 'acct-00000000-0000-0000-0000-000000000001'
const SESSION_ID = '00000000-0000-0000-0000-000000000099'

const MOCK_SHELF = {
  id: 'instance-series-1',
  title: 'Séries pour toi',
  type: 'GENERATED' as const,
  layoutHint: 'ROW' as const,
  shelfInstanceId: 'instance-series-1',
  items: [
    { mediaType: 'SERIES' as const, mediaId: 'series-001', title: 'Breaking Bad', posterUrl: null },
  ],
}

const MOCK_PAGE_RESPONSE = {
  coldStart: false,
  sessionId: SESSION_ID,
  shelves: [MOCK_SHELF],
  nextCursor: 'cursor_pos_1',
}

// ---------------------------------------------------------------------------
// App setup
// ---------------------------------------------------------------------------

const app = Fastify({ logger: false })

beforeAll(async () => {
  await app.register(jwt, { secret: 'test-jwt-secret' })

  app.addHook('preHandler', async (request) => {
    ;(request as any).account = { id: ACCOUNT_ID }
  })

  await app.register(seriesPersonalizedRoutes)
  await app.ready()
})

afterAll(async () => {
  await app.close()
})

beforeEach(() => {
  vi.clearAllMocks()
  mockGetCurrentProfile.mockResolvedValue({ id: PROFILE_ID })
})

// ---------------------------------------------------------------------------
// GET /profiles/:profileId/series/personalized — first request
// ---------------------------------------------------------------------------

describe('GET /profiles/:profileId/series/personalized', () => {
  it('returns 200 with shelves, sessionId, and nextCursor', async () => {
    mockBuildSeriesPage.mockResolvedValue(MOCK_PAGE_RESPONSE)

    const res = await app.inject({
      method: 'GET',
      url: `/profiles/${PROFILE_ID}/series/personalized`,
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.sessionId).toBe(SESSION_ID)
    expect(body.shelves).toHaveLength(1)
    expect(body.nextCursor).toBe('cursor_pos_1')
  })

  it('all returned shelf items have mediaType SERIES', async () => {
    mockBuildSeriesPage.mockResolvedValue(MOCK_PAGE_RESPONSE)

    const res = await app.inject({
      method: 'GET',
      url: `/profiles/${PROFILE_ID}/series/personalized`,
    })

    expect(res.statusCode).toBe(200)
    const body = res.json<typeof MOCK_PAGE_RESPONSE>()
    for (const shelf of body.shelves) {
      for (const item of shelf.items) {
        expect(item.mediaType).toBe('SERIES')
      }
    }
  })

  it('returns coldStart: true when no shelves are available', async () => {
    mockBuildSeriesPage.mockResolvedValue({ coldStart: true, sessionId: SESSION_ID, shelves: [], nextCursor: null })

    const res = await app.inject({
      method: 'GET',
      url: `/profiles/${PROFILE_ID}/series/personalized`,
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().coldStart).toBe(true)
  })

  it('returns 403 when profile does not belong to the account', async () => {
    mockGetCurrentProfile.mockRejectedValue(new Error('not found'))

    const res = await app.inject({
      method: 'GET',
      url: `/profiles/${PROFILE_ID}/series/personalized`,
    })

    expect(res.statusCode).toBe(403)
  })
})

// ---------------------------------------------------------------------------
// GET /profiles/:profileId/series/personalized?cursor=<token>
// ---------------------------------------------------------------------------

describe('GET /profiles/:profileId/series/personalized?cursor=<token>', () => {
  it('returns next batch when cursor is valid', async () => {
    const cursorBatch = {
      coldStart: false,
      sessionId: SESSION_ID,
      shelves: [{ ...MOCK_SHELF, id: 'instance-series-2', title: 'Séries drama' }],
      nextCursor: 'cursor_pos_7',
    }
    mockBuildSeriesPage.mockResolvedValue(cursorBatch)

    const res = await app.inject({
      method: 'GET',
      url: `/profiles/${PROFILE_ID}/series/personalized?cursor=valid-cursor-token`,
    })

    expect(res.statusCode).toBe(200)
    expect(mockBuildSeriesPage).toHaveBeenCalledWith(PROFILE_ID, 'valid-cursor-token')
    expect(res.json().nextCursor).toBe('cursor_pos_7')
  })

  it('returns 400 for cursor with whitespace', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/profiles/${PROFILE_ID}/series/personalized?cursor=bad%20cursor`,
    })

    expect(res.statusCode).toBe(400)
  })

  it('returns 400 for cursor exceeding 512 characters', async () => {
    const longCursor = 'x'.repeat(513)
    const res = await app.inject({
      method: 'GET',
      url: `/profiles/${PROFILE_ID}/series/personalized?cursor=${longCursor}`,
    })

    expect(res.statusCode).toBe(400)
  })

  it('returns 403 when buildSeriesPage rejects with status 403 (expired cursor)', async () => {
    mockBuildSeriesPage.mockRejectedValue(
      Object.assign(new Error('Invalid or expired cursor'), { status: 403 }),
    )

    const res = await app.inject({
      method: 'GET',
      url: `/profiles/${PROFILE_ID}/series/personalized?cursor=expired-cursor`,
    })

    expect(res.statusCode).toBe(403)
  })

  it('returns nextCursor: null when session is exhausted', async () => {
    mockBuildSeriesPage.mockResolvedValue({
      coldStart: false,
      sessionId: SESSION_ID,
      shelves: [MOCK_SHELF],
      nextCursor: null,
    })

    const res = await app.inject({
      method: 'GET',
      url: `/profiles/${PROFILE_ID}/series/personalized?cursor=last-cursor`,
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().nextCursor).toBeNull()
  })
})
