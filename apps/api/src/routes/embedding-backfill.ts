import type { FastifyInstance } from 'fastify'
import { count, isNotNull, avg, sql } from 'drizzle-orm'
import { db } from '../db/client.js'
import { movies } from '../db/schema/movies.js'
import { series } from '../db/schema/series.js'
import { mediaEmbeddings } from '../db/schema/media-embeddings.js'
import { EmbeddingService } from '../services/embedding-service.js'
import { runBackfill } from '../services/embedding-backfill-service.js'
import { createDefaultProvider } from '../services/embedding-provider.js'
import { OPENAI_API_KEY } from '../config/env.js'
import { getEmbeddingIndexMode } from '../db/embedding-index-mode.js'

export async function embeddingBackfillRoutes(app: FastifyInstance): Promise<void> {
  app.post('/admin/embedding-backfill', async (_request, reply) => {
    if (!OPENAI_API_KEY) {
      return reply.status(503).send({ error: 'OPENAI_API_KEY not configured' })
    }

    const provider = createDefaultProvider(OPENAI_API_KEY)
    const embeddingService = new EmbeddingService(db, provider)

    const result = await runBackfill(db, embeddingService)
    return reply.send(result)
  })

  app.get('/admin/embedding-backfill/coverage', async (_request, reply) => {
    const [movieCount, seriesCount, embeddedCount] = await Promise.all([
      db.select({ cnt: count() }).from(movies).where(isNotNull(movies.metadataEnrichedAt)),
      db.select({ cnt: count() }).from(series).where(isNotNull(series.metadataEnrichedAt)),
      db.select({ cnt: count() }).from(mediaEmbeddings),
    ])

    const total = Number(movieCount[0]?.cnt ?? 0) + Number(seriesCount[0]?.cnt ?? 0)
    const embedded = Number(embeddedCount[0]?.cnt ?? 0)

    // Coverage by field: count rows where the field is non-null/non-empty across movies+series
    const [movieCoverage] = await db
      .select({
        withOverview: sql<number>`count(*) filter (where synopsis is not null and synopsis != '')`,
        withKeywords: sql<number>`count(*) filter (where keywords is not null and jsonb_array_length(keywords::jsonb) > 0)`,
        withLanguage: sql<number>`count(*) filter (where original_language is not null)`,
      })
      .from(movies)
      .where(isNotNull(movies.metadataEnrichedAt))

    const [seriesCoverage] = await db
      .select({
        withOverview: sql<number>`count(*) filter (where synopsis is not null and synopsis != '')`,
        withKeywords: sql<number>`count(*) filter (where keywords is not null and jsonb_array_length(keywords::jsonb) > 0)`,
        withLanguage: sql<number>`count(*) filter (where original_language is not null)`,
      })
      .from(series)
      .where(isNotNull(series.metadataEnrichedAt))

    const movieTotal = Number(movieCount[0]?.cnt ?? 0)
    const seriesTotal = Number(seriesCount[0]?.cnt ?? 0)

    const totalWithOverview = Number(movieCoverage?.withOverview ?? 0) + Number(seriesCoverage?.withOverview ?? 0)
    const totalWithKeywords = Number(movieCoverage?.withKeywords ?? 0) + Number(seriesCoverage?.withKeywords ?? 0)
    const totalWithLanguage = Number(movieCoverage?.withLanguage ?? 0) + Number(seriesCoverage?.withLanguage ?? 0)

    const safe = (n: number) => (total > 0 ? Math.round((n / total) * 100) / 100 : 0)
    const provider = OPENAI_API_KEY ? createDefaultProvider(OPENAI_API_KEY) : null

    return reply.send({
      totalMovies: movieTotal,
      totalSeries: seriesTotal,
      total,
      embedded,
      missing: total - embedded,
      coverageByField: {
        overview: safe(totalWithOverview),
        keywords: safe(totalWithKeywords),
        language: safe(totalWithLanguage),
      },
      vectorIndexMode: getEmbeddingIndexMode(),
      embeddingModel: provider?.modelName ?? null,
      embeddingDimension: provider?.dimension ?? null,
    })
  })
}
