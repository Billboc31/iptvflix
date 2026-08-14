# Plan — T074: Populate canonical TV seasons and episodes from TMDB

## Objective

Extend the TMDB enrichment pipeline so that every canonical Series can have its Season/Episode hierarchy created from TMDB data alone, without requiring any Xtream/Plex source import first. This satisfies the TMDB-first catalog invariant and unblocks the immersive Series detail UI (#150) for source-free browsing.

## Included

### 1. `apps/api/src/services/metadata-enrichment-service.ts` — Upsert seasons and episodes (core fix)

**`enrichSeries()` — season upsert (currently lines 245–253)**

Currently updates existing seasons only. Change to upsert using `INSERT ... ON CONFLICT (seriesId, seasonNumber) DO UPDATE SET`:
- Fields to insert/update: `tmdbId`, `title` (from TMDB `name`), `synopsis` (from `overview`), `posterPath`, `episodeCount`, `airYear` (from `air_date`)
- Season 0 / specials: no filter on `seasonNumber` — handle like any other season
- Source: `metadata.seasons` already returned by `provider.getSeriesMetadata()` (existing call)

**`enrichSeriesSeasons()` — episode upsert (currently lines 264–341)**

Currently skips episodes that do not exist in the DB (`counters.skipped++` at line 316). Change to upsert using `INSERT ... ON CONFLICT (seasonId, episodeNumber) DO UPDATE SET`:
- Fields to insert/update: `tmdbId`, `title`, `synopsis`, `airDate`, `durationMinutes`, `posterPath`, `voteAverage`, `voteCount`
- `episodeAvailabilities` table is separate — upsert on the canonical `episodes` row does not touch it; source availability links are preserved
- Watch state / progress live in a separate watch-state table — also untouched by this upsert
- Seasons fetched from DB before the per-season loop already exist after the season upsert above; loop is unchanged

These two changes are the minimal core fix. All existing flows that call `enrichSeries()` — refresh buckets, import-by-TMDB-ID, on-demand trigger — automatically gain the ability to create hierarchy.

### 2. `apps/api/src/services/catalog-bootstrap-service.ts` — Tiered hierarchy hydration strategy

After each series upsert batch:
- **Priority tier** — top N series by `popularity` (configurable via env `CATALOG_BOOTSTRAP_HIERARCHY_PRIORITY_COUNT`, default 200): call `enrichmentService.enrichSeries()` for each immediately
- Apply concurrency control: process in small batches (e.g. 5 concurrent) with 500 ms delay between batches to stay within TMDB rate limits; reuse existing provider retry/backoff
- **Remaining tier** — leave for the refresh scheduler (first cycle picks them up via `metadataEnrichedAt IS NULL`)
- Track per-series hydration success/failure in the existing `catalogBootstrapRuns` checkpoint structure; log counts (created seasons, created episodes, errors)

Document the strategy as a comment in the function so the rationale is discoverable.

### 3. `apps/api/src/services/catalog-refresh-service.ts` — No structural change needed

The existing `runRefreshBucket()` flow already calls `enrichSeries()` per series. With the upsert fix in step 1, this automatically creates hierarchy for shows that have none. No code change required here beyond verifying the flow is exercised correctly in tests.

Differentiated cadence for hierarchy is already covered by existing refresh buckets:
- In-production/upcoming shows: "upcoming" bucket with 1-hour cadence — hierarchy is refreshed each cycle, picking up new seasons/episodes
- Stable shows: tied to normal `metadataEnrichedAt` staleness threshold (30 days)

### 4. `apps/api/src/routes/catalog.ts` — On-demand hydration trigger

In `GET /series/:id` (lines 191–329), after fetching `seasonRows`:
- If `seasonRows.length === 0` AND `series.tmdbId` is set AND enrichment is not already running:
  - Fire `enrichmentService.enrichSeries(series.id)` as fire-and-forget (no `await`)
  - Return current state immediately (`seasons: []`) with a response header `X-Hierarchy-Hydrating: true` so the client can handle the empty state gracefully
  - Log the trigger at INFO level for observability
- On subsequent requests (after hydration completes in the background), `seasonRows` will be populated

### 5. Tests

New test cases to add (location: alongside existing service tests):

- `enrichSeriesSeasons()` creates seasons and episodes for a series that has none (source-free)
- `enrichSeries()` upserts seasons when the seasons table has no rows for the series
- Repeated `enrichSeries()` on the same series produces identical DB state — no duplicate rows in `seasons` or `episodes`
- Refresh does not overwrite `episodeAvailabilities` rows or delete watch-state records
- `GET /series/:id` fires async hydration when `seasons` is empty and `tmdbId` is set
- Bootstrap priority-tier processing calls `enrichSeries()` for the top-N shows and logs correct counts

## Excluded

- Frontend/UI changes — handled in #150
- New database migrations — existing schema fields (`tmdbId`, `posterPath`, `episodeCount`, `airYear` on seasons; `tmdbId`, `posterPath`, `voteAverage`, `voteCount` on episodes) are sufficient
- Season-level availability tracking (no `seasonAvailabilities` table)
- M3U source episode attachment changes
- Multi-language localization beyond current French behavior
- Xtream/Plex sync restructuring — existing canonical-resolver contract is already correct; only enrichment is the write path for canonical hierarchy
- Admin/manual hydration endpoints
- Image binary storage

## Acceptance criteria

- A TMDB-imported Series with zero sources returns non-empty `seasons[]` through `GET /series/:id` after `enrichSeries()` runs
- `GET /series/:id/seasons/:n/episodes` returns non-empty episodes for a source-free series after enrichment
- `enrichSeries()` called twice on the same series produces no duplicate rows in `seasons` or `episodes`
- `episodeAvailabilities` rows and watch-state records are identical before and after a repeat hydration run
- Bootstrap logs confirm priority-tier series received season+episode hydration, with counts for created/updated/failed
- `GET /series/:id` response includes `X-Hierarchy-Hydrating: true` when hierarchy was absent and async hydration was triggered
- In-production shows acquire newly announced TMDB seasons/episodes on the next refresh cycle (upcoming bucket, 1-hour cadence)
- Season 0 / specials are upserted without errors
- TMDB rate-limit errors during bootstrap priority hydration are retried with backoff and do not abort the batch
- Automated tests listed in § 5 pass
