All tasks complete. Here is the full summary of what was implemented.

---

## Summary

### Files modified

**`apps/recommendation-engine/src/pipeline/types.ts`**
- Added `available?: boolean` to `CandidateItem` so availability status flows through the pipeline.

**`apps/recommendation-engine/src/db/schema.ts`**
- Added read-only `profileMediaExposure` table reference so the engine can query cross-session exposure counts.

**`apps/recommendation-engine/src/pipeline/stages/hybrid-reranker.ts`**
- Added `loadExposureCounts()` — queries `profile_media_exposure` for the candidate set.
- Added `exposureCount` to `EnrichedCandidate`.
- Applied exposure penalty in scoring: `-0.05 × min(exposureCount, 4)`.
- Populated `scoreBreakdown: { semantic, profileScore, finalScore }` on each output item.
- Included `available` and `scoreBreakdown` in the output `CandidateItem`.

**`apps/api/src/client/recommendation-engine-client.ts`**
- Added `ShelfCandidateItem` and `ShelfQueryResult` interfaces.
- Added `queryForShelf()` method — wraps the existing `/v1/query` call, maps results to typed shelf candidates (uppercasing `mediaType`, extracting `semantic`/`profileScore` from `scoreBreakdown`, version strings from `engineMetadata`).

**`apps/api/src/services/home-pool-service.ts`**
- Replaced the `rankRecommendations()` call in the shelf generation loop with `RecommendationEngineClient.queryForShelf({ text: concept.semanticIntent, ... })`.
- Added freshness policy filter: `AVAILABLE_NOW` shelves keep only `available: true` items.
- Persists `semanticScore`, `profileScore`, `finalScore`, `latencyMs`, and real version strings (`queryPlannerVersion`, `embeddingModelVersion`, `rankerVersion`) from the engine response.
- Falls back gracefully to `rankRecommendations()` if the engine is unavailable.

**`apps/api/src/routes/shelf-instances.ts`**
- Added `GET /shelf-instances/:id/pipeline` endpoint returning `semanticIntentSnapshot`, version fields, and per-item scores for Recommendation Lab inspection.

### New file

**`apps/api/src/__tests__/home-semantic-pipeline.test.ts`**
- Integration test (skipped if `RECOMMENDATION_ENGINE_URL` not set) asserting:
  - Three distinct concept texts produce candidate sets with Jaccard similarity < 0.3.
  - Each query returns `semanticScore > 0` for at least one item.
  - Version metadata is non-empty.
  - `fillPoolAsync` generates shelves with non-null provenance and non-identical item lists.
