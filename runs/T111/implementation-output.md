All done. Here's a summary of every change made to address the review:

---

## Files modified

### `packages/api-contracts/src/recommendations.ts`
- Added `'ENGINE'` to `RecommendationSource` union type (`'LOCAL' | 'DISCOVERY' | 'ENGINE'`)

### `apps/recommendation-engine/src/pipeline/types.ts`
- Added `reasons?: string[]` to `CandidateItem`
- Added `queryPlan?: RecommendationQueryPlan` to `QueryResponse`

### `apps/recommendation-engine/src/pipeline/stages/hybrid-reranker.ts`
- Reranker now populates `reasons` directly on `CandidateItem` (was hidden in a type-cast `scoreBreakdown`)

### `apps/recommendation-engine/src/pipeline/pipeline.ts`
- Added `queryPlan: ctx.queryPlan` to the pipeline response (exposed to callers)

### `apps/recommendation-engine/src/routes/personalized.ts` *(new)*
- `/v1/personalized` endpoint: accepts `profileId` + `mediaTypes?` + `limit?`, no `text`
- Fetches top-200 catalog candidates by popularity, runs hybrid reranker only
- Returns `engineMetadata.plannerModelVersion: 'none/profile-only'` — accurate metadata

### `apps/recommendation-engine/src/index.ts`
- Registers `personalizedRoutes`

### `apps/api/src/client/recommendation-engine-client.ts`
- Added `reasons?: string[]` and `queryPlan?: RecommendationQueryPlan` to `EngineQueryResult`
- Added `EnginePersonalizedResult` interface
- Added `personalized()` method calling `/v1/personalized`
- Added comment documenting the shared circuit-breaker scope (MINEUR 3)

### `apps/api/src/routes/recommendation-lab.ts`
- **BLOQUANT 1 fixed**: `expandWithLlm=true` now calls `RecommendationEngineClient.query()` first and uses its result as the primary `results`. Local deprecated services (`EmbeddingService`, `SemanticRetrievalService`, `LlmQueryPlannerService`) are only called in the fallback path when engine returns `null`. Also eliminates the double LLM call when both `expandWithLlm` and `useHybridRanking` are set.
- `mapEngineResultToCandidate`: `source: 'ENGINE'`, `reasons: r.reasons ?? []`

### `apps/api/src/routes/recommendations.ts`
- **BLOQUANT 2 fixed**: Home now calls `RecommendationEngineClient.personalized()` instead of `query({ text: '' })`
- `source: 'ENGINE'`, `reasons: r.reasons ?? []`

### `apps/api/src/routes/__tests__/recommendation-engine-delegation.test.ts` *(new)*
- 6 smoke tests verifying: Lab delegates to engine as primary, Home delegates to `personalized` endpoint (not `query`), both paths propagate the same `engineVersion`, `source: 'ENGINE'` on all engine results, and local fallback works when engine is unavailable
