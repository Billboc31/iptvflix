All tests pass. Here's a summary of what was implemented:

---

## Files modified or created

### New files
- **`apps/api/src/services/not-found-error.ts`** — extracted `NotFoundError` to a standalone module to avoid transitive DB import in unit tests
- **`apps/api/src/services/similar-titles-service.ts`** — `SimilarTitlesService` class with `getSimilarMovies` / `getSimilarSeries`, 5-minute in-memory cache, up to 5 materializations per request, TMDB fallback to local genre query on network error
- **`apps/api/src/services/__tests__/similar-titles-service.test.ts`** — 12 unit tests covering TMDB hit, deduplication, source exclusion, zero-source availability, materialization cap, failure resilience, network fallback, cache hit, and limit
- **`apps/api/src/routes/__tests__/similar-titles.test.ts`** — 13 route integration tests covering both endpoints: 200 shape, 404 for unknown id, limit validation (0/99 → 400), non-UUID id → 400

### Modified files
- **`apps/api/src/providers/metadata/tmdb/client.ts`** — added `TmdbSimilarItem`, `TmdbSimilarResponse` types and 4 methods: `getMovieSimilar`, `getMovieRecommendations`, `getSeriesSimilar`, `getSeriesRecommendations`
- **`apps/api/src/services/catalog-service.ts`** — replaced inline `NotFoundError` class with re-export from `not-found-error.ts`
- **`apps/api/src/routes/movies.ts`** — added `MoviesRouteOptions`, opts parameter, `GET /movies/:id/similar` route
- **`apps/api/src/routes/series.ts`** — added `SeriesRouteOptions`, opts parameter, `GET /series/:id/similar` route
- **`apps/api/src/index.ts`** — instantiates `SimilarTitlesService` and passes it to `moviesRoutes` and `seriesRoutes`
