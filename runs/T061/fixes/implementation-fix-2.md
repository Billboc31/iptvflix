# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T061/reviews/implementation-review.md
- generated at: 2026-08-13T10:38:57Z

---

Now I have a complete picture. Let me write the review.

---

## Review — T061: Backfill and Reconcile Already-Synced Media Without TMDB Identities

### Summary

The implementation is structurally sound: the schema, cursor-based pagination, transactional merge, rate-limiting delegation, and the public HTTP API all align with the plan. Service logic is correctly scoped to ticket requirements. However, the test suite has a material gap — most of the user-state migration path is implemented but not covered — and two issues in the migration logic warrant verification before approval.

---

### Correctness relative to ticket requirements

#### ✅ Core backfill mechanics

- Cursor-based pagination (`id > cursorId ORDER BY id LIMIT batchSize`) is correct for UUID ordering and resumability.
- Partial unique index on `status = 'RUNNING'` correctly enforces single-execution invariant.
- `startRun()` handles the race condition between the SELECT guard and the INSERT via `isUniqueConstraintError()` catch — 409 returned instead of 500.
- `executeRun()` persists cursor and incremental counts after each batch, before advancing.
- Unresolved media remains PENDING/UNMATCHED and playable (never silently deleted).
- `matchStatus IN ('PENDING', 'UNMATCHED')` correctly excludes already-MATCHED rows.

#### ✅ Matching reuse

The service delegates entirely to `TitleMatchingService.matchBatch()` from T060. No second matching algorithm introduced.

#### ✅ Availability migration

Non-conflicting availabilities are moved via UPDATE with `NOT EXISTS` guard; conflicting ones (same provider/providerItemId on canonical) are deleted. Correct.

#### ✅ Basic user-state migration

Watchlist, viewing_progress, explicit_feedback, shelf_members, follow_release all use INSERT ON CONFLICT DO NOTHING + DELETE pattern. Canonical row wins on conflict. Consistent with the plan.

#### ⚠️ release_events + media_arrivals — implemented correctly but NOT tested

The plan specified a simpler `INSERT ON CONFLICT DO NOTHING + DELETE` for `release_events`. The implementation correctly realized this won't work (INSERT would create new rows with new IDs, breaking `media_arrivals.release_event_id` FK references) and implemented a 4-step approach instead:

1. UPDATE non-conflicting `release_events` to `canonicalId` (preserving row IDs so FK from `media_arrivals` remains valid)
2. UPDATE `media_arrivals.media_id` to `canonicalId`
3. DELETE `media_arrivals` whose `release_event_id` still points to old events (those that conflicted)
4. DELETE remaining old `release_events`

This is the right approach, but the added complexity is entirely untested. Any regression in this path (wrong event_type list in the CASE, wrong FK chain order) would silently produce broken data.

#### ⚠️ `::watchlist_media_type` cast on `media_arrivals` — risk of runtime failure

`_migrateUserState`, line 549:
```typescript
WHERE media_id = ${oldId} AND media_type = ${type}::watchlist_media_type
```

`media_arrivals.media_type` may not use the `watchlist_media_type` enum. If the schema defines a distinct `arrival_media_type` (or similar), this will throw at runtime during any SERIES merge. No test exercises the SERIES path of `_migrateUserState`, so this would not be caught in CI.

**Required action**: Verify the actual `media_arrivals.media_type` enum name against the schema and correct the cast if it differs.

#### ✅ `profile_taste` migration

`array_replace()` on text arrays is correct for this schema shape.

#### ⚠️ `media_credits`/`media_videos` potential duplicates

The implementation uses direct UPDATE (not INSERT ON CONFLICT DO NOTHING):
```sql
UPDATE media_credits SET media_id = :canonicalId WHERE media_id = :oldId AND media_type = 'MOVIE'
```

If the canonical was already enriched (has credits/videos) and the old media also has credits/videos, the canonical accumulates duplicates after merge. The plan acknowledges unresolved media is typically unenriched, but this is a silent data quality risk for any edge case where it isn't.

---

### Scope compliance

