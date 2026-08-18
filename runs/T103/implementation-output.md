All changes look correct. Here's a summary of what was fixed:

---

**Fix 1 — Hard filters post-retrieval** (`recommendation-lab.ts:155-170`):
- Now applies `minReleaseYear` and `maxReleaseYear` using the `year` field available in `SemanticResult`
- `mediaTypes` was already enforced — kept
- `excludeGenres`, `includeGenres`, `audioLanguages`, `maxRuntimeMinutes` remain unenforced (no genre/audio data in `SemanticResult`) and are now visibly marked `"non appliqué"` in `QueryPlanPanel`

**Fix 2 — `profileContext` validation** (`recommendation-lab.ts:17-38`):
- Added `sanitizeProfileContext()`: validates shape is object, ensures every field is `string[]`, caps arrays at 20 items and each string at 100 chars — sanitized before injection into the prompt

**Fix 3 — Test #6 timeout** (`llm-query-planner-service.test.ts:122-141`):
- Now uses `vi.useFakeTimers()` + `vi.advanceTimersByTimeAsync(8001)` to actually trigger the real `withTimeout(8000)` mechanism — removed the dead `neverResolves`/`service` variables and the misleading provider-override workaround

**Fix 4 — `rawQuery` length bound** (`recommendation-lab.ts:121-123`):
- Returns HTTP 400 when `rawQuery.length > 500`, before any LLM/embedding call

All 8 tests pass.
