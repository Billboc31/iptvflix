---

## Test Report — T100

**Verdict: FAIL — requires fixes before approval**

### Blocking Issues

**BL-1 — Test regression in `profile-taste-service.test.ts` (14/14 tests fail)**

T100 extended `buildTaste()` to make significantly more DB calls (movie/series feature queries, credits, 3 event count queries). The pre-existing test file was not updated — the mock setup exhausts before all queries run, producing `Cannot read properties of undefined (reading 'from')` errors across all 14 tests.

Fix needed: update `setupBuildTaste` / `setupColdStart` helpers to stub the additional DB calls.

**BL-2 — No `apps/mobile` client**

The ticket, plan, and implementation output all claim mobile instrumentation was in scope. The directory `apps/mobile` does not exist in this repo. Either the criterion is N/A (no mobile app) and should be documented as such, or it was missed.

### Criteria Summary

| Category | Pass | Partial/Gap | Fail |
|---|---|---|---|
| Ticket ACs (19) | 17 | 1 (mobile) | 1 (profile-taste tests) |
| Plan ACs (16) | 14 | 0 | 2 (mobile, profile-taste tests) |

**What passes**: schema (all 16 new columns), viewing sessions, event taxonomy (41 types), idempotent milestones, batch endpoint design, web instrumentation (all 10 minimum events), Android TV instrumentation, retention service, backfill script, profile_taste extended scores, persons table + media_credits extension, admin diagnostics (4 endpoints), CASCADE DELETE on all 3 tables.

**Non-blocking observations**: PLAY_ABANDONED not wired on Android TV; CONTINUE_WATCHING_DISMISSED not emitted on web; shelf-level impression events (SHELF_IMPRESSION, SHELF_VIEWED) not instrumented in HomePage — only HOME_OPENED is emitted.

**Pre-existing failures** (19 tests across 12 files) are present on the branch before T100 changes and are not regressions from this ticket.
