All tasks complete. Here's a summary of every file created or modified:

## Files Created

| File | Purpose |
|---|---|
| `migrations/0045_t115_enrichment_failures.sql` | Creates `enrichment_failures` table with unique index on `(media_type, media_id)` |
| `migrations/0046_t115_catalog_refresh_runs_type.sql` | Adds `type` column to `catalog_refresh_runs` |
| `src/db/schema/enrichment-failures.ts` | Drizzle schema for the new table |
| `src/services/embedding-eligibility.ts` | Single-source `isEmbeddingEligible()` policy (enriched = eligible) |
| `src/services/catalog-enrich-missing-service.ts` | Resumable keyset-cursor enrich-missing service with stats, failure listing, and retry |
| `src/routes/catalog-enrich-missing.ts` | 4 admin endpoints: POST start, GET status, GET failures, POST retry-failures |
| `src/providers/metadata/tmdb/__tests__/t115-normalization.test.ts` | 4 unit tests for TMDB normalization |
| `src/services/__tests__/t115-enrichment.test.ts` | 3 unit tests for failure persistence + cursor behavior |

## Files Modified

| File | Change |
|---|---|
| `src/providers/metadata/tmdb/client.ts` | `runtime=0` → `null`, `imdb_id=""` → `null`, `overview` whitespace → `null` |
| `src/db/schema/catalog-refresh-runs.ts` | Added `type` column |
| `src/db/schema/index.ts` | Exports `enrichment-failures` |
| `src/services/metadata-enrichment-service.ts` | Per-item failure persistence via `persistFailure()` in `enrichMovie()`/`enrichSeries()`; clears failure on success |
| `src/routes/catalog-stats.ts` | Adds `neverEnriched`, `partiallyEnriched`, `fullyEnriched`, `stale`, `failedLastEnrichment`, `embeddingEligible`, `embeddingBlocked`, real `embeddingPending` |
| `src/index.ts` | Registers `CatalogEnrichMissingService` and `catalogEnrichMissingRoutes` |
| `src/routes/__tests__/catalog-stats.test.ts` | Updated mock setup to cover 12 queries |
| `src/services/__tests__/metadata-enrichment-service.test.ts` | Updated `makeInsertChain` + 3 test cases to include `insert` mock for `persistFailure` |

**Result: 0 TypeScript errors, 51 tests passing.**
