Implementation complete. Here's a summary of all files created or modified:

**New files:**
- `apps/api/migrations/0030_catalog_bootstrap.sql` — table, indexes, `localizations` columns
- `apps/api/src/db/schema/catalog-bootstrap-runs.ts` — Drizzle schema for bootstrap runs
- `apps/api/src/services/catalog-bootstrap-service.ts` — bootstrap orchestrator with `buildSteps`, `start`, `execute`, upsert logic
- `apps/api/src/routes/catalog-bootstrap.ts` — `POST /catalog-bootstrap` and `GET /catalog-bootstrap/status`
- `apps/api/src/routes/__tests__/catalog-bootstrap.test.ts` — 4 route tests
- `apps/api/src/services/__tests__/catalog-bootstrap-service.test.ts` — 7 `buildSteps` unit tests

**Modified files:**
- `apps/api/src/db/schema/movies.ts` — added `localizations jsonb` column
- `apps/api/src/db/schema/series.ts` — added `localizations jsonb` column
- `apps/api/src/db/schema/index.ts` — re-exports `catalogBootstrapRuns`
- `apps/api/src/providers/metadata/types.ts` — added `DiscoverParams`, 4 new interface methods, optional `language` param on `getMovieMetadata`/`getSeriesMetadata`, updated `NoopMetadataProvider`
- `apps/api/src/providers/metadata/tmdb/client.ts` — added `fetchMovieTopRated`, `fetchSeriesTopRated`, `fetchMovieDiscover`, `fetchSeriesDiscover`; updated `getMovieMetadata`/`getSeriesMetadata` with optional `language` query param
- `apps/api/src/services/metadata-enrichment-service.ts` — added `persistFrenchLocalization` called after each enrichment
- `apps/api/src/config/env.ts` — 6 new `CATALOG_BOOTSTRAP_*` exports
- `apps/api/src/index.ts` — wires `CatalogBootstrapService` inside the protected scope (when `TMDB_API_KEY` is set)
- 5 existing test files — added 4 missing provider methods to `makeProvider` factories
