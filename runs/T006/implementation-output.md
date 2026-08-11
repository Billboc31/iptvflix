# T006 — Implementation summary

Coder step completed the catalog sync work, then hung on a finished shell probe
of the `sync_runs` unique constraint. This artifact was finalized manually so
review/tester can continue without re-running the coder.

## Changes

- Schema: `availability_status` + `unavailableAt` on movie availabilities;
  new `seriesAvailabilities`; unique `(providerId, providerItemId)` lookups.
- Schema: new `syncRuns` table with partial unique index
  `(sourceId) WHERE status = 'RUNNING'` for concurrency lock.
- Migration: `apps/api/migrations/0003_gifted_johnny_blaze.sql`.
- Service: `CatalogSyncService.syncCatalog(sourceId, snapshot)` with
  stale-lock clear, lock acquire (`SyncAlreadyRunningError` on 23505),
  movie/series upsert preserving `firstSeenAt`, mark missing → `UNAVAILABLE`,
  structured `CatalogSyncResult`.
- Tests: `catalog-sync-service.test.ts` (6 tests).

## Files

- `apps/api/src/db/schema/availabilities.ts`
- `apps/api/src/db/schema/sync-runs.ts`
- `apps/api/src/db/schema/index.ts`
- `apps/api/migrations/0003_gifted_johnny_blaze.sql`
- `apps/api/migrations/meta/0003_snapshot.json`
- `apps/api/migrations/meta/_journal.json`
- `apps/api/src/services/catalog-sync-service.ts`
- `apps/api/src/services/__tests__/catalog-sync-service.test.ts`

## Verifications

- Live probe: second `RUNNING` insert → Postgres `23505` on
  `sync_runs_source_running_idx`.
- `pnpm exec vitest run src/services/__tests__/catalog-sync-service.test.ts`
  → **6 passed**.

## Limits

- No HTTP route wired yet (sync is a service API as per plan).
- Stale lock timeout fixed at 10 minutes.
