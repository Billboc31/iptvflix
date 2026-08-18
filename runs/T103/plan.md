# T103 — LLM Query Planner

## Objective

Add a provider-abstracted LLM Query Planner that converts a natural-language recommendation intent into a validated `RecommendationQueryPlan`, feeding `semanticIntent` to vector retrieval and hard filters to post-retrieval filtering. The planner is optional, togglable in the Recommendation Lab, and falls back to a raw-query plan on any error.

---

## Included

### 1. `RecommendationQueryPlan` schema — `packages/api-contracts/src/query-plan.ts` (new)

Define and export:

```typescript
export const QUERY_PLAN_SCHEMA_VERSION = '1' as const

export type CompactTasteContext = {
  topGenres: string[]       // max 5 genre slugs
  topThemes: string[]       // max 5 keyword labels
  likedPeople: string[]     // max 3 director/actor names
  recentlyWatched: string[] // max 5 titles
  negativeSignals: string[] // max 3 genre slugs with negative score
}

export type QueryPlanHardFilters = {
  maxRuntimeMinutes?: number
  minReleaseYear?: number
  maxReleaseYear?: number
  audioLanguages?: string[]
  includeGenres?: string[]
  excludeGenres?: string[]
}

export type QueryPlanSoftPreferences = {
  preferredDecades?: string[]
  preferredDirectors?: string[]
  preferredLanguages?: string[]
}

export type RecommendationQueryPlan = {
  schemaVersion: typeof QUERY_PLAN_SCHEMA_VERSION
  rawQuery: string
  displayTitle: string
  semanticIntent: string
  desiredThemes: string[]
  desiredTone: string[]
  avoidSignals: string[]
  mediaTypes: ('MOVIE' | 'SERIES')[]
  hardFilters: QueryPlanHardFilters
  softPreferences: QueryPlanSoftPreferences
  userConstraints: string[]   // verbatim explicit constraints extracted from user input
  plannerFallback: boolean
  plannerMeta: {
    provider: string
    model: string
    promptVersion: string
    latencyMs: number
  } | null
}
```

Export a `rawQueryFallbackPlan(rawQuery: string): RecommendationQueryPlan` helper that fills the schema with `semanticIntent = rawQuery`, empty arrays, `plannerFallback: true`, `plannerMeta: null`.

### 2. `LlmPlannerProvider` interface — `apps/api/src/services/llm-planner-provider.ts` (new)

```typescript
export interface LlmPlannerProvider {
  readonly provider: string
  readonly model: string
  readonly promptVersion: string
  planQuery(
    rawQuery: string,
    profileContext: CompactTasteContext | null
  ): Promise<RecommendationQueryPlan>
}
```

### 3. `OpenAiLlmPlannerProvider` — `apps/api/src/services/openai-llm-planner-provider.ts` (new)

- Uses existing `OPENAI_API_KEY` from `env.ts`; model read from `LLM_PLANNER_MODEL` env var (default `gpt-4o-mini`)
- `promptVersion: 'query-planner-v1'`
- Calls `client.chat.completions.create` with `response_format: { type: 'json_object' }`, `temperature: 0.1`, `max_tokens: 600`
- Prompt loaded from `apps/api/src/prompts/query-planner-v1.ts` (see §4)
- Parses and validates JSON response into `RecommendationQueryPlan`; throws on schema mismatch so caller can fall back
- Records `latencyMs`

### 4. Prompt template — `apps/api/src/prompts/query-planner-v1.ts` (new)

Export `buildQueryPlannerPrompt(rawQuery: string, profileContext: CompactTasteContext | null): ChatCompletionMessageParam[]`

System message (compact, ~200 tokens):
- Role: intent planner, not catalog authority
- Task: expand the user query into a JSON `RecommendationQueryPlan` (v1 schema)
- Rules: preserve explicit constraints as hard filters; do not invent catalog titles; distinguish user-stated vs inferred; keep `semanticIntent` rich for embedding
- Output: single JSON object matching the schema keys exactly

