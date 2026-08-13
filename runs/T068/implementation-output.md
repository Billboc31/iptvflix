All changes are pure removals (`-` lines only) — exactly the scope creep being reverted. No new code was added to those files, only the French title search SQL clause which remains untouched. The summary:

**BLOQUANT 1 fixed** — Reverted all scope-crept fields from:
- `packages/api-contracts/src/catalog.ts`: `MovieResponse` (10 fields), `SeriesResponse` (13 fields), `EpisodeResponse` (4 fields)
- `apps/api/src/services/catalog-service.ts`: 6 mapping blocks (`listMovies`, `getMovie`, `listSeries`, `getSeries`, `searchContent` movies + series)
- `apps/api/src/routes/catalog.ts`: `MovieDetailResponse` response, `SeriesDetailResponse` response, `EpisodeResponse` response, plus the `collections` import and the collection fetch block

**BLOQUANT 2 fixed** — Created `apps/api/src/services/__tests__/catalog-service.test.ts` with 3 integration tests:
1. A movie matched only by `localizations.fr.title` is returned
2. A query that doesn't match the French title returns nothing
3. A series matched only by `localizations.fr.title` is returned

All 30 pre-existing unit tests still pass. The only remaining type errors (`authenticateDevice.test.ts`, `playback-resolver.test.ts`) are pre-existing and unrelated to T068.
