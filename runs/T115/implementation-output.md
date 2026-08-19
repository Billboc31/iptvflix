The file looks correct. All 4 fixes are in place. Here's a summary of what was done:

---

**BLOQUANT 2 — `isEmbeddingEligible` as single source of truth**

`embedding-eligibility.ts` now exports two additional symbols derived from the same policy:
- `EMBEDDING_ELIGIBLE_SQL_PREDICATE` — raw SQL string for use inside `sql`` FILTER (WHERE ...)` aggregates (can't use a Drizzle expression builder there)
- `embeddingEligibleCondition()` — Drizzle `.where()` condition builder

`embedding-backfill-service.ts` now uses `embeddingEligibleCondition(table.metadataEnrichedAt)` in both cursor query variants (removed the inline `isNotNull`).

`catalog-stats.ts` now interpolates `sql.raw(EMBEDDING_ELIGIBLE_SQL_PREDICATE)` into all 4 FILTER WHERE clauses (movie `eligible`, movie `pending`, series `eligible`, series `pending`).

**BLOQUANT 3 — UNIQUE constraint crash on concurrent RUNNING**

`CatalogEnrichMissingService.checkNoRunningConflict()` queries for any existing RUNNING row and throws an error with `code: 'RUN_CONFLICT'` if one is found. It's called at the top of both `start()` and `retryFailures()` (before the `RUNNING` insert). The route handlers for both POSTs catch `RUN_CONFLICT` and return `409` with a descriptive message.

**BLOQUANT 4 — Retry transient failures (3 attempts, 250/500/1000 ms backoff)**

`CatalogEnrichMissingService.enrichWithRetry()` loops up to 3 times, returning early on any non-`'provider-failed'` result and sleeping between attempts. Both `execute()` (the batch cursor loop) and `retryFailures()` now call it instead of invoking `enrichMovie`/`enrichSeries` directly.

**BLOQUANT 1 — Production run** remains an operational step (cannot be automated from code). The enrichment endpoint is now correctly guarded and functional — it needs to be triggered against production to satisfy the completion rule.
