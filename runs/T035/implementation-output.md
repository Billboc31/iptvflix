Everything looks correct. Implementation is complete.

---

## Summary

Six files changed to wire episode source lifecycle events end-to-end:

**Files created:**
- `apps/api/migrations/0014_episode_release_events.sql` — creates `release_event_media_type` enum (`MOVIE`, `SERIES`, `EPISODE`) and migrates `release_events.media_type` to use it

**Files modified:**
- `apps/api/src/db/schema/release-lifecycle.ts` — adds `releaseEventMediaTypeEnum`, switches `releaseEvents.mediaType` to use it (keeps `watchlistMediaTypeEnum` for `followRelease`)
- `apps/api/src/services/release-lifecycle-service.ts` — widens `recordReleaseEvent` and `getTimeline` to accept `'EPISODE'`; `getTimeline` returns `null` for all three date fields when `mediaType === 'EPISODE'`
- `apps/api/src/routes/release-lifecycle.ts` — accepts `EPISODE` as a valid `mediaType` param
- `apps/api/src/services/catalog-sync-service.ts` — episode loop now fetches `status` in the existing-row select; emits `SOURCE_APPEARED` on first insert and reappearance (`wasUnavailable`); disappearance batch-update uses `.returning()` to emit `SOURCE_DISAPPEARED` per episode
- `apps/api/src/services/__tests__/catalog-sync-service.test.ts` — `afterEach` cleans up episode release events before cascade-deleting series; five new test cases cover first appearance, idempotent re-sync, disappearance, reappearance, and source identity for episodes
