No type errors in the modified files. Here's a summary of all changes made:

---

## Changes implemented

**5 files modified**, addressing all 5 code-fixable issues from the review:

### `apps/api/src/db/schema/catalog-refresh-runs.ts`
- Removed the `RefreshCheckpoint` type (which was specific to REFRESH runs, not ENRICH_MISSING)
- Changed `checkpoint` column type from `$type<RefreshCheckpoint>()` to `$type<unknown>()` — honest about the fact that REFRESH and ENRICH_MISSING write structurally different checkpoint objects

### `apps/api/src/services/catalog-enrich-missing-service.ts`
- **`resumeRunId` option**: Added `resumeRunId?: string` to `EnrichMissingOptions`. When provided, `start()` reads the previous run's checkpoint and initializes `lastId` from it, so the cursor resumes from where the interrupted run left off
- **Race condition fix**: Wrapped the `INSERT ... RETURNING` in `start()` and `retryFailures()` in a try/catch for Postgres error code `23505` (unique constraint), translating it to a `RUN_CONFLICT` error → HTTP 409 instead of 500
- **Type**: Removed `as any` cast on `set({ checkpoint })` — now valid since the column type is `unknown`
- **`retrying` doc**: Added JSDoc clarifying it counts retry *attempts*, not unique items

### `apps/api/src/routes/catalog-enrich-missing.ts`
- Added `resumeRunId?: string` to the POST body type and passes it through to `service.start()`

### `apps/api/src/services/__tests__/t115-enrichment.test.ts`
- Renamed the misleading "cursor pagination" test to accurately reflect it tests `countEligible`
- Added a **genuine cursor pagination test** that actually runs `start()`, waits for async execute to complete (via the COMPLETED status update), and verifies two batch queries were made with `enrichMovie` called for each item in the first batch

### `apps/api/scripts/diagnose-db.mjs`
- Added `enrichment_failures` to the `tables` row-count list
