# Plan — T116: Unifier tous les parcours de recommandation sur le pipeline sémantique + SCORE_MODEL_V2

## Objective

Unify all recommendation paths — user query (`/v1/query`), personalized home (`/v1/personalized`), shelf generation from seeds, and Lab ShelfConcept preview — onto a single central pipeline using semantic retrieval + `SCORE_MODEL_V2` + diversity, eliminating scoring inconsistencies and the misleading raw-vector Lab preview.

## Included

### 1. New central recommendation service

**File**: `apps/recommendation-engine/src/pipeline/recommendation-service.ts` (new)

Extract from `runPipeline` (`pipeline.ts:36-134`) a new exported function:

```ts
runRecommendationFromPlan(
  plan: RecommendationQueryPlan,
  opts: {
    profileId?: string;
    mediaTypes?: MediaType[];
    limit?: number;
    candidatePoolSize?: number;  // default 200
    debug?: boolean;
  },
  requestId: string,
  log: FastifyBaseLogger
): Promise<RecommendationResult>
```

- Runs semantic search → text fallback (if vector unavailable) → `runHybridReranker` with `SCORE_MODEL_V2`
- Accepts a pre-built `RecommendationQueryPlan`; skips the LLM planner entirely
- Returns identical debug metadata to `runPipeline`: query plan, candidate count, score breakdown per dimension, model versions, timings, fallback flags

Update `pipeline.ts` to call `runRecommendationFromPlan` after its own LLM planner step, removing duplicated retrieval + reranker logic.

---

### 2. Fix `/v1/personalized`

**File**: `apps/recommendation-engine/src/routes/personalized.ts`

- Remove the `fetchCatalogCandidates()` top-200 popularity-based pool (lines 74-126)
- Add helper `buildProfileQueryPlan(profileId: string, mediaTypes: MediaType[]): Promise<RecommendationQueryPlan>`:
  - Reads taste signals from `profileTaste` table
  - Derives `semanticIntent` from top genre/theme labels + recent signals
  - Adds `softPreferences` for dominant decades and languages
  - Cold-start path: if no taste signals, returns a generic plan with empty `semanticIntent` (popularity/quality prior remains a V2 score factor, not a candidate filter)
- Replace direct `runHybridReranker()` call with `runRecommendationFromPlan(plan, opts, requestId, log)`
- Fix `engineMetadata.rerankerVersion` to always report `'v2'`

---

### 3. Fix shelf generation from seeds

**File**: `apps/recommendation-engine/src/services/shelf-generator.ts`

- Add `buildSeedQueryPlan(seeds: MediaItem[], mediaTypes: MediaType[]): RecommendationQueryPlan`:
  - Aggregates genres, themes, keywords, people, language, decade from seed metadata and embeddings
  - Constructs `semanticIntent` string from aggregated attributes
  - Populates `avoidSignals` with seed IDs to exclude them from results
- Replace `rankCandidatesForShelf` + `resolveGeneratedMembers` genre-only ranking with a call to `runRecommendationFromPlan(plan, { profileId, mediaTypes, candidatePoolSize: 200 })`
- Keep `availableToMe`, `mediaType`, and existing hard exclusion filters
- Update `GeneratedShelfRules` metadata to include the derived semantic plan

---

### 4. Fix Lab ShelfConcept preview

**File**: `apps/recommendation-engine/src/routes/shelf-concepts.ts` (or wherever `/v1/shelf-concepts` routes are defined)

Add `POST /v1/shelf-concepts/:id/preview` endpoint:

- **Request body**: `{ profileId: string; debug?: boolean }`
- Builds a `RecommendationQueryPlan` from the concept's `semanticIntent`, `desiredMediaTypes`, `freshnessPolicy`, and applicable hard filters
- Returns two modes in a single response:
  - `rawVector`: top-50 vector results via `semanticQuery({ query: concept.semanticIntent, topK: 50 })` — raw, no rerank
  - `finalPersonalized`: `runRecommendationFromPlan(plan, { profileId, limit: 20, debug: true })`
- Response schema:
  ```ts
  {
    rawVector: { id: string; title: string; vectorScore: number }[];
    finalPersonalized: {
      id: string; title: string;
      finalScore: number;
      scoreBreakdown: ScoreBreakdown;
    }[];
    candidatePoolSize: number;
    queryPlan: RecommendationQueryPlan;
  }
  ```

**Assumption**: the Lab frontend currently calls `semanticQuery` via a backend endpoint or directly. This plan covers the backend endpoint; the Lab UI calling the new `/v1/shelf-concepts/:id/preview` endpoint is out of scope for the backend but must be noted to the frontend team.

---

### 5. Scoring consistency

**File**: `apps/recommendation-engine/src/pipeline/stages/hybrid-reranker.ts`

- Mark `SCORE_MODEL_V1` as `@deprecated` (do not delete: used in tests as a reference baseline)
- Confirm `runHybridReranker` uses `SCORE_MODEL_V2` when called from `runRecommendationFromPlan`
- Remove any remaining conditional model selection in `personalized.ts`

---

### 6. Tests

**File**: `apps/recommendation-engine/src/pipeline/__tests__/recommendation-service.test.ts` (new)

- Verify a candidate at vector rank > 5 can appear in final top-10 after V2 scoring (semantic rerank test)
- Verify `buildProfileQueryPlan` with no taste signals falls back to cold-start without error

**File**: `apps/recommendation-engine/src/services/__tests__/shelf-generator.test.ts` (extend or create)

- Verify `buildSeedQueryPlan` produces a non-empty `semanticIntent` from 3 seed items
- Verify final shelf from seeds excludes seed IDs
- Ambiguous intent tests: `"Aventures à travers le temps"`, `"Épopées modernes"`, `"film qui retourne le cerveau"` — assert final results score above a threshold and are not purely lexical matches

## Excluded

- Shelf display strategy and layout on Home (next ticket, per T116 hors scope section)
- Contextual recommendations on film/series detail pages
- Cache, invalidation, and regeneration strategy for shelf computation
- Inter-shelf diversity pass (future)
- `maxMaturityRating` / `kidsOnly` filter enforcement (noted as unimplemented in `query-plan.ts`)
- Changes to the LLM planner prompt, model, or its output schema
- Frontend Lab UI changes (displaying the two preview modes — depends on the new endpoint)
- Embedding model changes or re-indexing of `media_embeddings`

## Acceptance criteria

- `POST /v1/shelf-concepts/:id/preview` returns both `rawVector` and `finalPersonalized` fields; `finalPersonalized` uses `runHybridReranker` with `SCORE_MODEL_V2` weights
- `POST /v1/personalized` response no longer references `fetchCatalogCandidates()` as candidate source; uses semantic retrieval via `runRecommendationFromPlan`
- `POST /v1/personalized` response `engineMetadata.rerankerVersion === 'v2'`
- A shelf generated from seeds routes through `runRecommendationFromPlan`; seed IDs absent from final results
- All three paths (`/v1/query`, `/v1/personalized`, shelf from seeds) share `runRecommendationFromPlan`; debug output shows: `queryPlan` → `candidatePoolSize` → V2 score breakdown per dimension → applied filters → final results
- No endpoint returns `rerankerVersion: 'v1'` in production paths
- Recommendation-service test passes: a candidate outside top-5 vector results appears in final top-10 after V2 scoring
- Ambiguous intent tests pass without panic or empty results
