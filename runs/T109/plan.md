## Objective

Validate and complete the end-to-end series episode playback chain (Series → Season → Episode → Availability → Playback), fix any breaks discovered during investigation, and add regression tests that guard the episode availability lookup and playback resolution path.

## Included

### 1. Investigation — trace the real data path

The architecture is structurally in place. The investigation must verify the chain holds with real imported data before assuming it is correct.

**`apps/api/src/services/catalog-sync-service.ts` (lines 1278–1307):**
- Confirm Xtream `snapshot.seriesInfo` is populated (the Xtream client actually fetches per-series episode data).
- Confirm `resolveEpisodeId()` creates canonical `Episode` rows with correct `(seriesId, seasonId, episodeNumber)` linkage.
- Confirm `episodeAvailabilities` rows have `episodeId` pointing to the canonical episode UUID, not a series or season ID.
- Confirm `containerExtension` is set on episode availability rows (already mapped at line 1295).

**`apps/api/src/routes/catalog.ts` (line 440):**
- Confirm `leftJoin(sources, eq(sql\`${sources.id}::text\`, episodeAvailabilities.providerId))` resolves correctly; `sources.id` is UUID, `providerId` is varchar — the cast must work, otherwise `sourceDisplayName` is silently null and variant labels fall back.

**Playback resolver — episode path:**
- Confirm `POST /playback/resolve/episode/:episodeId` calls `fetchAvailabilities('episode', episodeId)` → queries `episodeAvailabilities` by `episodeId` (confirmed at `playback-resolver.ts:80`).
- Confirm `startPositionSeconds` is returned from viewing progress keyed on `(profileId, 'EPISODE', episodeId)`.

**UI chain:**
- Confirm `EpisodeCard` passes correct `episodeId` and `availabilityId` to `/player/episode/:mediaId`.
- Confirm `PlayerPage` receives `mediaType='episode'` from the route param and resolves playback correctly.
- Confirm `useProgressSync` writes progress to `PUT /progress/EPISODE/:episodeId`, not to the parent series.

### 2. Fix breaks found during investigation

Depending on findings, fix in these files (changes bounded to the identified issue):

- `apps/api/src/services/catalog-sync-service.ts` — if episode attachment is silently failing for any provider.
- `apps/api/src/routes/catalog.ts` — if the `sources` UUID join is not returning `sourceDisplayName`.
- `apps/api/src/providers/xtream/client.ts` — if `seriesInfo` is not fetched or mapped.
- `apps/web/src/components/detail/EpisodeCard.tsx` — if play navigation or progress display is incorrect.
- `apps/web/src/pages/PlayerPage.tsx` — if episode resume or progress flush is broken.

### 3. Regression tests

**`apps/api/src/__tests__/integration/vertical-slice.test.ts`:**
- Add a series → episode availability → episode playback resolve integration slice using a real (test) DB and a mocked Xtream server.
- Assert that after a sync, a canonical `Episode` row exists with the correct `seasonId`/`seriesId`.
- Assert that `episodeAvailabilities` rows have `status='AVAILABLE'` and `episodeId` matching the canonical episode.
- Assert that `POST /playback/resolve/episode/:episodeId` returns a `gatewayUrl` and `deliveryMode`.
- Assert that `PUT /progress/EPISODE/:episodeId` persists progress and that the next `POST /playback/resolve` returns the correct `startPositionSeconds`.

**`apps/api/src/services/__tests__/playback-resolver.test.ts`:**
- Add an explicit test for `resolvePlayback('episode', episodeId)` with a mocked `episodeAvailabilities` response.
- Assert that the resolver queries `episodeAvailabilities` by `episodeId` (not by series or season ID).
- Assert that `explicitAvailabilityId` selects the correct variant when multiple episode availabilities exist.

**`apps/web/src/lib/variant-label.test.ts`:**
- Add a test confirming that when two variants share the same base label (e.g., both `FR • 1080p`), `sourceDisplayName` is appended — and that the label never contains a bare UUID.

### 4. Manual E2E validation (required for completion)

Walk through every acceptance criterion in the ticket with a real imported series that has multiple episodes and real IPTV availability. Completion is blocked until all checklist items pass:

- Open series detail → select season → episode list loads.
- Select episode → availability for that exact episode is shown.
- If multiple sources exist, variant selector shows readable labels (language, quality, provider name).
- Press Play → correct episode streams (not another episode or the parent series).
- Seek to persist progress → exit → reopen series → progress shown on correct episode.
- Resume episode → playback resumes from saved position.
- Play different episode → first episode's state is unchanged.
- Unavailable episode shows "Indisponible" and no Play action.

## Excluded

- Redesigning the series, season, or episode schema.
- Changes to the Continue Watching system beyond verifying it works for episodes.
- New UI components or layout changes not required to expose existing episode data.
- Android app implementation (verify API contract is unchanged; do not modify Android code).
- M3U series import improvements unless investigation reveals a concrete break in the episode chain.
- Recommendation engine, discovery, or metadata enrichment changes.
- Any work outside the episode playback chain (T109 scope only).

## Acceptance criteria

- All existing tests pass without modification.
- New vertical-slice integration test (episode slice) passes against a real test DB with mocked Xtream.
- `playback-resolver.test.ts` has a passing test for `resolvePlayback('episode', ...)` asserting episode-ID lookup.
- `variant-label.test.ts` has a passing test confirming no bare UUID appears in labels when `sourceDisplayName` is available.
- Manual E2E checklist above is fully validated with a real imported series.
- A reviewer can open the series detail page, select a season, select an episode, and play it successfully without any console errors or broken stream.
