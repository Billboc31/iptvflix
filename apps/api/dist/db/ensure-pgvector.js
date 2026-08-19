import { sql } from 'drizzle-orm';
import { db } from './client.js';
import { getEmbeddingIndexMode, setEmbeddingIndexMode } from './embedding-index-mode.js';
function rowCount(result) {
    if (Array.isArray(result))
        return result.length;
    if (result && typeof result === 'object' && Array.isArray(result.rows)) {
        return result.rows.length;
    }
    return 0;
}
/**
 * Enable pgvector + HNSW when the Postgres image ships the extension.
 * Never throws: stock Railway Postgres stays on float8[] cosine search.
 */
export async function ensurePgvectorEmbeddings() {
    try {
        const available = await db.execute(sql `SELECT 1 FROM pg_available_extensions WHERE name = 'vector' LIMIT 1`);
        if (rowCount(available) === 0) {
            setEmbeddingIndexMode('float8');
            return 'float8';
        }
        await db.execute(sql `CREATE EXTENSION IF NOT EXISTS vector`);
        await db.execute(sql `
      DO $upgrade$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'media_embeddings'
            AND column_name = 'embedding'
            AND udt_name IN ('_float8', 'float8', '_float4')
        ) THEN
          ALTER TABLE media_embeddings
            ALTER COLUMN embedding TYPE vector(1536)
            USING embedding::vector;
        END IF;
      END
      $upgrade$
    `);
        try {
            await db.execute(sql `
        CREATE INDEX IF NOT EXISTS media_embeddings_hnsw_idx
        ON media_embeddings USING hnsw (embedding vector_cosine_ops)
      `);
        }
        catch {
            // Exact <=> search still works without HNSW (small catalogs / old pgvector).
        }
        const vectorCol = await db.execute(sql `
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'media_embeddings'
        AND column_name = 'embedding'
        AND udt_name = 'vector'
      LIMIT 1
    `);
        const mode = rowCount(vectorCol) > 0 ? 'pgvector' : 'float8';
        setEmbeddingIndexMode(mode);
        return mode;
    }
    catch {
        setEmbeddingIndexMode('float8');
        return 'float8';
    }
}
export { getEmbeddingIndexMode };
//# sourceMappingURL=ensure-pgvector.js.map