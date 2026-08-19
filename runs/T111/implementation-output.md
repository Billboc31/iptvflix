All tasks complete. The workspace type-checks cleanly across all 7 packages. Here's a summary of what was done in this session continuation:

**Task 8 — API routes updated to delegate to engine:**
- `apps/api/src/config/env.ts`: Added `RECOMMENDATION_ENGINE_URL` export
- `apps/api/src/routes/recommendations.ts`: Tries `RecommendationEngineClient.query()` first; falls back to `rankRecommendations()` when engine unavailable
- `apps/api/src/routes/recommendation-lab.ts`: Both `useHybridRanking` blocks (LLM-expanded and default paths) now call `RecommendationEngineClient.query()` first; fall back to local `rankHybrid()` + `enrichAsHybridCandidates()` when engine unreachable
- `apps/api/src/routes/shelf-concepts.ts`: `generate` and `getActivePool` endpoints proxy to engine; `feedback` stays as local DB write
- `apps/api/src/routes/shelves.ts`: `POST /shelves/generate` and `POST /shelves/:id/refresh` proxy to engine with local fallback

**Task 9 — Deprecation markers added** (`// @deprecated — use recommendation-engine`) to:
- `embedding-service.ts`, `semantic-retrieval-service.ts`, `llm-query-planner-service.ts`, `openai-llm-planner-provider.ts`, `shelf-concept-generator-service.ts`, `shelf-generation-service.ts`
- `rankHybrid()` in `recommendation-ranking-service.ts` (JSDoc `@deprecated`)

**Bug fixed:** `shelfConcepts.id` in the engine's schema was missing `.defaultRandom()`, causing a TS insert error.
