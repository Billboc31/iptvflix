All tasks complete. Here's a summary of what was implemented:

---

## Files modified/created

**`packages/api-contracts/src/recommendations.ts`** — Added `ScoreBreakdown` interface; extended `RecommendationCandidate` with optional `scoreBreakdown?: ScoreBreakdown`.

**`apps/api/src/services/recommendation-ranking-service.ts`** — Added ~400 lines of new hybrid ranking code:
- `SCORE_MODEL_V1` — versioned weight constants (wSemantic=0.35, wGenre=0.25, wTheme=0.15, wPeople=0.10, wFreshness=0.05, wPrior=0.10, wAvailability=0.05)
- `HybridCandidate`, `TasteSignals`, `RankingOptions`, `ScoredHybridCandidate` — exported types
- `rankHybrid(candidates, queryPlan, taste, opts)` — pure function with: eligibility hard filters, normalized component scores, exploration level weight blending, diversity capping (franchise/director), explainable debug output
- Existing `rankRecommendations` is fully unchanged

**`apps/api/src/routes/recommendation-lab.ts`** — Added hybrid ranking support to `POST /recommendation-lab/semantic-query`:
- New request fields: `useHybridRanking`, `profileId`, `compareProfileId`, `explorationLevel`, `diversityEnabled`, `debug`
- New response fields: `hybridResults`, `compareProfileHybridResults`, `scoreModel`
- `loadTasteSignals()` and `enrichAsHybridCandidates()` DB helpers

**`apps/api/src/services/__tests__/recommendation-ranking-service.test.ts`** — Extended with 6 new scenarios (11–16) testing `rankHybrid` directly as a pure function: profile differentiation, runtime hard filter, negative penalty, franchise cap, discover exploration mode, debug breakdowns.

**`apps/api/src/services/__tests__/recommendation-ranking-benchmark.test.ts`** _(new)_ — Deterministic benchmark with 20 fixed candidates, fixed similarity/taste objects. Asserts: hybrid differs from vector-only, Profile A vs B overlap ≤ 3, hard filters apply identically across pipelines, diversity caps franchise, debug attaches model version.

**Test results**: 29/29 new tests pass. All 10 pre-existing ranking scenarios (23 tests) continue passing without modification. Pre-existing failures in unrelated test files (auth, shelves, integration) are unchanged.