User message:
```
Query: {{rawQuery}}
{{if profileContext}}Profile context (for personalization hints only): {{JSON.stringify(profileContext)}}{{/if}}
Return only the JSON object.
```

### 5. `LlmQueryPlannerService` — `apps/api/src/services/llm-query-planner-service.ts` (new)

```typescript
class LlmQueryPlannerService {
  constructor(private provider: LlmPlannerProvider | null) {}

  async plan(
    rawQuery: string,
    profileContext: CompactTasteContext | null
  ): Promise<RecommendationQueryPlan>
}
```

- If `provider` is null → return `rawQueryFallbackPlan(rawQuery)`
- Wraps provider call in try/catch with 8-second timeout (via `Promise.race`)
- On error or timeout → logs warning, returns `rawQueryFallbackPlan(rawQuery)` with `plannerFallback: true`
- Validates that returned plan's `semanticIntent` is non-empty (otherwise falls back)

### 6. Env config — `apps/api/src/config/env.ts` (modify)

Add optional: `LLM_PLANNER_MODEL: z.string().default('gpt-4o-mini')`

`OPENAI_API_KEY` already exists. No new key required.

### 7. API contracts — `packages/api-contracts/src/embeddings.ts` (modify)

Extend `SemanticQueryRequest`:
```typescript
expandWithLlm?: boolean
profileContext?: CompactTasteContext
```

Extend `SemanticQueryResponse`:
```typescript
queryPlan?: RecommendationQueryPlan
```

Export `CompactTasteContext` re-export from `query-plan.ts`.

### 8. Lab route — `apps/api/src/routes/recommendation-lab.ts` (modify)

- Instantiate `LlmQueryPlannerService` with `OpenAiLlmPlannerProvider` (or null if no API key)
- When `expandWithLlm: true` in request body:
  1. Call `plannerService.plan(query, profileContext ?? null)`
  2. Use `plan.semanticIntent` as the text fed to `SemanticRetrievalService.retrieve()`
  3. Apply `plan.hardFilters` post-retrieval: filter out candidates by `mediaTypes` and `maxRuntimeMinutes` if present (using existing movie/series metadata already on `SemanticResult`)
  4. Attach `queryPlan` to response
- When `expandWithLlm: false` (default) → existing path unchanged
- Cache: use an in-process LRU cache (key = `sha256(rawQuery + JSON(profileContext))`), TTL 5 minutes, max 100 entries — skip network call on hit

### 9. `SemanticRetrievalService` — `apps/api/src/services/semantic-retrieval-service.ts` (modify)

Add optional parameter `queryTextOverride?: string` to `retrieve(queryText, topK, queryTextOverride?)`.
When provided, embed `queryTextOverride` instead of `queryText` for the vector search (while keeping `queryText` for logging).
No other change to the service contract.

### 10. Recommendation Lab UI — `apps/web/src/pages/RecommendationLabPage.tsx` (modify)

Add below the existing query input:

**LLM Expansion toggle** (checkbox/switch, default off):
- Label: `LLM query expansion`
- When on, sends `expandWithLlm: true` in request

**QueryPlan panel** (shown only when response includes `queryPlan`):
- `displayTitle` as panel heading
- `semanticIntent` — text actually embedded, highlighted
- `desiredThemes` / `desiredTone` / `avoidSignals` — tag lists
- `hardFilters` — key/value display
- `softPreferences` — key/value display
- `userConstraints` — list of verbatim constraints extracted
- `plannerMeta` — provider, model, promptVersion, latencyMs
- `plannerFallback` warning badge when true

**A/B/C tabs** when `expandWithLlm: true`:
- **A** — Raw query results (existing comparison path: send `compareQuery = query` without expansion, or keep existing results panel as "raw" reference)
- **B** — Expanded semantic intent results (main results from expanded path)
- **C** — Expanded + hard filters applied (server already applies them; mark results filtered out with visual indicator or count)

