The fixes look correct. Here's a summary of what was changed:

**Files modified:**

1. **`apps/api/src/services/catalog-enrich-missing-service.ts`** — `retryFailures()` now tracks `{ totalEligible, processed, enriched, skipped, retrying, failedTerminal }` per item, and saves them to `checkpoint.stats` (with `remaining` = `failedTerminal`, `ratePerMinute: 0`, `etaSeconds: null`) when the run completes. Also sets `failedCount` on the run record. `GET /admin/catalog-enrich-missing/status` after a retry run will now return meaningful stats instead of `"stats": null`.

2. **`apps/api/src/db/schema/enrichment-failures.ts`** — added a one-line comment above `retryCount` clarifying `0 = initial failure, no retry attempted; incremented on each subsequent retry`.

**Remaining blocker (unchanged — requires human action):** The Completion Rule requires a production run via `flyctl`. The playbook at `runs/T115/production-run-playbook.md` documents the exact steps; it must be executed by an operator with Fly.io access.
