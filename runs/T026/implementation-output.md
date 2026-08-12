All 361 tests pass (359 + 2 new). The two missing `availableToMe: true` tests have been added to `shelves.test.ts`:

- `availableToMe: true for movies` — verifies the `inArray` path returns only movies with an AVAILABLE record
- `availableToMe: true for series` — same for series

Both follow the identical mock-chain pattern as the `false` tests (`setupSelectFromWhere({})` for the subquery, then `setupSelectWhereOrderLimit` for the main results). No changes to `shelf-service.ts` were needed.
