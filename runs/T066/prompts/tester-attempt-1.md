# T066 — Test Report

**Date**: 2026-08-13  
**Branch**: `ticket/T066-add-scheduled-refreshes-for-the-canonical-catalog`  
**Tester**: Claude (Sonnet 4.6)

---

## Summary

All 7 acceptance criteria **PASS**. No regressions introduced by T066. The 4 failing tests in the suite are pre-existing failures unrelated to this ticket.

---

## Test Suite Results

```
Test Files  2 failed | 50 passed (52)
      Tests  4 failed | 706 passed (710)
   Duration  19.66s
```

**New tests added by T066**: 12 tests in `catalog-refresh-service.test.ts` — all pass.

**Pre-existing failures** (4 tests in `vertical-slice.test.ts`): Confirmed present before T066's changes (stash test verified). Root cause: the source sync endpoint was changed to return `RUNNING` asynchronously in a prior ticket (`feat(sync): show live progress while catalog sync is RUNNING`) and the integration test expectations were never updated. T066 does not touch `vertical-slice.test.ts` or the sync endpoint.

---

## Acceptance Criteria

### AC1 — Catalog refreshes automatically

**PASS**

`SchedulerService.start()` (`scheduler-service.ts:59`) registers a `catalogRefreshTimer` interval after the startup delay. `runCatalogRefreshTick()` is called once immediately on startup and then on cadence.

Cadence check: skips if the last COMPLETED run's `completedAt` is within the configured window. This prevents double-firing if the server restarts within the cadence window.

---

### AC2 — Upcoming/recent/airing content stays fresh

**PASS**

Stale thresholds by bucket:
- **upcoming**: `upcomingStaleHours / 24` days (default 12h). Applied to movies with `status IN ('Rumored','Planned','In Production','Post Production')` or release date within 60 days; and to series with `status IN ('In Production','Planned')`.
- **recent**: `recentStaleDays` (default 3 days). Applied to movies released 61–90 days ago with non-upcoming status.

The `enrichMovie` / `enrichSeries` call passes `staleDays` as a threshold, so enrichment also respects the bucket's freshness window.

Unit tests confirm correct `staleDays` values are passed per bucket (`catalog-refresh-service.test.ts:186–215`).

---

### AC3 — Stable content is not unnecessarily refreshed every night

**PASS**

Stable bucket uses `stableStaleDays` (default 30 days). Only entities with `metadataEnrichedAt IS NULL` or `metadataEnrichedAt < now - 30 days` are included in the query (`fetchStaleMovies:335`, `fetchStaleSeries:371`). A recently enriched stable entity will not be re-processed on the next nightly run.

---

### AC4 — Newly relevant titles can be imported

**PASS**

`runDiscoveryFeed()` (`catalog-refresh-service.ts:269`) fetches TMDB `upcoming` and `trending` feeds for both MOVIE and SERIES, up to `discoveryMaxPages` pages (default 5). `upsertMovieBatch()` / `upsertSeriesBatch()` insert new rows on conflict using `ON CONFLICT (tmdb_id) DO UPDATE`, incrementing `moviesImported` / `seriesImported` for genuinely new rows via `xmax = 0` detection.

---

### AC5 — Job status/counts/errors/last-run are observable

**PASS**

`GET /catalog-refresh/status` (`catalog-refresh.ts:28`) returns the most recent `catalog_refresh_runs` row ordered by `started_at DESC`. Response includes:

| Field | Description |
|---|---|
| `status` | PENDING / RUNNING / COMPLETED / FAILED |
| `moviesRefreshed` | Count of movies re-enriched |
| `seriesRefreshed` | Count of series re-enriched |
| `moviesImported` | Count of new movies discovered |
| `seriesImported` | Count of new series discovered |
| `failedCount` | Count of enrichment/provider failures |
| `errorMessage` | Last non-fatal error message (or null) |
| `startedAt` | Job start timestamp |
| `completedAt` | Job end timestamp (null if still running) |
| `checkpoint` | Per-step progress state |

Returns 404 if no run exists. Returns running job data if in progress (allows live progress monitoring).

`POST /catalog-refresh` returns 202 with `{runId, status: 'RUNNING'}` on success, 409 if a run is already in progress.

---

### AC6 — Interrupted jobs resume without duplicates

**PASS**

The `checkpoint` JSONB column stores per-step state: `Record<stepKey, { done: boolean; offset: number }>`. Step keys cover all 10 processing steps (6 refresh buckets + 4 discovery feeds).

On restart, `execute()` reads the existing checkpoint from the DB row and skips any step where `done: true`. For incomplete steps, pagination resumes from the saved `offset`. Checkpoint is written to the DB after each page.

Upserts use `ON CONFLICT (tmdb_id) DO UPDATE` — re-processing an already-imported title updates metadata without creating duplicates.

Stale lock handling: RUNNING rows older than 2 hours are cleared to FAILED before a new run acquires the lock, preventing hung processes from blocking indefinitely (`catalog-refresh-service.ts:99–111`).

Unit test confirms checkpoint skip behavior (`catalog-refresh-service.test.ts:218–257`).

---

### AC7 — Scheduling can be configured or disabled

**PASS**

All scheduling behavior is env-var driven (`config/env.ts`):

| Variable | Default | Effect |
|---|---|---|
| `CATALOG_REFRESH_ENABLED` | `true` | Disables the scheduler entirely when `false` |
| `CATALOG_REFRESH_CADENCE_HOURS` | `24` | Hours between scheduled runs |
| `CATALOG_REFRESH_UPCOMING_STALE_HOURS` | `12` | Freshness window for upcoming content |
| `CATALOG_REFRESH_RECENT_STALE_DAYS` | `3` | Freshness window for recent content |
| `CATALOG_REFRESH_STABLE_STALE_DAYS` | `30` | Freshness window for stable content |
| `CATALOG_REFRESH_DISCOVERY_MAX_PAGES` | `5` | Max TMDB feed pages per discovery step |

The `POST /catalog-refresh` endpoint allows manual triggering regardless of schedule.

---

## Regressions

None introduced by T066. All changed files are new additions:

```
apps/api/migrations/0032_catalog_refresh.sql
apps/api/src/config/env.ts                         (additive: 17 new lines)
apps/api/src/db/schema/catalog-refresh-runs.ts     (new file)
apps/api/src/db/schema/index.ts                    (additive: 1 export)
apps/api/src/index.ts                              (additive: service wiring)
apps/api/src/routes/catalog-refresh.ts             (new file)
apps/api/src/services/catalog-refresh-service.ts   (new file)
apps/api/src/services/scheduler-service.ts         (additive: catalogRefreshTimer)
apps/api/src/services/__tests__/catalog-refresh-service.test.ts (new file)
```

---

## Observations (non-blocking)

1. **Series `recent` bucket is always empty**: `classifySeriesBucket` only returns `upcoming` or `stable`. The `fetchStaleSeries('recent', ...)` query path exists but will never match any series in practice. The bucket processing completes immediately (no entities returned) — no functional impact, just dead code.

2. **Status endpoint returns most recent run, not most recent completed run**: If a run is currently RUNNING, the status endpoint returns the in-progress run. This is correct for monitoring (live progress is visible), but callers expecting only completed data should filter on `status`.

3. **`xmax = 0` new-row detection**: PostgreSQL-specific trick used to count genuinely inserted vs updated rows. Correct and idiomatic for PostgreSQL, though not portable. Acceptable for this codebase.

---

## Verdict

**PASS** — Implementation satisfies all acceptance criteria. No blocking issues found.
