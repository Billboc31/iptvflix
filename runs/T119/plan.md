I have everything I need. Let me now write the plan.

## Objective

Diagnose and fix semantic retrieval returning 0 candidates for ShelfConcept preview. Add model-specific pre-flight diagnostics to `runSemanticSearch`, expose per-step pipeline counters and fallback origin in the preview API and Recommendation Lab UI.

## Included

### `apps/recommendation-engine/src/pipeline/stages/semantic-search.ts`

Replace the unfiltered `SELECT COUNT(*) FROM media_embeddings` pre-flight with three targeted queries:
- `totalCount`: total rows (any model)
- `eligibleCount`: rows matching `model_provider = ${EMBEDDING_MODEL_PROVIDER} AND model_name = ${EMBEDDING_MODEL_NAME}`
- `detectedModels`: `SELECT DISTINCT model_provider || '/' || model_name AS m FROM media_embeddings LIMIT 10` (sanitized label, no embeddings data)

Decision tree:
- `totalCount === 0` → reason `'no embeddings indexed'` (existing)
- `eligibleCount === 0` AND `totalCount > 0` → reason `'no embeddings matching configured model (${EMBEDDING_MODEL_PROVIDER}/${EMBEDDING_MODEL_NAME}); corpus has: ${detectedModels.join(", ")}'`
- `eligibleCount > 0` → proceed with existing SQL query

Log and add to returned `StageResult.diagnostics`:
```
{ totalEmbeddings, eligibleEmbeddings, detectedModels, usePgvector, retrievalLimit, queryVectorDim, retrievedRawRows }
```
where `queryVectorDim = queryVector.length` (logged before SQL) and `retrievedRawRows = rows.length` (raw SQL count before mapping).

Improve error catch: log the full `err` object (already done at line 152); ensure the `reason` string includes the error message (already done at line 156 — no change needed there).

### `apps/recommendation-engine/src/pipeline/types.ts`

Add optional field to `StageResult`:
```typescript
diagnostics?: Record<string, unknown>
```

### `apps/recommendation-engine/src/routes/shelf-concepts.ts`

Extend the `POST /v1/shelf-concepts/:id/preview` response body with:
```typescript
semanticAvailable: rawSemanticResult.available,
semanticFallbackReason: rawSemanticResult.reason,
semanticDiagnostics: rawSemanticResult.diagnostics,
fallbackFlags: finalResult.engineMetadata.fallbackFlags,
stageAvailability: finalResult.stageAvailability,
retrievalCounts: {
  retrieved: rawSemanticResult.outputCount,         // from semantic-search stage
  postFilter: rerankerStage?.filteredCount ?? null, // from hybrid-reranker filteredCount
  reranked: rerankerStage?.outputCount ?? null,     // from hybrid-reranker outputCount
  final: finalResult.results.length,
},
```
where `rerankerStage = finalResult.stageOutputs.find(s => s.stage === 'hybrid-reranker')`.

### `packages/api-contracts/src/shelf-concepts.ts`

Extend `ShelfConceptPreviewResponse`:
```typescript
semanticAvailable: boolean
semanticFallbackReason?: string
semanticDiagnostics?: Record<string, unknown>
fallbackFlags: string[]
stageAvailability: Array<{ name: string; available: boolean; reason?: string }>
retrievalCounts: {
  retrieved: number
  postFilter: number | null
  reranked: number | null
  final: number
}
```

### New route: `apps/recommendation-engine/src/routes/diagnostics.ts`

`GET /v1/diagnostics/vector-corpus` — corpus health check, no secrets:
```typescript
{
  totalEmbeddings: number
  byModel: Array<{ modelProvider: string; modelName: string; count: number }>
  byMediaType: Array<{ mediaType: string; count: number }>
  pgvectorAvailable: boolean
  configuredModel: string   // "${EMBEDDING_MODEL_PROVIDER}/${EMBEDDING_MODEL_NAME}"
  eligibleCount: number
}
```
SQL used: `SELECT model_provider, model_name, COUNT(*) FROM media_embeddings GROUP BY 1, 2` and `SELECT media_type, COUNT(*) FROM media_embeddings GROUP BY 1`.

Register this route in `src/app.ts` (or wherever existing routes are registered).

### `apps/web/src/pages/RecommendationLabPage.tsx`

In the `ShelfConceptsTab` preview panel (currently lines 479–537):

**Fallback banner**: When `!previewResponse.semanticAvailable || previewResponse.fallbackFlags.includes('popularity-fallback')`, render a visible warning above the Raw Vector section:
```
⚠ Semantic retrieval failed — fallback results displayed
Reason: {semanticFallbackReason}
```

**Pipeline counters row**: Display `retrieved → postFilter → reranked → final` using `previewResponse.retrievalCounts`. Render each as a `N` badge; missing values shown as `—`.

**Stage availability badges**: Below the pipeline counters, render one pill per `stageAvailability` entry: green = available, red = unavailable with reason on hover/title.

**Diagnostics block** (collapsible): Show `semanticDiagnostics` as a `<pre>` JSON dump when `semanticDiagnostics` is defined and non-empty.

## Excluded

- Adjusting `SCORE_MODEL_V2` weights (separate ticket; blocked until retrieval is confirmed working)
- Changing which embedding model or provider is used (operational decision, made after diagnostics reveal the mismatch)
- Re-indexing or backfilling embeddings (operational, not code)
- Modifying the Home production shelf fallback behavior (fallback stays transparent to end users)
- Adding unit tests that mock the DB (ticket explicitly requires real-corpus validation)
- Modifying `runTextSearch` or `fetchPopularityFallbackPool` (out of scope)
- Tracking `postHardFilterCandidates` inside `runSemanticSearch` itself (hard filters run in the reranker, not in retrieval; the `filteredCount` field on `hybrid-reranker`'s `StageResult` is the correct source)

## Acceptance criteria

1. `GET /v1/diagnostics/vector-corpus` returns `totalEmbeddings`, `byModel`, `byMediaType`, `eligibleCount`, `pgvectorAvailable` without exposing `DATABASE_URL` or any credential.
2. When `eligibleCount === 0` but `totalEmbeddings > 0`, `runSemanticSearch` sets `available: false` and `reason` includes the configured model name and the list of detected models.
3. When `eligibleCount === 0` and `totalEmbeddings === 0`, `reason` is `'no embeddings indexed'` (unchanged).
4. `StageResult.diagnostics` from `runSemanticSearch` contains `{ totalEmbeddings, eligibleEmbeddings, detectedModels, usePgvector, retrievalLimit, queryVectorDim, retrievedRawRows }`.
5. `POST /v1/shelf-concepts/:id/preview` response includes `semanticAvailable`, `semanticFallbackReason`, `semanticDiagnostics`, `fallbackFlags`, `stageAvailability`, `retrievalCounts`.
6. The Lab preview panel shows the fallback warning banner when `!semanticAvailable` or `fallbackFlags` contains `'popularity-fallback'`.
7. The Lab preview panel shows `retrieved → postFilter → reranked → final` counts for every preview run.
8. After the model/corpus mismatch is identified and corrected (operationally), `Aventures à travers le temps` preview shows `retrieved > 0`, `postFilter > 0`, `fallbackFlags = []`, and no fallback banner.
9. `TypeScript` compiles without errors across `packages/api-contracts`, `apps/recommendation-engine`, and `apps/web` after all changes.
