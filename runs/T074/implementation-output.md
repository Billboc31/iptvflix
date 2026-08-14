All tasks complete. Here is a summary of changes made:

---

## Summary

### Files modified

**`apps/api/src/providers/metadata/types.ts`**
- Extended `ExternalSeriesMetadata.seasons[]` with `name: string | null` and `airDate: string | null` fields

**`apps/api/src/providers/metadata/tmdb/client.ts`**
- Updated `mapSeriesDetail()` to populate the new `name` and `airDate` fields from the raw TMDB response

**`apps/api/src/services/metadata-enrichment-service.ts`**
- `enrichSeries()` — seasons block changed from `UPDATE WHERE` to `INSERT ... ON CONFLICT (seriesId, seasonNumber) DO UPDATE`, creating canonical season rows even when none existed
- `enrichSeriesSeasons()` — episodes loop changed from "skip if no DB row" to `INSERT ... ON CONFLICT (seasonId, episodeNumber) DO UPDATE`, creating canonical episode rows from TMDB data independently of any source import

**`apps/api/src/config/env.ts`**
- Added `CATALOG_BOOTSTRAP_HIERARCHY_PRIORITY_COUNT` (default 200)

**`apps/api/src/services/catalog-bootstrap-service.ts`**
- Added `hierarchyPriorityCount` to `BootstrapConfig`
- Added optional `enrichmentService` as 4th constructor parameter
- Added priority-tier hierarchy hydration phase at end of `execute()`: queries top-N series by popularity, enriches them in batches of 5 with 500 ms inter-batch delay, tracked in checkpoint under key `hierarchy:priority`

**`apps/api/src/routes/catalog.ts`**
- Added `CatalogRoutesOptions` interface with optional `enrichmentService`
- `GET /series/:id` — when seasons are absent and `tmdbId` is set, fires `enrichSeries()` as fire-and-forget and sets `X-Hierarchy-Hydrating: true` response header

**`apps/api/src/index.ts`**
- Passes `MetadataEnrichmentService` to both `catalogRoutes` (on-demand hydration) and `CatalogBootstrapService` (priority tier)

### Files updated (tests)
- `metadata-enrichment-service.test.ts` — updated 2 existing tests to reflect upsert behavior; added 5 new tests (season upsert, idempotency, source-free episode creation)
- `catalog-bootstrap-service.test.ts` — added new env var to mock; added 2 tests for new config and wiring
- `catalog.test.ts` — added `GET /series/:id — on-demand hierarchy hydration` describe block with 3 tests
