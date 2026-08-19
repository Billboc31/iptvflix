import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

vi.mock('../config/env.js', () => ({
  WEB_SECRET: 'test-web-secret',
}))

import Fastify from 'fastify'
import jwt from '@fastify/jwt'
import { authenticateWeb } from './authenticateWeb.js'

describe('authenticateWeb', () => {
  const app = Fastify({ logger: false })

  beforeAll(async () => {
    await app.register(jwt, { secret: 'test-jwt-secret' })
    app.get('/test-web-secret', async (request, reply) => {
      const ok = await authenticateWeb(request, reply)
      if (!ok) return
      return reply.send({ ok: true })
    })
    app.get('/test-jwt', async (request, reply) => {
      const ok = await authenticateWeb(request, reply)
      if (!ok) return
      return reply.send({ ok: true, username: request.user.username })
    })
    app.get('/test-none', async (request, reply) => {
      const ok = await authenticateWeb(request, reply)
      if (!ok) return
      return reply.send({ ok: true })
    })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  it('accepts legacy WEB_SECRET bearer token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/test-web-secret',
      headers: { authorization: 'Bearer test-web-secret' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ ok: true })
  })

  it('accepts JWT from login flow', async () => {
    const token = app.jwt.sign({ accountId: 'acc-1', username: 'admin' })
    const res = await app.inject({
      method: 'GET',
      url: '/test-jwt',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ ok: true, username: 'admin' })
  })

  it('returns 401 when no credentials', async () => {
    const res = await app.inject({ method: 'GET', url: '/test-none' })
    expect(res.statusCode).toBe(401)
  })
})
