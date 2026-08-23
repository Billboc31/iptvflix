Everything looks correct. Here's a summary of all changes made:

---

## Files modified

**`apps/recommendation-engine/src/config.ts`**
Added `PROFILE_BOOST_MIN_FACTOR` (default `0.15`) and `PROFILE_BOOST_MODULATION_POWER` (default `1.5`), both env-overridable.

**`packages/api-contracts/src/recommendations.ts`**
Extended `ScoreBreakdown` with 8 new fields: `semanticRelevanceNormalized`, `semanticConfidenceFactor`, `profileBoostRaw`, `profileBoostEffective`, `semanticPercentile`, `rawVectorRank`, `finalRank`, `rankDelta`.

**`apps/recommendation-engine/src/pipeline/stages/hybrid-reranker.ts`**
- Imported the two new config constants
- Added exported pure function `computeSemanticConfidenceFactor(similarity, poolMin, poolMax, minFactor, power)` — monotone, bounded in `[minFactor, 1.0]`, degeneracy-safe (uniform pool → 1.0)
- Before scoring loop: computed `rawRankById`, `poolSemanticMin/Max`, `semanticPercentileById`
- Inside scoring loop: separated `profileBoostRaw` / `qualityContrib` / `semanticContribution`; applied `semanticConfidenceFactor` (only when `blendLevel === 'thematic'`, else `1.0`); `profileBoostEffective = profileBoostRaw × factor`; individual per-signal contributions now reflect effective (modulated) values
- After sort: patched `finalRank` and `rankDelta` into each item's breakdown; flagged candidates with `rankDelta < -3` and `semanticPercentile < 0.33`

**`apps/recommendation-engine/src/pipeline/stages/__tests__/hybrid-reranker.test.ts`**
Added `describe('T122 — computeSemanticConfidenceFactor')` with 6 tests covering: pool bottom/top values, monotonicity, uniform-pool degeneracy, profile boost ordering, bounds invariant.

**`apps/recommendation-engine/src/pipeline/__tests__/pipeline-regression.test.ts`**
- "Aventures à travers le temps": added T122 assertions (≥4 of top-8 are temporal titles, The Hobbit not in top-5, ≥3 candidates with `profileBoostEffective < profileBoostRaw`)
- "film qui retourne le cerveau" and "SF qui fait réfléchir": added `semanticConfidenceFactor` population check and `profileBoostEffective ≤ profileBoostRaw` invariant check

All 53 unit tests pass; TypeScript reports zero errors.
