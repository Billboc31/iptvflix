All four changes are clean and the TypeScript build passes with zero errors. Here's a summary of what was implemented:

---

## Changes made

### Step 4 (Case C fix) — `semantic-search.ts`
Hoisted `totalCount`, `eligibleCount`, `detectedModels`, `usePgvector`, `queryVectorDim` to `let` declarations **before** the `try` block. The catch block now includes a full `diagnostics` object, so a SQL/pgvector exception is no longer silent — the preflight state is visible in the response even when the vector query throws.

### Step 5a — `types.ts`
Added `RetrievalSummary` interface and optional `retrievalSummary?: RetrievalSummary` field to `QueryResponse`.

### Step 5b — `recommendation-service.ts`
After the fallback pool block, captures `popularityFallbackUsed` and constructs `retrievalSummary: { semanticCandidateCount, fallbackCandidateCount, fallbackUsed }`, which is returned alongside the rest of `QueryResponse`.

### Step 5c — `shelf-concepts.ts`
Replaced the misleading `{ retrieved, postFilter, reranked, final }` with semantically correct counters:
- `semanticRetrieved` — candidates from the vector search
- `semanticPostFilter` — post-reranker count (only when semantic worked)
- `fallbackCandidates` — popularity pool count (only when fallback fired)
- `rerankedCandidates`, `finalResults`
- Top-level `fallbackUsed: boolean` field added to the response

---

**Runtime validation still required.** The ticket's completion rule demands a live end-to-end proof on a populated environment. These code changes fix the counter display (Step 5) and make Case C errors visible (Step 4). The root cause (Case A/B/C) must still be identified by calling `/v1/diagnostics/vector-corpus` on production and reading `semanticFallbackReason` from the preview response to determine which path applies.
