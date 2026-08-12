All four fixes are in place and all tests pass. Here's a summary of what changed:

**Files modified:**

1. **`apps/api/src/services/shelf-generation-service.ts`**
   - Min seeds: `< 2` → `< 3`, error message updated to "between 3 and 10 entries"
   - Ranking call: replaced `positiveMediaIds: seedIds` (useless, seeds are filtered out anyway) with `preferGenreIds: inferredGenreIds` (actually influences scores for non-seed candidates)
   - `refreshGeneratedShelf`: added defensive validation of `rules` schema, wrapped delete/insert/update in a `db.transaction` to prevent partial-state on failure

2. **`apps/api/src/services/recommendation-ranking-service.ts`**
   - Added `preferGenreIds?: string[]` to `RankOpts`
   - Computes `preferGenreBonus` (+3.0 if candidate shares any preferred genre); applied in both cold-start and warm scoring paths so seed-genre signals work for new profiles too

3. **`apps/api/src/routes/shelves.ts`**
   - Route validation: `< 2` → `< 3`, error message updated to match

4. **`apps/api/src/services/__tests__/shelf-generation-service.test.ts`**
   - All flows updated to use 3 seeds (added `MOVIE_ID_E`, `THREE_MOVIE_SEEDS` constant)
   - `'rejects fewer than 2 seeds'` → `'rejects fewer than 3 seeds'` (now uses 2 seeds which are rejected)
   - `'accepts exactly 2 seeds'` → `'rejects exactly 2 seeds'` + `'accepts exactly 3 seeds'`
   - Added `mockDb.transaction` mock (passes `mockDb` as `tx` so existing delete/insert/update mocks still work)
   - Added test: `'rejects refresh when rules are missing or malformed'`
   - Added test: `'passes preferGenreIds derived from seeds to rankRecommendations'`
   - 17 tests total (was 14), all passing
