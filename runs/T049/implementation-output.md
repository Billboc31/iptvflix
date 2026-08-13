All 594 tests pass. Here's a summary of what was implemented:

---

## Summary

**New files created:**

- `apps/api/src/providers/m3u/errors.ts` — `M3UAuthError`, `M3UNetworkError`, `M3UParseError`
- `apps/api/src/providers/m3u/types.ts` — `M3UEntry`, `M3UClassifiedEntry`, `M3UCatalogSnapshot`
- `apps/api/src/providers/m3u/parser.ts` — `parseM3U()` (extended M3U line parser), `classifyEntries()` (conservative movie/episode/unclassified classification via group-title + SxxExx)
- `apps/api/src/providers/m3u/client.ts` — `M3UClient` with `testConnection()` (range-request probe) and `fetchSnapshot()`, both with credential sanitization via `sanitizeUrl()`
- `apps/api/src/providers/m3u/index.ts` — re-exports
- `apps/api/src/providers/m3u/__tests__/parser.test.ts` — 16 tests covering all fixtures
- `apps/api/src/providers/m3u/__tests__/client.test.ts` — 16 tests covering happy path, auth failure, timeout, malformed body, credential leakage

**Modified files:**

- `apps/api/src/services/catalog-sync-service.ts` — added `syncM3UCatalog()` mapping M3U classified entries to `NormalizedSnapshot`; series are synthesized from episode `seriesKey` groups
- `apps/api/src/services/sync-runs-service.ts` — added `fetchM3USnapshot()`, extended `triggerSync()` guard to include `'M3U'`
- `apps/api/src/services/source-service.ts` — replaced the stub with a real `M3UClient.testConnection()` call
- `apps/api/src/routes/sources.test.ts` — replaced the stub assertion with 3 proper M3U tests (happy path, 401, network error)
- `apps/api/src/config/env.ts` — added `M3U_FETCH_TIMEOUT_MS` (default 60000)
