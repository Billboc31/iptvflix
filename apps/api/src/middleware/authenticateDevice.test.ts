import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify, { type FastifyRequest, type FastifyReply } from 'fastify'

vi.mock('../db/client.js', () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
  },
}))

import { db } from '../db/client.js'
import { authenticateDevice } from './authenticateDevice.js'

function makeRequestWithToken(token: string | null): FastifyRequest {
  const app = Fastify({ logger: false })
  const req = { headers: {} } as FastifyRequest
  if (token) req.headers = { authorization: `Bearer ${token}` }
  void app.close()
  return req
}

function makeReply(): { reply: FastifyReply; statusCode: number | null; body: unknown } {
  const captured: { statusCode: number | null; body: unknown } = { statusCode: null, body: null }
  const reply = {
    status: vi.fn().mockReturnThis(),
    send: vi.fn().mockImplementation((body) => { captured.body = body }),
  } as unknown as FastifyReply
  ;(reply.status as ReturnType<typeof vi.fn>).mockImplementation((code: number) => {
    captured.statusCode = code
    return reply
  })
  return { reply, ...captured }
}

const VALID_DEVICE = {
  id: 'dev-uuid',
  name: 'TV',
  tokenHash: 'e3b0c44298fc1c149afb', // placeholder
  lastSeenAt: null,
  revokedAt: null,
  createdAt: new Date('2026-01-01'),
}

function mockDbSelect(device: typeof VALID_DEVICE | null) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(device ? [device] : []),
  }
  vi.mocked(db.select).mockReturnValue(chain as unknown as ReturnType<typeof db.select>)
}

function mockDbUpdate() {
  const chain = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(undefined),
  }
  vi.mocked(db.update).mockReturnValue(chain as unknown as ReturnType<typeof db.update>)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('authenticateDevice', () => {
  it('returns 401 when no Authorization header', async () => {
    const req = makeRequestWithToken(null)
    const { reply, ...captured } = makeReply()
    const result = await authenticateDevice(req, reply)
    expect(result).toBeNull()
    expect((reply.status as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe(401)
  })

  it('returns 401 when token is unknown', async () => {
    mockDbSelect(null)
    const req = makeRequestWithToken('unknown-token')
    const { reply } = makeReply()
    const result = await authenticateDevice(req, reply)
    expect(result).toBeNull()
    expect((reply.status as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe(401)
  })

  it('returns 401 when device is revoked', async () => {
    const revokedDevice = { ...VALID_DEVICE, revokedAt: new Date('2026-06-01') }
    mockDbSelect(revokedDevice)
    const req = makeRequestWithToken('some-token')
    const { reply } = makeReply()
    const result = await authenticateDevice(req, reply)
    expect(result).toBeNull()
    expect((reply.status as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe(401)
  })

  it('returns the device and updates lastSeenAt for a valid token', async () => {
    mockDbSelect(VALID_DEVICE)
    mockDbUpdate()
    const req = makeRequestWithToken('valid-token')
    const { reply } = makeReply()
    const result = await authenticateDevice(req, reply)
    expect(result).toMatchObject({ id: 'dev-uuid' })
    expect(db.update).toHaveBeenCalled()
  })
})
