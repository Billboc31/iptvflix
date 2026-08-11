Implementation complete. Here's a summary:

---

## Summary

**70 tests pass, 0 TypeScript errors in new code.**

### Files modified
| File | Change |
|------|--------|
| `apps/api/src/db/schema/movies.ts` | Add `metadataProvider`, `metadataEnrichedAt` columns |
| `apps/api/src/db/schema/series.ts` | Same two columns |
| `apps/api/src/config/env.ts` | Export `TMDB_API_KEY` (optional) and `TMDB_STALE_DAYS` (default 7) |
| `.env.example` | Add `TMDB_API_KEY=` and `TMDB_STALE_DAYS=7` placeholders |
| `apps/api/src/index.ts` | Conditionally create `TmdbClient`/`MetadataEnrichmentService`, register enrichment route |

### Files created
| File | Purpose |
|------|---------|
| `apps/api/migrations/0004_wild_legion.sql` | `ALTER TABLE` adds 4 nullable columns |
| `apps/api/src/providers/metadata/types.ts` | `MetadataProvider` interface + `ExternalMovieMetadata`/`ExternalSeriesMetadata` types |
| `apps/api/src/providers/metadata/tmdb/types.ts` | TMDB API response shapes |
| `apps/api/src/providers/metadata/tmdb/errors.ts` | `TmdbRateLimitError`, `TmdbNetworkError` |
| `apps/api/src/providers/metadata/tmdb/client.ts` | `TmdbClient` with retry-after handling, auth header, null on 404 |
| `apps/api/src/providers/metadata/tmdb/__tests__/client.test.ts` | 14 tests (happy path, 404, 429 retry, error classes, no key leakage) |
| `apps/api/src/providers/metadata/tmdb/__tests__/fixtures/*.json` | 4 fixture files |
| `apps/api/src/services/metadata-enrichment-service.ts` | `MetadataEnrichmentService` with `enrichMovie`, `enrichSeries`, `enrichPending` (250ms throttle) |
| `apps/api/src/services/__tests__/metadata-enrichment-service.test.ts` | 16 tests (skip/stale/fresh/force, provider-failed, genre upsert, provenance) |
| `apps/api/src/routes/enrichment.ts` | `POST /enrichment/trigger` → 503 when provider absent, counters when active |

### Key behaviors
- `TMDB_API_KEY` absent → route returns 503, IPTV catalog unaffected
- Records with `tmdbId` and fresh `metadataEnrichedAt` are skipped without TMDB calls
- Provider 404 or network errors per-item return `'provider-failed'` without aborting the batch
- API key never appears in logs or error messages
- All TMDB calls mocked in tests — no live network required