No scope creep. The service correctly excludes:
- Episode-level reconciliation
- TitleMatchingService internals
- Frontend/UI changes
- Source delete/recreate flow

`mediaType` option correctly isolates MOVIE and SERIES processing paths.

---

### Code quality

- Service structure is clean, private methods are well-separated.
- No N+1 queries — `_fetchAvailabilities` bulk-fetches per page.
- `batchSize = Math.max(1, ...)` guard prevents infinite loop with zero input.
- `dryRun` uses conditional guards rather than the plan-specified rollback transaction. Side effects from `TitleMatchingService` (writes to `title_match_results`, canonical skeleton creation) still occur in dryRun mode. Operators running a preview run will see unexpected rows. This diverges from the plan spec:
  > "In `dryRun` mode: run all queries but wrap everything in a transaction that is rolled back"

- TMDB failure detection at line 228 is brittle:
  ```typescript
  const hasFailure = results.some((r) => r.id === '' && r.notes?.includes('provider error'))
  ```
  This string-sentinel coupling to `TitleMatchingService`'s internal error format means any change in that service's error signaling silently breaks failure handling here.

---

### Test coverage

| Scenario | Status |
|---|---|
| Single movie match | ✅ Test 1 |
| Series type isolation | ✅ Test 2 |
| Multi-row merge + availability preservation | ✅ Test 3 |
| Watchlist migration | ✅ Test 4 |
| Viewing progress conflict | ✅ Test 5 |
| Ambiguous match | ✅ Test 6 |
| No availabilities (skipped) | ✅ Test 7 |
| Already MATCHED excluded | ✅ Test 8 |
| Idempotency | ✅ Test 9 |
| TMDB failure mid-batch | ✅ Test 10 |
| Cursor resumability | ✅ Test 11 |
| **explicit_feedback migration** | ❌ Not tested |
| **shelf_members migration** | ❌ Not tested |
| **follow_release migration** | ❌ Not tested |
| **release_events migration** | ❌ Not tested |
| **media_arrivals migration** | ❌ Not tested |

The ticket acceptance criteria states: *"Automated tests cover existing-data matching, multi-row merge, Availability preservation, user-state migration, ambiguous match, retry/idempotency and interrupted/failed reconciliation."*

"User-state migration" is explicitly listed. The test suite covers only 2 of 7 user-state tables. `release_events`/`media_arrivals` — the most complex migration path — has zero coverage.

---

### Blocking issues

**1. Missing user-state migration tests** (blocker)

`explicit_feedback`, `shelf_members`, `follow_release`, `release_events`, and `media_arrivals` are all migrated in `_migrateUserState` but none are tested. The ticket acceptance criteria explicitly calls for user-state migration tests. Tests for at least `explicit_feedback` (simple path) and `release_events`/`media_arrivals` (complex FK chain) are required.

**2. `::watchlist_media_type` cast on `media_arrivals`** (blocker if wrong)

Must verify the actual enum type used for `media_arrivals.media_type`. If it's anything other than `watchlist_media_type`, SERIES merges will throw a Postgres type error at runtime with no test catching it.

---

### Non-blocking observations

**3. `dryRun` side effects** — `TitleMatchingService` still writes to DB in dryRun mode. Document this limitation explicitly in the route body schema or JSDoc, or flag it as a known deviation from plan.

**4. TMDB failure detection string sentinel** — Consider exposing a typed `failed: boolean` field on match results rather than `r.notes?.includes('provider error')`.

**5. `media_credits`/`media_videos` duplicates** — Low risk in practice but worth noting. If this ever triggers for an already-enriched canonical, duplicates would require manual cleanup.

**6. Silent endpoint suppression without TMDB_API_KEY** — `POST /admin/reconcile` returns 404 when key is absent. A 503 with a clear message would be more operator-friendly.

---

### Required before approval

1. Add tests for at minimum: `explicit_feedback` migration, and the `release_events` + `media_arrivals` FK chain (simulate a SERIES or MOVIE merge where both old and canonical have release events with conflicting and non-conflicting entries).
2. Verify the `media_arrivals.media_type` enum name against the current schema and correct the cast at line 549 if needed.

IMPLEMENTATION_FIX_REQUIRED
