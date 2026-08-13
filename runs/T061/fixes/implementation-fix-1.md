# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T061/reviews/implementation-review.md
- generated at: 2026-08-13T10:29:02Z

---

I have enough information to write the review. Let me compile it now.

---

# PR Review — T061: Backfill and reconcile already-synced media without TMDB identities

## Overview

The implementation adds a `MediaReconciliationService`, an HTTP admin endpoint pair, a `reconciliation_runs` table/migration, and 11 integration tests. The core backfill logic — cursor pagination, transactional merge, user-state migration, rate-limit respect — is well-executed. Several issues require fixes before approval.

---

## Scope compliance

**Included / correct:**
- Reuses `TitleMatchingService` from T060 without modification ✓
- Processes MOVIE and SERIES independently ✓
- Preserves all user-state tables: watchlist, viewing_progress, explicit_feedback, shelf_members, follow_release, profile_taste, media_arrivals, release_events ✓
- Leaves ambiguous/unmatched records intact ✓
- Admin endpoints protected by existing auth middleware ✓
- Rate limiting delegated to `MATCH_CONCURRENCY` / `MATCH_THROTTLE_MS` ✓
- Idempotency via ON CONFLICT DO NOTHING pattern ✓

**No scope drift detected.**

---

## Blocking Issues

### 1. Test 11 does not test cursor resumability from an interrupted run

**Plan acceptance criterion 8:** _"Interrupting the backfill and restarting resumes from the last committed cursor position; records from committed batches are not re-processed."_

Test 11 (`cursor resumability — records from committed batches are not re-processed`) does not test this. What it actually does:

1. Runs full `reconcile()` on 3 movies → all become UNMATCHED
2. Deletes the run row (`await db.delete(reconciliationRuns)`)
3. Runs `reconcile()` again → all 3 re-processed

This tests re-eligibility of UNMATCHED records (already covered by test 9's idempotency pass), not cursor-based resumption. A true cursor resumption test would:
1. Start a run with `startRun()`
2. Manually advance the cursor to simulate a partially completed interrupted run (update `cursorMovieId` to the second movie's ID)
3. Call `executeRun(runId)` directly on the still-RUNNING row
4. Assert only the third movie (after the cursor) was processed

The code correctly reads `cursorMovieId`/`cursorSeriesId` from the DB at the start of each `_processType` call, so the implementation is sound — but the test does not exercise that path. The plan explicitly required this scenario.

**Fix required:** Replace or supplement test 11 with a test that:
- Creates a RUNNING row with `cursorMovieId` set to a mid-batch ID
- Calls `executeRun(runId)` directly
- Asserts that only records with `id > cursorMovieId` are processed

---

### 2. `startRun` race condition — concurrent POST returns 500 instead of 409

```typescript
// apps/api/src/services/media-reconciliation-service.ts:55-67
const [existing] = await db.select(...).from(reconciliationRuns).where(eq(..., 'RUNNING'))
if (existing) throw new ReconciliationAlreadyRunningError(existing.id)
const [run] = await db.insert(reconciliationRuns).values({ status: 'RUNNING', ... }).returning(...)
```

Two simultaneous POST `/admin/reconcile` requests can both pass the SELECT check before either INSERT lands. The partial unique index on `status = 'RUNNING'` correctly rejects the second INSERT with a PostgreSQL constraint violation. However, that constraint error is not a `ReconciliationAlreadyRunningError`, so the route handler's catch block does not intercept it:

```typescript
// apps/api/src/routes/reconcile.ts:23-29
} catch (err) {
  if (err instanceof ReconciliationAlreadyRunningError) {
    return reply.status(409).send({ error: err.message })
  }
  throw err  // constraint error propagates as 500
}
```

Data integrity is preserved by the index. The bug is a wrong HTTP status to the caller.

**Fix required:** Catch the DB unique constraint error in `startRun` and translate it to `ReconciliationAlreadyRunningError`, or use an INSERT ... ON CONFLICT DO NOTHING approach and check the return.

---

## Significant Non-Blocking Issues

### 3. `dryRun` creates DB side effects via `TitleMatchingService`

The plan specifies: _"In dryRun mode: run all queries but wrap everything in a transaction that is rolled back."_

The implementation uses conditional `if (!dryRun)` guards instead of a rolled-back transaction. This means `titleMatchingService.matchBatch()` — called unconditionally — writes to `title_match_results` and creates canonical `movies`/`series` skeleton rows (via `_resolveCanonicalMovie`/`_resolveCanonicalSeries`) even in dryRun mode.

After a dryRun:
- Canonical skeleton rows exist with `matchStatus='MATCHED'` but no availabilities
- Original PENDING rows still exist with their availabilities
- The state is recoverable (the next real run will merge them correctly), but differs from what an operator expects from a "read-only preview"

The plan's rolled-back transaction approach would have prevented this. If changing to a true rolled-back transaction is impractical (concerns about long-held locks), add documentation to the `dryRun` option that explicitly calls out the TitleMatchingService cache writes as a known side effect.

---

### 4. Dead code path at line 237

```typescript
// media-reconciliation-service.ts:237-241
if (matchedResults.length === 0) {
  // Mixed UNMATCHED + AMBIGUOUS already handled above; this path means some MATCHED, some UNMATCHED
  // Fall through: evaluate canonical below
}
```

At this point in the flow:
- `hasFailure` checked → skipped if true
- `hasAmbiguous` checked → skipped if true
- `allUnmatched` checked → skipped if true

The only remaining possibility is at least one MATCHED result, so `matchedResults.length > 0` is guaranteed here. The if-block is unreachable and its comment is incorrect. This is minor quality noise but adds confusion in an already-complex control flow.

---

## Minor Observations

**Input validation absent on admin body:** `batchSize: 0` would produce an infinite loop (LIMIT 0 returns all rows without pagination). Consider clamping batchSize to `max(1, batchSize)`.

**`media_credits`/`media_videos` merge may produce duplicates:** These tables have no unique constraints, so if a canonical was already enriched and the old media also has credits/videos (unlikely but possible), the UPDATE creates duplicate rows. Low risk in practice since unresolved media is typically unenriched.

---

## Correctness Spot-Checks

| Check | Result |
|---|---|
| `discovery_candidates.canonical_movie_id` — no unique constraint, UPDATE is safe | ✓ confirmed via migration 0018 |
| `explicit_feedback.media_type` uses `watchlist_media_type` enum | ✓ confirmed via migration 0016 |
| `follow_release.media_type` uses `watchlist_media_type` | ✓ confirmed via migration 0010 |
| `shelf_members.media_type` uses `shelf_media_type` — correct cast used | ✓ |
| `matchBatch` failure produces `id: ''` + `notes: 'match failed: provider error'` | ✓ confirmed in title-matching-service.ts:267-278 |
| `release_events` migration uses UPDATE (preserving FK for media_arrivals) | ✓ correct improvement over plan's INSERT approach |
| `profile_taste` array replacement via `array_replace` | ✓ correct for text[] columns |
| Cursor persisted after each batch before advancing | ✓ |
| Ambiguous results leave `matchStatus` unchanged | ✓ |

---

## Summary

The implementation is architecturally sound with correct transactional safety, comprehensive user-state migration, and good rate-limit discipline. Two fixes are required:

1. **Test 11** must test actual cursor resumption from a mid-run interrupted state (the code supports it; the test doesn't exercise it).
2. **`startRun` race condition** must be handled so concurrent callers receive 409, not 500.

IMPLEMENTATION_FIX_REQUIRED
