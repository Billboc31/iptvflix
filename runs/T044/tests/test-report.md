I now have all the information needed to produce the test report.

---

## T044 — Test Report

**Branch**: `ticket/T044-add-refresh-semantics-for-generated-and-recommenda`  
**Date**: 2026-08-12  
**Tester**: Claude (Tester role)

---

### Test Execution Results

| Test File | Tests | Result |
|---|---|---|
| `shelf-generation-service.test.ts` | 21/21 | PASS |
| `shelves.test.ts` (routes) | 44/44 | PASS |
| Full suite (all other files) | 490/491 | PASS (1 unrelated failure) |

**Pre-existing failure** (unrelated to T044):  
`title-matching-service.test.ts > UNMATCHED row is upgraded to MATCHED` — duplicate `tmdb_id` DB constraint collision in test setup. This failure exists on main and predates T044.

---

### Acceptance Criteria

| # | Criterion | Evidence | Status |
|---|---|---|---|
| 1 | Generated/recommendation Shelves can be refreshed without recreating the Shelf | `refreshGeneratedShelf()` deletes members and re-inserts them inside a transaction while preserving the Shelf row; route `POST /shelves/:id/refresh` returns 200 | **PASS** |
| 2 | Manual Shelves are never automatically recomputed | `refreshGeneratedShelf()` throws `ValidationError('Shelf is not a GENERATED shelf')` when called on a MANUAL shelf; route returns 400; no automatic trigger exists | **PASS** |
| 3 | Refresh uses current taste/candidate/availability state and produces deterministic ordering for the same inputs | "unchanged refresh" test verifies identical member IDs and positions across two consecutive refreshes; ranking service called with stored rules each time | **PASS** |
| 4 | Newly relevant candidates can enter; no-longer-valid candidates can leave | "changed candidate pool" test: new candidate `MOVIE_ID_D` appears in second refresh. "changed availability" test: zero members written when `availableToMe` filter empties the candidate list | **PASS** |
| 5 | Duplicate canonical Media not created during refresh | "deduplication" test: only 2 `insert` calls (shelf + members) when discovery candidate already has `canonicalMovieId`. "materialization" test: 3 calls (canonical movie + shelf + members) when link is absent | **PASS** |
| 6 | Last-evaluated/refresh metadata persisted and exposed | `generatedAt` stored in `rules` JSONB, updated on every refresh; exposed in `ShelfResponse` (via `shelf-service.ts:394`) and in `GenerateShelfResponse.explanation` | **PASS** |
| 7 | Tests cover: unchanged refresh, changed candidate pool, changed availability, changed taste, manual-Shelf protection | All four semantic scenarios in `describe('refresh — semantic scenarios')` + `rejects refresh on a non-GENERATED shelf` test + route-level 400 guard | **PASS** |

---

### Regressions

None. All 490 pre-existing tests still pass.

---

### Validation Limits

- All tests are unit/integration tests with mocked DB and ranking service. No end-to-end (HTTP → real database) validation was performed.
- The web client `refreshShelf()` function exists in `apps/web/src/lib/api.ts` but no frontend tests were run — UI behaviour was not verified.
- Background scheduling is explicitly out of scope and correctly absent.

---

**Verdict: PASS** — all 7 acceptance criteria satisfied, no regressions detected.
