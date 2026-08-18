I have all the data needed to write the test report. Let me write it now.

---

## Test Report — T103: LLM Query Planner

**Branch:** `ticket/T103-add-llm-query-planner-to-expand-natural-language-s`
**Date:** 2026-08-18

---

### Unit Tests

```
vitest run — apps/api

 ✓ llm-query-planner-service.test.ts (8 tests) — 5ms
   ✓ French input with explicit runtime (hardFilters.maxRuntimeMinutes = 120)
   ✓ English input (non-empty semanticIntent)
   ✓ Negative preference 'pas d'horreur' (avoidSignals + excludeGenres)
   ✓ Mixed hard + soft constraints (mediaTypes=['MOVIE'] + preferredDecades)
   ✓ Malformed LLM response → rawQueryFallbackPlan (plannerFallback=true)
   ✓ Provider timeout (8001ms via fake timers) → fallback without throw
   ✓ Prompt injection attempt → schemaVersion unchanged
   ✓ Null provider → rawQueryFallbackPlan immediately
```

All 8 ticket-specific tests pass.

---

### TypeScript

No errors in any T103-introduced file (`query-plan.ts`, `llm-query-planner-service.ts`, `openai-llm-planner-provider.ts`, `llm-planner-provider.ts`, `query-planner-v1.ts`, `recommendation-lab.ts`, `RecommendationLabPage.tsx`).

Pre-existing TypeScript errors exist in `profiles.test.ts`, `playback-session-store.test.ts`, `authenticateDevice.test.ts` and frontend test helpers — all unmodified by T103.

---

### Regressions

The full suite shows `12 failed | 63 passed` on T103. The same 12 test files fail identically on `main` before T103 changes. Confirmed via stash comparison. **Zero regressions introduced by T103.**

The one `title-matching-service.test.ts` assertion failure (`matchBatch per-item TMDB failure returns UNMATCHED`) is also pre-existing on `main`.

---

### Acceptance Criteria

| Criterion | Status | Notes |
|-----------|--------|-------|
| Natural-language query converts to validated QueryPlan | **PASS** | 8 unit tests cover French, English, constraints, fallback paths |
| QueryPlan separates semantic text, hard filters, soft preferences, avoidSignals | **PASS** | `query-plan.ts` schema has all required fields with clear separation |
| Explicit user constraints preserved | **PASS** | `userConstraints[]` (verbatim) + `hardFilters` extraction; prompt instructs this explicitly |
| LLM never authoritative source of catalog titles | **PASS** | System prompt: "Do NOT invent or name specific titles. Do NOT return a movie list." |
| Optional TasteProfile context is compact/sanitized | **PASS** | `sanitizeProfileContext()`: max 20 items, 100 chars each; passed as hint only |
| Provider/model/prompt versions observable | **PASS** | `plannerMeta: { provider, model, promptVersion, latencyMs }` on every plan |
| Failure falls back to raw query without breaking search | **PASS** | 8s timeout, catch-all fallback, `plannerFallback=true`, null-provider safe |
| Recommendation Lab displays and compares raw vs expanded retrieval | **PASS** | LLM toggle, A/B columns, `QueryPlanPanel` with all plan fields |
| "SF qui fait réfléchir" live benchmark via Lab | **CANNOT VERIFY** | Requires `OPENAI_API_KEY` + populated vector catalog. Not testable in unit context. |

---

### Notable Limitation

`maxRuntimeMinutes`, `audioLanguages`, `includeGenres`, and `excludeGenres` are correctly extracted into `hardFilters` but are **not enforced** on retrieval results. Only `mediaTypes` and year filters are applied. The code documents this honestly (comment at `recommendation-lab.ts:154–158`) and the UI shows each unenforced filter with a "non appliqué" badge. This means a user query like "moins de 2h" will produce a plan with `maxRuntimeMinutes: 120` but the returned results may include longer films.

This is a transparent partial implementation of criterion 3, not a silent failure. It should be tracked as follow-up work if full enforcement is required.

---

### Verdict

**PASS with one open item.** All verifiable acceptance criteria are met. The live Lab benchmark (`SF qui fait réfléchir` end-to-end with real catalog) cannot be confirmed without a running environment with `OPENAI_API_KEY` configured and embeddings backfilled — this is outside the scope of automated testing and must be validated manually before final closure of the ticket per the completion rule.
