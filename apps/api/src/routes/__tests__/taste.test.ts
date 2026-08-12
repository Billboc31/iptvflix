import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'

const { mockGetTaste, mockBuildTaste } = vi.hoisted(() => ({
  mockGetTaste: vi.fn(),
  mockBuildTaste: vi.fn(),
}))

vi.mock('../../services/profile-taste-service.js', () => ({
  getTaste: mockGetTaste,
  buildTaste: mockBuildTaste,
}))

vi.mock('../../db/client.js', () => ({ db: {} }))

import { tasteRoutes } from '../taste.js'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PROFILE_ID = '00000000-0000-0000-0000-000000000001'

function makeTaste(overrides: object = {}) {
  return {
    profileId: PROFILE_ID,
    genreScores: [{ genreId: 'genre-1', slug: 'action', name: 'Action', score: 3 }],
    positiveMediaIds: ['media-1'],
    negativeMediaIds: [],
    signalCount: 1,
    builtAt: '2024-01-01T10:00:00.000Z',
    ...overrides,
  }
}

const emptyTaste = {
  profileId: PROFILE_ID,
  genreScores: [],
  positiveMediaIds: [],
  negativeMediaIds: [],
  signalCount: 0,
  builtAt: '2024-01-01T10:00:00.000Z',
}

// ---------------------------------------------------------------------------
// App setup
// ---------------------------------------------------------------------------

const app = Fastify({ logger: false })

beforeAll(async () => {
  await app.register(tasteRoutes)
  await app.ready()
})

afterAll(async () => {
  await app.close()
})

beforeEach(() => {
  vi.resetAllMocks()
})

// ---------------------------------------------------------------------------
// GET /taste
// ---------------------------------------------------------------------------

describe('GET /taste', () => {
  it('returns 200 with a valid ProfileTaste shape', async () => {
    mockGetTaste.mockResolvedValue(makeTaste())

    const res = await app.inject({ method: 'GET', url: '/taste' })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(typeof body.profileId).toBe('string')
    expect(Array.isArray(body.genreScores)).toBe(true)
    expect(Array.isArray(body.positiveMediaIds)).toBe(true)
    expect(Array.isArray(body.negativeMediaIds)).toBe(true)
    expect(typeof body.signalCount).toBe('number')
    expect(typeof body.builtAt).toBe('string')
  })

  it('returns genreScores with required fields', async () => {
    mockGetTaste.mockResolvedValue(makeTaste())

    const res = await app.inject({ method: 'GET', url: '/taste' })

    const [genre] = res.json().genreScores
    expect(genre.genreId).toBeDefined()
    expect(genre.slug).toBeDefined()
    expect(genre.name).toBeDefined()
    expect(typeof genre.score).toBe('number')
  })

  it('returns 200 for cold-start (empty taste, not 404 or 500)', async () => {
    mockGetTaste.mockResolvedValue(emptyTaste)

    const res = await app.inject({ method: 'GET', url: '/taste' })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.signalCount).toBe(0)
    expect(body.genreScores).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// POST /taste/rebuild
// ---------------------------------------------------------------------------

describe('POST /taste/rebuild', () => {
  it('calls buildTaste and returns 200 with ProfileTaste', async () => {
    const taste = makeTaste()
    mockBuildTaste.mockResolvedValue(taste)

    const res = await app.inject({ method: 'POST', url: '/taste/rebuild' })

    expect(res.statusCode).toBe(200)
    expect(mockBuildTaste).toHaveBeenCalledTimes(1)
    const body = res.json()
    expect(body.profileId).toBe(PROFILE_ID)
    expect(body.signalCount).toBe(1)
  })

  it('returns 200 for cold-start rebuild (no signals)', async () => {
    mockBuildTaste.mockResolvedValue(emptyTaste)

    const res = await app.inject({ method: 'POST', url: '/taste/rebuild' })

    expect(res.statusCode).toBe(200)
    expect(res.json().signalCount).toBe(0)
  })

  it('does not call getTaste on rebuild', async () => {
    mockBuildTaste.mockResolvedValue(emptyTaste)

    await app.inject({ method: 'POST', url: '/taste/rebuild' })

    expect(mockGetTaste).not.toHaveBeenCalled()
  })
})
