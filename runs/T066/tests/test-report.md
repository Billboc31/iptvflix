I have everything I need to write the test report.

---

## Test Report — T066: Add scheduled refreshes for the canonical catalog

### Test execution

| Suite | Run | Passed | Failed |
|---|---|---|---|
| `catalog-refresh-service.test.ts` | 12 | **12** | 0 |
| Full suite | 710 | 706 | 4 |

The 4 failures are pre-existing `vertical-slice.test.ts` failures (async source-sync timing), confirmed unrelated to this ticket.

---

### Acceptance criteria

**AC1 — Catalog refreshes automatically** `PASS`

`SchedulerService.start()` sets a `catalogRefreshTimer` at `catalogRefreshCadenceHours × 3 600 000 ms` (default 24 h). On each tick, `runCatalogRefreshTick()` checks elapsed time since last completed run and calls `CatalogRefreshService.run()`. Wired in `index.ts:175–180`.

---

**AC2 — Upcoming/recent/airing content stays fresh** `PASS`

`classifyMovieBucket()` routes upcoming-status movies and those released within 60 days to the `upcoming` bucket (stale threshold: `CATALOG_REFRESH_UPCOMING_STALE_HOURS`, default 12 h). `classifySeriesBucket()` routes `In Production`/`Planned` series to `upcoming`. Recent movies (61–90 days) use `CATALOG_REFRESH_RECENT_STALE_DAYS` (default 3 d). Unit tests confirm: a movie enriched 13 h ago (> 12 h threshold) is re-enriched; one enriched 6 h ago is skipped.

---

**AC3 — Stable content is not unnecessarily refreshed every night** `PASS`

Everything outside the upcoming/recent windows falls into the `stable` bucket with a 30-day stale threshold (`CATALOG_REFRESH_STABLE_STALE_DAYS`). Unit tests confirm: enriched 25 d ago → skipped; enriched 35 d ago → refreshed.

---

**AC4 — Newly relevant titles can be imported** `PASS`

Discovery step iterates `upcoming` and `trending` TMDB feeds for both movies and series (4 feeds total, up to `CATALOG_REFRESH_DISCOVERY_MAX_PAGES` pages each). `upsertMovieBatch`/`upsertSeriesBatch` use `onConflictDoUpdate` on `tmdbId`, inserting new rows and counting `created` via `xmax = 0`.

---

**AC5 — Job status/counts/errors/last-run are observable** `PASS`

- `catalog_refresh_runs` table tracks `status`, `startedAt`, `completedAt`, `moviesRefreshed`, `seriesRefreshed`, `moviesImported`, `seriesImported`, `failedCount`, `errorMessage`, `checkpoint`.
- `GET /catalog-refresh/status` returns the latest row ordered by `startedAt desc`.
- `POST /catalog-refresh` returns 202 with `runId` or 409 if already running.
- Both routes are within `protectedScope`.

---

**AC6 — Interrupted jobs resume without duplicates** `PASS`

`execute()` re-reads the `checkpoint` JSONB from the DB at start. Each sub-step has a unique key (e.g., `refresh:MOVIE:upcoming`, `discovery:SERIES:trending`). Steps with `{ done: true }` are skipped immediately (`return` at top of loop). Offset is persisted after every page. Upserts are idempotent via `onConflictDoUpdate`. Unit test confirms: step already marked done in checkpoint is not re-executed.

---

**AC7 — Scheduling can be configured or disabled** `PASS`

`CATALOG_REFRESH_ENABLED=false` prevents the timer branch from executing in `SchedulerService.start()` (`if (this.config.catalogRefreshEnabled ?? true) && ...`). All 6 env vars are present in `env.ts` with documented defaults. `CATALOG_REFRESH_CADENCE_HOURS` controls the interval.

---

### Migration

`migrations/0032_catalog_refresh.sql` creates `catalog_refresh_runs` with all required columns and the partial unique index `WHERE status = 'RUNNING'` to enforce single-concurrency at the DB level.

---

### Minor observations (non-blocking, inherited from review)

- **`classifySeriesBucket` never returns `'recent'`** — the DB query handles the recent window for series independently. No data loss; just untested classification path.
- **Lock is non-atomic** — a simultaneous second `run()` call could get a 500 instead of 409 in a race. Acceptable in single-instance deployment.

---

### Verdict

**IMPLEMENTATION_APPROVED**

All 7 acceptance criteria are satisfied. 12/12 unit tests pass. No regressions introduced in the existing 706-test suite.
