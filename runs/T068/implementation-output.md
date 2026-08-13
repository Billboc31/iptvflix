All 6 changes were already implemented and all 35 tests (14 search-route + 16 discovery-service + 5 for sync-runs) pass.

Here is a summary of the implementation:

**Files modified:**

| File | Change |
|---|---|
| `packages/api-contracts/src/catalog.ts` | `SearchResponse` stripped of `externalMovies`/`externalSeries`; new `DiscoverResponse` type added |
| `apps/api/src/routes/search.ts` | `GET /search` now returns only local `{ movies, series }` with no TMDB call; `GET /search/remote` added — fetches local IDs for exclusion, calls `discoveryService`, returns `{ externalMovies, externalSeries }`, swallows all errors with HTTP 200 |
| `apps/api/src/services/external-discovery-service.ts` | `MAX_EXTERNAL_RESULTS` raised from `5` to `10` |
| `apps/api/src/services/catalog-service.ts` | `searchContent()` WHERE clause extended with `localizations->'fr'->>'title' ILIKE` for both movies and series |
| `apps/web/src/lib/api.ts` | `DiscoverResponse` imported; `searchDiscover(q)` added calling `GET /search/remote` |
| `apps/web/src/pages/SearchPage.tsx` | Parallel fire of `searchContent` + `searchDiscover`; independent `externalLoading` state; `showExternal = hasExternal \|\| externalLoading`; inline `<Spinner />` inside the external section while loading |
