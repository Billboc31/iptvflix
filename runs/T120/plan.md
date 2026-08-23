## Objective

Find and fix the root cause that makes `runSemanticSearch()` return 0 candidates in production for ShelfConcept previews, using the diagnostics added in #254/#255 to identify the specific failure mode. Correct the misleading counter display (`0 retrieved → 200 postFilter`) that conflates the semantic pool with the popularity fallback pool.

## Included

### Step 1 — Diagnose root cause

Call `/v1/diagnostics/vector-corpus` on the production recommendation-engine instance and read:
- `totalEmbeddings` — 0 → Case A; >0 → proceed
- `eligibleCount` — 0 with non-zero total → Case B (model mismatch)
- `pgvectorAvailable` — determines which SQL path is taken
- `configuredModel` vs `byModel[]` — identifies the exact mismatch string

Call `/v1/shelf-concepts/:id/preview` for "Aventures à travers le temps" and read:
- `semanticAvailable` — false confirms retrieval failure
- `semanticFallbackReason` — exact reason string from `runSemanticSearch()`
- `semanticDiagnostics` — preflight counters: `totalEmbeddings`, `eligibleEmbeddings`, `detectedModels`, `retrievedRawRows`

The `semanticFallbackReason` will start with one of:
- `"no embeddings indexed"` → Case A
- `"no embeddings matching configured model …"` → Case B
- `"semantic search error: …"` → Case C (SQL/vector exception silently caught)

### Step 2 — Fix for Case A: empty corpus

If `totalEmbeddings = 0`, the `apps/api` embedding backfill has not run against the DB that `recommendation-engine` reads, or the two services use different Postgres instances.

**`apps/api` writes embeddings via `POST /admin/embedding-backfill`** — verify this endpoint is called and connects to the same DATABASE_URL as `recommendation-engine`.

Actions:
- Confirm both Railway services share the same Postgres DATABASE_URL (not separate DB instances).
- If they share the DB: trigger backfill via `POST /admin/embedding-backfill` and verify `coverage` endpoint shows `embedded > 0`.
- If they are isolated: fix the Railway DATABASE_URL for one service so both hit the same Postgres instance. No code change needed — deployment config only.
- Do not close the ticket after simply logging "no embeddings indexed"; the corpus must actually be populated.

### Step 3 — Fix for Case B: model mismatch

If `eligibleCount = 0` and `totalEmbeddings > 0`, `EMBEDDING_MODEL_PROVIDER` / `EMBEDDING_MODEL_NAME` in Railway recommendation-engine do not match the values stored during indexing.

The `apps/api` indexation hardcodes `modelProvider = 'openai'` and `modelName = 'text-embedding-3-small'` in `apps/api/src/services/embedding-provider.ts` (lines 12–14).

The recommendation-engine reads these from env vars with the same defaults (`apps/recommendation-engine/src/config.ts` lines 10–11).

