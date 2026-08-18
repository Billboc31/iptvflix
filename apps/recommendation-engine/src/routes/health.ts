import type { FastifyInstance } from 'fastify'
import { PIPELINE_VERSION } from '../pipeline/pipeline.js'

export async function healthRoutes(app: FastifyInstance) {
  app.get('/health', async (_request, reply) => {
    return reply.send({
      status: 'ok',
      version: PIPELINE_VERSION,
      timestamp: new Date().toISOString(),
    })
  })
}
