Implementation complete. Here's a summary of all changes:

---

## Files modified / created

### Schema & contracts (additive, non-breaking)
- **`packages/api-contracts/src/shelf-concepts.ts`** — `semanticAnchor?: string | null` added to `ShelfConcept`
- **`packages/api-contracts/src/query-plan.ts`** — `semanticAnchor?: string | null` added to `RecommendationQueryPlan`
- **`apps/api/src/db/schema/shelf-concepts.ts`** — `semanticAnchor: text('semantic_anchor')` column
- **`apps/recommendation-engine/src/db/schema.ts`** — same column
- **`apps/api/migrations/0049_t123_shelf_concept_anchor.sql`** *(new)* — `ALTER TABLE shelf_concepts ADD COLUMN semantic_anchor TEXT`

### LLM prompts
- **`apps/recommendation-engine/src/prompts/shelf-concept-generator-v1.ts`** — added `semanticAnchor` field + anchor extraction instructions for compound thematic intents
- **`apps/api/src/prompts/shelf-concept-generator-v1.ts`** — same
- **`apps/recommendation-engine/src/prompts/query-planner-v1.ts`** — added `semanticAnchor` to output schema + instructions

### Services
- **`apps/recommendation-engine/src/services/shelf-concept-mapper.ts`** — accepts and forwards `semanticAnchor` to query plan
- **`apps/recommendation-engine/src/services/shelf-concept-generator.ts`** — persists and maps `semanticAnchor`
- **`apps/api/src/services/shelf-concept-generator-service.ts`** — same

### Config & pipeline
- **`apps/recommendation-engine/src/config.ts`** — `SEMANTIC_ANCHOR_BLEND_ALPHA = 0.45` (env-overridable; `0.0` = legacy behavior)
- **`apps/recommendation-engine/src/pipeline/stages/semantic-search.ts`** — dual-embedding: when `semanticAnchor` is present, embeds both intent and anchor in parallel, blends distances in SQL as `ALPHA × anchorDist + (1-ALPHA) × intentDist`

### Tests
- **`apps/recommendation-engine/src/pipeline/stages/__tests__/semantic-search-blend.test.ts`** *(new)* — 7 pure unit tests for the blend formula, no DB/API calls
- **`apps/recommendation-engine/src/pipeline/__tests__/pipeline-regression.test.ts`** — added 2 T123 integration tests (benchmark shelf + "Enquêtes policières dans l'espace"), `makeRegressionPlan` accepts optional `semanticAnchor`
- **`apps/recommendation-engine/src/services/__tests__/shelf-concept-mapper.test.ts`** — 3 new anchor-forwarding tests
