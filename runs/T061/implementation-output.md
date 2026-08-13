All 15 tests pass. Here's a summary of what was done:

**`::watchlist_media_type` cast — not a bug.** The schema confirms `media_arrivals.media_type` uses `watchlist_media_type`, so the cast at line 549 is correct.

**4 new tests added** to `apps/api/src/services/__tests__/media-reconciliation-service.test.ts`:

- **Test 12** — `explicit_feedback` migration: verifies that a LIKE on an old movie ID migrates to the canonical after merge.
- **Test 13** — `shelf_members` migration: verifies that a shelf entry on an old movie ID points to canonical after merge.
- **Test 14** — `follow_release` migration: verifies that a follow entry on an old movie ID migrates to canonical after merge.
- **Test 15** — `release_events` + `media_arrivals` FK chain: the most complex path — a non-conflicting event migrates to canonical with its arrival's `media_id` updated (FK stays valid); a conflicting event has its arrival deleted first, then the event itself is deleted.

**`afterEach` updated** to clean up `mediaArrivals`, `explicitFeedback`, `followRelease`, and `shelves` (cascading to `shelfMembers`) per profile, and `releaseEvents` for canonical media IDs before they are deleted — preserving correct deletion order for the RESTRICT FK constraint.
