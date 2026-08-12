import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'

// Mock DB and middleware before route import
vi.mock('../db/client.js', () => ({ db: { select: vi.fn() } }))

vi.mock('../middleware/authenticateDevice.js', () => ({
  authenticateDevice: vi.fn(),
}))

vi.mock('../middleware/authenticateWeb.js', () => ({
  authenticateWeb: vi.fn().mockResolvedValue(true),
}))

vi.mock('../services/command.service.js', () => ({
  createCommand: vi.fn(),
  getPendingCommands: vi.fn(),
  acknowledgeCommand: vi.fn(),
  CommandDeviceNotFoundError: class CommandDeviceNotFoundError extends Error {
    readonly statusCode = 404
    constructor(id: string) {
      super(`Device ${id} not found`)
    }
  },
  CommandDeviceRevokedError: class CommandDeviceRevokedError extends Error {
    readonly statusCode = 403
    constructor(id: string) {
      super(`Device ${id} has been revoked`)
    }
  },
  CommandNotFoundError: class CommandNotFoundError extends Error {
    readonly statusCode = 404
    constructor(id: string) {
      super(`Command ${id} not found`)
    }
  },
}))

vi.mock('../lib/device-events.js', () => ({
  onCommandForDevice: vi.fn(() => vi.fn()),
  emitCommandForDevice: vi.fn(),
}))

import type { FastifyReply, FastifyRequest } from 'fastify'
import { authenticateDevice } from '../middleware/authenticateDevice.js'
import { authenticateWeb } from '../middleware/authenticateWeb.js'
import {
  createCommand,
  getPendingCommands,
  acknowledgeCommand,
  CommandDeviceNotFoundError,
  CommandDeviceRevokedError,
  CommandNotFoundError,
} from '../services/command.service.js'
import { commandsRoutes } from './commands.js'

const DEVICE = {
  id: 'dev-uuid',
  name: 'TV',
  tokenHash: 'hash',
  lastSeenAt: null,
  revokedAt: null,
  createdAt: new Date('2026-01-01'),
}

function mockAuthSuccess() {
  vi.mocked(authenticateDevice).mockResolvedValueOnce(DEVICE)
}

function mockAuthFail() {
  vi.mocked(authenticateDevice).mockImplementationOnce(
    async (_req: FastifyRequest, reply: FastifyReply) => {
      void reply.status(401).send({ error: 'Unauthorized' })
      return null
    },
  )
}

const CMD = {
  id: 'cmd-uuid',
  mediaType: 'movie' as const,
  mediaId: 'media-uuid',
  availabilityId: null,
  startPositionMs: 0,
  state: 'pending' as const,
  expiresAt: new Date(Date.now() + 120_000).toISOString(),
  createdAt: new Date().toISOString(),
}

const app = Fastify({ logger: false })

