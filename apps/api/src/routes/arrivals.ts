import type { FastifyInstance } from 'fastify'
import { listArrivals, markRead } from '../services/arrival-service.js'
import { DEFAULT_PROFILE_ID } from '../services/profile-service.js'
import { NotFoundError } from '../errors.js'

export async function arrivalsRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: { filter?: string } }>('/arrivals', async (request) => {
    const filter = request.query.filter === 'all' ? 'all' : 'unread'
    return listArrivals(DEFAULT_PROFILE_ID, filter)
  })

  app.patch<{ Params: { id: string } }>('/arrivals/:id/read', async (request, reply) => {
    try {
      await markRead(DEFAULT_PROFILE_ID, request.params.id)
      return reply.status(204).send()
    } catch (err) {
      if (err instanceof NotFoundError) return reply.status(404).send({ error: (err as Error).message })
      throw err
    }
  })
}
