import type { FastifyInstance } from 'fastify'
import type { GenerateShelfBody } from '@iptvflix/api-contracts'
import { generateShelfFromSeeds, refreshGeneratedShelf, ValidationError, NotFoundError, ForbiddenError } from '../services/shelf-generator.js'

export async function shelfInstancesRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: GenerateShelfBody & { profileId: string } }>(
    '/v1/shelf-instances/generate',
    async (request, reply) => {
      const { profileId, ...body } = request.body ?? {}
      if (!profileId || typeof profileId !== 'string') {
        return reply.status(400).send({ error: 'profileId is required' })
      }
      try {
        const result = await generateShelfFromSeeds(profileId, body as GenerateShelfBody)
        return reply.send(result)
      } catch (err) {
        if (err instanceof ValidationError) return reply.status(400).send({ error: err.message })
        if (err instanceof NotFoundError) return reply.status(404).send({ error: err.message })
        throw err
      }
    },
  )

  app.post<{ Params: { id: string }; Body: { profileId: string } }>(
    '/v1/shelf-instances/:id/refresh',
    async (request, reply) => {
      const { id } = request.params
      const { profileId } = request.body ?? {}
      if (!profileId || typeof profileId !== 'string') {
        return reply.status(400).send({ error: 'profileId is required' })
      }
      try {
        const result = await refreshGeneratedShelf(id, profileId)
        return reply.send(result)
      } catch (err) {
        if (err instanceof ValidationError) return reply.status(400).send({ error: err.message })
        if (err instanceof NotFoundError) return reply.status(404).send({ error: err.message })
        if (err instanceof ForbiddenError) return reply.status(403).send({ error: 'Forbidden' })
        throw err
      }
    },
  )
}