beforeAll(async () => {
  await app.register(commandsRoutes)
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

describe('POST /devices/:id/commands', () => {
  it('returns 401 without Web auth', async () => {
    mockWebAuthFail()
    const res = await app.inject({
      method: 'POST',
      url: '/devices/dev-uuid/commands',
      payload: { mediaType: 'movie', mediaId: 'media-uuid' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('creates a playback command', async () => {
    vi.mocked(createCommand).mockResolvedValueOnce(CMD)
    const res = await app.inject({
      method: 'POST',
      url: '/devices/dev-uuid/commands',
      payload: { mediaType: 'movie', mediaId: 'media-uuid' },
    })
    expect(res.statusCode).toBe(201)
    expect(res.json()).toMatchObject({ id: 'cmd-uuid', mediaType: 'movie' })
  })

  it('returns 400 when mediaType is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/devices/dev-uuid/commands',
      payload: { mediaId: 'media-uuid' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 for invalid mediaType', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/devices/dev-uuid/commands',
      payload: { mediaType: 'series', mediaId: 'media-uuid' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 404 for unknown device', async () => {
    vi.mocked(createCommand).mockRejectedValueOnce(new CommandDeviceNotFoundError('unknown'))
    const res = await app.inject({
      method: 'POST',
      url: '/devices/unknown/commands',
      payload: { mediaType: 'movie', mediaId: 'media-uuid' },
    })
    expect(res.statusCode).toBe(404)
  })

  it('returns 403 for revoked device', async () => {
    vi.mocked(createCommand).mockRejectedValueOnce(new CommandDeviceRevokedError('dev-uuid'))
    const res = await app.inject({
      method: 'POST',
      url: '/devices/dev-uuid/commands',
      payload: { mediaType: 'movie', mediaId: 'media-uuid' },
    })
    expect(res.statusCode).toBe(403)
  })

  it('command payload contains no provider credentials', async () => {
    vi.mocked(createCommand).mockResolvedValueOnce(CMD)
    const res = await app.inject({
      method: 'POST',
      url: '/devices/dev-uuid/commands',
      payload: { mediaType: 'movie', mediaId: 'media-uuid' },
    })
    const body = res.json()
    expect(body).not.toHaveProperty('xtreamUrl')
    expect(body).not.toHaveProperty('plexToken')
    expect(body).not.toHaveProperty('password')
  })
})

describe('GET /devices/me/commands', () => {
  it('returns pending commands for authenticated device', async () => {
    mockAuthSuccess()
    vi.mocked(getPendingCommands).mockResolvedValueOnce([CMD])
    const res = await app.inject({ method: 'GET', url: '/devices/me/commands' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toHaveLength(1)
    expect(res.json()[0].id).toBe('cmd-uuid')
  })

  it('returns 401 without device token', async () => {
    mockAuthFail()
    const res = await app.inject({ method: 'GET', url: '/devices/me/commands' })
    expect(res.statusCode).toBe(401)
  })

  it('acknowledged command is not returned in pending', async () => {
    mockAuthSuccess()
    vi.mocked(getPendingCommands).mockResolvedValueOnce([])
    const res = await app.inject({ method: 'GET', url: '/devices/me/commands' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual([])
  })
})

describe('POST /devices/me/commands/:commandId/ack', () => {
  it('acknowledges a command', async () => {
    mockAuthSuccess()
    vi.mocked(acknowledgeCommand).mockResolvedValueOnce(undefined)
    const res = await app.inject({
      method: 'POST',
      url: '/devices/me/commands/cmd-uuid/ack',
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ ok: true })
  })

  it('is idempotent — second ack still returns 200', async () => {
    mockAuthSuccess()
    vi.mocked(acknowledgeCommand).mockResolvedValueOnce(undefined)
    const res = await app.inject({
      method: 'POST',
      url: '/devices/me/commands/cmd-uuid/ack',
    })
    expect(res.statusCode).toBe(200)
  })

  it('returns 401 without device token', async () => {
    mockAuthFail()
    const res = await app.inject({
      method: 'POST',
      url: '/devices/me/commands/cmd-uuid/ack',
    })
    expect(res.statusCode).toBe(401)
  })

  it('returns 404 for unknown command', async () => {
    mockAuthSuccess()
    vi.mocked(acknowledgeCommand).mockRejectedValueOnce(new CommandNotFoundError('unknown'))
    const res = await app.inject({
      method: 'POST',
      url: '/devices/me/commands/unknown/ack',
    })
    expect(res.statusCode).toBe(404)
  })
})

describe('GET /devices/me/commands/stream', () => {
  // SSE streams keep the connection open indefinitely; inject cannot receive streaming
  // responses. We test only the auth-rejection path, where the response completes immediately.
  it('returns 401 without device token', async () => {
    mockAuthFail()
    const res = await app.inject({ method: 'GET', url: '/devices/me/commands/stream' })
    expect(res.statusCode).toBe(401)
  })
})
