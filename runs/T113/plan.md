I have all the information I need. Here is the plan:

---

## Objective

Decouple the pgvector retrieval pool size from the final shelf limit so that hard filters, profile reranking, and diversity operate on ~200 candidates before truncation to the configured 20-30 final items. Simultaneously introduce an explicit `STRICT_EXCLUDE_UNKNOWN` policy for hard filters when required metadata is absent.

## Included

### `apps/recommendation-engine/src/config.ts`
- Add `SEMANTIC_RETRIEVAL_LIMIT = Number(process.env.SEMANTIC_RETRIEVAL_LIMIT ?? 200)` — configurable retrieval pool size.
- Add `SEMANTIC_RETRIEVAL_MAX_CAP = Number(process.env.SEMANTIC_RETRIEVAL_MAX_CAP ?? 500)` — safety cap to avoid pathological query sizes.

### `apps/recommendation-engine/src/pipeline/stages/semantic-search.ts`
- Line 48: remove `const limit = ctx.request.limit ?? 24`.
- Derive `const retrievalLimit = Math.min(SEMANTIC_RETRIEVAL_LIMIT, SEMANTIC_RETRIEVAL_MAX_CAP)` from the new config exports.
- Line 122: replace `LIMIT ${limit}` with `LIMIT ${retrievalLimit}`.
- Update the stage log (line 136 area) to include both `retrievalLimit` and actual `candidateCount`.

### `apps/recommendation-engine/src/pipeline/stages/hybrid-reranker.ts`
**`passesHardFilters` (lines 307-330) — unknown metadata policy:**
- Add a top-level constant `HARD_FILTER_UNKNOWN_POLICY = 'STRICT_EXCLUDE_UNKNOWN' as const`.
- Change the three guard conditions that currently silently pass unknown values:
  - `maxRuntimeMinutes`: if filter is active and `c.durationMinutes == null` → return `false`.
  - `minReleaseYear` / `maxReleaseYear`: if either filter is active and `c.year == null` → return `false`.
  - `audioLanguages`: if filter is active and `c.originalLanguage == null` → return `false` (reverses the existing `c.originalLanguage != null` guard).
- Add a comment on the constant documenting the policy rationale.

**Provenance logging (lines 460-486):**
- After `enriched.filter(passesHardFilters)` (line 414), capture `const filteredCount = eligible.length`.
- After `applyDiversityFilter` (line 460), capture `const finalCount = diversified.length`.
- Extend the `ctx.log.info` call (line 474) to include `{ inputCount: candidates.length, filteredCount, finalCount }`.
- Return `filteredCount` and `finalCount` in the `StageResult` object.

### `apps/recommendation-engine/src/pipeline/types.ts`
- Add `filteredCount?: number` and `finalCount?: number` optional fields to `StageResult`.

### `apps/recommendation-engine/src/pipeline/pipeline.ts`
- Update the final `log.info` (lines 100-108) to pull `filteredCount` and `finalCount` from the reranker `StageResult` and log them alongside `candidateCount`.

### Tests
- **Unit — `passesHardFilters` unknown metadata:** add cases asserting that `null` duration / year / language causes exclusion when the corresponding filter is active under `STRICT_EXCLUDE_UNKNOWN`.
- **Regression — `runPipeline` integration:** add three tests covering WATCH_NOW, DISCOVERY, and a mixed movie+series query, asserting:
  - `stageOutputs['semantic-search'].outputCount >= 100` (retrieval pool materially larger than final shelf).
  - `results.length <= 30` (final shelf respects the configured limit).
  - `stageOutputs['hybrid-reranker'].filteredCount` is present and `<= outputCount` of semantic stage.

## Excluded

- Changing the text-search `LIMIT` (text search already uses `limit` for a different purpose).
- Modifying the LLM planner or its schema.
- Modifying the `CANDIDATE_POOL_SIZE = 200` in `personalized.ts` (that is a catalog-candidate pool, not a semantic retrieval pool).
- Shelf concept generator, shelf generator, or any IPTV frontend.
- Introducing a `LENIENT_PASS_UNKNOWN` opt-in path beyond the constant definition (behavior only, no routing logic needed for this ticket).
- Changing `QueryRequest.limit` semantics — it remains the final shelf size.

## Acceptance criteria

- `semantic-search.ts` pgvector query uses `retrievalLimit` (≥ 200 by default), not `ctx.request.limit`.
- `SEMANTIC_RETRIEVAL_LIMIT` is read from environment and falls back to 200.
- `passesHardFilters` returns `false` for candidates with `null` duration when `maxRuntimeMinutes` is set, `null` year when `minReleaseYear`/`maxReleaseYear` is set, and `null` originalLanguage when `audioLanguages` is set.
- `StageResult` for `hybrid-reranker` includes non-null `filteredCount` and `finalCount`.
- Pipeline final log includes `filteredCount` and `finalCount`.
- Unit tests for all three null-metadata cases in `passesHardFilters` pass.
- Integration regression tests for WATCH_NOW, DISCOVERY, and mixed queries pass with `outputCount >= 100` at semantic stage and `results.length <= 30`.
- Running the real query `SF qui fait réfléchir` against a populated embedding index shows `retrievalLimit ≈ 200`, `filteredCount < 200`, `finalCount ≤ 30` in logs.
