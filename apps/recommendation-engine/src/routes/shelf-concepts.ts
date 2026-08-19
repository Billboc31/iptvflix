import OpenAI from 'openai'
import type { FastifyInstance } from 'fastify'
import { OPENAI_API_KEY, SHELF_CONCEPT_LLM_MODEL, EMBEDDING_MODEL_NAME } from '../config.js'
import { ShelfConceptGeneratorService } from '../services/shelf-concept-generator.js'

function buildService(): ShelfConceptGeneratorService {
  const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null
  const embeddingOpenai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null
  return new ShelfConceptGeneratorService(openai, embeddingOpenai, EMBEDDING_MODEL_NAME)
}

const service = buildService()

export async function shelfConceptsRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: { profileId?: string; count?: number } }>(
    '/v1/shelf-concepts/generate',
    async (request, reply) => {
      const { profileId, count } = request.body ?? {}
      if (!profileId || typeof profileId !== 'string') {
        return reply.status(400).send({ error: 'profileId is required' })
      }
      if (count !== undefined && (typeof count !== 'number' || count < 1 || count > 100)) {
        return reply.status(400).send({ error: 'count must be a number between 1 and 100' })
      }

      try {
        const needsRefresh = await service.needsRefresh(profileId)
        let concepts
        if (!needsRefresh) {
          concepts = await service.getActivePool(profileId)
        } else {
          concepts = await service.generateConcepts(profileId, { count })
        }
        const profileContext = await service.buildProfileContext(profileId)
        return reply.send({ concepts, coldStart: profileContext.coldStart, profileContext })
      } catch (err) {
        if (err instanceof Error && err.message.includes('not configured')) {
          return reply.status(503).send({ error: err.message })
        }
        throw err
      }
    },
  )

  app.get('/v1/shelf-concepts', async (request, reply) => {
    const { profileId } = (request.query as Record<string, string>) ?? {}
    if (!profileId || typeof profileId !== 'string') {
      return reply.status(400).send({ error: 'profileId query param is required' })
    }
    try {
      const concepts = await service.getActivePool(profileId)
      return reply.send(concepts)
    } catch (err) {
      if (err instanceof Error && err.message.includes('not configured')) {
        return reply.status(503).send({ error: err.message })
      }
      throw err
    }
  })

  app.post<{ Params: { id: string }; Body: { signal?: string } }>(
    '/v1/shelf-concepts/:id/feedback',
    async (request, reply) => {
      const { id } = request.params
      const { signal } = request.body ?? {}
      if (signal !== 'good' && signal !== 'bad') {
        return reply.status(400).send({ error: "signal must be 'good' or 'bad'" })
      }
      await service.applyFeedback(id, signal)
      return reply.status(204).send()
    },
  )
}
