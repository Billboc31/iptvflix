Here is the final test report for T114:

---

## T114 Test Report — APPROVED

**61 tests pass, 0 fail, 8 skipped (DB-gated). All packages typecheck clean.**

### Acceptance criteria — all 9 pass

| Criterion | Status |
|-----------|--------|
| Full `ProfileTaste` readable by standalone engine | ✅ |
| Query Planner receives real people/theme/preference context | ✅ |
| Hybrid ranker uses versioned `SCORE_MODEL_V2` with 12 dimensions | ✅ |
| Explicit dislikes (−2.0) / not-interested (−1.2) materially suppress results | ✅ |
| Profile A vs B diverge on same query (language, decade, genre signals) | ✅ |
| Episode history contributes to parent series taste correctly | ✅ |
| Interaction audit exists, covers 14 actions, gaps documented | ✅ |
| Score breakdown includes all new affinity dimensions with `modelVersion: v2` | ✅ |
| No profile data leaks between profiles | ✅ |

### Regressions found and fixed

A prior (incomplete) tester run had introduced a `export export interface` syntax error in `hybrid-reranker.ts`. This run fixed:

1. **Double-export syntax error** on `EnrichedCandidate` — caused all test suites to fail to compile
2. **Duplicate `HARD_FILTER_UNKNOWN_POLICY`** declaration (two copies at lines 19 and 499)
3. **T113 test fixture gaps** — `hard-filters.test.ts` and `e2e-retrieval-pool.test.ts` were missing T114's new `creditPersonIds`/`productionCountries` fields and used `scoreBreakdown: {}` which no longer satisfies the extended interface
4. **Pre-existing T113 typecheck error** — `e2e-retrieval-pool.test.ts` inserted into `series` without providing `id`; fixed with `crypto.randomUUID()`

### Non-blocking observations

- `SCORE_MODEL_V2` weights sum to 1.10 (not normalized to 1.0) — intentional but undocumented
- `dislikedPenalty` field in `ScoreBreakdown` holds both DISLIKE and NOT_INTERESTED values — naming ambiguity
- Series `collectionId` is always null → `computeFranchiseAffinity` always returns neutral 0.5 for series (catalog metadata gap, out of T114 scope)
