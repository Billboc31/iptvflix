No TypeScript errors. The fix is clean.

**What changed** — one file, two locations in `catalog-enrich-missing-service.ts`:

- **`countEligible()` (line 104–108)**: replaced the `force ? isNotNull(...) : and(...)` ternary with a single unified `and(...)` expression that always includes `eq(table.matchStatus, 'MATCHED')` and conditionally omits the stale-threshold check when `force=true`.

- **`execute()` (line 204–209)**: same pattern — unified `and(...)` keeping `matchStatus = 'MATCHED'` unconditionally, stale threshold gated by `force`.

**Why not touching `enrichWithRetry`**: the current code already handles the optional concern correctly — `enrichMovie`/`enrichSeries` already return `'terminal-failed'` (not `'provider-failed'`) for non-transient errors, and `enrichWithRetry`'s `if (result !== 'provider-failed') return result` guard exits immediately on `'terminal-failed'`. No retries occur on non-transient failures.

**Remaining blocker** (non-code): the production run artifact (`POST /admin/catalog-enrich-missing` → before/after stats + failure list) still needs to be executed and deposited in `runs/T115/`. That requires access to the production environment.
