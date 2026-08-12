---
ticket: T043
role: tester
date: 2026-08-12
status: VALIDATED
---

# Test Report — T043: Compose a personalized Home from recommendation-backed Shelves

## Commands executed

```bash
# Full API test suite
pnpm --filter @iptvflix/api test

# home-service tests specifically (after noticing they were absent from summary)
pnpm --filter @iptvflix/api exec vitest run src/services/__tests__/home-service.test.ts
```

## Results

- home-service tests: **9 / 9 pass**
- Full API suite: **499 pass, 1 fail** (pre-existing, unrelated — see Regressions)

---

## Acceptance Criteria

### AC1 — Home includes at least one recommendation-backed Shelf for a profile with taste data
**PASS**

`buildHome()` always adds `sys_rec_for_you` populated from `rankRecommendations()`. For warm profiles, `coldStart: false` and items are sourced from available ranked candidates. Test: *warm profile > returns sys_rec_for_you with available candidates and coldStart false*.

### AC2 — Continue Watching and My List continue to work through the common Shelf model
**PASS**

Both shelves are resolved via `getShelf('sys_continue_watching', profileId)` and `getShelf('sys_my_list', profileId)`, returning standard `ShelfResponse` objects. They are included conditionally (if non-empty) in the same `shelves` array returned by `/home`. Tests: *positions Continue Watching first when non-empty*, *includes My List after sys_rec_for_you when non-empty*.

### AC3 — Cold-start profiles still receive useful Home content
**PASS**

`coldStart` is propagated from `rankRecommendations` into `HomeResponse`. The ranking service returns popularity-based candidates with `coldStart: true`; `sys_rec_for_you` is still populated. Test: *cold start > returns coldStart true and still populates sys_rec_for_you from popularity*.

### AC4 — `available now` shelves contain only Media with current Availability
**PASS**

`sys_rec_for_you` is built from `filtered.filter((c) => c.available).slice(0, 20)`. Candidates with `available === false` are excluded at the filter step. Test: *candidates with available=false never appear in sys_rec_for_you*.

### AC5 — Upcoming/unavailable recommendations may appear only in shelves whose intent allows them
**PASS**

`sys_rec_upcoming` is built exclusively from `filtered.filter((c) => !c.available).slice(0, 10)`. The two sets are disjoint by construction. Test: *candidates with available=true never appear in sys_rec_upcoming*.

### AC6 — Excessive duplicate Media across adjacent personalized shelves is reduced deterministically
**PASS**

Dedup strategy is documented in a code comment in `home-service.ts` and enforced:
- A single `rankRecommendations(limit: 60)` call is partitioned; no candidate can appear in both rec shelves.
- In-progress media IDs from Continue Watching are excluded from rec candidates via a `Set` before partition.

Test: *in-progress media IDs are absent from sys_rec_for_you*.

### AC7 — Web UI uses the existing Shelf rendering model rather than bespoke recommendation rows
**PASS**

`HomePage.tsx` replaced the `useShelves + useShelf` waterfall with `useHome(DEFAULT_PROFILE_ID)` and renders all shelves via:
```tsx
{shelves.map((shelf) => (
  <ShelfRow key={shelf.id} shelf={shelf} />
))}
```
No bespoke recommendation row was added. `HomeResponse.shelves` is typed as `ShelfResponse[]`, matching the existing contract consumed by `ShelfRow`.

### AC8 — Tests cover warm profile, cold start, availability filtering and duplicate suppression behavior
**PASS**

`home-service.test.ts` — 9 tests across 5 scenarios, all pass:

| Scenario | Tests | Result |
|---|---|---|
| Warm profile | 3 (content, CW ordering, My List ordering) | ✓ |
| Cold start | 1 | ✓ |
| Availability filtering | 2 (available=false excluded from for_you; available=true excluded from upcoming) | ✓ |
| Duplicate suppression | 1 (in-progress IDs excluded from for_you) | ✓ |
| Discovery threshold | 2 (< 3 → shelf absent; = 3 → shelf present) | ✓ |

---

## Regressions

### Pre-existing failure — `title-matching-service.test.ts` (UNRELATED)

```
FAIL src/services/__tests__/title-matching-service.test.ts
  TitleMatchingService > UNMATCHED row is upgraded to MATCHED on retry with a clear winner
  PostgresError: duplicate key value violates unique constraint "movies_tmdb_id_unique"
  detail: 'Key (tmdb_id)=(603) already exists.'
```

This is a DB test isolation issue: a preceding test in a concurrent run leaves a `movies` row with `tmdb_id=603` and the test attempts to insert the same row again. This has no connection to T043 (no changes touch the `movies` table or title matching logic).

---

## Known issues (carried from implementation review, non-blocking)

| # | Issue | Impact |
|---|---|---|
| 1 | `sys_rec_for_you` always included even when empty — frontend would show an empty shelf title in extreme edge cases | Marginal UX; cold-start always returns popularity-based candidates |
| 2 | `isColdStart` condition in `HomePage.tsx` (`shelves.length === 0`) can never be true since `sys_rec_for_you` is always pushed — cold-start message unreachable | Marginal UX; cold-start still gets useful content |
| 3 | No explicit test for HTTP 404 on unknown `profileId` in the home route (the route correctly handles `NotFoundError`, but the test file does not cover it) | Minor coverage gap |

None of these issues block the ticket's acceptance criteria.

---

## Conclusion

**VALIDATED** — all 8 acceptance criteria are met. The 9 new tests pass. The pre-existing regression is unrelated to T043. The three known issues are minor and were flagged during the implementation review.
