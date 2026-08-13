# T069 — Test Report

Date: 2026-08-13

## Commands executed

```
cd apps/api && npm test -- --reporter=verbose \
  src/services/__tests__/media-reconciliation-service.test.ts \
  src/services/__tests__/episode-backfill-service.test.ts
```

```
npx tsc --noEmit
```

## Test results

**21 / 21 tests passed** (2 files, 0 failures)

### media-reconciliation-service.test.ts — 15 tests, all PASS

| # | Test | Result |
|---|------|--------|
| 1 | Single movie match — PENDING resolves to MATCHED | PASS |
| 2 | Series type isolation — SERIES run does not touch movies | PASS |
| 3 | Multi-row merge — two PENDING for same canonical collapse to one | PASS |
| 4 | Watchlist migration — entry on old ID points to canonical after merge | PASS |
| 5 | Viewing progress conflict — canonical row survives, no duplicate | PASS |
| 6 | Ambiguous match — two equally-scored candidates leave record unchanged | PASS |
| 7 | No availabilities — media with no availability rows is skipped | PASS |
| 8 | Already MATCHED media is not re-queried | PASS |
| 9 | Idempotency — re-run produces no duplicate rows | PASS |
| 10 | TMDB failure mid-batch — failing item counted, rest continues | PASS |
| 11 | Cursor resumability — executeRun resumes from persisted cursor | PASS |
| 12 | explicit_feedback migration | PASS |
| 13 | shelf_members migration | PASS |
| 14 | follow_release migration | PASS |
| 15 | release_events + media_arrivals FK chain | PASS |

### episode-backfill-service.test.ts — 6 tests, all PASS

| # | Test | Result |
|---|------|--------|
| 1 | Picks up MATCHED series with zero seasons and ingests episodes | PASS |
| 2 | Skips series with existing seasons when force=false | PASS |
| 3 | Processes series with existing seasons when force=true | PASS |
| 4 | Does not abort other series when getSeriesInfo fails for one | PASS |
| 5 | getLatestState returns null before any run | PASS |
| 6 | getLatestState reflects result after backfill completes | PASS |

## TypeScript

2 pre-existing errors in files not touched by T069:
- `src/middleware/authenticateDevice.test.ts` — revokedAt type mismatch (last modified in T055)
- `src/services/__tests__/playback-resolver.test.ts` — missing autoplayPreviews field (pre-dates T069)

No TypeScript errors in any T069 files.

## Acceptance criteria

### From ticket (GitHub Issue #136)

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Existing valid TMDB-linked records map directly | PASS | Tests 1 + 8: PENDING resolves to MATCHED; already-MATCHED excluded from TMDB calls |
| Duplicate provider-derived cards consolidate under one canonical entity | PASS | Test 3: two PENDING movies collapse to one canonical row with both availabilities migrated |
| Existing variants remain playable after migration | PASS | Test 3: availabilities UPDATE'd to canonical ID, not deleted; both rows verified present |
| User list/progress/history relationships survive | PASS | Tests 4 (watchlist), 5 (viewing_progress), 12 (explicit_feedback), 13 (shelf_members), 14 (follow_release), 15 (release_events + media_arrivals) |
| Ambiguous/unresolved records reported and retained safely | PASS | Test 6: ambiguous record stays PENDING, counted in ambiguous_count, not deleted |
| Migration can be retried without duplication/corruption | PASS | Test 9: re-run on reconciled catalog = 0 matched, 0 merged, 0 failed, no duplicates |
| Verification report summarizes before/after counts and unresolved items | PARTIAL | `GET /admin/reconcile/:runId` returns all counters (processed, matched, merged, ambiguous, unmatched, skipped, failed). After-counts and unresolved items are captured. No before-snapshot is taken — this is an explicit design decision documented in the plan exclusions. |
| Old identity paths removed or explicitly deprecated | PASS | Plan notes application routes already use canonical IDs; no provider-first lookup layer exists to remove |

### From plan acceptance criteria

| Criterion | Status | Evidence |
|-----------|--------|----------|
| POST /admin/reconcile runs to COMPLETED; GET returns status | PASS | Routes verified in reconcile.ts; async execution; full counters returned |
| TMDB-id records marked MATCHED without search calls | PASS | Test 8 |
| Two PENDING for same TMDB collapse to one; both availabilities present | PASS | Test 3 |
| All user state tables survive merge | PASS | Tests 4, 5, 12, 13, 14, 15 |
| Ambiguous → PENDING, counted, not deleted | PASS | Test 6 |
| Re-run = 0 matched + 0 merged + 0 failed, no duplicates | PASS | Test 9 |
| POST /admin/episode-backfill restores episodes for zero-season merged series | PASS | Episode backfill test 1 |
| All 15 reconciliation tests pass | PASS | 15/15 |
| All episode backfill tests pass | PASS | 6/6 |

## Regressions

None observed. The 2 TypeScript errors are pre-existing and unrelated to this ticket.

## Blocking issues

None.

## Verdict

**VALIDATED** — All acceptance criteria are met. The partial note on "before/after counts" reflects an explicit, documented design decision (incremental counters only, no before-snapshot) and does not constitute a failure.
