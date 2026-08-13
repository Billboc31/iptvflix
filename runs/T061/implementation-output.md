Both changes look correct. Here's a summary of what was done:

---

**Fix 1 — `startRun` race condition (blocking issue #2)**

Added `isUniqueConstraintError` helper that checks for Postgres error code `'23505'`. The `INSERT` in `startRun` is now wrapped in a try/catch: if a concurrent request races past the initial `SELECT` and triggers the partial unique index, the constraint error is caught, translated to `ReconciliationAlreadyRunningError`, and the route returns 409 as expected.

**Fix 2 — Test 11 cursor resumability (blocking issue #1)**

Replaced the old test (which re-ran `reconcile()` twice and tested UNMATCHED re-eligibility — already covered by test 9) with a test that exercises the actual cursor code path:
1. Creates 3 movies with availabilities
2. Calls `startRun()` to get a live RUNNING row
3. Manually sets `cursorMovieId` to `sortedIds[1]` via `db.update` (simulating a mid-run crash after the first two movies committed)
4. Calls `executeRun(runId)` directly on that still-RUNNING row
5. Asserts `processedCount === 1` (only the movie with `id > sortedIds[1]` was fetched) and that the first two movies remain `PENDING` (untouched by this resume)

**Also cleaned up:**
- Dead code block at the `matchedResults.length === 0` check (unreachable — removed)
- `batchSize` clamped to `Math.max(1, ...)` to prevent the infinite-loop edge case with `batchSize: 0`