Actions:
- Check Railway env vars for recommendation-engine: `EMBEDDING_MODEL_PROVIDER` and `EMBEDDING_MODEL_NAME`.
- If they differ from `openai` / `text-embedding-3-small`, either:
  - Correct the env vars to match the stored model, **or**
  - Re-index with the model the env vars point to (using `POST /admin/embedding-backfill` after aligning `apps/api`'s provider).
- Do not remove the `model_provider` / `model_name` filter from the SQL query to bypass the mismatch — embedding vectors from different models are not dimension-compatible and would produce meaningless similarity scores.

### Step 4 — Fix for Case C: SQL/pgvector exception silently caught

If `semanticFallbackReason` starts with `"semantic search error: …"`, the vector query itself threw an exception and was swallowed by the catch block at `semantic-search.ts:186`.

Current catch block returns no `diagnostics`, so the preflight state (totalEmbeddings, eligibleEmbeddings) is invisible.

**`apps/recommendation-engine/src/pipeline/stages/semantic-search.ts`**, catch block (lines 186–195):

Add partial diagnostics (already resolved from preflights above the try — store them in variables before the query) so the error response includes `diagnostics.totalEmbeddings`, `diagnostics.eligibleEmbeddings`, and the SQL error message:

```typescript
} catch (err) {
  ctx.log.error({ requestId: ctx.requestId, stage: 'semantic-search', err }, 'stage error')
  return {
    stage: 'semantic-search',
    available: false,
    reason: `semantic search error: ${(err as Error).message}`,
    durationMs: Date.now() - start,
    inputCount: inputCandidates.length,
    outputCount: 0,
    diagnostics: {
      totalEmbeddings: totalCount,      // captured before the vector query
      eligibleEmbeddings: eligibleCount,
      detectedModels,
      usePgvector,
      retrievalLimit,
      queryVectorDim,
      retrievedRawRows: 0,
    },
  }
}
```

This requires hoisting the preflight variables (`totalCount`, `eligibleCount`, `detectedModels`, `usePgvector`, `queryVectorDim`) to the outer try scope so they are accessible in the catch block.

If the error message indicates a dimension mismatch (e.g., `"different vector dimensions"` from pgvector), the fix is to verify that `queryVectorDim` matches the stored `embedding_dimension` column — both should be 1536 for `text-embedding-3-small`.

If the error is a pgvector cast failure on a `double precision[]` column: check whether `usePgvector` is incorrectly returning `true` while the column is still `double precision[]`. The `checkPgvector()` function tests for the extension, not the column type. If the pgvector migration (`0040_t102_pgvector_hnsw.sql`) has not applied on production, the column is still `double precision[]` but `usePgvector = true` triggers the `::vector` cast, which fails. Fix: either ensure the column migration has run, or make `checkPgvector()` also verify the column type.

### Step 5 — Fix misleading `retrievalCounts` counters

**Root cause of `0 retrieved → 200 postFilter`**: `retrieved` comes from `rawSemanticResult.outputCount` (dedicated semantic-only call, returns 0) while `postFilter` comes from `rerankerStage.filteredCount` on the full pipeline — which received 200 popularity-fallback candidates after semantic failed.

**`apps/recommendation-engine/src/pipeline/recommendation-service.ts`**

Track fallback state explicitly. After the fallback block (line 120), record:
```typescript
const fallbackCandidateCount = mergedCandidates.length  // set after fetchPopularityFallbackPool()
const fallbackUsed = fallbackFlags.includes('popularity-fallback')
```

Add to `engineMetadata` (or a sibling `retrievalSummary` field in `QueryResponse`):
```typescript
retrievalSummary: {
  semanticCandidateCount: semanticCandidates.length,
  fallbackCandidateCount: fallbackUsed ? fallbackCandidateCount : 0,
  fallbackUsed,
}
```

**`apps/recommendation-engine/src/pipeline/types.ts`**

Add `retrievalSummary` to `QueryResponse`:
```typescript
retrievalSummary?: {
  semanticCandidateCount: number
  fallbackCandidateCount: number
  fallbackUsed: boolean
}
```

**`apps/recommendation-engine/src/routes/shelf-concepts.ts`**, lines 131–136:

Replace the current `retrievalCounts` block with semantically correct counters that separate semantic and fallback pools:
```typescript
const fallbackUsed = finalResult.retrievalSummary?.fallbackUsed ?? false
retrievalCounts: {
  semanticRetrieved: rawSemanticResult.outputCount,
  semanticPostFilter: fallbackUsed ? null : (rerankerStage?.filteredCount ?? null),
  fallbackCandidates: fallbackUsed ? (finalResult.retrievalSummary?.fallbackCandidateCount ?? null) : 0,
  rerankedCandidates: rerankerStage?.outputCount ?? null,
  finalResults: finalResult.results.length,
},
fallbackUsed,
```

This produces the correct display:
- When semantic fails: `semantic: 0 | fallback: 200 | reranked: 20 | final: 20`
- When semantic works: `semantic: 187 | fallback: 0 | reranked: 187 | final: 20`

## Excluded

- Tuning `SCORE_MODEL_V2` weights or scoring parameters
- Adding observability beyond fixing the catch-block diagnostics gap and the counter display
- Modifying the hybrid-reranker scoring logic or hard-filter rules
- Adding new ShelfConcept types or pipeline stages
- Modifying the Recommendation Lab frontend (counter field names are consumed by the existing Lab response parser)
- Changing the embedding document schema or indexation fields

## Acceptance criteria

- `GET /v1/diagnostics/vector-corpus` on production returns `totalEmbeddings > 0` and `eligibleCount > 0`.
- "Aventures à travers le temps" preview returns `semanticAvailable: true` and `semanticRetrieved > 0`.
- `rawVector` array is non-empty and contains films semantically related to time travel / temporality / adventure.
- `fallbackUsed: false` in the preview response for this concept.
- `retrievalCounts` no longer shows `0 retrieved → 200 postFilter`; `semanticRetrieved` and `fallbackCandidates` are clearly separated.
- `finalPersonalized` results derive from the semantic pool, not the popularity fallback.
- "SF qui fait réfléchir" and "film qui retourne le cerveau" both return `semanticRetrieved > 0`.
- The catch block in `semantic-search.ts` now includes `diagnostics` so Case C errors are visible without a separate DB query.
- No `SCORE_MODEL_V2` weight changes are part of the fix.
- Ticket is not closed on compilation or unit tests alone — a live preview call on a populated environment must show the above counters.
