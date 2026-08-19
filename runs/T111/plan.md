## Objective

Make `apps/recommendation-engine` the single authoritative computation engine for all recommendation logic — replacing its three stub pipeline stages with the real implementations currently embedded in `apps/api` — so that the Recommendation Lab and personalized Home invoke identical algorithms and produce identical ranked results from the same engine version.

## Included

### Phase 1 — Wire real implementations into recommendation-engine pipeline stages

**`apps/recommendation-engine/src/pipeline/stages/semantic-search.ts`**
- Implement pgvector cosine-distance query against the shared `media_embeddings` table, porting `semanticSearch()` from `apps/api/src/services/embedding-service.ts`
- Remove the `available: false` stub; return real `SemanticCandidate[]` using types from `packages/api-contracts/src/embeddings.ts`
- Fallback to array-based cosine computation if pgvector extension is absent (same logic as the existing api service)

**`apps/recommendation-engine/src/pipeline/stages/llm-planner.ts`**
- Implement OpenAI chat completion producing `RecommendationQueryPlan`, porting from `apps/api/src/services/llm-query-planner-service.ts` + `openai-llm-planner-provider.ts`
- Preserve 8-second timeout and graceful fallback to `rawQueryFallbackPlan()` from `packages/api-contracts/src/query-plan.ts`
- `LLM_PLANNER_MODEL` env var controls model selection; already present in `apps/recommendation-engine/src/config.ts`

**`apps/recommendation-engine/src/pipeline/stages/hybrid-reranker.ts`** (new file)
- Port `rankHybrid()` scoring weights and logic from `apps/api/src/services/recommendation-ranking-service.ts`
- Scoring factors: semantic (0.35), genreAffinity (0.25), themeAffinity (0.15), peopleAffinity (0.10), freshness (0.05), qualityPrior (0.10), availabilityBonus (0.05)
- Penalties: watched, abandoned, disliked, avoidSignals, repetition
- Post-filter diversity: max per collection, max per director

**`apps/recommendation-engine/src/db/schema.ts`**
- Add read-only Drizzle table references for tables that already exist in the shared DB and are needed by the hybrid reranker: `profile_taste`, `profile_interaction_events`, `movie_genres`, `series_genres`, `media_credits`, `movie_availabilities`, `series_availabilities`, `viewing_progress`
- No schema migrations required; tables are not new

**`apps/recommendation-engine/src/pipeline/pipeline.ts`**
- Wire hybrid-reranker as the fourth stage (after text-search + semantic-search merge)
- Thread `profileId` through the pipeline context so reranker can load taste signals from DB

### Phase 2 — Add shelf pipeline to recommendation-engine

**`apps/recommendation-engine/src/services/shelf-concept-generator.ts`** (new)
- Port `ShelfConceptGeneratorService` from `apps/api/src/services/shelf-concept-generator-service.ts`
- Includes profile context builder (30-day interaction events, genre scores, binge tendency, cold-start detection), LLM concept generation, TTL refresh logic, and feedback recording

**`apps/recommendation-engine/src/services/shelf-generator.ts`** (new)
- Port `generateShelfFromSeeds()` and `refreshGeneratedShelf()` from `apps/api/src/services/shelf-generation-service.ts`

### Phase 3 — Versioned internal API routes with engine metadata

**`apps/recommendation-engine/src/routes/query.ts`**
- Extend `POST /v1/query` response to include `engineMetadata`: `engineVersion`, `embeddingModelVersion`, `plannerModelVersion`, `rerankerVersion`, `timingsMs` (per stage dict), `fallbackFlags`

**`apps/recommendation-engine/src/routes/shelf-concepts.ts`** (new)
- `POST /v1/shelf-concepts/generate` — delegates to `ShelfConceptGeneratorService`
- `GET /v1/shelf-concepts` — returns active concept pool for a profile
- `POST /v1/shelf-concepts/:id/feedback` — records good/bad rating

**`apps/recommendation-engine/src/routes/shelf-instances.ts`** (new)
- `POST /v1/shelf-instances/generate` — delegates to `ShelfGeneratorService`, returns `ShelfInstanceDetail` with `engineMetadata`
- `GET /v1/shelf-instances/:id` — retrieve a previously generated instance

**`packages/api-contracts/src/engine-metadata.ts`** (new)
- Export `EngineMetadata` type: `{ engineVersion: string; embeddingModelVersion: string; plannerModelVersion: string; rerankerVersion: string; timingsMs: Record<string, number>; fallbackFlags: string[] }`

**`packages/api-contracts/src/recommendations.ts`**
- Add optional `engineMetadata?: EngineMetadata` to `RecommendationsResponse`

