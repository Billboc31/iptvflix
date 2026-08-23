## Objective

Improve semantic retrieval precision for compound thematic shelf intents so the defining anchor concept (e.g. *time travel*) drives similarity ranking rather than being diluted by secondary themes (e.g. *adventure*, *journey*). The fix must generalise to any compound thematic concept without hardcoding specific shelves or titles.

## Included

### Root-cause diagnosis
- `apps/recommendation-engine/src/pipeline/stages/semantic-search.ts` — a single embedding of the full `semanticIntent` text causes uniform cosine-similarity weighting across all mentioned concepts; broad secondary themes (adventure, journey) generate false positives for compound intents.
- `apps/api/src/prompts/shelf-concept-generator-v1.ts` — the LLM prompt does not instruct the model to structurally separate the *defining* anchor of a compound concept from its secondary themes.

### Schema additions (additive, non-breaking)
- `packages/api-contracts/src/shelf-concepts.ts` — add `semanticAnchor?: string`: a short phrase (5–15 words) naming the most restrictive defining concept (e.g. `"time travel and temporal displacement"`).
- `packages/api-contracts/src/query-plan.ts` — add `semanticAnchor?: string` to `RecommendationQueryPlan`.

### Prompt improvements
- `apps/api/src/prompts/shelf-concept-generator-v1.ts` — add an instruction to extract `semanticAnchor` for compound thematic intents. The anchor must name the *most restrictive* concept and explicitly exclude generic secondary themes. The first sentence of `semanticIntent` must lead with this anchor and use contrast language ("specifically about X, not merely Y or Z").
- `apps/recommendation-engine/src/prompts/query-planner-v1.ts` — apply the same anchor-extraction instruction so ad-hoc user queries benefit from the same mechanism.

### Concept mapper
- `apps/recommendation-engine/src/services/shelf-concept-mapper.ts` — forward `concept.semanticAnchor` to `queryPlan.semanticAnchor`.

### Dual-embedding in semantic search
- `apps/recommendation-engine/src/pipeline/stages/semantic-search.ts`:
  - When `queryPlan.semanticAnchor` is present, call `embedQuery` for the anchor phrase in addition to the full `semanticIntent`.
  - Compute `anchorSimilarity = 1 − cosineDistance(anchorVector, candidateVector)`.
  - Compute blended similarity: `similarity = SEMANTIC_ANCHOR_BLEND_ALPHA × anchorSimilarity + (1 − SEMANTIC_ANCHOR_BLEND_ALPHA) × intentSimilarity`.
  - When no anchor is present, fall back to the existing single-embedding behaviour unchanged.

### Config constant
- `apps/recommendation-engine/src/config.ts` — add `SEMANTIC_ANCHOR_BLEND_ALPHA = 0.45` (env-overridable). Setting it to `0.0` must reproduce the current single-embedding behaviour exactly.

### DB migration
- Add nullable column `semantic_anchor TEXT` to the `shelf_concepts` table. Existing rows remain `NULL`; the updated prompt populates the column for newly generated concepts. No backfill of existing rows in this ticket.

### Regression tests
- `apps/recommendation-engine/src/pipeline/__tests__/pipeline-regression.test.ts`:
  - **Benchmark shelf — "Aventures à travers le temps"**: assert that at least 4 of the top-8 final results are temporal-themed candidates (title keywords: Time / Chrono / Visitor / Temporal / Lapse or equivalent fixture markers), and that generic adventure/travel-only candidates (`L'Avventura`, `France, le fabuleux voyage`, etc.) do not appear in the top-5.
  - **Second compound intent**: add a test for a distinct compound concept (e.g. `"Enquêtes policières dans l'espace"`) asserting that the defining anchor concept dominates over each secondary theme independently.
  - Both tests must run against the existing fixture corpus; no live DB or embedding API calls.

## Excluded

- Hardcoding shelf titles, movie titles, or concept-specific logic anywhere in production code.
- Modifying production database rows manually or backfilling existing `shelf_concepts` rows.
- Changing `hybrid-reranker.ts` scoring weights, `SCORE_MODEL_V2`, or profile-boost modulation.
- Changing the embedding model or provider (`text-embedding-3-small` / OpenAI).
- Applying anchor extraction to `FIXED` or `EDITORIAL` shelves (already have well-formed intents; left for a follow-up).
- UI or API endpoint changes.

## Acceptance criteria

- For the benchmark shelf **"Aventures à travers le temps"**, at least 4 of the top-8 final ranked candidates are genuinely temporal-themed, and none of the four observed false-positive examples (`L'Avventura`, `France, le fabuleux voyage`, `Mystery at the Louvre Museum`, `Treasure Island`) appear in the top-5.
- When `queryPlan.semanticAnchor` is absent (all legacy concepts), semantic search output is byte-for-byte identical to the current implementation.
- Setting `SEMANTIC_ANCHOR_BLEND_ALPHA=0` reproduces current single-embedding behaviour; increasing it towards `1.0` shifts weight to the anchor embedding.
- Regression test for "Aventures à travers le temps" and the second compound intent both pass.
- `SEMANTIC_FLOOR_MODERATE`, `SEMANTIC_WEIGHT_THEMATIC`, and profile-boost modulation constants remain unmodified.
- All previously passing tests remain green.
- No shelf-specific code paths and no hardcoded titles in production code.
