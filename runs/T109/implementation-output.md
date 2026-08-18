The implementation is clean and correct. Let me now verify the full picture of what exists across all three test files against the plan requirements.

**Plan requirements vs. implementation status:**

| Requirement | Status |
|---|---|
| `playback-resolver.test.ts`: episode ID lookup test | ✅ Already exists (lines 448-481: `episode variant selection and resume`) |
| `playback-resolver.test.ts`: explicit availabilityId selects correct variant | ✅ Already exists (lines 449-464) |
| `variant-label.test.ts`: no bare UUID in labels | ✅ Already exists (lines 106-110: `never returns a UUID-shaped string`) |
| `vertical-slice.test.ts`: episode sync + DB assertions + playback resolve + progress | ✅ Already exists from prior coder (lines 592-697): `resolvePlayback` + progress |
| `vertical-slice.test.ts`: catalog API exposes episode availability + per-episode progress tracking | ✅ Added by this coder (my new test) |

TypeScript compilation: ✅ clean

**Investigation findings (plan step 1):** All verified working by the exploration agent:
- `resolveEpisodeId()` creates canonical Episode rows correctly ✅
- `episodeAvailabilities` keyed on canonical episodeId ✅  
- `containerExtension` set on episode availability rows ✅
- `sources` UUID join works via `::text` cast ✅
- `resolvePlayback('episode', episodeId)` queries `episodeAvailabilities` by `episodeId` ✅
- `EpisodeCard` passes correct episodeId/availabilityId ✅
- `PlayerPage` handles `episode` mediaType and writes progress to correct endpoint ✅

**Fixes needed (plan step 2):** Investigation found no broken chain — architecture is complete. No file modifications beyond tests needed.

## Summary

**File modified:** `apps/api/src/__tests__/integration/vertical-slice.test.ts`

**Changes:**
1. Added `asc` to the drizzle-orm import
2. Added a new integration test: `episode slice — catalog API exposes episode availability and progress is tracked per episode` which:
   - Syncs series with two episodes (providerItemIds `8001`, `8002`) using the Xtream fixture
   - Asserts that `seasons`, `episodes`, and `episodeAvailabilities` DB rows are created with correct canonical linkage
   - Asserts `episodeAvailabilities` is keyed by `episodeId` (not series/season ID) and has `containerExtension='mp4'`
   - Validates `GET /series/:id/seasons/1/episodes` returns correct `availabilityStatus`, `availabilityCount`, and `variants`
   - Calls `upsertProgress('EPISODE', ep1Id, 840, 2700)` and verifies DB storage with correct `(profileId, EPISODE, episodeId)` key
   - Verifies per-episode watch state via catalog API with profileId

The other required tests (`playback-resolver.test.ts` episode variant selection, `variant-label.test.ts` no-UUID assertion) were already added by previous coder attempts and remain intact.
