All done. Here's a summary of every change made:

---

## Files modified

**`apps/recommendation-engine/src/config.ts`**
- Added `SEMANTIC_RETRIEVAL_LIMIT` (default 200, env-overridable) and `SEMANTIC_RETRIEVAL_MAX_CAP` (default 500).

**`apps/recommendation-engine/src/pipeline/types.ts`**
- Added `filteredCount?: number` and `finalCount?: number` optional fields to `StageResult`.

**`apps/recommendation-engine/src/pipeline/stages/semantic-search.ts`**
- Replaced `const limit = ctx.request.limit ?? 24` with `const retrievalLimit = Math.min(SEMANTIC_RETRIEVAL_LIMIT, SEMANTIC_RETRIEVAL_MAX_CAP)`.
- pgvector query now uses `LIMIT ${retrievalLimit}` (~200) instead of the final shelf limit.
- Log includes `retrievalLimit` alongside `candidateCount`.

**`apps/recommendation-engine/src/pipeline/stages/hybrid-reranker.ts`**
- Exported `EnrichedCandidate` interface and new `HARD_FILTER_UNKNOWN_POLICY = 'STRICT_EXCLUDE_UNKNOWN'` constant.
- `passesHardFilters` now excludes candidates with `null` duration/year/language when the corresponding hard filter is active (replaces the old pattern of silently passing unknowns).
- Captures `filteredCount` (after hard-filter pass) and `finalCount` (after diversity).
- Both are returned in the `StageResult` and included in the stage log.

**`apps/recommendation-engine/src/pipeline/pipeline.ts`**
- Final pipeline log now includes `filteredCount` and `finalCount` from the reranker stage.

## Files created

**`apps/recommendation-engine/vitest.config.ts`** — vitest setup with a fake `DATABASE_URL` fallback so unit tests don't require a live DB.

**`apps/recommendation-engine/src/pipeline/__tests__/hard-filters.test.ts`** — 18 unit tests covering all three `STRICT_EXCLUDE_UNKNOWN` cases (runtime null, year null, language null) and their positive/negative counterparts. All pass.

**`apps/recommendation-engine/src/pipeline/__tests__/pipeline-regression.test.ts`** — 3 integration tests (WATCH_NOW, DISCOVERY "SF qui fait réfléchir", mixed movie+series) asserting `semantic outputCount >= 100`, `results.length <= 30`, and `filteredCount` present. Skipped automatically when `OPENAI_API_KEY` is absent.
