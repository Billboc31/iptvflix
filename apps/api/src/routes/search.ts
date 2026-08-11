import type { FastifyInstance } from 'fastify'
import { searchContent } from '../services/catalog-service.js'

export async function searchRoutes(app: FastifyInstance): Promise<void> {
  app.get('/search', async (request, reply) => {
    const { q } = request.query as { q?: string }

    if (!q || !q.trim()) {
      return reply.status(400).send({ error: 'q is required' })
    }

    const trimmed = q.trim()
    if (trimmed.length > 200) {
      return reply.status(400).send({ error: 'q must be 200 characters or fewer' })
    }

    return searchContent(trimmed)
  })
}
