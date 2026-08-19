## Objective

Wire each ShelfConcept's `semanticIntent` through the recommendation-engine pipeline (LLM planner → semantic retrieval → hybrid reranker → diversity/exposure penalties) so that every generated Home shelf draws its items from its own semantic query rather than from a generic genre-only ranking.

## Included

### 1. Root cause: replace the generic ranking call in pool filling

**`apps/api/src/services/home-pool-service.ts`**

- Replace the per-concept `rankRecommendations(profileId, { limit: N })` call with a call to the recommendation-engine pipeline, passing `concept.semanticIntent` as the query text and `profileId` for profile reranking.
- Pass already-excluded media IDs to the engine so same-session deduplication is respected.
- Map engine results (`semanticScore`, `profileScore`, `finalScore`, `reasonCodes`) onto `PersistShelfInstanceParams.items`.
- Enforce shelf policy before persisting:
  - If `concept.freshnessPolicy === 'AVAILABLE_NOW'` (WATCH_NOW shelves): hard-filter engine results to available items only.
  - DISCOVERY / ALL shelves: no availability filter.
- Forward `queryPlannerVersion`, `embeddingModelVersion`, `rankerVersion` from the engine response into `PersistShelfInstanceParams`.

### 2. Recommendation-engine client: add per-concept query method

**`apps/api/src/client/recommendation-engine-client.ts`**

- Add (or verify) a method `queryForShelf(params: { text: string; profileId: string; excludeMediaIds?: string[]; limit: number }): Promise<ShelfQueryResult>`.
- `ShelfQueryResult` returns `{ candidates: CandidateItem[]; queryPlannerVersion: string; embeddingModelVersion: string; rankerVersion: string }`.
- Reuse the existing `/v1/query` (or equivalent) route on the recommendation engine.

### 3. Recommendation-engine: expose pipeline versions in response

**`apps/recommendation-engine/src/pipeline/pipeline.ts`**

- Ensure the pipeline response includes `queryPlannerVersion`, `embeddingModelVersion`, and `rankerVersion` fields derived from `ctx.queryPlan.plannerMeta`, the embedding model constant, and `SCORE_MODEL_V1.version`.

### 4. Recommendation-engine: apply cross-session exposure penalty in hybrid reranker

**`apps/recommendation-engine/src/pipeline/stages/hybrid-reranker.ts`**

- Before final score computation, query `profile_media_exposure` for the candidate set.
- Apply a configurable penalty (e.g. `-0.05 × min(exposureCount, 4)`) to items already shown in recent sessions.
- This is additive to existing penalties; do not change the existing weight table or other penalty logic.

### 5. Shelf instance persistence: populate score columns

**`apps/api/src/services/shelf-instance-service.ts`** and **`apps/api/src/services/home-pool-service.ts`**

- Ensure `semanticScore`, `profileScore`, `finalScore`, `reasonCodes`, `queryPlannerVersion`, `embeddingModelVersion`, `rankerVersion` are written to `shelf_instances` and `shelf_instance_items` when the engine result is available.
- Schema columns already exist; this is about populating them from the engine response.

### 6. Fixed shelves: no change

**`apps/api/src/services/home-service.ts`** — `buildFixedShelves()` remains untouched. `sys_continue_watching` and `sys_my_list` must not route through semantic generation. No code change required here; document as explicit invariant in comments if not already noted.

### 7. Recommendation Lab: pipeline inspection endpoint

**`apps/api/src/routes/shelf-instances.ts`** (or a new sub-route)

- Add `GET /shelf-instances/:id/pipeline` returning, for a given `ShelfInstance`:
  - `semanticIntentSnapshot`, `queryPlannerVersion`, `embeddingModelVersion`, `rankerVersion`
  - Per-item: `rankPosition`, `semanticScore`, `profileScore`, `finalScore`, `reasonCodes`
- Used by the Recommendation Lab UI to display per-concept pipeline provenance.

### 8. Integration test: different concepts → different candidate pools

**`apps/api/src/__tests__/home-semantic-pipeline.test.ts`** (new file)

- Use the real catalog (read-only).
- Generate shelf instances for at least three distinct concepts:
  - `SF qui fait réfléchir`
  - `Comédies légères familiales`
  - `Thrillers en huis clos où personne n'est fiable`
- Assert that the top-5 item sets are disjoint or materially different (Jaccard similarity < 0.3 between any two).
- Assert that no two shelves in a 10-shelf Home generation for a single profile produce identical item lists.

## Excluded

- Changing the LLM query-planner prompt (`apps/recommendation-engine/src/prompts/query-planner-v1.ts`): the planner already produces a valid `semanticIntent`; its prompt is not in scope.
- Changing the embedding model, weight table in `SCORE_MODEL_V1`, or any pipeline stage logic beyond the exposure penalty in §4.
- UI changes to the Recommendation Lab beyond surfacing the existing `/pipeline` endpoint.
- Shelf concept generation (how concepts are created or expired).
- Any database schema migration: all required columns already exist.
- Changing the genre-only `rankRecommendations()` service itself; it remains available for non-concept use cases.
- Changing `buildFixedShelves()` or the fatigue/cooldown system.

## Acceptance criteria

1. **Semantic intent reaches retrieval**: For a given `ShelfConcept`, the `semanticIntent` field is passed as the query text to the recommendation-engine pipeline; the pipeline's `ctx.queryPlan.semanticIntent` is populated (not overridden to the raw genre fallback) for that call.
2. **QueryPlan hard filters honored**: A WATCH_NOW shelf (`freshnessPolicy = 'AVAILABLE_NOW'`) contains no items where `mediaAvailable = false`; a DISCOVERY shelf may contain unavailable items.
3. **Items differ by concept**: Running `buildHome()` for a real profile produces at least 10 shelves where each shelf's item list is verifiably derived from its own `semanticIntent` (confirmed via `semanticIntentSnapshot` in `shelf_instances` and non-overlapping item sets in `shelf_instance_items`).
4. **Provenance stored**: Every generated shelf instance has non-null `queryPlannerVersion`, `embeddingModelVersion`, `rankerVersion`; every item has non-null `semanticScore`, `profileScore`, `finalScore`.
5. **Exposure penalty applied**: After two shelves have been generated in the same call, items already shown in the first shelf receive a lower `finalScore` in subsequent shelves (verifiable in the `finalScore` column relative to a baseline without the penalty).
6. **Fixed shelves unaffected**: `sys_continue_watching` and `sys_my_list` do not route through the recommendation engine; their item lists are unchanged from the current behaviour.
7. **Recommendation Lab endpoint responds**: `GET /shelf-instances/:id/pipeline` returns HTTP 200 with `semanticIntentSnapshot` and per-item scores for any persisted generated shelf.
8. **Integration test passes**: `home-semantic-pipeline.test.ts` asserts Jaccard < 0.3 between the three reference concept item sets and passes against the real catalog.
