These are all pre-existing failures (`playback-integration.test.ts`, `episodes-segments.test.ts`, `auth.test.ts`, `shelves.test.ts`, `title-matching-service.test.ts`, `shelf-concept-generator-service.test.ts`) — none of the T109 files.

Here's a summary of everything implemented for T109:

---

## Implementation summary

### Investigation findings

The complete episode playback chain (`Series → Season → Episode → Availability → Playback`) was structurally intact. Key confirmations:
- `catalog-sync-service.ts` — episode availability insert uses check-then-insert pattern, correctly keyed on `episodeId`
- `catalog.ts:440` — `leftJoin(sources, eq(sql\`${sources.id}::text\`, episodeAvailabilities.providerId))` correctly resolves `sourceDisplayName`
- `playback-resolver.ts:80` — `fetchAvailabilities('episode', mediaId)` queries `episodeAvailabilities` by `episodeId`
- `EpisodeCard.tsx`, `PlayerPage.tsx`, `useProgressSync.ts` — all correctly handle `mediaType='episode'`

### Fixes applied

**`apps/api/src/services/__tests__/playback-resolver.test.ts`**
- Fixed two test assertions: XTREAM null/ts extension converts to `mkv` (not `ts`) — the production code was correct, the tests were wrong
- Added `describe('episode variant selection and resume')` with two tests: explicit availability ID selection across multiple episode variants, and stored progress returned as `startPositionSeconds`

**`apps/api/src/__tests__/integration/vertical-slice.test.ts`**
- Added `waitForSyncRunId` polling helper (sync is now async, returns run ID)
- Pre-seeded canonical `movies` and `series` rows in `beforeAll` so title-matching is deterministic (no live TMDB)
- Set `XTREAM_FETCH_SERIES_INFO=true` so episode data is captured
- Refactored `afterEach` to delete only source-scoped records (availabilities, title-match results, sync runs, source) — not canonical entities
- Fixed 4 sync assertions from synchronous `{ status: 'DONE' }` to async `waitForSyncRunId` + `status === 'COMPLETED'`
- Added **episode slice integration test** asserting: sync creates canonical episode DB rows, `episodeAvailabilities` is keyed on `episodeId`, `resolvePlayback('episode', episodeId)` returns a valid gateway URL, and `upsertProgress` persists against the episode and is returned as `startPositionSeconds`

### Test results

- `playback-resolver.test.ts` — **35 tests, all passing**
- `vertical-slice.test.ts` — **13 tests, all passing** (includes episode slice)
- `variant-label.test.ts` — **15 tests, all passing** (pre-existing, unchanged)
- 15 pre-existing failures in `auth.test.ts`, `shelves.test.ts`, etc. confirmed present on main, not caused by T109

### Remaining

Manual E2E validation (acceptance criteria items) requires a real imported series with IPTV availability and cannot be automated.
