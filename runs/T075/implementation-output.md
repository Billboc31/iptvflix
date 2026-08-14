All 25 tests pass. Here's a summary of what was fixed:

---

## Changes applied

### `apps/api/src/lib/parse-year.ts` (new)
Extracted the duplicated `parseYear` utility into a shared module.

### `apps/api/src/providers/metadata/tmdb/client.ts`
Removed the local `parseYear` function; imports from `../../../lib/parse-year.js` instead.

### `apps/api/src/services/similar-titles-service.ts`
Three fixes:
1. **Local DB metadata** — `resolveMovieCandidates` and `resolveSeriesCandidates` now select `title`, `posterPath`, `year`, `voteAverage` from the local catalog tables. The card mapping uses local DB values as primary, falling back to TMDB candidate data only for nullable fields (`posterPath`, `year`, `voteAverage`). `title` (notNull in schema) always comes from the local catalog.
2. **Genre inserts after materialization** — `materializeMovie` and `materializeSeries` now use `.returning({ id })` to get the inserted row's ID, then call `upsertMovieGenres` / `upsertSeriesGenres` when the TMDB metadata includes genre data. This ensures materialized entries participate in the genre-based fallback.
3. **`parseYear` de-duplicated** — removed local copy, uses shared `lib/parse-year.ts`. Added local `slugify` helper (3 lines, not worth a shared module).

### `apps/api/src/services/__tests__/similar-titles-service.test.ts`
Updated the `getSimilarSeries` mock row to include `title`, `posterPath`, `year`, `voteAverage` so the assertion `expect(result[0].title).toBe('Similar Series 1')` correctly tests local-DB data priority.
