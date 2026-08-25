import { pgClient } from '../db/client.js';
import { EMBEDDING_MODEL_PROVIDER, EMBEDDING_MODEL_NAME } from '../config.js';
export async function diagnosticsRoutes(app) {
    app.get('/v1/diagnostics/vector-corpus', async (_request, reply) => {
        const [totalRows, byModelRows, byMediaTypeRows, eligibleRows, pgvectorRows, colTypeRows] = await Promise.all([
            pgClient `SELECT COUNT(*) AS count FROM media_embeddings`,
            pgClient `
        SELECT model_provider, model_name, COUNT(*) AS count FROM media_embeddings GROUP BY 1, 2
      `,
            pgClient `
        SELECT media_type, COUNT(*) AS count FROM media_embeddings GROUP BY 1
      `,
            pgClient `
        SELECT COUNT(*) AS count FROM media_embeddings
        WHERE model_provider = ${EMBEDDING_MODEL_PROVIDER} AND model_name = ${EMBEDDING_MODEL_NAME}
      `,
            pgClient `
        SELECT COUNT(*) AS count FROM pg_extension WHERE extname = 'vector'
      `,
            pgClient `
        SELECT udt_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'media_embeddings' AND column_name = 'embedding'
      `,
        ]);
        const pgvectorExtensionInstalled = Number(pgvectorRows[0]?.count ?? 0) > 0;
        const embeddingColumnType = colTypeRows[0]?.udt_name ?? null;
        return reply.send({
            totalEmbeddings: Number(totalRows[0]?.count ?? 0),
            byModel: byModelRows.map((r) => ({ modelProvider: r.model_provider, modelName: r.model_name, count: Number(r.count) })),
            byMediaType: byMediaTypeRows.map((r) => ({ mediaType: r.media_type, count: Number(r.count) })),
            pgvectorExtensionInstalled,
            // true only when extension is installed AND column has been migrated to vector type
            pgvectorAvailable: pgvectorExtensionInstalled && embeddingColumnType === 'vector',
            embeddingColumnType,
            configuredModel: `${EMBEDDING_MODEL_PROVIDER}/${EMBEDDING_MODEL_NAME}`,
            eligibleCount: Number(eligibleRows[0]?.count ?? 0),
        });
    });
}
//# sourceMappingURL=diagnostics.js.map