The PR is already merged and the ticket closed. My test report has been written to `runs/T110/tests/test-report.md`. Here's the summary:

---

## T110 Test Report — Summary

**Verdict: CONDITIONAL PASS**

### TypeScript
Both `apps/api` and `apps/recommendation-engine` compile clean (0 errors).

### Acceptance criteria (AC1–AC9): all PASS via code verification

| AC | Criterion | Result |
|---|---|---|
| AC1 | ShelfConcept intent → Query Planner | PASS — `home-pool-service.ts:233` passes `concept.semanticIntent` as query text |
| AC2 | QueryPlan semantic text → vector retrieval | PASS — `semantic-search.ts:47` uses `ctx.queryPlan.semanticIntent` |
| AC3 | Hard filters honored | PASS — `passesHardFilters()` in `hybrid-reranker.ts:307` before scoring |
| AC4 | Profile reranking | PASS — taste signals and exposure counts loaded per profileId |
| AC5 | Exposure/dedup penalties | PASS — intra-session exclusion + 0.05×min(exposureCount,4) penalty |
| AC6 | Provenance stored | PASS — semanticIntentSnapshot, versions, and per-item scores all persisted |
| AC7 | WATCH_NOW vs discovery filters | PASS — `freshnessPolicy === 'AVAILABLE_NOW'` hard-filters available items |
| AC8 | Fixed shelves unaffected | PASS — `buildFixedShelves()` unchanged, bypasses engine |
| AC9 | Recommendation Lab `/pipeline` endpoint | PASS — `GET /shelf-instances/:id/pipeline` returns all required fields |
| AC10 | Real catalog: 10 distinct shelves | **BLOCKED** — recommendation engine not running, all 4 integration tests skipped |

### Test suite: no regressions from T110
- 982 tests pass, 4 skipped (integration tests guarded by `.skipIf(!engineAvailable)`)
- 15 failures confirmed pre-existing on main branch (auth, shelves mock env issue, title-matching, etc.)
- New T110 test (`recommendation-engine-delegation.test.ts`): 6/6 pass

### Blocking items to fully close AC10
1. Run the integration suite with `RECOMMENDATION_ENGINE_URL` configured and the recommendation engine live
2. Apply pending DB migrations 36 (`media_embeddings` table) and 44 (`served_at` column) via `pnpm db:migrate`
