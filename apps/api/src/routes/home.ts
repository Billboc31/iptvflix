import type { FastifyInstance } from 'fastify'
import { buildHome } from '../services/home-service.js'
import { NotFoundError } from '../errors.js'

export async function homeRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { profileId: string } }>('/profiles/:profileId/home', async (request, reply) => {
    const { profileId } = request.params
    try {
      const result = await buildHome(profileId)
      return reply.status(200).send(result)
    } catch (err) {
      if (err instanceof NotFoundError) {
        return reply.status(404).send({ error: err.message })
      }
      throw err
    }
  })
}
