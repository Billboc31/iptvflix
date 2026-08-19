All 23 tests pass, TypeScript compiles clean. 

Two changes made:

**Fix 1** — `catalog-enrich-missing-service.ts:165,169` — `&&` → `||` in the `resumeRunId` checkpoint merge. The old logic reset `done=false` whenever a type was included in the current run, defeating the resume. Now if a type was already done in the previous run it stays done.

**Fix 2** — `metadata-enrichment-service.ts:454-459` — when `enrichSeriesSeasons` throws, the function now returns `'terminal-failed'` immediately without calling `onEnriched`. This eliminates the inconsistent state where a series appeared simultaneously in `enriched` and `failedLastEnrichment`.

The remaining bloquant (BLOQUANT 3) is the production run artifact — that requires live infrastructure access (`flyctl auth login` or production `DATABASE_URL`) and cannot be resolved in code.
