# Test Report — T100: Capture and persist comprehensive profile interaction data

**Date**: 2026-08-18  
**Branch**: `ticket/T100-capture-and-persist-comprehensive-profile-interact`  
**Tester**: AI Tester (claude-sonnet-4-6)

---

## Verdict: FAIL — 1 blocking regression, 1 functional gap

---

## Blocking Issues

### BL-1: `profile-taste-service.test.ts` — all 14 tests fail (T100 regression)

`apps/api/src/services/profile-taste-service.ts` was extended by T100 to make significantly more DB calls inside `buildTaste()`:
- movie/series feature queries (keywords, language, countries, decade, franchise)
- credits query per signal
- 3 additional `Promise.all` queries for PLAY_STARTED count, PLAY_COMPLETED count, historyEventCount

The pre-existing test file `apps/api/src/services/__tests__/profile-taste-service.test.ts` was not updated to account for these new DB calls. The mock setup (`setupSelectWhere`, `setupSelectJoinWhere`) exhausts before all queries complete, causing `Cannot read properties of undefined (reading 'from')` errors.

**All 14 tests in that file fail** — none pass. This is a T100-introduced regression (service is in the diff, test file is not).

**Required fix**: update the test mock setup to supply mocked return values for the additional DB calls (movie/series feature queries, credits queries, event count queries).

---

### BL-2: No `apps/mobile` client implementation

The ticket specifies "Current Web/Mobile and Android TV clients to emit meaningful events." The plan explicitly describes mobile instrumentation under §12. However, `apps/mobile` does not exist in this repository (only `apps/api`, `apps/web`, `apps/android-tv`, `apps/media-relay`).

If there is no mobile app in this codebase this criterion is vacuously satisfied, but the implementation output and plan claim mobile was in scope and addressed. **This must be clarified.**

---

## Acceptance Criteria — Status

| # | Criterion | Status | Notes |
|---|-----------|--------|-------|
| 1 | All behavioral data owned by `profileId` | ✅ PASS | FK with CASCADE DELETE on all 3 tables |
| 2 | Event taxonomy explicit/versioned/extensible | ✅ PASS | 41 types in `ALLOWED_EVENT_TYPES`, `schemaVersion` column, typed `InteractionEventType` in api-contracts |
| 3 | Web/Mobile/Android TV emit meaningful events | ⚠️ PARTIAL | Web ✅, Android TV ✅, Mobile: no `apps/mobile` directory |
| 4 | No per-second noisy playback telemetry | ✅ PASS | 10s debounce on progress sync, milestones at fixed thresholds only |
| 5 | Viewing behavior distinguishes start/abandon/partial/complete | ✅ PASS | PLAY_STARTED, PLAY_ABANDONED (on unmount >5%), WATCHED_N_PERCENT, PLAY_COMPLETED |
| 6 | Viewing sessions or equivalent summaries | ✅ PASS | `viewing_sessions` table with all plan-specified fields |
| 7 | Shelf impression/click groundwork | ✅ PASS | Event types + `shelfPosition`, `itemPositionInShelf`, `shelfConceptId` columns |
| 8 | Search behavior with retention safeguards | ✅ PASS | `searchQueryNormalized` nulled after 90 days by `retentionService.runCompaction()` |
| 9 | Canonical metadata joinable for genres/people/keywords | ✅ PASS | Via `mediaId`, `personId`, `mediaCredits` → `persons` joins |
| 10 | Missing TMDB metadata persisted in catalog tables | ✅ PASS | `metadata-enrichment-service.ts` upserts `persons`, sets `personId` FK on credits |
| 11 | Cast/crew/director relationships available | ✅ PASS | `persons` table; `media_credits` extended with `personId`, `isDirector`, `isCreator`, `department`, `job` |
| 12 | Keywords/collections/themes retained | ✅ PASS | `movies.keywords`, `series.keywords`, `movies.collectionId` all used in taste builder |
| 13 | Availability-aware ranking without leaking provider internals | ✅ PASS | `availabilityId` in events, `sourceId` in sessions |
| 14 | Derived taste features fully recomputable from history | ✅ PASS | `buildTaste()` recomputes from scratch from `viewingProgress`, `explicitFeedback`, `watchlist`, and `profileInteractionEvents` |
| 15 | Existing profile state backfilled without inventing history | ✅ PASS | Script uses actual timestamps, tags `schemaVersion: 0`, `origin: backfill` |
| 16 | Database retention/indexing prevents unbounded growth | ✅ PASS | 3-tier retention (HIGH_VALUE/STANDARD/ANALYTICS), 5 indexes added, no per-second events |
| 17 | Profile/account deletion removes owned data | ✅ PASS | CASCADE DELETE in schema for all 3 tables |
| 18 | Event recording failures don't break primary flows | ✅ PASS | Fire-and-forget throughout; batch endpoint swallows errors, never returns 5xx |
| 19 | Diagnostics show data volume and instrumentation health | ✅ PASS | 4 admin endpoints: `/admin/interaction-stats`, `/admin/taste-stats`, `/admin/interaction-health`, `/admin/retention-stats` |

---

## Plan Acceptance Criteria — Status

