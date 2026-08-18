---

## Test Report — T102

**Result: CONDITIONAL PASS**

### Tests executed

All 19 embedding unit tests pass (4 test files):

```
Test Files: 4 passed (4)
Tests:      19 passed (19)
```

### Acceptance criteria results

| Criterion | Status |
|-----------|--------|
| AC1 — Embedding document builder, deterministic/versioned | **PASS** |
| AC2 — Idempotent catalog backfill | **PASS** |
| AC3 — Vector storage/index (pgvector + HNSW) | **PASS** |
| AC4 — Provider/model swappable without schema change | **PASS** |
| AC5 — Incremental re-embedding on enrichment | **PASS** |
| AC6 — Top-K semantic retrieval API | **PASS** (code level) |
| AC7 — Lab displays scores/model/version | **PASS** |
| AC8 — Structured metadata remains separate | **PASS** |
| AC9 — Benchmark demonstrates real catalog retrieval | **BLOCKED** |
| AC10 — Coverage diagnostics | **PASS** (minor gap) |

### Issues found

**I1 — Minor:** `GET /admin/embedding-backfill/coverage` returns only 3 coverage fields (`overview`, `keywords`, `language`). The plan specified 4 (`credits`, `genres` also). The `measureCoverage()` function computes all 5, but the route doesn't query the junction/credit tables to surface credits and genres. Non-blocking.

**I2 — Minor:** `embedding-service.ts` uses `sql.raw()` to inline the pgvector literal in the cosine distance expression. Safe in practice (values come from OpenAI's `number[]` response), but not parameterized. Non-blocking.

### Blocking issue

**AC9 cannot be validated without a live environment.** The completion rule explicitly requires running real queries in the Lab against the actual IPTVFlix catalog and showing that semantically appropriate titles rank near the top for multiple benchmark intents. The benchmark CLI (`pnpm --filter api benchmark:embeddings`) is fully implemented and ready, but execution requires `OPENAI_API_KEY` and a populated `media_embeddings` table in a deployed environment. This step must be completed manually before closing the ticket.

The full report is saved at `runs/T102/test-report.md`.
