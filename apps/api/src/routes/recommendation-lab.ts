import type { FastifyInstance } from 'fastify'
import { db } from '../db/client.js'
import { EmbeddingService } from '../services/embedding-service.js'
import { SemanticRetrievalService } from '../services/semantic-retrieval-service.js'
import { createDefaultProvider } from '../services/embedding-provider.js'
import { OPENAI_API_KEY } from '../config/env.js'

export async function recommendationLabRoutes(app: FastifyInstance): Promise<void> {
  app.post('/recommendation-lab/semantic-query', async (request, reply) => {
    if (!OPENAI_API_KEY) {
      return reply.status(503).send({ error: 'OPENAI_API_KEY not configured' })
    }

    const body = request.body as { query?: string; topK?: number; compareQuery?: string }
    const query = body?.query
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return reply.status(400).send({ error: 'query is required' })
    }

    const topK = Math.min(Math.max(1, Number(body?.topK ?? 10)), 50)
    const compareQuery = body?.compareQuery && typeof body.compareQuery === 'string'
      ? body.compareQuery.trim()
      : undefined

    const provider = createDefaultProvider(OPENAI_API_KEY)
    const embeddingService = new EmbeddingService(db, provider)
    const retrievalService = new SemanticRetrievalService(db, embeddingService)

    const [primary, comparison] = await Promise.all([
      retrievalService.retrieve(query.trim(), topK),
      compareQuery ? retrievalService.retrieve(compareQuery, topK) : Promise.resolve(null),
    ])

    return reply.send({
      query: query.trim(),
      topK,
      modelProvider: provider.modelProvider,
      modelName: provider.modelName,
      results: primary.map((r) => ({
        mediaId: r.mediaId,
        mediaType: r.mediaType,
        title: r.title,
        year: r.year,
        posterPath: r.posterPath,
        similarity: r.similarity,
        rank: r.rank,
        modelProvider: r.modelProvider,
        modelName: r.modelName,
      })),
      ...(compareQuery && comparison
        ? {
            compareQuery,
            compareResults: comparison.map((r) => ({
              mediaId: r.mediaId,
              mediaType: r.mediaType,
              title: r.title,
              year: r.year,
              posterPath: r.posterPath,
              similarity: r.similarity,
              rank: r.rank,
              modelProvider: r.modelProvider,
              modelName: r.modelName,
            })),
          }
        : {}),
    })
  })
}
