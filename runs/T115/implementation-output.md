All tests pass. Here's a summary of the two minor fixes applied:

---

## Changes made

### Minor 1 — `retrying` stat in run-level stats

**`services/catalog-enrich-missing-service.ts`**
- Added `retrying: number` to `EnrichMissingStats` interface
- Added `retrying: 0` to the `stats` object initialized in `start()`
- Added `retrying: number` to the `stats` type in `execute()`'s context parameter
- Added optional `onRetry?: () => void` callback to `enrichWithRetry()` — called before each retry delay
- Passed `() => { stats.retrying++ }` to both `enrichWithRetry()` calls in `execute()`
- Added `retrying: cp.stats.retrying ?? 0` in `getLatestRunStatus()`

### Minor 3 — `map` stage captured when `mapMovieDetail`/`mapSeriesDetail` throws

**`providers/metadata/types.ts`**
- Exported new `MetadataMappingError extends Error` class

**`providers/metadata/tmdb/client.ts`**
- Imported `MetadataMappingError`
- Split the try/catch in `getMovieMetadata` and `getSeriesMetadata`: `response.json()` failure → `TmdbNetworkError`; `mapMovieDetail`/`mapSeriesDetail` failure → `MetadataMappingError` with the original error message preserved

**`services/metadata-enrichment-service.ts`**
- Imported `MetadataMappingError`
- Changed both fetch-stage catch blocks in `enrichMovie` and `enrichSeries` to use `stage: err instanceof MetadataMappingError ? 'map' : 'fetch'`

---

**Remaining blocker** (unchanged): The production run artifact (`runs/T115/production-run-YYYYMMDD.md`) still requires a human to execute `POST /admin/catalog-enrich-missing` against production and publish the before/after counts and real failure causes.
