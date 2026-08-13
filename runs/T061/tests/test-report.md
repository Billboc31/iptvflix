I now have enough information to write the complete test report. Let me compose it.

---

## Test Report — T061: Backfill and Reconcile Already-Synced Media Without TMDB Identities

### Execution summary

| Scope | Result |
|---|---|
| Full test suite (`pnpm test`) | 10 failures across 3 test files |
| `media-reconciliation-service.test.ts` isolated | 6 / 15 tests fail |
| `arrival-service.test.ts` isolated | 10 / 10 tests pass |
| `vertical-slice.test.ts` isolated | 4 / 12 tests fail (pre-existing) |

---

### Failures in `media-reconciliation-service.test.ts`

The 6 failing tests and their observed vs expected values:

| Test | Assertion | Expected | Received |
|---|---|---|---|
| 1. single movie match | `result.failedCount` | `0` | `≥4` |
| 7. no availabilities | `result.skippedCount` | `1` | `≥13` |
| 7. no availabilities | `result.processedCount` | `1` | `≥13` |
| 8. already MATCHED | `searchFn` call count | `0` | `≥6` |
| 9. idempotency | `result.failedCount` (2nd run) | `0` | `≥6` |
| 10. TMDB failure | `result.failedCount` | `1` | `≥3` |
| 11. cursor resumability | `result.processedCount` | `1` | `≥5` |

Tests 2, 3, 4, 5, 6, 12, 13, 14, 15 all pass.

---

### Root cause analysis

**Confirmed via isolation**: Running only test 7 in isolation (no other tests in the file) shows `skippedCount = 25` against a DB that should contain 0 PENDING movies. This rules out intra-file contamination; the stale data is persistent across test runs in the shared database.

**Mechanism** — the `afterEach` cleanup has a gap:

```typescript
// afterEach does:
await db.delete(movies).where(inArray(movies.tmdbId, ALL_TEST_TMDB_IDS)) // ← only hits canonical rows
await db.delete(movieAvailabilities).where(eq(movieAvailabilities.providerId, testSourceId)) // ← hits availabilities
```

Tests 1, 3, 4, 5, 9 create PENDING movies with **no tmdbId**. When those movies are successfully reconciled they are either deleted (merged) or get a tmdbId (and are then caught by the afterEach). But when the test **fails mid-body** (e.g., due to unexpected counts), the merge never happens and the manual `db.delete(movies)` at the end of each test body does not execute.

The `afterEach` then:
- Deletes the availability (via `providerId = testSourceId`) ✓
- Does **not** delete the orphaned PENDING movie (no tmdbId, not caught by any filter) ✗

The orphaned PENDING movie persists across test runs. Over multiple `vitest run` invocations, these orphans accumulate (currently 24+ orphaned PENDING movies confirmed in the shared test DB). Every `reconcile()` call queries `WHERE matchStatus IN ('PENDING', 'UNMATCHED')` globally, so all orphans are processed in every subsequent test, skewing every count-based assertion.

**This is a self-reinforcing failure**: failing tests leave more orphans → next run has more orphans → more tests fail → more orphans.

---

### Pre-existing failures (unrelated to T061)

**`vertical-slice.test.ts` — 4 failures**: Assertions of the form `expected 'RUNNING' to be 'DONE'`/`'FAILED'`. The sync runs fire asynchronously (`void syncService.runSync(...)` fire-and-forget) and the test polls the run status before the background job completes. This is a timing/async test design issue. The test file was last modified by T048 and T060; T061 does not touch `vertical-slice.test.ts` or `catalog-sync-service.ts`.

**`arrival-service.test.ts` — 1 failure in full run, 0 in isolation**: The isolated run shows all 10 tests green. The failure in the full parallel run is DB-state contamination from a concurrent test file, not a T061 defect.

---

### Acceptance criteria status

| AC | Status | Evidence |
|---|---|---|
| Movie re-evaluation reusing #122 matching policy | ✅ code review | `_processType('MOVIE', ...)` calls `titleMatchingService.matchBatch` |
| Series re-evaluated independently, no Movie mixing | ✅ Test 2 passes | `mediaType='SERIES'` run leaves unrelated PENDING movie untouched |
| Backfill does not require source deletion | ✅ structural | `POST /admin/reconcile` operates on existing data only |
| Multi-row merge to single canonical with Availability preserved | ✅ Test 3 passes | Both `rawTitle` values confirmed on canonical after merge |
| Canonical title replaces dirty provider title | ✅ code review | `resolveMovieId/resolveSeriesId` inserts candidate.title into canonical row |
| Raw provider titles remain at Availability level | ✅ Test 3 asserts | `rawTitle` is on `movie_availabilities`, not moved |
| Watchlist, progress, feedback, shelves, follow, arrivals migrated | ✅ Tests 4, 5, 12, 13, 14, 15 all pass | Each user-state table validated end-to-end |
| Ambiguous/unmatched remain visible | ✅ Test 6 passes | `ambiguousCount++; continue` leaves movie PENDING |
| Idempotency | ❌ Test 9 fails | Cannot confirm — `failedCount` on 2nd run is non-zero due to contamination |
| Resumability/retryability | ❌ Test 11 fails | Cannot confirm — `processedCount` sees orphan PENDING movies |
| Bounded TMDB concurrency | ❌ Test 8 fails | `searchFn` called more times than expected due to orphan movies |
| Progress/outcome diagnostic counters | ❌ Tests 1, 7, 10 fail | Counts are off due to contamination |
| Automated tests cover all required scenarios | ❌ 6 / 15 tests fail | Tests exist but fail non-deterministically |

---

### Classification

**Blocking issue — test isolation bug in `media-reconciliation-service.test.ts`**

The `afterEach` does not clean up PENDING/UNMATCHED movies without a `tmdbId`. This causes orphaned movies to accumulate in the shared test database across repeated `vitest run` invocations, making 6 of 15 tests non-deterministic and currently failing.

The **implementation logic** itself (service code, migration SQL, HTTP routes) has passed code review and is architecturally correct. The user-state migration tests (12–15) and core reconciliation tests (2, 3, 4, 5, 6) all pass on a clean DB. However, the test suite as written cannot reliably demonstrate the properties required by the ticket's final AC.

**Required fix**: The `afterEach` must also delete any PENDING/UNMATCHED `movies` or `series` rows whose `id` appeared in `movie_availabilities`/`series_availabilities` with `providerId = testSourceId` (delete them before deleting availabilities, since availabilities cascade). Additionally, tests that create PENDING movies without availabilities (tests 7, 8) should track those IDs and include them in `afterEach` cleanup rather than relying on in-body `db.delete` calls that don't run on failure.

---

### Verdict

**TESTING_FAILED** — 6 of 15 automated tests fail due to a test isolation bug in the `afterEach` cleanup. The core implementation appears correct based on code review and the tests that do pass, but the ticket's acceptance criterion requiring "automated tests cover … retry/idempotency and interrupted/failed reconciliation" is not met. The coder must fix the afterEach cleanup before this can be approved.
