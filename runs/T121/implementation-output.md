All done. Here is a summary of every file modified and what changed:

---

## Files modified

### `packages/api-contracts/src/query-plan.ts`
- Added `semanticProtection?: 'strict' | 'moderate' | 'none'` to `RecommendationQueryPlan`.

### `packages/api-contracts/src/recommendations.ts`
- Added `semanticContribution: number` and `profileContribution: number` to `ScoreBreakdown`.

### `apps/recommendation-engine/src/config.ts`
- Added three env-configurable exports: `SEMANTIC_FLOOR_STRICT` (default 0.40), `SEMANTIC_FLOOR_MODERATE` (default 0.28), `SEMANTIC_WEIGHT_THEMATIC` (default 0.40).

### `apps/recommendation-engine/src/services/shelf-concept-mapper.ts`
- Added `generationType?: string | null` to the input type.
- Added `resolveSemanticProtection()` that maps: `FIXED|EDITORIAL` → `'strict'`, `DISCOVERY` → `'none'`, anything else → `'moderate'`.
- The returned plan now includes `semanticProtection` set accordingly.

### `apps/recommendation-engine/src/routes/shelf-concepts.ts`
- Passes `generationType: concept.generationType` into `buildQueryPlanFromShelfConcept` at the `:id/preview` endpoint.

### `apps/recommendation-engine/src/pipeline/stages/hybrid-reranker.ts`
- Exported `getBlendedWeights` (previously private).
- Added `'thematic'` to `ExplorationLevel` with boosted `wSemantic = SEMANTIC_WEIGHT_THEMATIC` and proportionally reduced profile weights.
- `runHybridReranker` now selects blend level and semantic floor dynamically based on `plan.semanticProtection`: `'strict'` → thematic + 0.40 floor, `'moderate'` → thematic + 0.28 floor, `undefined` → exploit + no floor (no regression on existing paths).
- The floor is applied in the `eligible` filter alongside `passesHardFilters`.
- `buildReasons` accepts optional `semanticIntent` and emits `'strong semantic match to <first-3-words>'` / `'semantic match to <first-3-words>'` when provided.
- `ScoreBreakdown` now includes `semanticContribution` and `profileContribution` computed from the actual weights used.

### `apps/recommendation-engine/src/pipeline/stages/__tests__/hybrid-reranker.test.ts`
- Two new describe blocks with 5 new test cases covering the semantic floor check and the "profile cannot override semantic" proof (demonstrates that without the floor, B would outscore A, but the floor excludes B).

### `apps/recommendation-engine/src/pipeline/__tests__/pipeline-regression.test.ts`
- `makeRegressionPlan` now accepts an optional `semanticProtection` parameter.
- Added `'SF qui fait réfléchir'` regression test.
- Thematic intent tests (`Aventures à travers le temps`, `film qui retourne le cerveau`, `SF qui fait réfléchir`) now run with `semanticProtection: 'moderate'` and assert: top-5 semantic scores ≥ `SEMANTIC_FLOOR_MODERATE`, at least 3/10 results where `semanticContribution > profileContribution`, and top-5 semantic score spread < 0.25.
