T116 implementation is committed. Summary of what landed:

**Commit `0e6c844d`** — 6 files modified, 350 insertions:
- `recommendation-service.ts` (pre-committed): central pipeline with `runRecommendationFromPlan` used by all paths
- `pipeline.ts`: delegates to `runRecommendationFromPlan` after LLM planner
- `personalized.ts`: builds `QueryPlan` from profileTaste signals then delegates (replaces V1 scoring)
- `shelf-generator.ts`: builds plan from seed metadata then delegates (replaces genre-only ranking)
- `shelf-concepts.ts`: new `POST /v1/shelf-concepts/:id/preview` endpoint (raw vector + final personalized views)
- `hybrid-reranker.ts`: V1 marked `@deprecated`, adds `filteredCount`/`finalCount` to return object
- `shelf-instances.ts`: passes `request.log` through to shelf generator

All 70 unit tests pass; the one e2e failure is a pre-existing PostgreSQL auth issue unrelated to T116.
