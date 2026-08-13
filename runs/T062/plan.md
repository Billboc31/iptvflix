## Objective

Fill the specific gaps between what the Xtream API exposes and what the sync, enrichment,
and backfill services persist, so that matched Series gain canonical Season and Episode
records, episode Availabilities carry full variant metadata, and already-synced Series
can be backfilled without recreating their source records.

The schema, Xtream client, sync lifecycle, catalog routes, playback resolver and frontend
components are already in place. The changes below are surgical fills.

---

## Included

### 1. Schema — add `container_extension` to `episode_availabilities`

**Why**: `XtreamEpisode.container_extension` is used by `buildXtreamStreamUrl()` as the
URL file extension. Without storing it, playback always defaults to `.ts` regardless of
actual container format.

- New migration SQL: `ALTER TABLE episode_availabilities ADD COLUMN container_extension text;`
- `apps/api/src/db/schema/availabilities.ts`: add `containerExtension: text('container_extension')`
  to `episodeAvailabilities` (nullable, no default).

### 2. Episode sync — propagate variant metadata through the ingestion chain

All changes in `apps/api/src/services/catalog-sync-service.ts`.

**`NormalizedEpisodeItem` interface** (line 73): add optional fields
`rawTitle`, `audioLanguage`, `subtitleLanguage`, `videoQuality`, `containerExtension`.

**`syncCatalog()`** (line 1071): populate the new fields from each `XtreamEpisode`:
- `rawTitle` ← `ep.title`
- `containerExtension` ← `ep.container_extension`
- `audioLanguage`, `subtitleLanguage`, `videoQuality` ← `normalizeTitle(ep.title).variantAttributes`

**`resolveEpisodeId()`** (line 312): accept an extra optional argument
`meta: { title?, synopsis?, durationMinutes?, airDate? }`. When the episode row already
exists, UPDATE the canonical fields that are non-null in `meta` (title, synopsis,
durationMinutes, airDate). This lets subsequent syncs keep canonical metadata fresh
without recreating episode identity.

**`syncNormalized()` episode INSERT** (around line 930): pass all variant fields
(`rawTitle`, `audioLanguage`, `subtitleLanguage`, `videoQuality`, `containerExtension`)
when inserting a new `episodeAvailabilities` row.

**`syncNormalized()` episode UPDATE** (around line 957): also update variant fields
on the existing row when the same provider item is re-seen in a later sync.

### 3. TMDB season/episode enrichment

**`apps/api/src/providers/metadata/types.ts`**:
- Add interface `ExternalSeasonEpisode`:
  `{ episodeNumber: number; title: string | null; synopsis: string | null; airDate: string | null; runtimeMinutes: number | null; stillPath: string | null }`
- Add `getSeasonEpisodes(tmdbSeriesId: number, seasonNumber: number): Promise<ExternalSeasonEpisode[]>`
  to `MetadataProvider`.
- Add a stub returning `[]` to `NoopMetadataProvider`.

**`apps/api/src/providers/metadata/tmdb/types.ts`**:
- Add `TmdbSeasonEpisode` type (fields: `episode_number`, `name`, `overview`,
  `air_date`, `runtime`, `still_path`).
- Add `TmdbSeasonResponse` type (`{ episodes: TmdbSeasonEpisode[] }`).

**`apps/api/src/providers/metadata/tmdb/client.ts`**:
- Implement `getSeasonEpisodes(tmdbSeriesId, seasonNumber)` using
  `GET /tv/{series_id}/season/{season_number}`.

**`apps/api/src/services/metadata-enrichment-service.ts`**:
- Add `enrichSeriesSeasons(seriesId: string, opts?): Promise<{ episodes: EnrichmentCounters }>` method:
  1. Fetch `series.tmdbId`; return early with `no-tmdb-id` result if null.
  2. Fetch all `seasons` rows for the series from DB.
  3. For each season, call `provider.getSeasonEpisodes(tmdbId, seasonNumber)` with
     `ENRICH_THROTTLE_MS` between calls.
  4. For each TMDB episode response, UPDATE the matching DB episode row
     (`title`, `synopsis`, `airDate`, `durationMinutes`) **only if the episode row
     already exists** — never INSERT new episodes that have no Xtream Availability.
  5. Optionally update `seasons.title` and `seasons.airYear` from TMDB season data.
- Call `enrichSeriesSeasons()` from within `enrichSeries()` after Series-level fields
  are persisted; failures are caught and logged, not re-thrown.

### 4. Episode backfill service

**New `apps/api/src/services/episode-backfill-service.ts`**:

```
EpisodeBackfillService(sourceService: { getXtreamSources(): Source[] })
  backfill(opts?: { force?: boolean, concurrency?: number }): Promise<BackfillResult>
```

- `backfill()` iterates all XTREAM sources from the DB.
- For each source, fetches MATCHED series with an XTREAM `seriesAvailability` for that
  source. When `force` is false (default), filters to series with zero existing seasons.
  When `force` is true, processes all MATCHED series.
- For each (source, series, providerSeriesId) tuple: calls
  `XtreamCodesClient.getSeriesInfo(providerSeriesId)` under `withBoundedConcurrency`
  bounded by `XTREAM_SERIES_CONCURRENCY` (default 5).
