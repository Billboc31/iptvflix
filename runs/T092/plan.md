Now I have a complete picture. Let me write the plan.

## Objective

Connect episode-level availability data to the episode playback UX so that each episode card shows its own playable sources, lets the user pick among variants, and launches playback with the correct per-episode stream. The infrastructure (DB schema, API endpoint, playback resolver, progress tracking, next-episode navigation) is already in place; what is missing is (a) episode artwork surfaced in the response and card, and (b) a compact per-episode variant selector in `EpisodeCard` that replaces the current series-level `AvailabilityPanel` for series detail pages.

## Included

### 1 – Diagnose Xtream→episode availability mapping (backend investigation)

- `apps/api/src/services/catalog-sync-service.ts` (lines ~1044–1135): trace the episode loop that calls `resolveEpisodeCanonical` and inserts into `episodeAvailabilities`. Verify the data is actually reaching the DB for a real series (run `SELECT count(*) FROM episode_availabilities`).
- `apps/api/src/services/canonical-resolver.ts` (`resolveEpisodeCanonical`): confirm season/episode number matching is reliable for Xtream episode records.
- If mapping fails: fix the join condition or episode-number normalisation in `resolveEpisodeCanonical` / the sync loop. No schema change; only service logic.

### 2 – Expose episode poster in API response

- `packages/api-contracts/src/catalog.ts`: add `posterUrl: string | null` to `EpisodeResponse`.
- `apps/api/src/routes/catalog.ts` (`GET /series/:id/seasons/:seasonNumber/episodes`, ~line 399): include `episodes.posterPath` in the episode select, compute `posterUrl` with `resolveMediaImageUrl(posterPath)` (same helper already used for series/movies), and include it in the returned `EpisodeResponse` map (~line 471).

### 3 – Per-episode variant selector in EpisodeCard

- `apps/web/src/components/detail/EpisodeCard.tsx`:
  - Add local state `pickedVariantId: string | null`, initialised from `episode.selectedVariantId`.
  - Compute `availableVariants = episode.variants.filter(v => v.status === 'AVAILABLE')`.
  - When `availableVariants.length > 1`: render a compact `<select>` (or button-group) in the episode info section using `formatVariantLabel(v, availableVariants)` from `apps/web/src/lib/variant-label.ts` (already used in `AvailabilityPanel`).
  - Replace the hardcoded `episode.selectedVariantId` in the play-button `onClick` and in `DevicePickerModal` with `pickedVariantId ?? episode.selectedVariantId`.
  - Display episode poster: if `episode.posterUrl` is non-null, render it as an `<img>` in the still-image slot instead of the current `🎬` placeholder.
- Props type does not change; `EpisodeResponse` gains `posterUrl` (step 2).

### 4 – Remove series-level AvailabilityPanel from SeriesDetailPage

- `apps/web/src/pages/SeriesDetailPage.tsx` (~lines 201–205): remove (or hide behind a feature flag / comment) the `<AvailabilityPanel>` block that currently shows series-level variants. Source selection is now handled per-episode in step 3.
  - Keep `selectedVariantId` state and any code paths still needed for the TV cast flow if it relies on a series-level variant; otherwise remove entirely.

### 5 – No-op verification of next-episode availability (already correct)

- `apps/web/src/pages/PlayerPage.tsx` line 91 already uses `nextEpisode.selectedVariantId`, not the current episode's availabilityId — no change required. Document in the PR.

## Excluded

- Artwork for season posters or series backdrop (not an episode-level field).
- Progress UI progress bar on episode cards (separate ticket).
- Subtitle / audio language preference persistence (already handled in player; no change needed here).
- Introduction of a new AvailabilityPanel variant or shared component (reuse `formatVariantLabel` inline in EpisodeCard — no new abstraction).
- Adding `variants` to `SeasonSummary` (not needed: episode variants come from the episodes endpoint, not the series detail endpoint).
- Any schema migration (no new tables or columns; `posterUrl` is computed from the existing `posterPath` column in `episodes`).
- M3U provider episode sync (only Xtream in scope for this ticket per the investigation target).

## Acceptance criteria

1. `SELECT count(*) FROM episode_availabilities` returns > 0 rows for a series that has Xtream streams; if it was 0 before, the fix in step 1 must be identified and committed.
2. `GET /series/:id/seasons/:n/episodes` returns `posterUrl` (non-null for episodes that have TMDB artwork) in each episode object.
3. An episode card with `availabilityCount > 1` renders a source-selector `<select>` or equivalent; choosing a different source changes the `availabilityId` passed to the player URL.
4. An episode card with `availabilityCount === 0` shows no play button and displays "Indisponible".
5. Clicking "▶ Lire" on two distinct episodes of a series navigates to `/player/episode/{correct-episode-id}` and each opens its own stream (manually verified in browser with network tab).
6. After watching ≥ 5 % of an episode, the progress row in `viewing_progress` has `media_type = 'EPISODE'` and the correct `media_id`.
7. The player's "next episode" button navigates to the next episode using its own `selectedVariantId` (already correct; regression test: confirm `availabilityId` in the new URL differs from the previous episode's).
8. No duplicate episode cards appear when the same episode has availabilities from two different providers.
9. TypeScript compiles without errors after adding `posterUrl` to `EpisodeResponse` (`pnpm tsc --noEmit` or equivalent).
