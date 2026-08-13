I now have a complete picture. Let me write the test report.

---

## Test Report — T060

### Test execution summary

**Full suite**: 652 tests across 46 files — **648 pass, 4 fail**

All failing tests are in a single file: `src/__tests__/integration/vertical-slice.test.ts`

---

### Acceptance criteria status

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | Xtream movie with valid TMDB ID uses direct external-ID path | **PASS** | `catalog-sync-service.test.ts` — "reuses an existing movie row when tmdbId already exists", "maps two provider streams with the same tmdbId to one movie" |
| 2 | Xtream movie without TMDB ID evaluated by title-matching during sync | **PASS** | `catalog-sync-service.test.ts` — "provider item without TMDB ID, confident match: attaches availability to canonical movie" |
| 3 | Series without TMDB IDs use same resolution; type-safe from movies | **PASS** | `catalog-sync-service.test.ts` — "series without TMDB ID is matched via title matching service"; `title-matching-service.test.ts` — "MOVIE input with only SERIES candidates produces UNMATCHED" |
| 4 | Confident match associates TMDB identity, attaches Availability to canonical Media | **PASS** | `title-matching-service.test.ts` — "first match — high-confidence single candidate produces MATCHED row with movieId" |
| 5 | Multiple provider entries for same artwork converge on one Media | **PASS** | `catalog-sync-service.test.ts` — "multiple provider items matching the same canonical movie converge on one movie row" |
| 6 | Low-confidence / ambiguous TMDB results do not cause false merges | **PASS** | `catalog-sync-service.test.ts` — "ambiguous match result: local UNMATCHED movie created, no false merge"; `title-matching-service.test.ts` — "two equally-scored candidates produce AMBIGUOUS" |
| 7 | Unmatched items remain stored, visible and playable | **PASS** | `catalog-sync-service.test.ts` — "zero TMDB candidates: UNMATCHED local movie created and remains playable" |
| 8 | Unmatched items retain state for later retry | **PASS** | `title-matching-service.test.ts` — "UNMATCHED row is upgraded to MATCHED on retry with a clear winner"; "re-match with zero candidates does not downgrade an existing MATCHED row" |
| 9 | UI-facing Media APIs expose canonical title, not dirty provider title | **PASS** | `catalog-sync-service.test.ts` — `movies.matchStatus` is `MATCHED` for TMDB-resolved items; `catalog.test.ts` — enrichmentStatus reflects tmdbId/synopsis presence |
| 10 | Raw provider titles remain at Availability/source level | **PASS** | `catalog-sync-service.test.ts` — `avRows[0].rawTitle === '4K-FR - Dune Part Two 2024 1080p'` verified |
| 11 | Language/quality metadata attached to Availability, not canonical Media | **PASS** | `variant-extractor.test.ts`, `availability-resolver.test.ts` — all 51 tests pass |
| 12 | Re-running sync with unchanged data is idempotent | **PASS** | `catalog-sync-service.test.ts` — "repeat sync", "re-sync with identical snapshot is idempotent when matching service is provided" |
| 13 | Bounded TMDB call strategy, no uncontrolled parallel burst | **PASS** | `title-matching-service.test.ts` — "matchBatch bounded concurrency — peak in-flight calls never exceeds the limit"; `catalog-sync-service.test.ts` — "withBoundedConcurrency limits concurrent in-flight tasks" |
| 14 | Temporary TMDB failure does not destroy/drop content | **PASS** | `catalog-sync-service.test.ts` — "TMDB failure during pre-pass: affected item stored as UNMATCHED, sync completes"; `title-matching-service.test.ts` — "matchBatch per-item TMDB failure returns UNMATCHED for failing item without aborting the batch" |
| 15 | Automated tests cover all scenarios listed | **PASS** | All scenario types present: direct-ID, title match, ambiguous, no match, year-tiebreak, Movie/Series separation, multi-variant convergence, canonical title, retry, idempotency, concurrency/rate-limit |

---

### Failing tests — blocking issue

**Root cause**: `triggerSync` (in `sync-runs-service.ts:223`) was refactored to run the sync in the background via `void (async () => { ... })()` and immediately returns a `RUNNING` row. The vertical slice tests were written expecting synchronous behavior — they assert `status === 'DONE'` on the `POST /sync-runs` response body.

**4 tests fail**:

| Test | Expected | Received |
|------|----------|----------|
| happy path: full pipeline produces correctly shaped canonical movies and series | `status: 'DONE'` | `status: 'RUNNING'` |
| empty catalog sync — GET /movies and GET /series return empty lists | `status: 'DONE'` | `status: 'RUNNING'` |
| sync error — MSW returns 500, sync run records FAILED status | `status: 'FAILED'` | `status: 'RUNNING'` |
| source disappearance: canonical movie and user-state survive when availability is removed | `status: 'DONE', moviesAdded: 2` | `status: 'RUNNING', moviesAdded: 0` |

The async sync itself works correctly — the sync does complete and create records in the DB (visible in the stdout logs of subsequent tests). The problem is purely that the vertical slice HTTP-layer tests were not updated to match the new async route contract.

**This is a blocking regression.** The tests cover important end-to-end scenarios (happy path, error handling, source disappearance) that must pass before the implementation can be considered complete.

---

### Verdict

**FAIL — implementation fix required**

All 15 acceptance criteria have unit-level and integration-level test coverage that passes. However, 4 vertical slice integration tests fail because the `POST /sync-runs` route now returns asynchronously (`RUNNING`) while the tests expect a synchronous `DONE`/`FAILED` response. The vertical slice tests must be updated to poll for sync completion (or the sync must provide a synchronous test mode), and all tests must pass before the ticket can be closed.
