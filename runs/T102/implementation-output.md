**18/18 tests pass** across 4 test files. All implementation is complete. Here's a summary of what was built:

---

## Files created

| File | Purpose |
|---|---|
| `apps/api/migrations/0036_t102_media_embeddings.sql` | Enables pgvector extension + creates `media_embeddings` table with HNSW index |
| `apps/api/src/db/schema/media-embeddings.ts` | Drizzle schema with `customType` vector column |
| `apps/api/src/services/embedding-document-builder.ts` | Deterministic embedding text builder + SHA-256 hash + coverage metrics |
| `apps/api/src/services/embedding-provider.ts` | `EmbeddingProvider` interface + `OpenAIEmbeddingProvider` (`text-embedding-3-small`, 1536d) |
| `apps/api/src/services/embedding-service.ts` | `upsertEmbedding` (skip-if-hash-unchanged) + `semanticSearch` (cosine distance via pgvector `<=>`) |
| `apps/api/src/services/embedding-backfill-service.ts` | Idempotent batch backfill — paginated cursor, bounded concurrency, exponential retry |
| `apps/api/src/services/semantic-retrieval-service.ts` | Top-K retrieval enriched with title/year/poster metadata |
| `apps/api/src/routes/recommendation-lab.ts` | `POST /recommendation-lab/semantic-query` with optional side-by-side comparison |
| `apps/api/src/benchmarks/embedding-benchmarks.ts` | 5-query benchmark suite with precision@5/10 scoring |
| `packages/api-contracts/src/embeddings.ts` | `SemanticQueryRequest/Response/Candidate` types |
| `apps/web/src/pages/RecommendationLabPage.tsx` | Lab UI with benchmark quick-picks, comparison mode, similarity badges |
| 3 test files | 18 unit tests covering document builder, embedding service, and backfill service |

## Files modified

- `apps/api/src/db/schema/index.ts` — exports `media-embeddings`
- `apps/api/src/config/env.ts` — adds `OPENAI_API_KEY`
- `apps/api/package.json` — adds `openai` dependency + `benchmark:embeddings` script
- `apps/api/src/services/metadata-enrichment-service.ts` — optional `onEnriched` callback for fire-and-forget embedding after enrichment
- `apps/api/src/routes/embedding-backfill.ts` — replaces 501 stub with real backfill + coverage endpoints
- `apps/api/src/routes/__tests__/embedding-backfill.test.ts` — updates for new behavior
- `apps/api/src/index.ts` — wires embedding service + lab route in protected scope
- `packages/api-contracts/src/index.ts` — exports embeddings types
- `apps/web/src/App.tsx` — adds `/lab` route
- `apps/web/src/lib/api.ts` — adds `semanticQuery()` function
- `apps/web/src/components/layout/TopNav.tsx` — adds "Lab" nav item
