import type { FastifyInstance } from 'fastify'
import type { HealthResponse } from '@iptvflix/api-contracts'
import { sql } from 'drizzle-orm'
import { db } from '../db/client.js'

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Reply: HealthResponse }>('/health', async (_req, reply) => {
    let dbStatus: 'ok' | 'unavailable'
    try {
      await db.execute(sql`SELECT 1`)
      dbStatus = 'ok'
    } catch {
      dbStatus = 'unavailable'
    }
    reply.header('X-Build-Tag', 'android-tv-direct-v3-20260820')
    return reply.send({ status: 'ok', db: dbStatus })
  })
}
