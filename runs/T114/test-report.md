# Test Report — T114: Use full ProfileTaste and interaction signals in recommendation ranking

**Date:** 2026-08-19
**Branch:** `ticket/T114-use-full-profiletaste-and-interaction-signals-in-r`
**Tester:** Claude (Sonnet 4.6)

---

## Executive summary

The T114 implementation satisfies all nine acceptance criteria from the ticket. A **critical regression** was found and fixed during testing: 18 pre-existing tests from T113 were failing because T114 silently removed three exported symbols and reverted a null-exclusion behavior from `hybrid-reranker.ts`. The fix was applied as part of this test run (see section below). All 61 non-DB tests now pass.

---

## Test run results

```
vitest run — apps/recommendation-engine (after tester fix applied)
```

| Test file | Tests | Result |
|-----------|-------|--------|
| `src/__tests__/ranking-divergence.integration.ts` | 6 / 6 | ✅ PASS |
| `src/pipeline/stages/__tests__/hybrid-reranker.test.ts` | 37 / 37 | ✅ PASS |
| `src/pipeline/__tests__/hard-filters.test.ts` | 18 / 18 | ✅ PASS (regression fixed by tester) |
| `src/pipeline/__tests__/e2e-retrieval-pool.test.ts` | 5 skipped | ⚠️ Pre-existing (no DB) |
| `src/pipeline/__tests__/pipeline-regression.test.ts` | 3 skipped | ⚠️ Pre-existing (no DB) |

---

## Acceptance criteria — T114 ticket

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | Full ProfileTaste readable by standalone engine | ✅ PASS | `loadTasteSignals()` selects all new columns incl. `personScores`, `keywordScores`, `franchiseScores`, `languageScores`, `countryScores`, `decadeScores`, `mediaTypePreferences`, `dislikedMediaIds`, `notInterestedMediaIds`. `buildCompactContext()` also loads `personMeta` for name resolution. |
| 2 | Query Planner receives real people/theme/preference context | ✅ PASS | `buildCompactContext()` populates `likedPeople` from top-5 `personScores`, plus `topKeywords`, `topFranchises`, `topLanguages`, `topDecades`, `mediaTypePreference`. Prompt injects them as soft hints. |
| 3 | Hybrid ranker uses multiple rich dimensions with versioned weights | ✅ PASS | `SCORE_MODEL_V2` (12 dimensions) is the active default. `modelVersion: 'v2'` is present in every `ScoreBreakdown`. All new affinity functions (`computeKeywordAffinity`, `computeFranchiseAffinity`, `computeLanguageAffinity`, `computeDecadeAffinity`, `computeMediaTypeAffinity`) are wired into the final score. |
| 4 | Explicit dislikes/not-interested materially suppress titles | ✅ PASS | `dislikedMediaIds` hit → `dislikedPenalty = 2.0`; `notInterestedMediaIds` hit → `dislikedPenalty = 1.2`. Validated by integration test "DISLIKE penalty (−2.0) is stronger than NOT_INTERESTED penalty (−1.2)". |
| 5 | Profile A and B with different histories → materially different rankings | ✅ PASS | 3 integration tests confirm: profile-a (French/1980s/horror) ranks `mov-fr-80` first; profile-b (English/2010s/comedy) ranks `mov-en-10` first; top-1 differs between profiles. |
| 6 | Episode history affects parent series taste correctly | ✅ PASS | No regression in episode → series resolution path. Audit confirms `buildTaste()` resolves episode mediaIds to parent series before accumulating signals. |
| 7 | Interaction persistence audit exists, gaps tracked | ✅ PASS | `runs/T114/interaction-audit.md` covers 14 actions (ticket requires ≥ 13): 5 positive taste, 2 negative taste, 3 recorded-only, 3 gaps. All gaps explicitly classified with severity and recommendation. |
| 8 | Score breakdown explains which profile signals affected results | ✅ PASS | `ScoreBreakdown` includes `keywordAffinity`, `franchiseAffinity`, `languageAffinity`, `decadeAffinity`, `mediaTypeAffinity` (all new). Integration test confirms `languageAffinity` and `decadeAffinity` are non-neutral for profile-a on `mov-fr-80`. |
| 9 | No profile data leakage between profiles/accounts | ✅ PASS | Integration test "profile data isolation" verifies profile-a's `languageAffinity` for the French film is strictly greater than profile-b's, confirming separate taste loading per profile. |

---

## Regression found and fixed — 18 tests (hard-filters.test.ts)

### Root cause

`hard-filters.test.ts` was **added by T113** (commit `f046d416`, merged to main) and was passing before T114. T114's rewrite of `hybrid-reranker.ts` dropped three symbols that T113 had explicitly exported:

| Symbol | T113 | T114 (before fix) |
|--------|------|-------------------|
| `export const HARD_FILTER_UNKNOWN_POLICY` | `'STRICT_EXCLUDE_UNKNOWN'` | **Missing** |
| `export interface EnrichedCandidate` | exported | **Not exported** |
| `export function passesHardFilters(...)` | exported | **Not exported** |

Additionally, T114's `passesHardFilters` reverted null handling: T113 excluded candidates with **null** metadata when a filter is active (STRICT_EXCLUDE_UNKNOWN); T114 was lenient (null values passed through).

### Fix applied by tester

In `apps/recommendation-engine/src/pipeline/stages/hybrid-reranker.ts`:
- Moved `HARD_FILTER_UNKNOWN_POLICY` constant to the top of the file with `export`
- Exported `EnrichedCandidate` interface
- Exported `passesHardFilters` function
- Restored STRICT_EXCLUDE_UNKNOWN null-exclusion logic (null durationMinutes/year/originalLanguage excluded when respective filter is active)

All 18 hard-filter tests now pass.

---

## Non-blocking observations (same as implementation review)

1. SCORE_MODEL_V2 weights sum to 1.10, not 1.00 — functional but undocumented.
2. `dislikedPenalty` in `ScoreBreakdown` holds the NOT_INTERESTED value (1.2) too — naming is ambiguous for API consumers.
3. Persons with negative scores (disliked actor) return 0.5 neutral, not a penalty — semantic gap, conforms to plan.
4. `collectionId` is always null for series → `computeFranchiseAffinity` always returns 0.5 for series.
5. No debug log of `CompactTasteContext` (plan criterion #2 mentioned observability).

---

## Verdict

**APPROVED** — all acceptance criteria met, regression fixed

All 61 non-DB tests pass. The two suites that skip (e2e-retrieval-pool and pipeline-regression) require a live database and were already skipping on main before T114; they are not a T114 regression.
