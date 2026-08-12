# Implementation Output — T019

## Status

IMPLEMENTATION_COMPLETE

## Summary

All files required by the approved plan were already implemented in a prior session that hit rate limits before recording output. This session verified the implementation, fixed two test bugs, and confirmed all tests pass.

## Files Modified / Created

### New files
- `apps/api/src/services/external-discovery-service.ts` — ExternalDiscoveryService with discoverMovies, discoverSeries, materializeMovie, materializeSeries; 60s TTL in-memory cache; provider error isolation
- `apps/api/src/routes/discovery.ts` — POST /discovery/movies and POST /discovery/series endpoints
- `apps/api/src/services/__tests__/external-discovery-service.test.ts` — 16 unit tests

### Modified files
- `packages/api-contracts/src/catalog.ts` — Added ExternalMovieCandidate, ExternalSeriesCandidate types; extended SearchResponse with externalMovies/externalSeries
- `apps/api/src/providers/metadata/types.ts` — Added releaseStatus?, releaseDate?, firstAirDate? to ExternalMovieMetadata, ExternalSeriesMetadata, MetadataCandidate; added NoopMetadataProvider
- `apps/api/src/providers/metadata/tmdb/client.ts` — Maps TMDB status/release_date/first_air_date into extended types
- `apps/api/src/services/catalog-service.ts` — Added getMovieTmdbIds() and getSeriesTmdbIds() helpers for deduplication
- `apps/api/src/routes/search.ts` — Local-first search with external discovery fallback (threshold ≤5)
- `apps/api/src/index.ts` — Registers discoveryRoutes; creates ExternalDiscoveryService conditional on TMDB_API_KEY
- `apps/web/src/lib/api.ts` — Added materializeMovie() and materializeSeries() client calls
- `apps/web/src/pages/SearchPage.tsx` — External results section with badge rendering and materialization on click; defensive defaults for externalMovies/externalSeries
- `apps/web/src/components/content/PosterCard.tsx` — Added badge prop with unavailable/upcoming variants
- `apps/api/src/__tests__/integration/vertical-slice.test.ts` — Added 6 discovery integration tests; fixed duplicate mswServer.listen() across describe blocks; fixed cache-bleed in provider-failure test
- `apps/web/src/test/handlers.ts` — Added externalMovies/externalSeries to mock search response
- `apps/web/src/pages/SearchPage.test.tsx` — Updated test mock overrides to include new search response fields

## Test Results

- API unit tests: 218 passed / 0 failed (21 test files)
- Web component tests: 53 passed / 0 failed (11 test files)

## Bugs Fixed During Implementation

1. **Duplicate mswServer.listen()** in vertical-slice.test.ts: the second describe block called `mswServer.listen()` again while the file-level `beforeAll` already had MSW running. Removed the redundant listen/close pair from the second describe's hooks.

2. **Cache bleed in provider-failure test**: the "GET /search succeeds when TMDB returns 500" test used the same query string as a prior test whose result was still cached (60s TTL). Changed to a distinct query string so the test actually reaches the provider (which returns 500).

3. **Undefined externalMovies in web mocks**: test overrides and the default handler didn't include `externalMovies`/`externalSeries`, causing SearchPage to crash on `.length`. Added defensive `?? []` defaults in SearchPage and updated all mock handlers.

## Known Limits

- In-memory cache is cleared on API restart (not persistent across restarts). This is per-spec.
- External discovery is capped at 5 results per type — no pagination.
- `materializeMovie` / `materializeSeries` call `getMovieMetadata` synchronously on first access rather than queuing async enrichment; acceptable given the plan's scope.