- On success: builds a minimal `NormalizedSnapshot` carrying only the episodes for that
  series (empty `movies` and `series` arrays, `episodes` populated) and feeds it through
  the existing `syncNormalized()` episode path using the source's existing run lock
  (or a standalone lock).
- On failure per series: logs a warning, records the providerSeriesId in
  `failedSeriesProviderIds`, and continues — does not abort other series.
- Returns `{ processed: number, succeeded: number, failed: number }`.

**`apps/api/src/routes/reconcile.ts`**: add `POST /admin/episode-backfill` endpoint:
- Accepts optional body `{ force?: boolean }`.
- Calls `EpisodeBackfillService.backfill(body)` as fire-and-forget.
- Returns HTTP 202 immediately.
- Adds `GET /admin/episode-backfill/latest` to report the last backfill result
  (stored in memory or a simple DB row if persistence is needed; a single shared
  in-memory state object is acceptable for V1).

### 5. Tests

**`apps/api/src/services/__tests__/catalog-sync-service.test.ts`** — add:
- Episode variant field propagation: after `syncCatalog()` with a series info payload,
  `episode_availabilities` row has correct `rawTitle`, `audioLanguage`, `videoQuality`,
  `containerExtension`.
- Multi-variant convergence: two Xtream streams mapped to the same S01E03 (same
  `seasonNumber`/`episodeNumber`, different `providerItemId`) produce one `episodes` row
  and two `episodeAvailabilities` rows.
- Idempotency: re-running `syncCatalog()` with identical data does not increment row
  counts for seasons, episodes, or availabilities.
- Failed-series protection: episodes belonging to a series whose `getSeriesInfo()` failed
  (recorded in `failedSeriesProviderIds`) are not marked UNAVAILABLE.
- Newly-added episode: appears with `status = 'AVAILABLE'` after a subsequent sync that
  includes it.

**`apps/api/src/services/__tests__/metadata-enrichment-service.test.ts`** — add:
- `enrichSeriesSeasons()` upserts `title`, `synopsis`, `airDate` from TMDB onto
  existing episode rows.
- `enrichSeriesSeasons()` does not INSERT a new episode row for a TMDB episode that has
  no corresponding row in the `episodes` table.
- `enrichSeriesSeasons()` returns early with `no-tmdb-id` when `series.tmdbId` is null.

**New `apps/api/src/services/__tests__/episode-backfill-service.test.ts`**:
- MATCHED series with zero seasons are picked up and their episodes ingested.
- Series that already have seasons are skipped when `force` is false.
- A `getSeriesInfo()` failure for one series does not prevent other series from being
  processed.

---

## Excluded

- Title-matching algorithm changes (scope of T060/T061).
- Adding `stillPath`/`thumbnailPath` column to `episodes`; the schema stores what is
  available today.
- Creating TMDB-only Episode rows that have no Xtream Availability (TMDB is enrichment,
  not the source of availability).
- Viewing-progress schema extension for `EPISODE` media type; episode identity stability
  via `(seasonId, episodeNumber)` uniqueness already preserves any future progress rows.
- Autoplay, skip-intro, or never-stop sequencing.
- Browser codec compatibility fixes.
- New UI components — `SeasonAccordion` and `EpisodeRow` already render correctly when
  data exists; `GET /series/:id` and `GET /series/:id/seasons/:seasonNumber/episodes`
  already return the correct response shape.
- Playback resolver changes — already supports `mediaType: 'episode'` with
  `providerItemId` + `containerExtension`.

---

## Acceptance criteria

- After a sync with `XTREAM_FETCH_SERIES_INFO=true`, a matched Series has `seasons` and
  `episodes` rows; each episode has at least one `episodeAvailabilities` row carrying
  non-null `rawTitle`, `audioLanguage`, `videoQuality`, and `containerExtension`.
- Re-running the sync with identical provider data produces zero new rows (idempotency).
- `POST /admin/episode-backfill` creates Season and Episode records for already-matched
  Series that had zero seasons, without touching or deleting existing
  `seriesAvailabilities` rows.
- `enrichSeriesSeasons()` updates `episodes.title` / `episodes.airDate` from TMDB;
  does not create any episode row that lacks an `episodeAvailabilities` counterpart.
- `GET /series/:id` returns a non-empty `seasons[]` array for a series with ingested
  episodes.
- `GET /series/:id/seasons/:seasonNumber/episodes` returns episode rows with
  `availabilityStatus: 'AVAILABLE'` and a non-empty `variants[]` for each episode with
  an available Availability.
- The web Series detail page renders the Season accordion with real episode data for an
  ingested series and does not show "Les saisons ne sont pas encore disponibles".
- `POST /playback` with `{ mediaType: 'episode', mediaId: <episodeUUID> }` resolves to
  a playable Xtream URL constructed from the stored `providerItemId` and
  `containerExtension`.
- TMDB-only episodes (known to TMDB but absent from Xtream) have no
  `episodeAvailabilities` row and are never returned as `availabilityStatus: 'AVAILABLE'`.
- A `getSeriesInfo()` fetch failure for one Series does not mark its existing
  `episodeAvailabilities` rows as `UNAVAILABLE` and does not abort backfill of other
  Series.
- All new automated tests pass; existing test suite remains green.
