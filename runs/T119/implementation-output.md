All changes are in place. Here's the summary:

---

## Files modified

| File | Change |
|---|---|
| `apps/recommendation-engine/src/pipeline/types.ts` | Added `diagnostics?: Record<string, unknown>` to `StageResult` |
| `apps/recommendation-engine/src/pipeline/stages/semantic-search.ts` | Replaced single `COUNT(*)` preflight with three targeted queries: `totalCount`, `eligibleCount` (filtered by configured model), `detectedModels` (distinct labels only). Returns model-mismatch reason when `eligibleCount === 0` but `totalCount > 0`. Adds `diagnostics` block to all return paths with `{ totalEmbeddings, eligibleEmbeddings, detectedModels, usePgvector, retrievalLimit, queryVectorDim, retrievedRawRows }`. |
| `apps/recommendation-engine/src/routes/diagnostics.ts` *(new)* | `GET /v1/diagnostics/vector-corpus` — corpus health check: `totalEmbeddings`, `byModel`, `byMediaType`, `eligibleCount`, `pgvectorAvailable`, `configuredModel`. No secrets exposed. |
| `apps/recommendation-engine/src/index.ts` | Registers `diagnosticsRoutes`. |
| `packages/api-contracts/src/shelf-concepts.ts` | Extended `ShelfConceptPreviewResponse` with `semanticAvailable`, `semanticFallbackReason`, `semanticDiagnostics`, `fallbackFlags`, `stageAvailability`, `retrievalCounts`. |
| `apps/recommendation-engine/src/routes/shelf-concepts.ts` | Preview route now returns all new fields by reading from `rawSemanticResult` and `finalResult.stageOutputs`/`engineMetadata`. |
| `apps/web/src/pages/RecommendationLabPage.tsx` | Added `DiagnosticsBlock` component; preview panel now shows: yellow fallback banner + reason when `!semanticAvailable` or `popularity-fallback` is active; `retrieved → postFilter → reranked → final` pipeline counters; stage availability pills (green/red with reason on hover); collapsible semantic diagnostics JSON block. |

**What this enables operationally:** when the model/provider configured in `EMBEDDING_MODEL_PROVIDER`/`EMBEDDING_MODEL_NAME` doesn't match what's in the corpus, the Lab will now show the exact mismatch in both the fallback banner reason and the diagnostics block — instead of silently returning 0 candidates.
