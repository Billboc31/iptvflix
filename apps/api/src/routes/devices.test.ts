import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import type { FastifyReply, FastifyRequest } from 'fastify'

vi.mock('../services/device.service.js', () => ({
  listDevices: vi.fn(),
  renameDevice: vi.fn(),
  revokeDevice: vi.fn(),
  DeviceNotFoundError: class DeviceNotFoundError extends Error {
    readonly statusCode = 404
    constructor(id: string) {
      super(`Device ${id} not found`)
    }
  },
}))

vi.mock('../middleware/authenticateWeb.js', () => ({
  authenticateWeb: vi.fn().mockResolvedValue(true),
}))

import {
  listDevices,
  renameDevice,
  revokeDevice,
  DeviceNotFoundError,
} from '../services/device.service.js'
import { authenticateWeb } from '../middleware/authenticateWeb.js'
import { devicesRoutes } from './devices.js'

const app = Fastify({ logger: false })

beforeAll(async () => {
  await app.register(devicesRoutes)
  await app.ready()
})

afterAll(async () => {
  await app.close()
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(authenticateWeb).mockResolvedValue(true)
})

function mockWebAuthFail() {
  vi.mocked(authenticateWeb).mockImplementationOnce(
    async (_req: FastifyRequest, reply: FastifyReply) => {
      void reply.status(401).send({ error: 'Web authentication required' })
      return false
    },
  )
}

const DEVICE = {
  id: 'dev-uuid',
  name: 'TV',
  lastSeenAt: null,
  revokedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
}

describe('GET /devices', () => {
  it('returns 401 without Web auth', async () => {
    mockWebAuthFail()
    const res = await app.inject({ method: 'GET', url: '/devices' })
    expect(res.statusCode).toBe(401)
  })

  it('returns list of devices', async () => {
    vi.mocked(listDevices).mockResolvedValueOnce([DEVICE])
    const res = await app.inject({ method: 'GET', url: '/devices' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual([DEVICE])
  })

  it('returns empty list when no devices', async () => {
    vi.mocked(listDevices).mockResolvedValueOnce([])
    const res = await app.inject({ method: 'GET', url: '/devices' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual([])
  })
})

describe('PATCH /devices/:id', () => {
  it('renames a device', async () => {
    vi.mocked(renameDevice).mockResolvedValueOnce({ ...DEVICE, name: 'Bedroom TV' })
    const res = await app.inject({
      method: 'PATCH',
      url: '/devices/dev-uuid',
      payload: { name: 'Bedroom TV' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().name).toBe('Bedroom TV')
  })

  it('returns 400 when name is missing', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/devices/dev-uuid',
      payload: {},
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 404 for unknown device', async () => {
    vi.mocked(renameDevice).mockRejectedValueOnce(new DeviceNotFoundError('unknown'))
    const res = await app.inject({
      method: 'PATCH',
      url: '/devices/unknown',
      payload: { name: 'TV' },
    })
    expect(res.statusCode).toBe(404)
  })
})

describe('DELETE /devices/:id', () => {
  it('revokes a device (204)', async () => {
    vi.mocked(revokeDevice).mockResolvedValueOnce(undefined)
    const res = await app.inject({ method: 'DELETE', url: '/devices/dev-uuid' })
    expect(res.statusCode).toBe(204)
  })

  it('returns 404 for unknown device', async () => {
    vi.mocked(revokeDevice).mockRejectedValueOnce(new DeviceNotFoundError('unknown'))
    const res = await app.inject({ method: 'DELETE', url: '/devices/unknown' })
    expect(res.statusCode).toBe(404)
  })
})
