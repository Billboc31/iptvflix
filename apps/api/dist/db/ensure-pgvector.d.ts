import { getEmbeddingIndexMode, type EmbeddingIndexMode } from './embedding-index-mode.js';
/**
 * Enable pgvector + HNSW when the Postgres image ships the extension.
 * Never throws: stock Railway Postgres stays on float8[] cosine search.
 */
export declare function ensurePgvectorEmbeddings(): Promise<EmbeddingIndexMode>;
export { getEmbeddingIndexMode };
//# sourceMappingURL=ensure-pgvector.d.ts.map