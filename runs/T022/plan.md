## Objective

Extend the Series detail API and UI to surface unified Season/Episode availability counts and per-episode watch state, so one canonical page shows all known seasons and episodes with their source coverage and viewing progress — without duplicating episode rows per provider.

## Included

### 1. API contract — `packages/api-contracts/src/catalog.ts`

- `SeasonSummary`: add `availableEpisodeCount: number` — count of episodes in the season that have at least one `AVAILABLE` `episodeAvailability`.
- `EpisodeResponse`: add `watchState: 'unwatched' | 'in_progress' | 'watched' | null` — `null` when no `profileId` is supplied.

### 2. Backend — series detail endpoint (`apps/api/src/routes/catalog.ts` + `catalog-service.ts`)

- In `GET /series/:id`: extend the seasons query to also count available episodes per season (one additional grouped sub-select on `episodeAvailabilities` joining by `episodes.seasonId` where `status = 'AVAILABLE'`). Map into `availableEpisodeCount` on each `SeasonSummary`.
- In `GET /series/:id/seasons/:seasonNumber/episodes`:
  - Accept an optional `profileId` query parameter (UUID string, validated with Zod).
  - When `profileId` is provided: join (or query in parallel) `viewingProgress` where `mediaType = 'EPISODE'` and `mediaId IN (episode ids)`. Compute `watchState` per episode using existing thresholds (`< 0.05` → `'unwatched'`, `0.05–0.90` → `'in_progress'`, `≥ 0.90` → `'watched'`).
  - When `profileId` is absent: set `watchState: null` on all episodes.

### 3. Backend tests — `apps/api/src/routes/catalog.test.ts`

New test cases using the existing Drizzle mock-chain pattern:

- `GET /series/:id` with a series having 2 seasons: S1 has 3 episodes (2 available), S2 has 4 episodes (0 available) → `seasons[0].availableEpisodeCount = 2`, `seasons[1].availableEpisodeCount = 0`.
- `GET /series/:id/seasons/1/episodes` without `profileId` → all `watchState: null`.
- `GET /series/:id/seasons/1/episodes?profileId=<uuid>` with mixed progress records → correct `watchState` values (`'watched'`, `'in_progress'`, `'unwatched'`).
- Episode with multiple AVAILABLE variants from different providers → appears once in the response with `variants.length > 1`.
- Episode with `status = 'UNAVAILABLE'` on all variants → `availabilityStatus: 'UNAVAILABLE'`, `watchState: null` (or whatever progress says).

### 4. Frontend API client — `apps/web/src/lib/api.ts`

- Update `getSeriesSeasonEpisodes(seriesId, seasonNumber, profileId?: string)` to append `?profileId=<profileId>` when provided.

### 5. Frontend — `apps/web/src/pages/SeriesDetailPage.tsx`

- Retrieve the active profile ID from the existing profile context (however profiles are currently surfaced in the web app).
- Pass `profileId` to `getSeriesSeasonEpisodes` calls.

### 6. Frontend — `apps/web/src/components/detail/SeasonAccordion.tsx`

- Display `availableEpisodeCount / episodeCount` per season header (e.g., `"3 / 5 episodes available"`).
- When `availableEpisodeCount === 0`: show `"0 / N episodes available"` (not hidden — absence is meaningful).
- When `episodeCount === 0`: show nothing (season has no known episodes yet).

### 7. Frontend — `apps/web/src/components/detail/EpisodeRow.tsx`

- Show a watch-state indicator:
  - `'watched'` → checkmark icon.
  - `'in_progress'` → progress bar or partial-fill icon.
  - `'unwatched'` or `null` → neutral (no badge).
- Distinguish availability states visually:
  - At least one `AVAILABLE` variant → normal appearance.
  - `availabilityStatus = 'UNAVAILABLE'` (episode known, no available source) → muted/greyed style, "Unavailable" label.
  - Episodes rendered by this component always exist in the DB; "unknown metadata" episodes are not rendered (they are not in the episode list response).

### 8. Frontend tests

- `SeasonAccordion`: add cases for `availableEpisodeCount = 2 / episodeCount = 5` displaying the correct fraction, and `availableEpisodeCount = 0` displaying `"0 / N"`.
- `EpisodeRow`: add cases for each `watchState` value and for `availabilityStatus = 'UNAVAILABLE'`.

## Excluded

- Video player integration.
- Episode release notifications or download triggers.
- Showing episodes that exist only in a provider but not in the canonical episodes table (metadata matching engine changes are excluded).
- Surfacing series-level `seriesAvailability` entries as fallback episode availability — only `episodeAvailabilities` drive per-episode status.
- Modifying the availability resolver logic (`availability-resolver.ts`) — reused as-is.
- Any change to the `viewingProgress` write path (`PUT /progress/:mediaType/:mediaId`).
- Multi-profile switching UI.
- "Next episode" badge or auto-play queue (watch-state display only, no navigation logic).

## Acceptance criteria

- `GET /series/:id` returns each `SeasonSummary` with `availableEpisodeCount` equal to the count of distinct episodes in that season that have at least one `AVAILABLE` `episodeAvailability`.
- `GET /series/:id/seasons/:seasonNumber/episodes` without `profileId` returns all episodes with `watchState: null`.
- `GET /series/:id/seasons/:seasonNumber/episodes?profileId=<uuid>` returns each episode with the correct `watchState` (`'watched'`, `'in_progress'`, or `'unwatched'`) derived from existing `viewingProgress` rows using the `< 0.05 / 0.05–0.90 / ≥ 0.90` thresholds.
- An episode with two `AVAILABLE` `episodeAvailabilities` from different providers appears exactly once in the episode list, with both variants in its `variants` array.
- The Season header in the UI shows `"X / Y episodes available"` where X is `availableEpisodeCount` and Y is `episodeCount`.
- An episode with `availabilityStatus = 'UNAVAILABLE'` is visually distinguishable from an available episode in `EpisodeRow`.
- `EpisodeRow` renders a watch-state indicator that correctly reflects `'watched'`, `'in_progress'`, and `'unwatched'` states.
- New API test cases pass (available-count aggregation, profileId-scoped watch state, multi-source variants, unavailable episode).
- New frontend component tests pass for `SeasonAccordion` (availability fraction) and `EpisodeRow` (watch state, unavailability).
- TypeScript compilation passes across `packages/api-contracts`, `apps/api`, and `apps/web` with no new type errors.
