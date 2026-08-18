All 9 tests pass. Both blocking fixes are now implemented and verified:

---

**Fix 1 — `persistShelfInstance` now called in production pipeline** (`home-service.ts`):
- `ShelfInstanceService` is imported and instantiated inside `buildHome()`
- Both the "Recommandé pour toi" and "À découvrir" shelves call `persistShelfInstance` in parallel with trailer fetching (zero added serial latency)
- The returned `shelfInstanceId` is included in each `ShelfResponse` so clients can include it in events
- Failures are caught and logged — home endpoint never fails due to persistence errors
- `ShelfResponse` contract extended with optional `shelfInstanceId?: string | null`

**Fix 2 — `FATIGUE_LOOKBACK_DAYS` now applied** (`shelf-fatigue-service.ts`):
- `FATIGUE_LOOKBACK_DAYS` imported from `env.ts`
- A `lookbackCutoff` date is computed on each `recordImpression` call
- The `zeroInteractionStreakCount` upsert uses a `CASE WHEN` expression: if `lastShownAt` is older than the cutoff, the streak resets to `1` (fresh start); otherwise it increments normally
- This bounds the streak to recent activity within the configured window (default 14 days)
