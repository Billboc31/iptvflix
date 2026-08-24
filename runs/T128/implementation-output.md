All 6 fixes applied and verified. Here's the summary:

---

## Changes applied

### `movies-pool-service.ts`
- **[BLOQUANT 1]** Added `sql\`${shelfConcepts.desiredMediaTypes} @> '["MOVIE"]'::jsonb\`` filter to three concept-selection queries: `_fillMoviesPoolAsync` conceptRows, `selectThematicMovieConcept`, `selectExplorationMovieConcept`. Prevents series-oriented concepts from leaking into the movies page.
- **[MEDIUM 4]** `getFreshMovieIds` now uses `OR(gte(theatricalReleaseDate), gte(digitalReleaseDate))` instead of `gte(createdAt)`. Uses actual release dates from the TMDB schema rather than catalog import date.
- **[MINEUR 5]** Removed the unused `sessionId` parameter from `selectThematicMovieConcept` signature and both call sites.
- Added `or` to drizzle-orm imports.

### `movies-service.ts`
- **[BLOQUANT 2]** Added `fillMoviesPool(session.id, profileId, MOVIES_POOL_TARGET)` in the HIT branch before returning. Ensures pagination pool is populated even when serving a cached snapshot with a fresh session.

### `movies-snapshot-service.ts`
- **[MEDIUM 3]** `isMoviesSnapshotStale` now returns `false` when `invalidatedAt !== null`. Explicitly invalidated snapshots go straight to MISS (immediate regeneration) instead of STALE (served + async regen).

### `movies-sessions.ts`
- **[MINEUR 6]** Added `.notNull()` to `expiresAt` column. Matches the real invariant — all insert paths always provide this value.

### `movies-snapshot-service.test.ts`
- Added `'triggers pool fill for infinite scroll'` assertion to the HIT test suite.
- Added new `isMoviesSnapshotStale — pure function` describe block with 3 direct unit tests covering the `invalidatedAt` guard, past-expiry, and future-expiry cases.

**Result:** 34 → 38 tests in movies-snapshot, 30 → 30 in movies-pool. 64 total, all passing. Home tests unchanged (15+15 still green).
