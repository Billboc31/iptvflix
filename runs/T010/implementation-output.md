The implementation was almost fully done from a prior attempt. My two small fixes completed it. Let me now review the final state of all T010 deliverables before summarizing.

The implementation is complete. Here's a summary of what exists and what I added:

---

**Files already implemented (from prior coder attempt):**

| File | Purpose |
|------|---------|
| `apps/api/src/db/schema/movies.ts` | Added `metadataProvider` + `metadataEnrichedAt` columns |
| `apps/api/src/db/schema/series.ts` | Same two provenance columns |
| `apps/api/migrations/0004_wild_legion.sql` | Migration SQL for both tables |
| `apps/api/migrations/meta/0004_snapshot.json` | Drizzle snapshot |
| `apps/api/src/config/env.ts` | `TMDB_API_KEY` and `TMDB_STALE_DAYS` exports |
| `apps/api/src/providers/metadata/types.ts` | `MetadataProvider`, `ExternalMovieMetadata`, `ExternalSeriesMetadata` interfaces |
| `apps/api/src/providers/metadata/tmdb/types.ts` | TMDB API response shapes |
| `apps/api/src/providers/metadata/tmdb/errors.ts` | `TmdbRateLimitError`, `TmdbNetworkError` |
| `apps/api/src/providers/metadata/tmdb/client.ts` | `TmdbClient` with retry + rate-limit handling |
| `apps/api/src/providers/metadata/tmdb/__tests__/client.test.ts` | 14 tests, all mocked |
| `apps/api/src/providers/metadata/tmdb/__tests__/fixtures/` | 4 JSON fixtures |
| `apps/api/src/services/metadata-enrichment-service.ts` | `MetadataEnrichmentService` with `enrichMovie`, `enrichSeries`, `enrichPending` |
| `apps/api/src/services/__tests__/metadata-enrichment-service.test.ts` | 16 tests, all mocked |
| `apps/api/src/routes/enrichment.ts` | `POST /enrichment/trigger` returning counters or 503 |
| `apps/api/src/index.ts` | Registers enrichment routes behind TMDB_API_KEY guard |

**Fixed by this run:**

| File | Change |
|------|--------|
| `apps/api/.env.example` | Added `TMDB_API_KEY=` and `TMDB_STALE_DAYS=7` placeholders |
| `apps/api/migrations/meta/_journal.json` | Registered missing `0004_wild_legion` journal entry |

**Test results:** 70 tests pass, 0 T010 failures. The 2 failing suites (`catalog-constraints`, `catalog-sync-service`) are pre-existing and require a live database — not in scope.
