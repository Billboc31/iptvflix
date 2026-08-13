Now I have everything I need. Let me write the plan.

## Objective

Split the single blocking search endpoint into a fast local-only route and an independent remote route so local catalog results render immediately without waiting on TMDB. Extend local search to also match French localized titles (`localizations.fr.title`). Remove the `≤5 local results` gate so TMDB suggestions always appear as a separate enrichment section.

## Included

**`apps/api/src/routes/search.ts`**
- Remove the external discovery call and `LOCAL_RESULTS_THRESHOLD` from `GET /search` — it returns only `{ movies, series }`.
- Add `GET /search/remote`: validate `q`, call `searchContent(q)` for TMDB-ID exclusion, then call `discoveryService.discoverMovies/discoverSeries`, return `{ externalMovies, externalSeries }`. If `discoveryService` is absent or TMDB throws, return `{ externalMovies: [], externalSeries: [] }` with HTTP 200.

**`apps/api/src/services/catalog-service.ts`** — `searchContent()`
- For movies: extend the `WHERE` clause with a third OR condition: `` sql`${movies.localizations}->'fr'->>'title' ILIKE ${pattern}` `` alongside the existing `ilike(movies.title, pattern)` and `ilike(movies.originalTitle, pattern)`.
- Apply the same French-title OR to the series query.

**`apps/api/src/services/external-discovery-service.ts`**
- Raise `MAX_EXTERNAL_RESULTS` from `5` to `10` so the now-always-visible external section has meaningful depth.

**`packages/api-contracts/src/catalog.ts`**
- Remove `externalMovies` and `externalSeries` from `SearchResponse`.
- Add `DiscoverResponse = { externalMovies: ExternalMovieCandidate[]; externalSeries: ExternalSeriesCandidate[] }`.

**`apps/web/src/lib/api.ts`**
- Update `searchContent` return type to the new `SearchResponse` (no external fields).
- Add `searchDiscover(q: string): Promise<DiscoverResponse>` calling `GET /search/remote?q=`.

**`apps/web/src/pages/SearchPage.tsx`**
- Add `externalLoading` state (boolean, init `false`).
- In the `debouncedQuery` `useEffect`: fire `searchContent` and `searchDiscover` in parallel. When `searchContent` settles, write `movies`/`series` and set `loading = false`. When `searchDiscover` settles, write `externalMovies`/`externalSeries` and set `externalLoading = false`. Each has independent error handling.
- Replace `const showExternal = hasExternal && total <= 5` with `const showExternal = hasExternal || externalLoading` — show the external section whenever TMDB results exist or are in flight, regardless of local count.
- Render an inline `<Spinner />` inside the external section while `externalLoading` is `true`.
- Keep existing `externalError` display and `handleExternalMovieClick` / `handleExternalSeriesClick` unchanged.

**Tests** (update existing test files if they cover these modules):
- `routes/search.ts`: assert `GET /search` response no longer contains `externalMovies`; add case for `GET /search/remote` with stubbed `discoveryService`.
- `services/catalog-service.ts`: add case where the match is only in `localizations.fr.title` and assert the entity is returned.

## Excluded

- SSE or HTTP streaming for progressive delivery (two parallel HTTP calls achieve the same UX).
- Pagination of search results.
- Searching within episode titles or synopses.
- Franchise/collection search.
- Adding `tmdbId` to `MovieResponse` or `SeriesResponse`.
- Changes to the enrichment pipeline, materialization logic, or watchlist/shelf features.
- Ranking or scoring of merged results (ordering stays alphabetical).
- CDN-level caching.

## Acceptance criteria

- `GET /search?q=X` returns `{ movies, series }` with no TMDB call and no `externalMovies` field.
- `GET /search/remote?q=X` returns `{ externalMovies, externalSeries }` excluding TMDB IDs already present in the local catalog.
- A title stored only in `localizations.fr.title` (e.g. French translation absent from `title` and `originalTitle`) is returned by `GET /search`.
- `GET /search/remote?q=X` returns `{ externalMovies: [], externalSeries: [] }` when TMDB is unreachable or unconfigured.
- `SearchPage` renders local results as soon as `GET /search` resolves, before `GET /search/remote` has returned.
- `SearchPage` shows the external section regardless of how many local results exist.
- Clicking a TMDB result card materializes the entity (POST `/discovery/movies` or `/discovery/series`) and navigates to its detail page — unchanged behaviour.
- A TMDB failure produces no visible error on the local results section; only the external section shows the error or stays empty.
- A zero-availability materialized entity opens successfully on its detail page.
