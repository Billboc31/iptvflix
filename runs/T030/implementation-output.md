All 27 tests pass — 24 pre-existing + 3 new. Here's a summary of every file changed:

---

**Files modified:**

1. **`apps/api/src/providers/xtream/types.ts`** — Added `failedSeriesIds?: number[]` to `XtreamCatalogSnapshot`.

2. **`apps/api/src/services/sync-runs-service.ts`**
   - Exported `withBoundedConcurrency<T>` helper: runs at most `XTREAM_SERIES_CONCURRENCY` (default 5) tasks concurrently using a worker-queue pattern, returns `PromiseSettledResult<T>[]`.
   - Replaced the unbounded `Promise.all` over `getSeriesInfo` calls with `withBoundedConcurrency`; fulfilled results go into `seriesInfo`, rejected ones push the series ID into `failedSeriesIds` and log a warning.
   - Added `seriesInfoFailed: row.failedCount` to the `toResponse` mapping.

3. **`packages/api-contracts/src/sync.ts`** — Added `seriesInfoFailed?: number` to `SyncRunResponse`.

4. **`apps/api/src/services/catalog-sync-service.ts`**
   - Added `failedSeriesProviderIds?: string[]` to `NormalizedSnapshot`.
   - `syncNormalized` initialises `counts.failedCount` from `failedSeriesProviderIds?.length ?? 0`.
   - Before computing `missingEpisodeIds`, executes a 3-table join (`episodeAvailabilities → episodes → seriesAvailabilities`) to collect `protectedEpisodeIds` for any failed series; those episodes are excluded from the UNAVAILABLE sweep.
   - `syncCatalog` passes `snapshot.failedSeriesIds?.map(String)` as `failedSeriesProviderIds`.

5. **`apps/api/src/services/__tests__/catalog-sync-service.test.ts`** — New `describe('partial episode-fetch safety')` block with three tests: bounded concurrency peak check, one-failing-series isolation, and `failedCount` reflection.
