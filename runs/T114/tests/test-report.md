Here is the full test report summary:

---

## T114 Test Report — Summary

**Verdict: APPROVED** (after tester fix)

### Test results

| Suite | Tests | Result |
|-------|-------|--------|
| `ranking-divergence.integration.ts` | 6/6 | ✅ PASS |
| `hybrid-reranker.test.ts` (affinity functions) | 37/37 | ✅ PASS |
| `hard-filters.test.ts` | 18/18 | ✅ PASS (regression fixed) |
| `e2e-retrieval-pool.test.ts` | 5 skipped | ⚠️ Pre-existing (no DB) |
| `pipeline-regression.test.ts` | 3 skipped | ⚠️ Pre-existing (no DB) |

### Acceptance criteria: all 9 pass

All acceptance criteria from the ticket are satisfied — full `ProfileTaste` loading, rich planner context, `SCORE_MODEL_V2` with 12 dimensions, tiered penalties (−2.0 / −1.2), A/B profile divergence, episode→series resolution, interaction audit (14 actions), score breakdown, and profile isolation.

### Regression found and fixed

T114's rewrite of `hybrid-reranker.ts` dropped three exports that T113 had introduced (`HARD_FILTER_UNKNOWN_POLICY`, `EnrichedCandidate`, `passesHardFilters`) and reverted `passesHardFilters` to lenient null-handling. This broke 18 tests from `hard-filters.test.ts` (added in T113, present in main).

**Fix applied**: restored the three exports and the `STRICT_EXCLUDE_UNKNOWN` null-exclusion logic. All 18 tests now pass.

### Non-blocking observations (from implementation review, unchanged)
- SCORE_MODEL_V2 weights sum to 1.10 (undocumented)
- `dislikedPenalty` field holds both DISLIKE and NOT_INTERESTED values (naming ambiguity)
- Series `collectionId` always null → franchise affinity always 0.5 for series
- No debug log of `CompactTasteContext`
