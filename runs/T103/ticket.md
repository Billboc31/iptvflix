# T103 — Add LLM query planner to expand natural-language shelf intents into structured recommendation plans

**Source**: GitHub Issue #206

## Description

## Context
#204 provides the Recommendation Lab/service and #205 provides semantic vector retrieval. We now want the LLM to act as an INTENT PLANNER, not as the source of truth for which movies exist.

A user or future shelf generator may provide a short intent such as:
`SF qui fait réfléchir`

The LLM should turn that into a richer structured QueryPlan that can drive vector retrieval, structured filters and reranking.

## Goal
Implement an optional, provider-abstracted LLM Query Planner that converts a natural-language recommendation request into a validated structured plan.

Example:
```text
Input:
SF qui fait réfléchir, plutôt sombre, peu d'action, moins de 2h

Output QueryPlan:
- displayTitle: SF qui fait réfléchir
- semanticIntent: cerebral philosophical science fiction exploring AI, identity, consciousness, time, humanity...
- desiredThemes: [AI, time, identity, consciousness]
- desiredTone: [serious, cerebral, atmospheric]
- avoid: [pure action, parody]
- mediaTypes: [movie]
- maxRuntimeMinutes: 120
- hardFilters: ...
- softPreferences: ...
```

## 1. Strict structured output
Define a versioned schema for `RecommendationQueryPlan` with clear separation between:
- semantic retrieval text;
- hard filters;
- soft preferences;
- negative preferences/avoidance;
- presentation/title suggestion;
- user-provided constraints vs LLM-inferred hints.

Validate LLM output. Invalid/unparseable output must gracefully fall back to the raw query.

## 2. Never let the LLM invent catalog results
The LLM must NOT return a final movie list as the authoritative recommendation result.

Its job is only to interpret/expand intent. Actual candidates come from IPTVFlix catalog through #205 + ranking.

## 3. Preserve explicit user constraints
If user explicitly says:
- `moins de 2h`;
- `uniquement films`;
- `pas d'horreur`;
- `après 2010`;
- `audio français`;
then those constraints must be represented as hard/strong constraints where applicable and must not be contradicted by inferred preferences.

## 4. Profile-aware optional context
Allow the planner to receive a compact sanitized TasteProfile summary where useful, but do not dump raw full interaction history into the LLM.

Example context:
```json
{
  "topGenres": ["science-fiction", "thriller"],
  "topThemes": ["AI", "space", "time"],
  "likedPeople": ["Denis Villeneuve"],
  "recentlyWatched": ["Dune: Part Two", "Arrival"],
  "negativeSignals": ["broad comedy"]
}
```

Planner should distinguish query intent from profile personalization; final ranking remains responsible for actual scoring.

## 5. Provider abstraction and versioning
Support swappable LLM providers/models with configuration, model version and prompt/schema version recorded in debug output.

Do not couple service logic to one vendor SDK throughout the codebase.

## 6. Prompt safety/cost
Use compact prompts and bounded context. Do not send provider credentials, raw account secrets or unnecessary private history.

Cache identical/sufficiently stable plan generation where useful to avoid repeated cost for the same shelf intent.

## 7. Lab toggles and visibility
In Recommendation Lab add:
- `LLM query expansion` toggle;
- raw input;
- generated QueryPlan JSON;
- semantic text actually sent to embedding retrieval;
- hard filters;
- soft preferences;
- model/prompt version;
- latency/cost metadata where available.

## 8. A/B comparison
Support comparing at minimum:
A. raw query -> embedding
B. LLM-expanded semantic intent -> embedding
C. LLM-expanded + structured constraints

For benchmark queries from #205, report whether expansion qualitatively improves result relevance.

## 9. Determinism and fallback
Use low-variance settings suitable for structured planning. On provider timeout/error:
- do not fail whole recommendation request;
- fall back to deterministic raw-query plan;
- mark `plannerFallback=true` in debug diagnostics.

## 10. Tests
Cover:
- French natural-language input;
- English input;
- explicit runtime filter;
- negative preference (`pas d'horreur`);
- mixed hard + soft constraints;
- malformed LLM response;
- provider timeout;
- prompt-injection-like user text cannot alter server/tool policy or expose secrets;
- stable schema versioning.

## Acceptance criteria
- [ ] Natural-language query can be converted into validated QueryPlan.
- [ ] QueryPlan separates semantic text, hard filters, soft preferences and avoid signals.
- [ ] Explicit user constraints are preserved.
- [ ] LLM never becomes authoritative source of catalog titles.
- [ ] Optional TasteProfile context is compact/sanitized.
- [ ] Provider/model/prompt versions are observable.
- [ ] Failure falls back to raw query without breaking search.
- [ ] Recommendation Lab displays and compares raw vs expanded retrieval.
- [ ] Real benchmark query `SF qui fait réfléchir` demonstrates a complete LLM-plan -> vector-search path.

## Completion rule
Do not close because the LLM returns JSON. Use the Lab against the real catalog and show at least several natural-language requests where the generated plan is understandable, respects constraints and feeds real retrieval results without hallucinated catalog items.
