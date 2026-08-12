All tasks complete. Here's a summary:

---

## Changes

**Files modified:**

- `apps/api/src/db/schema/availabilities.ts` — added `unique().on(t.providerId, t.providerItemId)` to `episodeAvailabilities`, matching the existing pattern on `movieAvailabilities` and `seriesAvailabilities`

- `apps/api/src/services/catalog-sync-service.ts` — replaced the three-field lookup `(episodeId, providerId, providerItemId)` with a two-phase check: look up by `(providerId, providerItemId)` only; if the row exists but points to a different episode, log a warning and skip; otherwise update or insert as before

- `apps/api/src/db/__tests__/catalog-constraints.test.ts` — added two tests: one asserting the DB rejects `(provider_id, provider_item_id)` duplicates across different episodes, one asserting multiple distinct provider items can still map to the same episode

- `apps/api/src/services/__tests__/catalog-sync-service.test.ts` — added a test where the same provider remaps a `providerItemId` to a different episode in a subsequent sync; asserts the original assignment is preserved

**Files created:**

- `apps/api/migrations/0014_episode_availability_provider_uniqueness.sql` — dedup DELETE followed by `ALTER TABLE ADD CONSTRAINT`
- `apps/api/migrations/meta/0014_snapshot.json` — drizzle-kit schema snapshot
- `apps/api/migrations/meta/_journal.json` — updated with entry for migration 0014

**Note:** The repo has a pre-existing `drizzle-kit migrate` tracking inconsistency (migrations 0008–0013 are applied to the test DB but not recorded in `drizzle.__drizzle_migrations`). The migration SQL file is correct; the test DB was updated directly. All 378 tests pass.
