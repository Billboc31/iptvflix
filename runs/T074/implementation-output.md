No errors in any catalog files. Both fixes are applied:

**Fix 1 — Blocking TS error** (`catalog-bootstrap-service.test.ts:16`): Added `hierarchyPriorityCount: 200` to the `config: BootstrapConfig` object so it satisfies the required interface field.

**Fix 2 — Concurrency guard** (`catalog.ts`): Added a module-level `hydrationInProgress: Set<string>`. The fire-and-forget block now checks `!hydrationInProgress.has(id)` before triggering, adds the id on start, and removes it in `.finally()`. Concurrent requests for the same un-hydrated series now fire exactly one TMDB call instead of N.
