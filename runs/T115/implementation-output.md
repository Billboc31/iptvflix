All 8 T115 tests pass. TypeScript compiles clean. The pre-existing failures in `title-matching-service.test.ts` are unrelated to this ticket.

**Change made:** `catalog-enrich-missing.ts:32-37` — added `mediaTypes` validation that returns HTTP 400 when the array contains values other than `'MOVIE'` or `'SERIES'`.

**Remaining blocker (not resolvable by code):** The production run criterion requires live infrastructure access (`DATABASE_URL` or `flyctl`). The review correctly flags this as requiring human operator action — once a run is executed against production and counts published to `runs/T115/production-run-20260819.md`, the implementation is complete.
