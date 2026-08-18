All 8 tests pass. Here's a summary of all changes:

---

## Files created

| File | Purpose |
|---|---|
| `packages/api-contracts/src/query-plan.ts` | `RecommendationQueryPlan` schema v1, `CompactTasteContext`, `QueryPlanHardFilters`, `QueryPlanSoftPreferences`, `rawQueryFallbackPlan()` helper |
| `apps/api/src/services/llm-planner-provider.ts` | `LlmPlannerProvider` interface — provider abstraction |
| `apps/api/src/prompts/query-planner-v1.ts` | `buildQueryPlannerPrompt()` — compact system + user messages for structured JSON output |
| `apps/api/src/services/openai-llm-planner-provider.ts` | `OpenAiLlmPlannerProvider` — calls GPT with `json_object` format, validates and normalizes response |
| `apps/api/src/services/llm-query-planner-service.ts` | `LlmQueryPlannerService` — wraps provider with 8s timeout, fallback to raw query on any error |
| `apps/api/src/benchmarks/llm-planner-benchmarks.ts` | A/B benchmark: raw vs LLM-expanded, Precision@5/P@10 for all 5 existing queries |
| `apps/api/src/services/__tests__/llm-query-planner-service.test.ts` | 8 unit tests covering all plan scenarios |

## Files modified

| File | Change |
|---|---|
| `packages/api-contracts/src/embeddings.ts` | Extended `SemanticQueryRequest` with `expandWithLlm?`, `profileContext?`; `SemanticQueryResponse` with `queryPlan?` |
| `packages/api-contracts/src/index.ts` | Added `export * from './query-plan.js'` |
| `apps/api/src/config/env.ts` | Added `LLM_PLANNER_MODEL` (default `gpt-4o-mini`) |
| `apps/api/src/services/semantic-retrieval-service.ts` | Added optional `queryTextOverride?` param to `retrieve()` — embeds override when provided |
| `apps/api/src/routes/recommendation-lab.ts` | LLM expansion path with in-process LRU cache (100 entries, 5min TTL), `mediaTypes` filter, A/B results |
| `apps/api/package.json` | Added `benchmark:planner` script |
| `apps/web/src/pages/RecommendationLabPage.tsx` | LLM expansion toggle, `QueryPlanPanel` component, A/B column labeling |

## Known limits
- `maxRuntimeMinutes` filter is not applied post-retrieval (runtime data not in `SemanticResult` without an extra DB join — noted in code comment)
- Only OpenAI provider implemented; interface supports others