Use the existing comparison layout; label the two columns "Raw" and "LLM-expanded" when expansion is on.

### 11. Benchmark extension — `apps/api/src/benchmarks/llm-planner-benchmarks.ts` (new)

Script runnable via `pnpm --filter api benchmark:planner`:
- For each of the 5 existing benchmark queries in `embedding-benchmarks.ts`:
  - Run path A (raw) and path B (LLM-expanded) in sequence
  - Print QueryPlan summary (semanticIntent, hardFilters, latencyMs)
  - Print Precision@5 / Precision@10 for both paths
  - Print qualitative delta (expanded better / worse / same)
- Include at least `SF qui fait réfléchir` as the primary demo query
- Does NOT write to the database

### 12. Tests — `apps/api/src/services/__tests__/llm-query-planner-service.test.ts` (new)

Unit tests using a mock `LlmPlannerProvider`:

| Scenario | What to verify |
|---|---|
| French input with explicit runtime (`moins de 2h`) | `hardFilters.maxRuntimeMinutes = 120`, constraint in `userConstraints` |
| English input | Plan produced, `semanticIntent` non-empty |
| Negative preference (`pas d'horreur`) | `avoidSignals` contains `horror`, `hardFilters.excludeGenres` contains horror slug |
| Mixed hard + soft (`uniquement films`, `plutôt des années 80`) | `mediaTypes = ['MOVIE']`, `softPreferences.preferredDecades = ['1980s']` |
| Malformed LLM response (not valid JSON) | Returns `rawQueryFallbackPlan`, `plannerFallback: true` |
| Provider timeout | Returns fallback plan, `plannerFallback: true` |
| Prompt-injection attempt in query text | Provider receives sanitized prompt; plan `schemaVersion` matches declared constant |
| Null provider | Returns fallback plan immediately |

---

## Excluded

- Integrating `QueryPlan.hardFilters` into the production recommendations endpoint (`GET /profiles/:profileId/recommendations`) — ranking pipeline untouched
- Persisting query plans to the database
- Profile-aware planner wiring in production recommendation flow (Lab only)
- Caching beyond in-process LRU (no Redis/DB cache layer)
- Non-OpenAI provider implementations (interface defined, OpenAI is the only impl)
- UI for editing/overriding the generated QueryPlan fields
- Cost/token tracking beyond `latencyMs`
- Benchmark script writing results to files or CI assertions

---

## Acceptance criteria

1. `POST /recommendation-lab/semantic-query` with `expandWithLlm: true` and query `"SF qui fait réfléchir"` returns a `queryPlan` where `semanticIntent` is noticeably richer than the raw query and results differ from the raw path.
2. A query with `"moins de 2h"` produces `hardFilters.maxRuntimeMinutes = 120` and the string `"moins de 2h"` (or equivalent) appears in `userConstraints`.
3. A query with `"pas d'horreur"` produces `avoidSignals` or `hardFilters.excludeGenres` containing a horror signal.
4. On mock LLM timeout, the endpoint returns HTTP 200 with `queryPlan.plannerFallback = true` and `semanticIntent` equal to the raw query.
5. On malformed LLM JSON, same fallback behaviour as §4.
6. `LLM_PLANNER_MODEL` env override changes the model field in `plannerMeta`.
7. `expandWithLlm: false` (default) produces identical behaviour to existing endpoint — no regression.
8. Lab UI shows QueryPlan panel (semanticIntent, hardFilters, plannerMeta) when expansion is on; shows `plannerFallback` badge when fallback occurred.
9. Lab A/B columns display raw vs LLM-expanded results side by side with visible label distinction.
10. `pnpm --filter api benchmark:planner` runs without error, prints QueryPlan summaries and Precision@5 for both paths for all 5 benchmark queries.
11. All 8 unit test scenarios pass (`pnpm --filter api test`).
12. TypeScript build passes with no new errors (`pnpm build`).
