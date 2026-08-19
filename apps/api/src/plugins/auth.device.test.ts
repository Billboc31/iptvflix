import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest'
import Fastify from 'fastify'
import jwt from '@fastify/jwt'
import { createHash } from 'node:crypto'

vi.mock('../db/client.js', () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
  },
}))

import { db } from '../db/client.js'
import { authenticate } from './auth.js'

const ACCOUNT_ID = 'aaaaaaaa-0000-0000-0000-000000000001'
const DEVICE_TOKEN = 'a'.repeat(64)

function deviceTokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

describe('authenticate device token fallback', () => {
  const app = Fastify({ logger: false })

  beforeAll(async () => {
    await app.register(jwt, { secret: 'test-jwt-secret' })
    app.get('/protected', { preHandler: authenticate }, async (request) => ({
      accountId: request.account?.id ?? null,
      username: request.user.username,
    }))
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('accepts a paired TV device token and resolves the owning account', async () => {
    const device = {
      id: 'dev-uuid',
      accountId: ACCOUNT_ID,
      name: 'TV',
      tokenHash: deviceTokenHash(DEVICE_TOKEN),
      lastSeenAt: null,
      revokedAt: null,
      createdAt: new Date('2026-01-01'),
    }

    vi.mocked(db.select)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([device]),
        }),
      } as never)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ id: ACCOUNT_ID, username: 'admin' }]),
        }),
      } as never)

    vi.mocked(db.update).mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    } as never)

    const res = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { authorization: `Bearer ${DEVICE_TOKEN}` },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ accountId: ACCOUNT_ID, username: 'admin' })
  })
})
