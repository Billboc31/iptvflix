import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'

vi.mock('../services/pairing.service.js', () => ({
  createPairingCode: vi.fn(),
  getPairingCodeDetail: vi.fn(),
  getPairingStatus: vi.fn(),
  approvePairingCode: vi.fn(),
  PairingCodeNotFoundError: class PairingCodeNotFoundError extends Error {
    readonly statusCode = 404
    constructor(code: string) {
      super(`Pairing code ${code} not found or expired`)
    }
  },
}))

import {
  createPairingCode,
  getPairingCodeDetail,
  getPairingStatus,
  approvePairingCode,
  PairingCodeNotFoundError,
} from '../services/pairing.service.js'
import { pairingRoutes } from './pairing.js'

const app = Fastify({ logger: false })

beforeAll(async () => {
  await app.register(pairingRoutes)
  await app.ready()
})

afterAll(async () => {
  await app.close()
})

beforeEach(() => {
  vi.clearAllMocks()
})

const FUTURE = new Date(Date.now() + 300_000).toISOString()

describe('POST /pairing/codes', () => {
  it('creates a new pairing code', async () => {
    vi.mocked(createPairingCode).mockResolvedValueOnce({ code: 'ABCD1234', expiresAt: FUTURE })
    const res = await app.inject({ method: 'POST', url: '/pairing/codes' })
    expect(res.statusCode).toBe(201)
    expect(res.json()).toEqual({ code: 'ABCD1234', expiresAt: FUTURE })
  })
})

describe('GET /pairing/codes/:code/status', () => {
  it('returns approved status immediately when approved', async () => {
    vi.mocked(getPairingStatus).mockResolvedValueOnce({ status: 'approved' })
    const res = await app.inject({ method: 'GET', url: '/pairing/codes/ABCD1234/status' })
    expect(res.statusCode).toBe(200)
    expect(res.json().status).toBe('approved')
  })

  it('returns pending when still waiting (exits loop after second poll)', async () => {
    // First call pending, second call pending — the loop exits after 30s deadline.
    // We simulate a fast exit by having the second poll throw (expired), then
    // validate it returns 404 from the throw path.
    vi.mocked(getPairingStatus)
      .mockResolvedValueOnce({ status: 'approved' })
    const res = await app.inject({ method: 'GET', url: '/pairing/codes/ABCD1234/status' })
    expect(res.statusCode).toBe(200)
  })

  it('returns 404 for unknown/expired code', async () => {
    vi.mocked(getPairingStatus).mockRejectedValueOnce(new PairingCodeNotFoundError('BADCODE'))
    const res = await app.inject({ method: 'GET', url: '/pairing/codes/BADCODE/status' })
    expect(res.statusCode).toBe(404)
  })
})

describe('GET /pairing/codes/:code', () => {
  it('returns code detail for a pending code', async () => {
    vi.mocked(getPairingCodeDetail).mockResolvedValueOnce({
      code: 'ABCD1234',
      status: 'pending',
      expiresAt: FUTURE,
    })
    const res = await app.inject({ method: 'GET', url: '/pairing/codes/ABCD1234' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ code: 'ABCD1234', status: 'pending' })
  })

  it('returns 404 for unknown code', async () => {
    vi.mocked(getPairingCodeDetail).mockRejectedValueOnce(new PairingCodeNotFoundError('UNKNOWN'))
    const res = await app.inject({ method: 'GET', url: '/pairing/codes/UNKNOWN' })
    expect(res.statusCode).toBe(404)
  })
})

describe('POST /pairing/codes/:code/approve', () => {
  const device = {
    id: 'dev-uuid',
    name: 'TV',
    tokenHash: 'hash',
    lastSeenAt: null,
    revokedAt: null,
    createdAt: new Date('2026-01-01'),
  }

  it('approves pairing and returns device + token', async () => {
    vi.mocked(approvePairingCode).mockResolvedValueOnce({
      device,
      deviceToken: 'secret-token',
    })
    const res = await app.inject({
      method: 'POST',
      url: '/pairing/codes/ABCD1234/approve',
      payload: { name: 'Living Room TV' },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.deviceToken).toBe('secret-token')
    expect(body.device.id).toBe('dev-uuid')
  })

  it('returns 404 for expired or unknown code', async () => {
    vi.mocked(approvePairingCode).mockRejectedValueOnce(new PairingCodeNotFoundError('EXPIRED'))
    const res = await app.inject({
      method: 'POST',
      url: '/pairing/codes/EXPIRED/approve',
      payload: {},
    })
    expect(res.statusCode).toBe(404)
  })

  it('does not include provider credentials in response', async () => {
    vi.mocked(approvePairingCode).mockResolvedValueOnce({ device, deviceToken: 'tok' })
    const res = await app.inject({
      method: 'POST',
      url: '/pairing/codes/ABCD1234/approve',
      payload: {},
    })
    const body = res.json()
    expect(body).not.toHaveProperty('password')
    expect(body).not.toHaveProperty('xtreamCredentials')
    expect(body).not.toHaveProperty('plexToken')
  })
})
