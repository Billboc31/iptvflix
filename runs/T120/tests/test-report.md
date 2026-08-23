Here is the test report summary:

---

## T120 — Test Report

### What was validated

**Static + structural** — full code review of 8 changed files, TypeScript compilation, unit test run.

**Runtime end-to-end** — impossible from this worktree (no Railway deployment, no populated `media_embeddings`). This is explicitly anticipated by the ticket's completion rule.

---

### Acceptance criteria

| Result | Criteria |
|--------|----------|
| **PASS** | Root cause identified (Case C: pgvector extension present but `embedding` column still `_float8` → `::vector` cast throws → silent catch → `outputCount: 0`) |
| **PASS** | Functional fix applied: `checkPgvector()` now verifies `udt_name = 'vector'` in `information_schema.columns`; if mismatch → `pgvectorAvailable = false` → routes to pure-SQL cosine (no `::vector` cast) |
| **PASS** | Counters correctly separated: `semanticRetrieved / fallbackCandidates / rerankedCandidates / finalResults` (verified by code at `shelf-concepts.ts:133-139`) |
| **PASS** | No `SCORE_MODEL_V2` weight changes (confirmed by diff) |
| **CANNOT VALIDATE** | `Aventures à travers le temps` → `semanticRetrieved > 0`, `fallbackUsed = false`, `RAW VECTOR > 0` |
| **CANNOT VALIDATE** | Semantic coherence of Raw Vector candidates |
| **CANNOT VALIDATE** | `SF qui fait réfléchir` and `film qui retourne le cerveau` smoke tests |

### Regressions

None introduced by T120. Pre-existing failures in `apps/api` tests (no local Postgres on 5433) and `SourcesPage.tsx` TypeScript errors are unrelated to this ticket.

### Minor issue

`semanticPostFilter` uses the hybrid-reranker's `filteredCount` (post-reranking, not post-semantic). Labelling is approximate. Non-blocking.

---

### Verdict: **VALIDATION PARTIELLE**

The functional fix is technically correct. **The ticket cannot be closed until a human validates on a deployed, corpus-populated environment** that `Aventures à travers le temps` returns `semanticRetrieved > 0` and `fallbackUsed = false`. Report saved to `runs/T120/tests/test-report.md`.
