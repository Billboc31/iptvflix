Implementation complete. Here's a summary:

---

## Changes made

**`apps/recommendation-engine/src/config.ts`**
- Added `PROFILE_MODULATION_POWER = 1.5` (env-overridable via `PROFILE_MODULATION_POWER`).

**`packages/api-contracts/src/recommendations.ts`**
- Added `semanticRelevanceFactor`, `profileBoostRaw`, `profileBoostEffective` to `ScoreBreakdown`.

**`apps/recommendation-engine/src/pipeline/stages/hybrid-reranker.ts`**
- Imported `PROFILE_MODULATION_POWER` from config.
- Exported `computeSemanticRelevanceFactor(semantic, poolMaxSemantic, power)` — pure function: `(semantic / poolMaxSemantic) ^ power`.
- Pre-pass before scoring: `poolMaxSemantic = Math.max(...eligible.map(c => c.similarity ?? 0), Number.EPSILON)`.
- Replaced the flat `weighted` sum: profile taste signals are now summed as `profileBoostRaw`, multiplied by `semanticRelevanceFactor` to get `profileBoostEffective`, and quality signals (`freshness`, `prior`, `availability`) remain unmodulated.
- Three new fields populated in every `ScoreBreakdown`.

**`apps/recommendation-engine/src/pipeline/stages/__tests__/hybrid-reranker.test.ts`**
- Added `computeSemanticRelevanceFactor` import.
- New `describe('computeSemanticRelevanceFactor')` block with 5 unit tests covering: pool leader = 1.0, zero semantic = 0, monotonicity, identical-affinity ordering, and power-steepness.

**`apps/recommendation-engine/src/pipeline/__tests__/pipeline-regression.test.ts`**
- Added `T124-precision` block: verifies broad adventure titles (`hobbit`, `journey to the center`, `hors limites`) cannot rank above genuine temporal titles on "Aventures à travers le temps"; also validates the three new `ScoreBreakdown` fields are present.
- Added `T124-personalization` block: three broader shelves (`films d'action`, `comédies romantiques`, `thrillers psychologiques`) each assert ≥ 5 results — confirming personalization is not over-suppressed on broad shelves.

**`apps/recommendation-engine/src/pipeline/__tests__/recommendation-service.test.ts`**
- Updated the mock candidate pool: `mov-7` similarity changed from `0.10` to `0.55` — with `(0.55/0.90)^1.5 ≈ 0.48` factor, the profile boost is preserved enough for promotion to top-3, consistent with T124's intended behavior (personalization reorders within the relevant set, not across a large semantic gap).