**`packages/api-contracts/src/embeddings.ts`**
- Add optional `engineMetadata?: EngineMetadata` to `SemanticQueryResponse`

### Phase 4 — Thin proxy in apps/api

**`apps/api/src/client/recommendation-engine-client.ts`** (new)
- Typed HTTP client for all recommendation-engine internal routes
- Per-request timeout; circuit-breaker pattern returning `null` on engine unavailability

**`apps/api/src/routes/recommendation-lab.ts`**
- Replace inline `loadTasteSignals()` + `rankHybrid()` invocation with `RecommendationEngineClient.query()`
- Keep LRU query-plan cache on the API side only if the engine does not deduplicate itself
- Keep authentication and profile ownership check; do not forward raw profile objects to the engine — send only `profileId`

**`apps/api/src/routes/recommendations.ts`**
- Replace `rankRecommendations()` call with `RecommendationEngineClient.query()`
- Policy post-filtering (availableToMe, mediaType, limit) applied in the API after receiving engine results, or forwarded as query params

**`apps/api/src/routes/shelf-concepts.ts`**
- Proxy `POST /shelf-concepts/generate` → engine `POST /v1/shelf-concepts/generate`
- Keep `POST /shelf-concepts/:id/feedback` as-is (pure DB write, no engine computation)

**`apps/api/src/routes/shelf-instances.ts`**
- Proxy generation requests to engine `POST /v1/shelf-instances/generate`
- Keep `GET /shelf-instances/:id` and performance routes in the API (telemetry reads from the same DB)

### Phase 5 — Resilient fallback

**`apps/api/src/client/recommendation-engine-client.ts`**
- When engine unreachable: return `{ coldStart: true, candidates: [], engineMetadata: null }` for query calls; return empty concept pool for shelf-concept calls
- `rankRecommendations()` (simple genre scoring) retained in `apps/api/src/services/recommendation-ranking-service.ts` as fallback invoked only on engine failure

### Phase 6 — Deprecation markers (after migration validated, before next ticket)

- Add `@deprecated — use recommendation-engine` JSDoc to `apps/api/src/services/`: `embedding-service.ts`, `semantic-retrieval-service.ts`, `llm-query-planner-service.ts`, `openai-llm-planner-provider.ts`, `shelf-concept-generator-service.ts`, `shelf-generation-service.ts`, and `rankHybrid()` in `recommendation-ranking-service.ts`
- Do not delete until callers have been migrated and tests confirm equivalence

## Excluded

- Migrating SYSTEM/MANUAL/DYNAMIC shelf logic (`shelf-service.ts`) — product-layer concerns unrelated to recommendation computation
- Migrating `shelf-fatigue-service.ts` — remains in apps/api as a suppression post-filter applied after engine output
- Migrating `shelf-instance-service.ts` (telemetry persistence) — apps/api continues to persist instances after receiving engine output
- Migrating `embedding-backfill-service.ts` — admin/maintenance route stays in apps/api
- Any frontend changes to the Recommendation Lab UI
- Authentication or authorization refactor — `profileId` is the only identifier crossing the internal API boundary; full profile objects stay in apps/api
- Schema migrations — all referenced tables already exist in the shared DB
- Changes to the external (public) API surface of apps/api

## Acceptance criteria

- `recommendation-engine POST /v1/query` with a real `profileId` invokes LLM planning, pgvector semantic retrieval, and hybrid reranking; no stage returns `available: false` with a "not yet implemented" reason
- Response JSON includes `engineMetadata` with non-null `plannerModelVersion`, `embeddingModelVersion`, `rerankerVersion`, and `timingsMs` keyed by stage name
- Recommendation Lab (apps/api `/recommendation-lab`) delegates to the engine client; the response forwards `engineMetadata` with the engine's version string
- `GET /profiles/:profileId/recommendations` also delegates to the engine and returns the same `engineVersion` in `engineMetadata`
- Given identical `profileId` + free-text query, Recommendation Lab and personalized Home return the same ordered `candidates` list (allowing only presentation-level differences: `limit`, `mediaType` filter)
- Stopping the recommendation-engine process: authentication, playback, Continue Watching, and catalog browsing remain fully functional; recommendation routes return a cold-start fallback without 5xx errors
- No `import` of `rankHybrid`, `OpenAIEmbeddingProvider`, or `LlmQueryPlannerService` remains on the hot recommendation path in `apps/api/src/routes/` (confirmed by grep)
- No raw profile interaction events or profile preference objects appear in any recommendation-engine HTTP response body
