Test report written. Here's the verdict:

---

## T066 — Test Report: **PASS**

All 7 acceptance criteria are satisfied.

| Criterion | Status |
|---|---|
| Catalog refreshes automatically | **PASS** — `SchedulerService` fires `runCatalogRefreshTick()` on startup and on cadence interval |
| Upcoming/recent/airing content stays fresh | **PASS** — 12h stale threshold for upcoming, 3d for recent, enforced via `metadataEnrichedAt` |
| Stable content not unnecessarily refreshed | **PASS** — 30-day stale threshold; stable entities skip enrichment until threshold passed |
| Newly relevant titles can be imported | **PASS** — Discovery via TMDB `upcoming`/`trending` feeds (up to 5 pages), upserted idempotently |
| Job status/counts/errors/last-run are observable | **PASS** — `GET /catalog-refresh/status` exposes full run record; `POST /catalog-refresh` returns 202/409 |
| Interrupted jobs resume without duplicates | **PASS** — JSONB checkpoint per step with `done`/`offset`; upserts on `tmdb_id` conflict |
| Scheduling can be configured or disabled | **PASS** — Fully env-var driven (`CATALOG_REFRESH_ENABLED`, cadence hours, stale thresholds) |

**Test suite**: 706 pass / 4 fail. The 4 failures are pre-existing regressions in `vertical-slice.test.ts` from a prior ticket (async sync endpoint change) — confirmed not introduced by T066.

**Minor observations** (non-blocking):
- Series `recent` bucket query path is dead code (series only ever classify as `upcoming` or `stable`)
- Status endpoint returns the most recent run (including in-progress), which is correct for live monitoring
