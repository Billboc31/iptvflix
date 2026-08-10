import type { FastifyInstance } from 'fastify'
import type { HealthResponse } from '@iptvflix/api-contracts'

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Reply: HealthResponse }>('/health', async () => {
    return { status: 'ok' }
  })
}
