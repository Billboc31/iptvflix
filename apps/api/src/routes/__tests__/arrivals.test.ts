import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'

const mockListArrivals = vi.hoisted(() => vi.fn())
const mockMarkRead = vi.hoisted(() => vi.fn())

vi.mock('../../services/arrival-service.js', () => ({
  listArrivals: mockListArrivals,
  markRead: mockMarkRead,
}))

vi.mock('../../services/profile-service.js', () => ({
  DEFAULT_PROFILE_ID: '00000000-0000-0000-0000-000000000001',
}))

import { arrivalsRoutes } from '../arrivals.js'
import { NotFoundError } from '../../errors.js'

const PROFILE_ID = '00000000-0000-0000-0000-000000000001'
const ARRIVAL_ID = 'aaaaaaaa-0000-0000-0000-000000000001'

const mockArrival = {
  id: ARRIVAL_ID,
  mediaType: 'MOVIE' as const,
  mediaId: 'bbbbbbbb-0000-0000-0000-000000000001',
  mediaTitle: 'Test Movie',
  sourceName: 'Test Source',
  arrivedAt: '2025-01-01T10:00:00.000Z',
  readAt: null,
}

const app = Fastify({ logger: false })

beforeAll(async () => {
  app.addHook('preHandler', async (request) => {
    request.profileId = PROFILE_ID
  })
  await app.register(arrivalsRoutes)
  await app.ready()
})

afterAll(async () => {
  await app.close()
})

beforeEach(() => {
  vi.resetAllMocks()
})

describe('GET /arrivals', () => {
  it('returns unread arrivals by default', async () => {
    mockListArrivals.mockResolvedValueOnce([mockArrival])

    const res = await app.inject({ method: 'GET', url: '/arrivals' })

    expect(res.statusCode).toBe(200)
    expect(mockListArrivals).toHaveBeenCalledWith(PROFILE_ID, 'unread')
    const body = res.json()
    expect(Array.isArray(body)).toBe(true)
    expect(body[0].id).toBe(ARRIVAL_ID)
    expect(body[0].mediaTitle).toBe('Test Movie')
    expect(body[0].sourceName).toBe('Test Source')
  })

  it('returns all arrivals when filter=all', async () => {
    const readArrival = { ...mockArrival, readAt: '2025-01-02T10:00:00.000Z' }
    mockListArrivals.mockResolvedValueOnce([mockArrival, readArrival])

    const res = await app.inject({ method: 'GET', url: '/arrivals?filter=all' })

    expect(res.statusCode).toBe(200)
    expect(mockListArrivals).toHaveBeenCalledWith(PROFILE_ID, 'all')
    expect(res.json()).toHaveLength(2)
  })

  it('returns empty array when no arrivals', async () => {
    mockListArrivals.mockResolvedValueOnce([])

    const res = await app.inject({ method: 'GET', url: '/arrivals' })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual([])
  })
})

describe('PATCH /arrivals/:id/read', () => {
  it('marks an arrival as read and returns 204', async () => {
    mockMarkRead.mockResolvedValueOnce(undefined)

    const res = await app.inject({ method: 'PATCH', url: `/arrivals/${ARRIVAL_ID}/read` })

    expect(res.statusCode).toBe(204)
    expect(mockMarkRead).toHaveBeenCalledWith(PROFILE_ID, ARRIVAL_ID)
  })

  it('returns 404 when arrival does not belong to the profile', async () => {
    mockMarkRead.mockRejectedValueOnce(new NotFoundError('Arrival', ARRIVAL_ID))

    const res = await app.inject({ method: 'PATCH', url: `/arrivals/${ARRIVAL_ID}/read` })

    expect(res.statusCode).toBe(404)
    const body = res.json()
    expect(body.error).toContain('not found')
  })
})
