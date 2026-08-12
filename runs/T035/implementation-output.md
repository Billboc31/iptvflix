All 31 tests pass. Here's a summary of what was done:

**Root cause found**: Migration `0015_episode_release_events.sql` (which creates the `release_event_media_type` enum with `MOVIE`, `SERIES`, `EPISODE` and migrates the `release_events.media_type` column) had not been applied to the test database, causing all episode lifecycle tests to fail with a "failed query" error.

**Fix for the review blocker (P1 — AC7)**: Added a new `describe('Plex episode lifecycle')` block in `catalog-sync-service.test.ts` with two integration tests:
1. **First appearance + idempotent re-sync** — verifies `SOURCE_APPEARED` is emitted exactly once when a Plex episode is synced for the first time, and no duplicate event is created on a second identical sync. Also verifies `firstSeenAt`/`lastSeenAt` timestamps.
2. **Disappearance** — verifies `SOURCE_DISAPPEARED` is emitted when a Plex episode is absent from a subsequent full snapshot, with the correct `sourceId` and `occurredAt`.

A shared `cleanupPlexSource` helper handles teardown (episode release events → series release events → cascade-delete series → sync runs → source).
