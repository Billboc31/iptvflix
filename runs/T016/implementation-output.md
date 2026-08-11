All done. Here's a summary of the implementation:

---

## Files created / modified

| File | Change |
|---|---|
| `apps/api/src/db/schema/availabilities.ts` | Added `status` (default `AVAILABLE`) and `unavailableAt` to `episodeAvailabilities` |
| `apps/api/migrations/0007_episode_availability_status.sql` | New migration SQL for the two new columns |
| `apps/api/migrations/meta/_journal.json` | Journal entry for the new migration |
| `packages/api-contracts/src/catalog.ts` | Added `availabilityCount: number` to `MovieResponse`, `SeriesResponse`, `EpisodeResponse` |
| `apps/api/src/services/catalog-service.ts` | Replaced boolean availability map with per-item `COUNT` queries; all responses now include `availabilityCount` |
| `apps/api/src/routes/catalog.ts` | Same count-based approach for the `catalogRoutes` handlers (including episode route with `status = 'AVAILABLE'` filter) |
| `apps/api/src/services/catalog-sync-service.ts` | Added episode staleness marking: previously AVAILABLE `episode_availabilities` rows not seen in the snapshot are set to `UNAVAILABLE` |
| `apps/api/src/db/__tests__/catalog-constraints.test.ts` | Two new tests: canonical movie exists with zero availabilities; episode status column defaults/transitions correctly |
| `apps/api/src/routes/movies.test.ts` | Added `availabilityCount` to `MOCK_MOVIE`; two new tests for 0 and 2 |
| `apps/api/src/routes/series.test.ts` | Same for series |
| `apps/api/src/routes/catalog.test.ts` | Updated availability mocks from row objects to `{ cnt: N }` count shape; added `availabilityCount` assertions |
| `apps/api/src/__tests__/integration/vertical-slice.test.ts` | New disappearance test (canonical movie + watchlist + viewing-progress survive source removal); fixed pre-existing tests against DB pollution |

**195 tests pass, 0 failures.**
