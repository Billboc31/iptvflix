Implementation complete. Here's a summary of what was done:

---

## T095 — Implementation summary

**Files created (5):**
- `apps/api/migrations/0042_t095_continue_watching_dismissals.sql` — migration for the new table
- `apps/api/src/db/schema/continue-watching-dismissals.ts` — Drizzle schema (profileId + mediaType + mediaId unique, cascades on profile delete)
- `apps/web/src/components/content/ContinueWatchingCard.tsx` — card with three interaction zones (▶ Play, ⓘ Info, ⋮ Overflow)
- `apps/web/src/components/content/ContinueWatchingOverflowMenu.tsx` — accessible dropdown menu (role="menu", Escape/click-outside to close)
- `apps/web/src/components/content/ContinueWatchingCard.test.tsx` — 14 component tests

**Files modified (12):**
- `apps/api/migrations/meta/_journal.json` — journal entry for migration 42
- `apps/api/src/db/schema/index.ts` — export new schema
- `packages/api-contracts/src/user-state.ts` — `ContinueWatchingItem` extended with `seriesId/seasonNumber/episodeNumber/episodeTitle`
- `apps/api/src/services/viewing-progress-service.ts` — `listContinueWatching` filters dismissed items (LEFT JOIN + isNull), enriches episode items (joined seasons), new `dismissContinueWatching`, `upsertProgress` clears dismissal on ≥5% (re-entry rule)
- `apps/api/src/routes/viewing-progress.ts` — `DELETE /continue-watching/:mediaType/:mediaId`
- `apps/api/src/routes/__tests__/viewing-progress.test.ts` — 19 tests (expanded from 11, covering dismissal, episode fields, re-entry)
- `apps/web/src/lib/api.ts` — `dismissContinueWatching()`
- `apps/web/src/hooks/useContinueWatching.ts` — `dismissItem` with optimistic removal + rollback
- `apps/web/src/components/content/ContinueWatchingRow.tsx` — now uses `ContinueWatchingCard`
- `apps/web/src/pages/PlayerPage.tsx` — skips resume dialog when `source=continue_watching`
- `apps/web/src/test/handlers.ts` — extended `MOCK_CONTINUE_WATCHING` + `MOCK_CONTINUE_WATCHING_EPISODE` + DELETE handler
- `apps/web/src/components/content/ContinueWatchingRow.test.tsx` — updated for new card structure

**All 19 backend + 17 frontend tests pass. TypeScript compiles cleanly on all changed files.**
