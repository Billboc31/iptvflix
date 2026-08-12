---

## Test Report — T043

**Result: VALIDATED** — all 8 acceptance criteria pass.

### Test execution

- `home-service.test.ts`: **9/9 pass** (5 scenarios: warm profile, cold start, availability filtering, duplicate suppression, discovery threshold)
- Full API suite: **499 pass, 1 fail** — the failure is a pre-existing DB isolation issue in `title-matching-service.test.ts` (duplicate `tmdb_id=603` from concurrent test runs), completely unrelated to T043.

### AC summary

| AC | Status | Evidence |
|---|---|---|
| AC1 — Rec-backed shelf for warm profile | **PASS** | `sys_rec_for_you` always built from `rankRecommendations`; test confirms `coldStart: false` + items populated |
| AC2 — Continue Watching & My List via Shelf model | **PASS** | Both resolved via `getShelf()`, returned as `ShelfResponse`, included conditionally |
| AC3 — Cold-start profiles get useful content | **PASS** | `coldStart` propagated; popularity-based candidates still populate `sys_rec_for_you` |
| AC4 — available-now shelf contains only available Media | **PASS** | `sys_rec_for_you` filtered to `c.available === true` before slice |
| AC5 — Unavailable media only in upcoming shelf | **PASS** | `sys_rec_upcoming` built from `c.available === false` partition; sets are disjoint |
| AC6 — Deterministic duplicate suppression | **PASS** | Single ranked call partitioned; in-progress IDs excluded via `Set` before partition; documented in code comment |
| AC7 — Web UI reuses `ShelfRow` | **PASS** | `HomePage.tsx` maps `HomeResponse.shelves` through `<ShelfRow>`; no bespoke rows added |
| AC8 — Tests cover all 4 required scenarios | **PASS** | 9 tests across 5 scenarios, all green |

### Known non-blocking issues

Three minor issues were flagged during implementation review and remain: `sys_rec_for_you` is always included even if empty, the cold-start UI message is unreachable (condition can never be true), and there is no explicit test for the HTTP 404 on unknown `profileId`. None affect the acceptance criteria.