| # | Criterion | Status | Notes |
|---|-----------|--------|-------|
| AC-1 | All new columns on `profile_interaction_events` | ✅ PASS | All 16 columns verified in schema and migration |
| AC-2 | Event type constraint ~47 types | ✅ PASS | 41 types accepted; all ticket-taxonomy types present |
| AC-3 | Batch endpoint: ≤50, best-effort, no 5xx | ✅ PASS | Code verified |
| AC-4 | viewing_sessions; PLAY_STARTED creates session; PLAY_COMPLETED closes | ✅ PASS | Implemented in batch route |
| AC-5 | WATCHED_N_PERCENT fires at most once per session | ✅ PASS | Server-side idempotency via composite key |
| AC-6 | Web emits minimum event set | ✅ PASS | PLAY_STARTED, PLAY_PAUSED, PLAY_COMPLETED, DETAIL_OPENED, HOME_OPENED, SEARCH_PERFORMED, MY_LIST_ADDED, LIKED, DISLIKED, PROFILE_SELECTED all confirmed |
| AC-7 | Android TV emits PLAY_STARTED/PAUSED/COMPLETED/PROFILE_SELECTED | ✅ PASS | Verified in PlayerViewModel and ProfileViewModel |
| AC-8 | Mobile client same as Web | ❌ FAIL | No `apps/mobile` directory |
| AC-9 | profile_taste includes personScores, keywordScores, franchiseScores, languageScores, decadeScores | ✅ PASS | All columns in schema and built by `buildTaste()` |
| AC-10 | persons table; media_credits has personId | ✅ PASS | Both verified |
| AC-11 | Backfill creates events tagged origin:backfill | ✅ PASS | `metadataJson: { origin: 'backfill' }`, `schemaVersion: 0` |
| AC-12 | Admin stats endpoints return required data | ✅ PASS | All 4 endpoints implemented |
| AC-13 | Profile deletion removes rows in all 3 tables | ✅ PASS | CASCADE DELETE in schema; no integration test, but schema guarantee is sufficient |
| AC-14 | Two profiles produce different taste records | ✅ PASS (structural) | Structurally guaranteed — not runtime verified without live DB |
| AC-15 | All DB changes additive | ✅ PASS | Migration uses only ADD COLUMN and CREATE TABLE |
| AC-16 | searchQueryNormalized nulled by runCompaction() | ✅ PASS | Verified in retention-service.ts |

---

## Test Suite Summary

**Total tests run**: 997 (933 passed, 33 failed, 31 skipped)

**T100-introduced test failures**: 14 (all in `profile-taste-service.test.ts`)

**Pre-existing failures** (confirmed by comparison with pre-T100 stash): 19  
- `auth.test.ts` (3)  
- `vertical-slice.test.ts` (5)  
- `shelves.test.ts` (8)  
- `title-matching-service.test.ts` (1)  
- Various service tests (arrival-service, follow-release, media-reconciliation, media-relay-runtime, playback-resolver, scheduler-service): all pre-existing (entire test files fail)  
- `playback-integration.test.ts`, `profiles.test.ts`, `episodes-segments.test.ts`: entire files fail, pre-existing

---

## Observations

### What works well
- The idempotency design is correct at both client (milestone ref set) and server (unique index on idempotency_key WHERE NOT NULL) levels.
- The fire-and-forget pattern is consistently applied across all three clients.
- The migration is additive and safe; `IF NOT EXISTS` guards are in place.
- The retention service correctly handles the 3 categories separately (anonymize vs delete).
- The Android TV PLAY_STARTED correctly calls `emitBatch()` to get `sessionId` and stores it for subsequent events.

### Gaps
- **PLAY_ABANDONED is never emitted on Android TV** — only PLAY_COMPLETED is wired to STATE_ENDED. There is no equivalent to the web's unmount handler for abandonment.
- **CONTINUE_WATCHING_DISMISSED instrumentation** is not visible in the web codebase (no `grep` match for that event type being emitted). The event type exists in the taxonomy but may not be wired.
- **HOME_OPENED shelf events** (SHELF_IMPRESSION, SHELF_VIEWED) are defined in the taxonomy but no intersection observer code appears in `HomePage.tsx` — only `HOME_OPENED` is emitted. Shelf-level events require additional instrumentation.
- The `profile-taste-service.test.ts` mock setup was designed for the pre-T100 `buildTaste()` which made N genre-load calls; now it makes N×(1 genre + 1 media-features + 1 credits) + 3 event-count calls. The mock helper architecture needs to be extended.

---

## Required Before Approval

1. **Fix `profile-taste-service.test.ts` mocks** — update `setupBuildTaste` and `setupColdStart` helpers to stub the additional DB calls introduced by T100 (movie/series feature queries, credits query, and 3 event count queries). All 14 tests must pass.

2. **Clarify mobile platform status** — either document that no `apps/mobile` exists in this codebase (and update the plan accordingly), or implement the mobile instrumentation.

3. **Optionally (non-blocking)**: wire PLAY_ABANDONED on Android TV; wire CONTINUE_WATCHING_DISMISSED on Web; add shelf-level impression tracking in HomePage.tsx.
