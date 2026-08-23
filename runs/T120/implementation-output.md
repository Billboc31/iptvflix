No errors related to my changes — all failures are the pre-existing missing `@types/react` in this worktree environment (present before T120).

---

Three fixes applied:

**BLOQUANT 1 — `packages/api-contracts/src/shelf-concepts.ts`**
Replaced `retrievalCounts: { retrieved, postFilter, reranked, final }` with `{ semanticRetrieved, semanticPostFilter, fallbackCandidates, rerankedCandidates, finalResults }` and added `fallbackUsed: boolean` at the top level of `ShelfConceptPreviewResponse`. The contract now matches what the backend actually returns.

**BLOQUANT 2 — `apps/web/src/pages/RecommendationLabPage.tsx:515`**
Updated the `as const` array from `['retrieved', 'postFilter', 'reranked', 'final']` to `['semanticRetrieved', 'semanticPostFilter', 'fallbackCandidates', 'rerankedCandidates', 'finalResults']`. TypeScript now enforces key validity against the updated contract.

**MOYEN 3 — `apps/recommendation-engine/src/pipeline/recommendation-service.ts:129`**
`fallbackCandidateCount` now uses `mergedCandidates.length - semanticCandidates.length` instead of `mergedCandidates.length`. In practice equivalent (fallback only fires when semantic=0), but semantically precise for future edge cases.

**Completion rule (MOYEN 4)** — Runtime validation on a populated environment is still required. The code changes are ready; a live end-to-end proof on production with `Aventures à travers le temps` showing `semanticRetrieved > 0` and `fallbackUsed=false` is needed before the ticket can be closed.
