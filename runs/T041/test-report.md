---
ticket: T041
date: 2026-08-12
tester: claude-sonnet-4-6
verdict: PASS
---

# T041 — Test Report

## Test execution

```
pnpm test -- --reporter=verbose   (from apps/api/)
Test Files: 1 failed | 32 passed (33)
Tests:      1 failed | 461 passed (462)
```

The single failure is `title-matching-service.test.ts > UNMATCHED row is upgraded to MATCHED on retry` — a pre-existing integration test collision (`tmdb_id=603` already present in the shared test DB). Explicitly documented in `implementation-output.md` as predating this branch. **Not a T041 regression.**

All 12 `recommendation-ranking-service.test.ts` tests pass.

---

## Acceptance criteria

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | Service returns ordered recommendation candidates for a profile | **PASS** | `rankRecommendations()` returns `RecommendationsResponse.candidates[]` sorted score DESC / mediaId ASC. Route registered at `GET /profiles/:profileId/recommendations`. Scenarios 1, 6, 7 exercise ordering. |
| 2 | Candidates may include currently unavailable/upcoming Media when the request allows it | **PASS** | Default `availableToMe=false` — no availability filter applied; all local Media and non-expired discovery rows included. `available` field still populated per candidate. |
| 3 | `availableToMe=true` uses existing Availability state and returns only currently available candidates | **PASS** | Service queries `movieAvailabilities`/`seriesAvailabilities` with `status='AVAILABLE'`; scenario 3 confirms unavailable movie is absent, available movie present with `available: true`. |
| 4 | Explicit negative feedback prevents or strongly suppresses affected Media | **PASS** | `negativeMediaIds` set used to hard-filter before scoring (`candidates.filter`). Scenario 2 confirms disliked media absent from results. |
| 5 | Already consumed content handled by documented deterministic rules | **PASS** | Movies ≥ 90% progress → −10 score penalty; `includeSeen=true` disables penalty. Series: no suppression (documented design choice). Scenarios 4a and 4b both pass. |
| 6 | Every returned recommendation includes a concise reason/explanation signal | **PASS** | `reasons: string[]` present on every `RecommendationCandidate`. Warm: genre names / `"liked"` / `"discovery"`. Cold-start: `["popular pick"]`. Verified in scenarios 1, 6, 8. |
| 7 | Cold-start profiles receive useful deterministic fallback recommendations | **PASS** | `signalCount === 0` or missing taste row → `coldStart: true`, score = `popularity × voteAverage`. Scenario 6 confirms ordering (800 > 350) and `coldStart` flag. Second test confirms no-taste-row case. |
| 8 | Automated tests cover positive affinity, negative feedback, availability filtering, seen-content handling, local/external candidates and cold start | **PASS** | 12 tests across 9 scenarios: affinity (S1), negative (S2), availability (S3), seen (S4×2), local+discovery+dedup (S5×2), cold-start (S6×2), determinism (S7), positive bonus (S8), mediaType filter (S9). All pass. |

---

## Regressions observed

None introduced by T041. The one failing test (`title-matching-service`) is a pre-existing DB state issue documented in `implementation-output.md`.

---

## Blocking issues

None.

---

## Notes / minor observations

- **Cold-start local candidates**: local `movies`/`series` rows have no `popularity`/`voteAverage` in the schema (those fields exist only on `discoveryCandidate`). In cold-start mode they score `0 × 0 = 0` and tie-break by `mediaId`. This pushes them below any discovery candidate with real scores — reasonable but not explicitly tested. Not a blocker.
- **Series seen-content**: the −10 penalty applies only to movies (progress tracked at movie level). Series suppression is intentionally omitted and documented. Aligns with AC5's "documented deterministic rules".
- **`NOT_INTERESTED` vs `DISLIKE`**: both are expected to land in `negativeMediaIds` (produced by the taste service, T040). The ranking service correctly excludes all IDs in that set regardless of the originating signal type.
