import { pgClient } from '../db/client.js'
import type { FastifyInstance } from 'fastify'
import { EMBEDDING_MODEL_PROVIDER, EMBEDDING_MODEL_NAME } from '../config.js'

export async function diagnosticsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/v1/diagnostics/vector-corpus', async (_request, reply) => {
    const [totalRows, byModelRows, byMediaTypeRows, eligibleRows, pgvectorRows] = await Promise.all([
      pgClient<{ count: string }[]>`SELECT COUNT(*) AS count FROM media_embeddings`,
      pgClient<{ model_provider: string; model_name: string; count: string }[]>`
        SELECT model_provider, model_name, COUNT(*) AS count FROM media_embeddings GROUP BY 1, 2
      `,
      pgClient<{ media_type: string; count: string }[]>`
        SELECT media_type, COUNT(*) AS count FROM media_embeddings GROUP BY 1
      `,
      pgClient<{ count: string }[]>`
        SELECT COUNT(*) AS count FROM media_embeddings
        WHERE model_provider = ${EMBEDDING_MODEL_PROVIDER} AND model_name = ${EMBEDDING_MODEL_NAME}
      `,
      pgClient<{ count: string }[]>`
        SELECT COUNT(*) AS count FROM pg_extension WHERE extname = 'vector'
      `,
    ])

    return reply.send({
      totalEmbeddings: Number(totalRows[0]?.count ?? 0),
      byModel: byModelRows.map((r) => ({ modelProvider: r.model_provider, modelName: r.model_name, count: Number(r.count) })),
      byMediaType: byMediaTypeRows.map((r) => ({ mediaType: r.media_type, count: Number(r.count) })),
      pgvectorAvailable: Number(pgvectorRows[0]?.count ?? 0) > 0,
      configuredModel: `${EMBEDDING_MODEL_PROVIDER}/${EMBEDDING_MODEL_NAME}`,
      eligibleCount: Number(eligibleRows[0]?.count ?? 0),
    })
  })
}
