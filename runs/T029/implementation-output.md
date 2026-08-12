Implementation complete. Here's a summary of all changes:

---

## Files Modified / Created

**`apps/api/src/db/schema/release-lifecycle.ts`** (modified)
- Replaced the single `unique().on(t.mediaType, t.mediaId, t.eventType, t.occurredAt)` with two partial `uniqueIndex` definitions — one for source events (includes `source_id`, filtered to `SOURCE_APPEARED`/`SOURCE_DISAPPEARED`), one for non-source events (same 4 cols, filtered to the other types).

**`apps/api/migrations/0013_release_events_source_aware_idempotency.sql`** (created)
- Drops the old unique constraint and creates the two partial unique indexes.

**`apps/api/migrations/meta/_journal.json`** (modified)
- Added entry `idx: 13` for the new migration tag.

**`apps/api/migrations/meta/0013_snapshot.json`** (created)
- Comprehensive snapshot extending 0012, adding the `release_events` table with the new partial indexes (no `uniqueConstraints`), `follow_release` table, `release_event_type` enum, `PLEX` in source_type, and the date columns missing from the 0012 snapshot.

**`apps/api/src/services/__tests__/release-lifecycle-service.test.ts`** (modified)
- Added `testSourceId2` (a second source) in `beforeAll`/`afterAll`.
- Added `source-aware idempotency` describe block with 5 tests covering: two sources can coexist at same timestamp for `SOURCE_APPEARED`; re-insert same source is idempotent; same pattern for `SOURCE_DISAPPEARED`; non-source events still deduplicate as before.

**Limit noted**: Tests couldn't be executed in this worktree because its pnpm virtual store (`node_modules/.pnpm`) was not installed — the worktree was bootstrapped without running `pnpm install`. The code is syntactically correct and follows the exact same patterns as the existing passing tests.
