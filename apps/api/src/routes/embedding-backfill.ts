import type { FastifyInstance } from 'fastify'
import { count, isNotNull } from 'drizzle-orm'
import { db } from '../db/client.js'
import { movies } from '../db/schema/movies.js'
import { series } from '../db/schema/series.js'

export async function embeddingBackfillRoutes(app: FastifyInstance): Promise<void> {
  app.post('/admin/embedding-backfill', async (_request, reply) => {
    const [movieRow, seriesRow] = await Promise.all([
      db.select({ cnt: count() }).from(movies).where(isNotNull(movies.metadataEnrichedAt)),
      db.select({ cnt: count() }).from(series).where(isNotNull(series.metadataEnrichedAt)),
    ])

    return reply.status(501).send({
      message: 'Embedding backfill not yet implemented. Wire #205 EmbeddingService here.',
      eligibleMovies: Number(movieRow[0]?.cnt ?? 0),
      eligibleSeries: Number(seriesRow[0]?.cnt ?? 0),
    })
  })
}
