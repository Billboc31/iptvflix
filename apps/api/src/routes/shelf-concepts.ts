import OpenAI from 'openai'
import type { FastifyInstance, FastifyReply } from 'fastify'
import type { GenerateShelfConceptsBody, ShelfConceptFeedbackBody } from '@iptvflix/api-contracts'
import { db } from '../db/client.js'
import { EmbeddingService } from '../services/embedding-service.js'
import { SemanticRetrievalService } from '../services/semantic-retrieval-service.js'
import { createDefaultProvider } from '../services/embedding-provider.js'
import { ShelfConceptGeneratorService } from '../services/shelf-concept-generator-service.js'
import {
  OPENAI_API_KEY,
  SHELF_CONCEPT_LLM_MODEL,
} from '../config/env.js'
import { RecommendationEngineClient } from '../client/recommendation-engine-client.js'

function buildService(): ShelfConceptGeneratorService {
  const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null
  const embeddingProvider = OPENAI_API_KEY ? createDefaultProvider(OPENAI_API_KEY) : null
  const embeddingService = embeddingProvider ? new EmbeddingService(db, embeddingProvider) : null
  const semanticRetrieval = embeddingService
    ? new SemanticRetrievalService(db, embeddingService)
    : null
  return new ShelfConceptGeneratorService(db, openai, embeddingProvider, semanticRetrieval, SHELF_CONCEPT_LLM_MODEL)
}

const service = buildService()

function handleError(err: unknown, reply: FastifyReply): ReturnType<FastifyReply['send']> {
  if (err instanceof Error && err.message.includes('not configured')) {
    return reply.status(503).send({ error: err.message })
  }
  throw err
}

export async function shelfConceptsRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: GenerateShelfConceptsBody }>(
    '/shelf-concepts/generate',
    async (request, reply) => {
      const { profileId, count } = request.body ?? {}
      if (!profileId || typeof profileId !== 'string') {
        return reply.status(400).send({ error: 'profileId is required' })
      }
      if (count !== undefined && (typeof count !== 'number' || count < 1 || count > 100)) {
        return reply.status(400).send({ error: 'count must be a number between 1 and 100' })
      }

      const engineResult = await RecommendationEngineClient.generateShelfConcepts({ profileId, count })
      if (engineResult) {
        return reply.send(engineResult)
      }

      try {
        const needsRefresh = await service.needsRefresh(profileId)
        let concepts
        if (!needsRefresh) {
          console.info(`[shelf-concepts] pool is fresh for profile ${profileId}, skipping LLM call`)
          concepts = await service.getActivePool(profileId)
        } else {
          concepts = await service.generateConcepts(profileId, { count })
        }
        const profileContext = await service.buildProfileContext(profileId)
        return reply.send({
          concepts,
          coldStart: profileContext.coldStart,
          profileContext,
        })
      } catch (err) {
        return handleError(err, reply)
      }
    },
  )

  app.get('/shelf-concepts', async (request, reply) => {
    const { profileId } = (request.query as Record<string, string>) ?? {}
    if (!profileId || typeof profileId !== 'string') {
      return reply.status(400).send({ error: 'profileId query param is required' })
    }

    const engineResult = await RecommendationEngineClient.getShelfConcepts(profileId)
    if (engineResult) {
      return reply.send(engineResult)
    }

    try {
      const concepts = await service.getActivePool(profileId)
      return reply.send(concepts)
    } catch (err) {
      return handleError(err, reply)
    }
  })

  app.post<{ Params: { id: string }; Body: { profileId: string; debug?: boolean } }>(
    '/shelf-concepts/:id/preview',
    async (request, reply) => {
      const { id } = request.params
      const { profileId, debug } = request.body ?? {}

      if (!profileId || typeof profileId !== 'string') {
        return reply.status(400).send({ error: 'profileId is required' })
      }

      const result = await RecommendationEngineClient.previewShelfConcept(id, { profileId, debug })
      if (!result.ok) {
        switch (result.kind) {
          case 'not-found':
            return reply.status(404).send({ error: 'Recommendation preview endpoint not deployed' })
          case 'timeout':
            return reply.status(504).send({ error: 'Recommendation preview timed out' })
          case 'circuit-open':
            return reply.status(503).send({ error: 'Recommendation engine circuit open' })
          case 'server-error':
            return reply.status(502).send({ error: `Recommendation engine error (HTTP ${result.status ?? 'unknown'})` })
          default:
            return reply.status(502).send({ error: 'Recommendation engine unreachable' })
        }
      }

      return reply.send(result.data)
    },
  )

  app.post<{ Params: { id: string }; Body: ShelfConceptFeedbackBody }>(
    '/shelf-concepts/:id/feedback',
    async (request, reply) => {
      const { id } = request.params
      const { signal } = request.body ?? {}
      if (signal !== 'good' && signal !== 'bad') {
        return reply.status(400).send({ error: "signal must be 'good' or 'bad'" })
      }
      try {
        await service.applyFeedback(id, signal)
        return reply.status(204).send()
      } catch (err) {
        return handleError(err, reply)
      }
    },
  )
}
