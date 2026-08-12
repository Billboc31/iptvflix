## Objective

Prevent catalog synchronization from falsely marking existing episode availabilities as `UNAVAILABLE` when a provider snapshot carries no episode-level data, and implement the full episode ingestion lifecycle for Xtream (via `getSeriesInfo`) and Plex (via a new episode fetch).

## Included

### 1. `NormalizedSnapshot` — add optional episode collection (`catalog-sync-service.ts`)

- Add `NormalizedEpisodeItem` interface:
  ```
  providerItemId: string          // opaque stream ID (Xtream episode.id / Plex ratingKey)
  seriesProviderItemId: string    // links to parent series in seriesAvailabilities
  seasonNumber: number
  episodeNumber: number
  title?: string | null
  synopsis?: string | null
  durationMinutes?: number | null
  airDate?: Date | null
  rawTitle?: string | null
  audioLanguage?: string | null
  subtitleLanguage?: string | null
  videoQuality?: string | null
  ```
- Add `episodes?: NormalizedEpisodeItem[]` to `NormalizedSnapshot`.  
  `undefined` means the provider does not supply episode data (no lifecycle action).  
  An empty array means the provider returned an authoritative empty episode set.

### 2. Fix episode lifecycle in `syncNormalized` (`catalog-sync-service.ts` lines 364–395)

- **Replace** the current block that unconditionally reads and marks all AVAILABLE episode_availabilities as UNAVAILABLE.
- **When `snapshot.episodes === undefined`**: skip the episode section entirely — no reads, no writes.
- **When `snapshot.episodes` is defined** (authoritative):
  - Before the episode loop, collect `previouslyAvailableEpisodeIds` (by `providerItemId`) for this `sourceId` (same pattern as movies/series).
  - For each `NormalizedEpisodeItem`:
    - Look up `seriesId` from `seriesAvailabilities` (by `sourceId + seriesProviderItemId`); skip item if not found.
    - Find or create the `seasons` row (`seriesId + seasonNumber`), using `onConflictDoNothing`.
    - Find or create the `episodes` row (`seasonId + episodeNumber`), using `onConflictDoNothing`.
    - Upsert `episodeAvailabilities`: if row does not exist → INSERT with `firstSeenAt = lastSeenAt = snapshot.fetchedAt`, `status = AVAILABLE`; if exists → UPDATE `lastSeenAt`, `status = AVAILABLE`, `unavailableAt = null`.
    - Track `providerItemId` in `seenEpisodeProviderItemIds`.
  - After loop, mark `previouslyAvailableEpisodeIds` not in `seenEpisodeProviderItemIds` as `UNAVAILABLE` with `unavailableAt = snapshot.fetchedAt`.
- Extract a private `resolveEpisodeId(tx, ...)` helper mirroring `resolveMovieId`.

### 3. Xtream — add episode data to snapshot

**`apps/api/src/providers/xtream/types.ts`**
- Add `seriesInfo?: Record<number, XtreamSeriesInfo>` to `XtreamCatalogSnapshot` (key = `series_id`).

**`apps/api/src/services/sync-runs-service.ts` — `fetchXtreamSnapshot`**
- After `getSeries()` resolves, fetch `getSeriesInfo(series_id)` for each series in parallel.
- Add results as `seriesInfo: Record<number, XtreamSeriesInfo>` to the returned snapshot.

**`apps/api/src/services/catalog-sync-service.ts` — `syncCatalog`**
- When building the `NormalizedSnapshot`, populate `episodes` by iterating `snapshot.seriesInfo`:
  - For each `(series_id, XtreamSeriesInfo)`, iterate `episodes[seasonNum]` (the `Record<string, XtreamEpisode[]>`).
  - Map each `XtreamEpisode` to `NormalizedEpisodeItem`:
    - `providerItemId` = `episode.id`
    - `seriesProviderItemId` = `series_id.toString()`
    - `seasonNumber` = `parseInt(seasonKey, 10)`
    - `episodeNumber` = `episode.episode_num`
    - `title` = `episode.title`
    - `durationMinutes` from `episode.info.duration_secs` (÷ 60, rounded)
    - `airDate` from `episode.info.releasedate` if parseable
