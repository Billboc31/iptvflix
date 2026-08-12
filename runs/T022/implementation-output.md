All tests pass. Here's a summary of the implementation:

---

## Changes made

### `packages/api-contracts/src/catalog.ts`
- `SeasonSummary`: added `availableEpisodeCount: number`
- `EpisodeResponse`: added `watchState: 'unwatched' | 'in_progress' | 'watched' | null`

### `apps/api/src/routes/catalog.ts`
- Imported `viewingProgress` schema
- Added `computeWatchState()` helper (thresholds: <0.05 → unwatched, 0.05–0.90 → in_progress, ≥0.90 → watched)
- `GET /series/:id`: added 6th parallel query counting distinct episodes per season with an AVAILABLE episodeAvailability; maps result into `availableEpisodeCount` on each `SeasonSummary`
- `GET /series/:id/seasons/:seasonNumber/episodes`: accepts optional `profileId` query param (UUID-validated); when provided, fetches `viewingProgress` in the same `Promise.all` batch and computes `watchState` per episode

### `apps/api/src/routes/catalog.test.ts`
- Fixed existing `GET /series/:id` test to add the 6th mock call
- Added: `availableEpisodeCount` aggregation test (S1=2, S2=0)
- Added: `watchState null` when no profileId
- Added: correct `watchState` per episode (`watched`/`in_progress`/`unwatched`) when profileId provided
- Added: multi-source episode appears exactly once with both variants
- Added: UNAVAILABLE episode shows `availabilityStatus: 'UNAVAILABLE'`

### `apps/web/src/lib/api.ts`
- `getSeriesSeasonEpisodes`: accepts optional `profileId` and appends `?profileId=...` when provided

### `apps/web/src/pages/SeriesDetailPage.tsx`
- Added `DEFAULT_PROFILE_ID` constant; passes it to `SeasonAccordion`

### `apps/web/src/components/detail/SeasonAccordion.tsx`
- Added `profileId?` prop; passed to `getSeriesSeasonEpisodes`
- Season header now shows `"X / Y disponible(s)"` fraction (hidden when `episodeCount === 0`)

### `apps/web/src/components/detail/EpisodeRow.tsx`
- UNAVAILABLE episodes get `opacity-50` on the container
- `watchState: 'watched'` → `✓ Vu` indicator (`aria-label="Vu"`)
- `watchState: 'in_progress'` → `◑ En cours` indicator (`aria-label="En cours"`)
- `null`/`'unwatched'` → no indicator

### `apps/web/src/test/handlers.ts`
- `MOCK_SERIES.seasons`: added `availableEpisodeCount` to each season
- `MOCK_EPISODES`: added `watchState` to each episode

### New: `apps/web/src/components/detail/SeasonAccordion.test.tsx`
6 tests: empty seasons fallback, fraction display (2/5, 0/4), no fraction when 0 episodes, plural/singular

### New: `apps/web/src/components/detail/EpisodeRow.test.tsx`
7 tests: title/badge, watched/in_progress/null/unwatched indicators, unavailable style, null title fallback
