I have all the context I need. Here is the plan:

## Objective

Prevent SCORE_MODEL_V2 from letting profile signals (genre/language/era) override semantic relevance in thematic ShelfConcepts by introducing a configurable semantic floor, a context-aware weight blend, enriched score breakdown, and intent-aware reason codes. The personalization must reorder within the relevant pool, not replace it.

## Included

### `packages/api-contracts/src/query-plan.ts`
- Add optional `semanticProtection?: 'strict' | 'moderate' | 'none'` to `RecommendationQueryPlan`.
- No schema version bump needed (additive optional field).

### `packages/api-contracts/src/recommendations.ts`
- Add `semanticContribution: number` and `profileContribution: number` to `ScoreBreakdown`.
  - `semanticContribution = semantic * wSemantic`
  - `profileContribution = weighted - semanticContribution - freshness*wFreshness - prior*wPrior - availBonus*wAvailability`

### `apps/recommendation-engine/src/services/shelf-concept-mapper.ts`
- Accept `generationType?: 'PERSONALIZED' | 'EXPLORATION' | 'DISCOVERY' | 'FIXED' | 'EDITORIAL'` in the input object.
- Set `semanticProtection` in the returned plan:
  - `'FIXED' | 'EDITORIAL'` → `'strict'`
  - `'PERSONALIZED' | 'EXPLORATION'` → `'moderate'`
  - `'DISCOVERY'` → `'none'`
  - `undefined` → `'moderate'` (safe default for thematic ShelfConcepts)

### `apps/recommendation-engine/src/routes/shelf-concepts.ts`
- Pass `generationType: concept.generationType` to `buildQueryPlanFromShelfConcept` at the `:id/preview` endpoint.

### `apps/recommendation-engine/src/config.ts`
Add three env-variable exports:
- `SEMANTIC_FLOOR_STRICT` (default `0.40`) — floor for `'strict'` plans
- `SEMANTIC_FLOOR_MODERATE` (default `0.28`) — floor for `'moderate'` plans
- `SEMANTIC_WEIGHT_THEMATIC` (default `0.40`) — wSemantic override for thematic blends

### `apps/recommendation-engine/src/pipeline/stages/hybrid-reranker.ts`
**`getBlendedWeights`** — add `'thematic'` level:
- `wSemantic: SEMANTIC_WEIGHT_THEMATIC` (env, default 0.40)
- Profile signals scaled down proportionally so total weighted mass is consistent with V2 (genre 0.14, theme 0.08, people 0.06, keyword 0.08, franchise 0.04, language 0.04, decade 0.03, mediaType 0.03 — all reduced to leave room for boosted semantic)
- `wFreshness`, `wPrior`, `wAvailability` unchanged

**`runHybridReranker`** — replace hardcoded `getBlendedWeights(SCORE_MODEL_V2, 'exploit')` with dynamic selection on `plan.semanticProtection`:
- `'strict'` → `'thematic'` blend + semantic floor `SEMANTIC_FLOOR_STRICT`
- `'moderate'` → `'thematic'` blend + semantic floor `SEMANTIC_FLOOR_MODERATE`
- `'none'` | `undefined` → `'exploit'` blend + no floor (unchanged behavior)

Apply the semantic floor immediately after `passesHardFilters`, before scoring — candidates below the floor are excluded entirely.

**`buildReasons`** — accept optional `semanticIntent?: string`:
- When `semantic > 0.7` and `semanticIntent` is provided: push `'strong semantic match to <first-3-words-of-intent>'`
- When `semantic > 0.5` and `semanticIntent` is provided: push `'semantic match to <first-3-words-of-intent>'`
- Existing generic `'strong semantic match'` / `'semantic match'` used as fallback when no intent text

Update `ScoreBreakdown` construction in the scoring loop to populate the two new fields.

Pass `plan.semanticIntent` into `buildReasons` at the call site.

### `apps/recommendation-engine/src/pipeline/stages/__tests__/hybrid-reranker.test.ts`
Two new unit test cases (no DB/network, use `makeCandidate`):
1. **Semantic floor**: given `semanticProtection: 'moderate'` and `SEMANTIC_FLOOR_MODERATE = 0.28`, a candidate with `similarity = 0.20` is excluded before scoring regardless of genre/language affinity.
2. **Profile cannot override semantic**: under `'moderate'` protection, a candidate with `semantic = 0.70` and low profile signals scores higher than a candidate with `semantic = 0.26` and maximum genre+language+era affinity.

Both tests call `runHybridReranker` with a mocked DB (vi.mock) or alternatively unit-test the floor/weight functions directly if exported.

### `apps/recommendation-engine/src/pipeline/__tests__/pipeline-regression.test.ts`
Extend existing `'Aventures à travers le temps'` test (and add `'SF qui fait réfléchir'`, `'film qui retourne le cerveau'`):
- `makeRegressionPlan` must set `semanticProtection: 'moderate'` explicitly for these cases.
- Assert `result.results.slice(0, 5).every(r => (r.scoreBreakdown?.semantic ?? 0) >= 0.28)` — no top-5 result with sub-floor semantic score.
- Assert at least 3 of the top-10 results have `semanticContribution > profileContribution` — semantic drives the top of the shelf.
- For "SF qui fait réfléchir": assert no result in top-5 has a semantic score that is the lowest in the top-10 (`maxSemantic - minSemantic < 0.25` in top-5, i.e. no extreme outlier saved by profile alone).

## Excluded

- Modifying the LLM planner prompt or its output contract to set `semanticProtection` (tracked separately).
- Changing `runPipeline` / free-text query path — `semanticProtection` will be `undefined` there, falling back to `'exploit'` (no regression).
- UI changes to the Recommendation Lab frontend beyond what the existing `scoreBreakdown` field already exposes.
- Adding new `ShelfConceptGenerationType` values.
- Changing the semantic retrieval stage (vector search, embeddings, filtering).
- Diversity filter logic changes.

## Acceptance criteria

- `packages/api-contracts/src/query-plan.ts` defines `semanticProtection` as an optional union field on `RecommendationQueryPlan`.
- `ScoreBreakdown` exposes `semanticContribution` and `profileContribution` as numeric fields.
- `buildQueryPlanFromShelfConcept` accepts `generationType` and sets `semanticProtection` according to the mapping above; `PERSONALIZED` → `'moderate'`, `DISCOVERY` → `'none'`, `EDITORIAL` → `'strict'`.
- The three new config exports exist in `config.ts` with documented defaults.
- `getBlendedWeights` handles the `'thematic'` level; weights sum to the same total as V2 baseline (≤ 1.0).
- Candidates with `similarity < SEMANTIC_FLOOR_MODERATE` do not appear in the scored set when `semanticProtection === 'moderate'`.
- The existing `'exploit'` path (no `semanticProtection`) is unchanged — all current passing tests remain green.
- The two new unit tests in `hybrid-reranker.test.ts` pass without a database connection.
- The extended regression tests for "Aventures à travers le temps", "SF qui fait réfléchir", and "film qui retourne le cerveau" pass (skipped when `OPENAI_API_KEY` / `DATABASE_URL` absent, consistent with existing test pattern).
- `buildReasons` emits `'strong semantic match to <intent>'` when `semantic > 0.7` and a `semanticIntent` string is present.
- `scoreBreakdown.reasons` for a high-semantic candidate includes a semantic reason string, not just genre/language/era signals.
