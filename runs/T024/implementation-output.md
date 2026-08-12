**349/349 tests pass.** Here's a summary of all changes:

---

## Files modified

**`apps/api/src/providers/xtream/types.ts`**
- Added `seriesInfo?: Record<number, XtreamSeriesInfo>` to `XtreamCatalogSnapshot`

**`apps/api/src/providers/plex/types.ts`**
- Added `PlexEpisodeItem` interface
- Added `episodes: PlexEpisodeItem[]` to `PlexCatalogSnapshot`

**`apps/api/src/providers/plex/client.ts`**
- Added `fetchEpisodes(sectionKey)` method (calls `/library/sections/{key}/all?type=4`)
- Added `mapEpisodeMetadataItem` helper

**`apps/api/src/services/sync-runs-service.ts`**
- `fetchXtreamSnapshot`: after fetching series, calls `getSeriesInfo` for each in parallel and adds `seriesInfo` to the snapshot
- `fetchPlexSnapshot`: fetches episodes per show section in parallel alongside movies/shows

**`apps/api/src/services/catalog-sync-service.ts`**
- Added `NormalizedEpisodeItem` interface and `episodes?: NormalizedEpisodeItem[]` to `NormalizedSnapshot` (`undefined` = provider has no episode data, skip lifecycle)
- Added `resolveEpisodeId` helper (find-or-create season + episode, race-safe)
- **Replaced** the broken episode section: only runs when `snapshot.episodes !== undefined`; full idempotent lifecycle (firstSeenAt/lastSeenAt/AVAILABLE/UNAVAILABLE/reappearance)
- `syncCatalog` (Xtream): maps `seriesInfo` to `NormalizedEpisodeItem[]` when present
- `syncPlexCatalog`: maps `snapshot.episodes` to `NormalizedEpisodeItem[]`

**`apps/api/src/services/__tests__/catalog-sync-service.test.ts`**
- Added 6 new episode lifecycle tests covering: no-episode snapshot, first sync, idempotency, disappearance, reappearance, multi-source shared canonical episode

**`apps/api/src/__tests__/integration/vertical-slice.test.ts`**
- Added `get_series_info` handler to `happyHandlers()` and the sync2 custom handler (returns valid empty-episodes response to prevent `XtreamParseError`)
