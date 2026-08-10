import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Fastify from 'fastify'
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
  it('returns 200 with status ok', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ status: 'ok' })
  })
})
