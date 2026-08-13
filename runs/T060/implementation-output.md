241 tests across 15 test files, all passing.

The implementation is complete. Here's what was done across this session and the previous one:

**Schema changes** (migrations already applied):
- `movies.ts`: Added `matchStatusEnum` (PENDING/MATCHED/UNMATCHED) and `matchStatus` column
- `series.ts`: Imports and uses same `matchStatusEnum`  
- `sync-runs.ts`: Added `titleMatchedCount`/`titleUnmatchedCount` counters

**Service changes**:
- `title-matching-service.ts`: `resolveMovieId`/`resolveSeriesId` now insert canonical skeletons on TMDB miss; `matchBatch` has per-item try/catch so a single TMDB failure produces UNMATCHED for that item without aborting the batch
- `catalog-sync-service.ts`: Full title-matching pre-pass (`runTitleMatchPrePass`) for items without TMDB IDs, with deduplication by normalized title, guarding of already-MATCHED items, and `.catch()` wrapping to ensure sync completes even on TMDB outage

**Tests added**:
- `title-matching-service.test.ts`: +2 tests (spy-based guard test, per-item batch failure test)
- `catalog-sync-service.test.ts`: +9 tests in `title-matching pre-pass` describe block covering all pre-pass scenarios
