Everything looks correct. Here's a summary of what was implemented:

---

## Summary

**Files modified:**

1. **`apps/api/src/services/catalog-sync-service.ts`** — Added `releaseEvents` import and 6 event emission points inside `syncNormalized()`, all within the existing transaction:
   - Movie first appearance → `SOURCE_APPEARED`
   - Movie reappearance (was UNAVAILABLE) → `SOURCE_APPEARED`
   - Movie disappearance (bulk update) → `SOURCE_DISAPPEARED` per row via `.returning()`
   - Series: same three patterns symmetrically
   - All use `onConflictDoNothing()` for idempotency

2. **`apps/api/src/routes/release-lifecycle.ts`** *(new file)* — `GET /release-lifecycle/:mediaType/:mediaId` endpoint that validates `mediaType` and delegates to `getTimeline()`.

3. **`apps/api/src/index.ts`** — Imported and registered `releaseLifecycleRoutes`.

4. **`apps/api/src/services/__tests__/catalog-sync-service.test.ts`** — Added `releaseEvents` cleanup to `afterEach`, plus 5 new test cases covering all acceptance criteria (first appearance, idempotent re-sync, disappearance, reappearance, metadata-only update). All queries filter by `providerId = testSourceId` to avoid stale-row interference from prior test runs.

**Verification:** 370/370 tests pass, including all 23 catalog-sync-service tests and the 5 new source lifecycle tests.
