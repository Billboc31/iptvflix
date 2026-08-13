## Objective

Add a nightly (configurable) catalog refresh job that re-syncs TMDB metadata for existing canonical entities at frequency appropriate to their content state (upcoming/airing more often, stable content rarely), and imports newly discovered TMDB titles that satisfy catalog inclusion rules. Jobs are tracked in a dedicated DB table, are idempotent and resumable via checkpoints, and expose status through a new API endpoint.

## Included

### Migration & Schema
- `apps/api/migrations/0032_catalog_refresh.sql`: create `catalog_refresh_runs` table with `id`, `status` (PENDING/RUNNING/COMPLETED/FAILED), `startedAt`, `completedAt`, `checkpoint` (JSONB), `moviesRefreshed`, `seriesRefreshed`, `moviesImported`, `seriesImported`, `failedCount`, `errorMessage`. Unique partial index on `status = 'RUNNING'` (same lock pattern as `catalog_bootstrap_runs`).
- `apps/api/src/db/schema/catalog-refresh-runs.ts`: Drizzle schema for the table, typed checkpoint: `Record<string, { done: boolean; offset: number }>`.

### Service
- `apps/api/src/services/catalog-refresh-service.ts`: `CatalogRefreshService` class.
  - `run()`: acquires lock (inserts RUNNING row; throws 409 if one exists), executes steps, marks COMPLETED or FAILED.
  - **Refresh step — bucket segmentation**: query movies and series grouped into three buckets using `status` field and release dates:
    - `upcoming`: `status IN ('Rumored','Planned','In Production','Post Production')` or `theatricalReleaseDate > now() - 60 days` for movies; `status IN ('In Production','Planned')` for series — stale threshold `CATALOG_REFRESH_UPCOMING_STALE_HOURS` (default 12 h).
    - `recent`: released in the last 90 days — stale threshold `CATALOG_REFRESH_RECENT_STALE_DAYS` (default 3 d).
    - `stable`: everything else — stale threshold `CATALOG_REFRESH_STABLE_STALE_DAYS` (default 30 d).
  - Each bucket is processed as a named checkpoint step; page offset stored so interrupted runs resume mid-bucket.
  - Calls `MetadataEnrichmentService.enrichMovie` / `enrichSeries` with the bucket's `staleDays` value; skips entities already within threshold (`'skipped'` result).
  - **Discovery step**: for `upcoming` and `trending` TMDB feeds (movies + series), fetches page 1–`CATALOG_REFRESH_DISCOVERY_MAX_PAGES` (default 5), upserts new canonical entities that are not yet in the DB (re-uses bootstrap upsert helpers or calls `CatalogBootstrapService`'s upsert logic, not the full bootstrap run). Checkpoint tracks last page per feed.
  - Throttles TMDB calls at `ENRICH_THROTTLE_MS` (reuses constant from `metadata-enrichment-service.ts`).
  - Stale lock: clears RUNNING rows older than 2 h before acquiring (same pattern as `catalog-sync-service.ts`).

### Scheduler Integration
- `apps/api/src/services/scheduler-service.ts`:
  - Add `catalogRefreshTimer: ReturnType<typeof setInterval> | null`.
  - Add `catalogRefreshCadenceHours` to `SchedulerConfig`.
  - In `start()`: after startup delay, start timer at `catalogRefreshCadenceHours * 3_600_000` calling `runCatalogRefreshTick()`.
  - `runCatalogRefreshTick()`: check last COMPLETED run's `completedAt`; skip if within cadence; call `CatalogRefreshService.run()`.
  - In `stop()`: clear `catalogRefreshTimer`.

### Environment Config
- `apps/api/src/config/env.ts`: add:
  - `CATALOG_REFRESH_ENABLED` (bool, default `true`)
  - `CATALOG_REFRESH_CADENCE_HOURS` (number, default `24`)
  - `CATALOG_REFRESH_UPCOMING_STALE_HOURS` (number, default `12`)
  - `CATALOG_REFRESH_RECENT_STALE_DAYS` (number, default `3`)
  - `CATALOG_REFRESH_STABLE_STALE_DAYS` (number, default `30`)
  - `CATALOG_REFRESH_DISCOVERY_MAX_PAGES` (number, default `5`)

### Route
- `apps/api/src/routes/catalog-refresh.ts`:
  - `POST /catalog-refresh`: manual trigger; returns 409 if RUNNING, 202 with run `id` otherwise.
  - `GET /catalog-refresh/status`: returns last run (status, counters, `startedAt`, `completedAt`, `errorMessage`).
- `apps/api/src/index.ts`: register the new route and pass `CatalogRefreshService` to `SchedulerService`.

### Tests
- `apps/api/src/__tests__/catalog-refresh-service.test.ts`: unit tests for bucket assignment logic (entity with `status='In Production'` → upcoming bucket; entity enriched 2 h ago → skipped under 12 h threshold; stable entity enriched 35 d ago → refreshed under 30 d threshold). Mock DB and MetadataEnrichmentService.

## Excluded

- Changes to `CatalogBootstrapService` or its routes (initial seed flow is unchanged).
- Changes to source sync cadence or `CatalogSyncService` (Xtream/Plex/M3U → availability).
- Changes to `DiscoveryCandidatePoolService` or `discoveryTimer` (discovery pool for UI remains separate).
- Adding new TMDB fields beyond what `MetadataEnrichmentService` already writes.
- Frontend / web changes.
- Enriching seasons and episodes during refresh (entity-level movies and series only).
- Changing authentication or any unrelated middleware.

## Acceptance criteria

- Migration creates `catalog_refresh_runs` with all specified columns and the partial unique index on `status = 'RUNNING'`.
- `POST /catalog-refresh` returns 409 when a RUNNING run exists, 202 otherwise.
- `GET /catalog-refresh/status` returns the latest run with status, counters, timestamps, and error message.
- Setting `CATALOG_REFRESH_ENABLED=false` prevents the scheduler from starting the catalog refresh timer.
- A movie with `status = 'In Production'` and `metadataEnrichedAt` 13 h ago is re-enriched (12 h threshold exceeded); one enriched 6 h ago is skipped.
- A stable movie enriched 25 d ago is skipped under a 30-day threshold; one enriched 35 d ago is refreshed.
- A TMDB title not yet in the DB appears in the catalog after a discovery step.
- Interrupting a run mid-bucket and re-running resumes from the saved checkpoint without creating duplicate rows.
- No existing test suite for bootstrap, sync, or source routes regresses.
