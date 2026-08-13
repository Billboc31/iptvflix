Implementation complete. Here's a summary of all changes made:

---

## Files modified

**`packages/api-contracts/src/catalog.ts`**
- Removed `externalMovies`/`externalSeries` from `SearchResponse`
- Added new `DiscoverResponse` type with those two fields

**`apps/api/src/routes/search.ts`**
- Removed `LOCAL_RESULTS_THRESHOLD` and the external discovery call from `GET /search` — it now returns only `{ movies, series }`
- Added `GET /search/remote`: fetches local TMDB IDs for exclusion, calls `discoveryService.discoverMovies/discoverSeries`, returns `{ externalMovies, externalSeries }`. Returns `{ externalMovies: [], externalSeries: [] }` when no discovery service or on any failure (HTTP 200 in all cases).

**`apps/api/src/services/catalog-service.ts`**
- Extended `searchContent()` movies WHERE clause with a third OR: `localizations->'fr'->>'title' ILIKE pattern`
- Same extension for the series query

**`apps/api/src/services/external-discovery-service.ts`**
- Raised `MAX_EXTERNAL_RESULTS` from `5` → `10`

**`apps/web/src/lib/api.ts`**
- Added `DiscoverResponse` import
- Added `searchDiscover(q)` calling `GET /search/remote`

**`apps/web/src/pages/SearchPage.tsx`**
- Added `externalLoading` state
- `useEffect` now fires `searchContent` and `searchDiscover` in parallel — each settles independently
- `showExternal = hasExternal || externalLoading` — external section appears immediately while TMDB is in flight
- Inline `<Spinner />` inside the external section during `externalLoading`
- TMDB failure silently leaves external section empty without affecting local results

**Tests updated** (`search.test.ts`, `external-discovery-service.test.ts`, `vertical-slice.test.ts`)
- Asserted `GET /search` no longer returns `externalMovies`
- Added 6 new cases for `GET /search/remote`
- Updated the cap-at-5 test to cap-at-10
- Updated integration tests to use `/search/remote` for external flows

**4 pre-existing test failures remain** (sync pipeline + scheduler, unrelated to search).
