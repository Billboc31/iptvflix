All changes committed. Here's a summary of the situation:

---

## Summary

**Two minor code fixes applied:**

1. **`retryFailures` with 0 failures** (`catalog-enrich-missing-service.ts`): Previously inserted a COMPLETED run record even when no failures matched the filter. Now returns `{ runId: null, queued: 0 }` without polluting the run log.

2. **Stat ambiguity for series with season failures** (`catalog-stats.ts`): A series can appear in both `enriched` (main metadata present, `metadataEnrichedAt` set) and `failedLastEnrichment` (season enrichment failed). Now exposes `enrichedWithSeasonFailures: N` in the series section to make this overlap explicit and diagnosable.

**What was already in the code (fixed in previous runs):**
- `retryFailures` filtered by `retryable=true` by default — ✅
- Season failures persisted in `enrichment_failures` with `stage: 'seasons'` — ✅  
- `persistFrenchLocalization` logs warnings on failure — ✅
- Collection upsert catch logs warnings — ✅
- `fullyEnriched` definition documented in code comments — ✅
- All 8 T115 tests pass — ✅

**Blocking — requires human operator action:**

The production run cannot be executed by the AI agent: `flyctl auth login` is required. The playbook at `runs/T115/production-run-playbook.md` contains exact curl commands. Once `flyctl auth login` is done, run the playbook to capture before/after catalog stats and the real failure list for the ~60k movie catalog — that's the final acceptance criterion.
