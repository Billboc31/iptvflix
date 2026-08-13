# Plan — T051: Automatic source synchronization and discovery refresh scheduling

## Objective

Add a `SchedulerService` that periodically triggers source synchronization and Discovery Pool maintenance on configurable cadences, reusing existing sync and discovery boundaries, without duplicating provider logic or replacing the existing on-demand sync path.

## Included

### Config — `apps/api/src/config/env.ts`
- `SYNC_SCHEDULER_ENABLED` — boolean, defaults to `true` only when `NODE_ENV === 'production'`, `false` otherwise (disables the scheduler in dev and test environments).
- `SOURCE_SYNC_CADENCE_MINUTES` — number, default `60`.
- `DISCOVERY_CADENCE_MINUTES` — number, default `360`.
- `SOURCE_SYNC_CONCURRENCY` — number, default `2` (max sources synced in parallel per tick).
- `SCHEDULER_STARTUP_DELAY_MS` — number, default `30000` (initial delay after boot before the first tick fires, prevents a startup burst after a restart).

### New service — `apps/api/src/services/scheduler-service.ts`
- `SchedulerService` class, constructor receives `db`, `triggerSync` (the existing function from `sync-runs-service.ts`), `discoveryPoolService` (`DiscoveryCandidatePoolService` or `null`), and the config values above.
- `start()`: registers two independent `setInterval` timers after `SCHEDULER_STARTUP_DELAY_MS` — one for source sync, one for discovery pool maintenance.
- `stop()`: clears both timers (for clean shutdown and test teardown).
- **Source sync tick**: fetches all enabled sources from DB; for each source (bounded by `SOURCE_SYNC_CONCURRENCY` via a simple semaphore or `Promise.all` over chunked batches), checks the `sync_runs` table for the last `COMPLETED` run — if `(now − lastCompleted) >= SOURCE_SYNC_CADENCE_MINUTES * 60_000` (or no completed run exists), calls `triggerSync({ sourceId })`. Catches `SyncAlreadyRunningError` (409) silently; catches any other error per-source, logs it with the source id, and continues to the remaining sources.
- **Discovery tick**: calls `discoveryPoolService.evictStale()` then `discoveryPoolService.refreshPool(feeds, mediaTypes)` if `discoveryPoolService` is non-null; catches and logs errors without crashing.
- No in-memory "next run" state is the source of truth — the DB `sync_runs.completedAt` is the durable record. The timers are just wakeup signals.

### New route — `apps/api/src/routes/scheduler.ts`
- `GET /scheduler/status` (public, no auth required — read-only config info).
- Returns `{ enabled: boolean, sourceSyncCadenceMinutes: number, discoveryCadenceMinutes: number }`.
- This lets the UI compute "next sync at ~HH:MM" client-side by adding the cadence to the last `completedAt` from the existing sync runs list.

### Server wiring — `apps/api/src/index.ts`
- Import `SchedulerService` and the new env vars.
- After all routes are registered, instantiate `SchedulerService` with `db`, `triggerSync`, `discoveryService` (already available in scope), and config.
- If `SYNC_SCHEDULER_ENABLED`, call `scheduler.start()`.
- Register `schedulerRoutes` (public scope).

### UI — `apps/web/src/components/sources/SyncStatusBanner.tsx`
- Add a small "Auto-sync every Xh" badge or "Auto-sync disabled" label, fetched once from `GET /scheduler/status`.
- When enabled and a `completedAt` exists in the latest run, display "Next sync ~HH:MM" computed as `lastCompleted + cadence`.
- No polling needed — cadence config is static for the lifetime of the process.

### New hook — `apps/web/src/hooks/useSchedulerStatus.ts`
- Single fetch on mount to `GET /scheduler/status`; exposes `{ enabled, sourceSyncCadenceMinutes, discoveryCadenceMinutes }`.

### Tests — `apps/api/src/services/__tests__/scheduler-service.test.ts`
- **Disabled scheduling**: when `SYNC_SCHEDULER_ENABLED=false`, `start()` is never called / no timers are set, no `triggerSync` calls happen.
- **Cadence gate**: tick does not call `triggerSync` for a source whose last `completedAt` is within the cadence window; calls it once the window has elapsed.
- **Lock contention**: when `triggerSync` throws `SyncAlreadyRunningError`, the tick logs and moves on; remaining sources are still processed.
- **Failure isolation**: when `triggerSync` throws a generic error for source A, the tick still processes sources B and C.
- **Concurrency bound**: with `SOURCE_SYNC_CONCURRENCY=1` and 3 sources, `triggerSync` is called one-at-a-time.
- **Restart safety**: `SCHEDULER_STARTUP_DELAY_MS` delays the first tick; no `triggerSync` calls happen before the delay elapses.
- **Discovery tick**: `evictStale` and `refreshPool` are called on the discovery cadence; errors are caught and do not throw.
- **No discovery service**: when `discoveryPoolService` is `null`, discovery tick is a no-op.

## Excluded

- Push / email / mobile notifications.
- Distributed multi-instance job infrastructure (Bull, BullMQ, Redis queues) — a single `setInterval` is sufficient for a single Railway instance.
- Per-source configurable cadences — one global cadence for all sources.
- Reimplementing any provider synchronization logic.
- The existing on-demand `POST /sync-runs` endpoint — it is unchanged.
- Shelf refresh triggered on every sync tick — it is already triggered through the existing availability lifecycle boundary when catalog sync completes.
- Any database migration beyond the existing `sync_runs` schema — the locking invariant (`UNIQUE` partial index on `(sourceId) WHERE status='RUNNING'`) already covers the scheduler's concurrency needs.

## Acceptance criteria

- [ ] Setting `SYNC_SCHEDULER_ENABLED=false` (or running with `NODE_ENV !== 'production'` and no override) produces zero automatic `triggerSync` calls.
- [ ] With `SYNC_SCHEDULER_ENABLED=true`, a source whose last `completedAt` is older than `SOURCE_SYNC_CADENCE_MINUTES` is synced on the next tick; a recently-synced source is skipped.
- [ ] If a source is already running (`SyncAlreadyRunningError`), the tick does not crash and other sources are still processed in the same tick.
- [ ] A runtime error in one source's sync does not prevent the scheduler from processing the remaining sources.
- [ ] `SOURCE_SYNC_CONCURRENCY` caps the number of concurrent `triggerSync` calls per tick.
- [ ] After a process restart, no sync fires before `SCHEDULER_STARTUP_DELAY_MS` elapses.
- [ ] `GET /scheduler/status` returns the correct `enabled`, `sourceSyncCadenceMinutes`, and `discoveryCadenceMinutes` values.
- [ ] `SyncStatusBanner` displays an "Auto-sync every Xh" (or disabled) label consistent with the scheduler status response.
- [ ] Discovery `evictStale` + `refreshPool` are called on the discovery cadence independently of the source sync cadence.
- [ ] All new test scenarios in `scheduler-service.test.ts` pass under `vitest`.
- [ ] Existing sync-runs and sources tests remain green.
- [ ] TypeScript build (`tsc --noEmit`) reports no errors.