- If `seriesInfo` is absent from snapshot, set `episodes: undefined`.

### 4. Plex — add episode data to snapshot

**`apps/api/src/providers/plex/types.ts`**
- Add `PlexEpisodeItem`:
  ```
  ratingKey: string
  grandparentRatingKey: string   // show ratingKey
  parentIndex: number             // season number
  index: number                   // episode number
  title: string
  summary?: string
  duration?: number               // milliseconds
  originallyAvailableAt?: string  // date string
  ```
- Add `episodes: PlexEpisodeItem[]` to `PlexCatalogSnapshot`.

**`apps/api/src/providers/plex/client.ts`**
- Add `fetchEpisodes(sectionKey: string): Promise<PlexEpisodeItem[]>`:
  - Calls `/library/sections/{sectionKey}/all?type=4`.
  - Maps each metadata item to `PlexEpisodeItem`, extracting `grandparentRatingKey`, `parentIndex`, `index`, `title`, `summary`, `duration`, `originallyAvailableAt`.

**`apps/api/src/services/sync-runs-service.ts` — `fetchPlexSnapshot`**
- For each `showSection`, call `fetchEpisodes(section.key)` in parallel (alongside movies/shows).
- Flatten results into `episodes: PlexEpisodeItem[]` in the returned snapshot.

**`apps/api/src/services/catalog-sync-service.ts` — `syncPlexCatalog`**
- Map `snapshot.episodes` to `NormalizedEpisodeItem[]`:
  - `providerItemId` = `episode.ratingKey`
  - `seriesProviderItemId` = `episode.grandparentRatingKey`
  - `seasonNumber` = `episode.parentIndex`
  - `episodeNumber` = `episode.index`
  - `title` = `episode.title`
  - `synopsis` = `episode.summary`
  - `durationMinutes` from `episode.duration` ms ÷ 60000
  - `airDate` from `episode.originallyAvailableAt`

### 5. Tests (`apps/api/src/services/__tests__/catalog-sync-service.test.ts`)

Add a new `describe('episode availability lifecycle')` block covering:

| Test | Assertion |
|------|-----------|
| Snapshot with `episodes: undefined` | Existing AVAILABLE episode_availabilities remain AVAILABLE |
| First episode snapshot | Episode availability rows created with correct firstSeenAt, lastSeenAt, status=AVAILABLE; canonical season and episode rows created |
| Repeated sync (idempotency) | No duplicates; firstSeenAt unchanged, lastSeenAt updated |
| Episode disappearance | Episode absent from snapshot → status=UNAVAILABLE, unavailableAt=fetchedAt |
| Episode reappearance | Episode returns → status=AVAILABLE, unavailableAt=null, firstSeenAt unchanged |
| Multi-source episode availability | One canonical episode with two independent provider availabilities |

## Excluded

- Episode playback or streaming URLs.
- Episode release notifications or lifecycle events.
- Series detail UI modifications.
- TMDB metadata enrichment at the episode level.
- Performance optimization or batching for large Xtream catalogs (per-series info fetch is sequential-parallel as-is).
- Season-level availability tracking (seasons table has no availability rows; episode counts per season are derived).
- Any schema migration changes — the `episodeAvailabilities`, `seasons`, and `episodes` tables already exist.

## Acceptance criteria

- Syncing a source snapshot with `episodes: undefined` (current behavior for any snapshot without episode data) leaves all existing `episode_availabilities` rows untouched.
- Syncing a snapshot with a fully populated `episodes` array marks observed episodes `AVAILABLE` and absent episodes `UNAVAILABLE`; subsequent syncs with the same set are idempotent.
- `firstSeenAt` is never updated after initial creation; `lastSeenAt` is updated on every sync that includes the episode.
- A disappeared episode (marked `UNAVAILABLE`) that reappears in a later snapshot is restored to `AVAILABLE` with `unavailableAt = null` and original `firstSeenAt` preserved.
- Xtream sync calls `getSeriesInfo` for each series and populates episode availability rows under the canonical `Series → Season → Episode` hierarchy.
- Plex sync calls the new `fetchEpisodes` endpoint for each show library section and maps results through the common episode ingestion path.
- The six new test cases in `catalog-sync-service.test.ts` all pass.
- No existing tests regress.
