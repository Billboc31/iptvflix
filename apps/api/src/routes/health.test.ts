import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import Fastify from 'fastify'

vi.mock('../db/client.js', () => ({
  db: { execute: vi.fn() },
}))

import { db } from '../db/client.js'
import { healthRoutes } from './health.js'

const app = Fastify()

beforeAll(async () => {
  await app.register(healthRoutes)
  await app.ready()
})

afterAll(async () => {
  await app.close()
})

describe('GET /health', () => {
  it('returns db: ok when DB probe succeeds', async () => {
    vi.mocked(db.execute).mockResolvedValueOnce([] as never)
    const response = await app.inject({ method: 'GET', url: '/health' })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ status: 'ok', db: 'ok' })
  })

  it('returns db: unavailable when DB probe fails', async () => {
    vi.mocked(db.execute).mockRejectedValueOnce(new Error('connection refused'))
    const response = await app.inject({ method: 'GET', url: '/health' })
    expect(response.statusCode).toBe(503)
    expect(response.json()).toEqual({ status: 'ok', db: 'unavailable' })
  })
})
