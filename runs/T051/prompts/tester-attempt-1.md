# T051 — Tester Report

**Date:** 2026-08-13  
**Branch:** ticket/T051-add-automatic-source-synchronization-and-discovery-refresh-scheduling

---

## Test Execution

```
Test Files  43 passed (43)
     Tests  606 passed (606)
  Duration  ~2.7s
```

All tests pass. No regressions.

---

## Acceptance Criteria Verification

### AC1 — Enabled sources synchronized automatically on a configurable cadence
**PASS**

`SchedulerService.runSourceSyncTick()` (scheduler-service.ts:90) fetches `WHERE enabled = true`, computes `now - lastCompleted < cadenceMs`, and calls `triggerSync` for stale sources. Cadence defaults to 60 min, fully overridable via `SOURCE_SYNC_CADENCE_MINUTES`. Tests: cadence gate skips recent, syncs stale, syncs sources with no prior run.

---

### AC2 — No overlapping syncs for the same source across two scheduler ticks
**PASS**

Enforced at DB level via a partial unique index on `sync_runs(source_id) WHERE status = 'RUNNING'` (sync-runs.ts:26-29). Any duplicate RUNNING insert raises a unique constraint violation (surfaced as 409 by the route), making concurrent overlapping syncs structurally impossible. Additionally, stale RUNNING locks older than 10 minutes are cleared to FAILED before each sync attempt (catalog-sync-service.ts:282-291).

---

### AC3 — Manual and scheduled synchronization share the same locking/idempotency rules
**PASS**

The scheduler calls `this.triggerSync({ sourceId })` (scheduler-service.ts:114), which is the exact same `triggerSync` function injected at bootstrap from the sync-runs route handler (index.ts:124). Both paths execute through the same `CatalogSyncService`, which holds the unique-index lock logic. No separate code path exists for scheduled syncs.

---

### AC4 — Source failures are isolated, logged safely, visible, and do not stop other sources
**PASS**

Each source task is wrapped in a per-source try/catch (scheduler-service.ts:103-122). 409 conflicts are silently skipped with a debug log; any other error is logged with `console.error` but remaining sources continue via `withBoundedConcurrency`. Failure reason is persisted in `sync_runs.error_message`. SyncRunList.tsx surfaces the error column in the UI. Test "failure isolation" verifies 3 sources are attempted even when source A throws a network error.

---

### AC5 — Discovery Pool maintenance runs independently and remains bounded
**PASS**

`runDiscoveryTick()` uses a **separate** `setInterval` with `discoveryCadenceMinutes` (default 360 min), independent of the source sync interval (scheduler-service.ts:68-71). Discovery pool is bounded by: (a) 250 ms delay between TMDB pages (`FEED_PAGE_DELAY_MS`, discovery-candidate-pool-service.ts:13), (b) rate-limit errors break the page loop gracefully (tested). Discovery tick is a no-op when `discoveryPoolService` is `null` (no TMDB key).

---

### AC6 — Automatic source changes feed the existing availability/release lifecycle
**PASS**

`CatalogSyncService` inserts into `release_events` on movie/series creation, availability transitions, and episode lifecycle changes (catalog-sync-service.ts:374, 399, 437, 462, 489, 513, 578, 595, 646). Since the scheduler calls the same `triggerSync` path as manual sync, lifecycle event emission is identical in both cases. The vertical-slice integration test (vertical-slice.test.ts, 12 tests) covers this end-to-end.

---

### AC7 — Scheduling can be disabled in test/local environments
**PASS**

`SYNC_SCHEDULER_ENABLED` defaults to `NODE_ENV === 'production'` (env.ts:26-29). Explicit override: `SYNC_SCHEDULER_ENABLED=true|false`. When `enabled: false`, `scheduler.start()` returns immediately (scheduler-service.ts:55). The "disabled scheduling" test verifies no timers fire after `enabled: false` even after the startup delay. Tests run with `NODE_ENV !== 'production'`, so the scheduler is off by default in CI.

---

### AC8 — Restart does not create an immediate unbounded duplicate storm
**PASS**

Two mechanisms prevent a restart storm:
1. **Startup delay** (default 30 s via `SCHEDULER_STARTUP_DELAY_MS`): no tick fires until the delay elapses (tested: no call at t=4999ms, call at t=5000ms).
2. **Cadence gate**: on first tick after restart, only sources whose last COMPLETED run is older than `sourceSyncCadenceMinutes` are triggered. Sources synced recently by a previous process instance are skipped. The DB is the authoritative source of truth (not in-memory state), so restart does not reset cadence tracking.

---

### AC9 — Tests cover concurrency, failure isolation, disabled scheduling and restart-safe behavior
**PASS**

| Test file | Tests | Coverage |
|---|---|---|
| `scheduler-service.test.ts` | 12 | disabled, cadence gate, lock contention (409), failure isolation, concurrency bound, restart safety, discovery tick |
| `catalog-sync-service.test.ts` | 34 | first sync, concurrent lock (409), availability transitions, episode lifecycle, transaction rollback |
| `discovery-candidate-pool-service.test.ts` | 13 | refresh idempotency, rate-limit error isolation, stale eviction, materialization |
| `sync-runs.test.ts` | 3 | list, create (201), missing source (404) |
| `vertical-slice.test.ts` | 12 | end-to-end catalog integration |

---

## Observations (non-blocking)

1. **Next-sync estimate is approximate**: `SyncStatusBanner` computes next sync as `finishedAt + cadence`. This is a UI hint, not the actual timer state. Acceptable per the ticket scope ("surface concise ... information").

2. **Discovery concurrency is page-level, not feed-level**: TMDB feeds (6 feed×type combinations) are fetched sequentially with 250ms page delays. Sufficient for a 6-hour cadence; could be parallelized later if needed.

3. **No dedicated `/scheduler/status` route test**: The route is a trivial config read — low risk.

---

## Verdict

**VALIDATION PASSED** — All 9 acceptance criteria are satisfied. 606/606 tests pass. No regressions detected.
