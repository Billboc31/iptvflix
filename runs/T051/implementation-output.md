All changes are in place. Here's a summary of everything implemented:

---

## Summary

### Files created
- **`apps/api/src/services/scheduler-service.ts`** — `SchedulerService` class with two independent timer ticks (source sync and discovery), bounded concurrency, DB-backed cadence gate, per-source error isolation, and `start()`/`stop()` lifecycle
- **`apps/api/src/routes/scheduler.ts`** — Public `GET /scheduler/status` endpoint returning enabled flag and cadence config
- **`apps/web/src/hooks/useSchedulerStatus.ts`** — Single-fetch hook exposing scheduler config to the UI
- **`apps/api/src/services/__tests__/scheduler-service.test.ts`** — 12 unit tests covering all scenarios (disabled, cadence gate, lock contention, failure isolation, concurrency bound, restart safety, discovery tick, no-op without discovery service)

### Files modified
- **`apps/api/src/config/env.ts`** — Added 5 scheduler env vars (`SYNC_SCHEDULER_ENABLED`, `SOURCE_SYNC_CADENCE_MINUTES`, `DISCOVERY_CADENCE_MINUTES`, `SOURCE_SYNC_CONCURRENCY`, `SCHEDULER_STARTUP_DELAY_MS`)
- **`apps/api/src/index.ts`** — Wired `SchedulerService`, `schedulerRoutes`, and `DiscoveryCandidatePoolService`; `scheduler.start()` unconditional (service checks `enabled` internally)
- **`apps/web/src/components/sources/SyncStatusBanner.tsx`** — Added "Auto-sync every Xh" badge, "Auto-sync désactivé" label, and "Prochaine ~HH:MM" computed from last `finishedAt + cadence`

### Key design decisions
- `withBoundedConcurrency` is inlined in `scheduler-service.ts` (not imported from `sync-runs-service.ts`) to avoid the transitive DB side-effect at module load time, which broke unit testing
- All 12 tests pass with `vi.useFakeTimers()` + `vi.advanceTimersByTimeAsync` for deterministic timer control
- `SYNC_SCHEDULER_ENABLED` defaults to `true` only in `production`, `false` elsewhere — safe for dev/test by default
