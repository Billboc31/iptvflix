import type { FastifyInstance } from 'fastify'
import { rankRecommendations } from '../services/recommendation-ranking-service.js'
import { NotFoundError } from '../errors.js'

export async function recommendationRoutes(app: FastifyInstance): Promise<void> {
  app.get<{
    Params: { profileId: string }
    Querystring: {
      mediaType?: string
      availableToMe?: string
      includeSeen?: string
      limit?: string
    }
  }>('/profiles/:profileId/recommendations', async (request, reply) => {
    const { profileId } = request.params
    const { mediaType, availableToMe, includeSeen, limit } = request.query

    if (mediaType !== undefined && mediaType !== 'MOVIE' && mediaType !== 'SERIES') {
      return reply.status(400).send({ error: 'mediaType must be MOVIE or SERIES' })
    }

    const limitNum = limit !== undefined ? parseInt(limit, 10) : undefined
    if (limitNum !== undefined && (isNaN(limitNum) || limitNum < 1 || limitNum > 100)) {
      return reply.status(400).send({ error: 'limit must be an integer between 1 and 100' })
    }

    try {
      const result = await rankRecommendations(profileId, {
        mediaType: mediaType as 'MOVIE' | 'SERIES' | undefined,
        availableToMe: availableToMe === 'true',
        includeSeen: includeSeen === 'true',
        limit: limitNum,
      })
      return reply.status(200).send(result)
    } catch (err) {
      if (err instanceof NotFoundError) {
        return reply.status(404).send({ error: err.message })
      }
      throw err
    }
  })
}
