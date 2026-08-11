## Objective

Implement backend search and filter endpoints over the canonical catalog (movies, series) and wire them to the already-scaffolded frontend pages, enabling users to browse, filter by genre/year/availability, and perform cross-type title search.

## Included

### Contracts — `packages/api-contracts/src/catalog.ts`
- Extend `MovieFilters` with `q?: string` (title search), `availability?: 'AVAILABLE' | 'UNAVAILABLE'`, `sortBy?: 'title' | 'year' | 'recentAvailability'`.
- Extend `SeriesFilters` with the same three fields.
- Export `GenreResponse` (already defined) from `packages/api-contracts/src/index.ts`.
- Note: `MovieFilters.quality` and `MovieResponse.quality` remain in the contract but are no-ops at backend level — the canonical model has no quality column; `quality` is always `null` in responses and the filter param is silently ignored.

### Backend — new service
- `apps/api/src/services/catalog-service.ts` — pure query functions using Drizzle:
  - `listMovies(filters: MovieFilters): Promise<PaginatedList<MovieResponse>>` — joins `movies`, `movieGenres`, `genres`, and `movieAvailabilities`; applies ILIKE on `(title, originalTitle)` for `q`; filters by genreId, year, availability status; sorts by `sortBy` (default: title); paginates.
  - `getMovie(id: string): Promise<MovieResponse | null>` — single movie with genres and derived availability.
  - `listSeries(filters: SeriesFilters): Promise<PaginatedList<SeriesResponse>>` — same pattern; joins `seriesAvailabilities`; counts distinct seasons.
  - `getSeries(id: string): Promise<SeriesResponse | null>` — single series with genres, season count, and derived availability.
  - `searchContent(q: string): Promise<{ movies: MovieResponse[]; series: SeriesResponse[] }>` — ILIKE on both tables, max 20 results per type, no pagination.
  - `listGenres(): Promise<GenreResponse[]>` — all genres ordered by name.
  - `availabilityStatus` derivation rule: AVAILABLE if at least one `movieAvailabilities`/`seriesAvailabilities` row with `status = 'AVAILABLE'` exists; else UNAVAILABLE.
  - `recentAvailability` sort: `MAX(lastSeenAt) DESC` over the availabilities join.
  - All filter params are validated before reaching Drizzle (see routes section).

### Backend — new routes
- `apps/api/src/routes/movies.ts` — register `GET /movies` and `GET /movies/:id`.
  - `GET /movies`: validate `page` (integer ≥ 1), `pageSize` (1–100), `year` (integer 1888–2100), `availability` (enum), `sortBy` (enum), `q` (string ≤ 200 chars, stripped). Return 400 with `{ error }` on invalid input. Return `PaginatedList<MovieResponse>`.
  - `GET /movies/:id`: return 404 when not found.
- `apps/api/src/routes/series.ts` — same pattern for `GET /series` and `GET /series/:id`.
- `apps/api/src/routes/search.ts` — `GET /search?q=`; validate `q` is non-empty string ≤ 200 chars; return 400 otherwise; return `{ movies, series }`.
- `apps/api/src/routes/genres.ts` — `GET /genres`; return `GenreResponse[]`.
- `apps/api/src/index.ts` — register the four new route modules.

### Frontend — wiring
- `apps/web/src/lib/api.ts` — add `listGenres(): Promise<GenreResponse[]>` calling `GET /genres`.
- `apps/web/src/hooks/useGenres.ts` (new) — simple hook wrapping `listGenres()`, returning `{ genres, loading }`.
- `apps/web/src/pages/MoviesPage.tsx` — call `useGenres()` and pass genres to `<FilterBar>`; add a `sortBy` selector (title / year / recentAvailability); add `availability` filter selector; add pagination controls (prev/next buttons using `data.total`, `data.page`, `data.pageSize`).
- `apps/web/src/pages/SeriesPage.tsx` — same changes as MoviesPage.
- `apps/web/src/pages/SearchPage.tsx` — replace empty `.catch(() => {})` with an `error` state rendered via the existing `<ErrorState>` component.

### Tests — backend
- `apps/api/src/routes/movies.test.ts` (new): mock catalog-service; test list (no filters, genre filter, year filter, availability filter, q filter, sortBy, pagination), single item 200 and 404, invalid inputs (400).
- `apps/api/src/routes/series.test.ts` (new): same pattern for series routes.
- `apps/api/src/routes/search.test.ts` (new): empty q → 400; q too long → 400; valid q returns `{ movies, series }` including empty arrays; test that provider DTOs are not referenced.
- `apps/api/src/routes/genres.test.ts` (new): returns array of `{ id, name }`.

### Tests — frontend
- `apps/web/src/test/handlers.ts` — add MSW handlers for `GET /genres`, `GET /movies`, `GET /series`, `GET /search`.
- `apps/web/src/pages/MoviesPage.test.tsx` — update/add: renders genre filter from mock genres; filters by genre change; shows empty state; shows error state; pagination advances page.
- `apps/web/src/pages/SearchPage.test.tsx` — update/add: shows results; shows empty state; shows error state on API failure.

## Excluded

- Natural-language or LLM-based search.
- Full-text search infrastructure (Elasticsearch, pg_tsvector) — ILIKE is sufficient for current scale.
- Personalized ranking or recommendation.
- Quality field implementation — `MovieResponse.quality` will always be `null`; the quality filter param is accepted but silently ignored until an enrichment ticket provides the data.
- Year-range filter (from/to) — the existing `year` (exact match) filter satisfies the contract; range is a future enhancement.
- Series detail page seasons display — already excluded from T013 scope.
- Enrichment-dependent filters (rating, director, cast) — not in the current canonical schema.

## Acceptance criteria

- `GET /movies?q=inception` returns movies whose title or originalTitle contains "inception" (case-insensitive).
- `GET /movies?genreId=<id>&year=2023&availability=AVAILABLE` returns only movies matching all three conditions.
- `GET /movies?sortBy=recentAvailability` returns movies ordered by the most recent IPTV appearance descending.
- `GET /series` mirrors the above for series.
- `GET /search?q=batman` returns `{ movies: [...], series: [...] }` without any Xtream provider DTO fields.
- `GET /search` (missing q) returns HTTP 400.
- `GET /movies?year=abc` returns HTTP 400.
- Movies/series with no availability rows appear in results with `availabilityStatus: 'UNAVAILABLE'` (not excluded).
- `GET /genres` returns an array of `{ id, name }` objects.
- MoviesPage and SeriesPage populate the genre dropdown from the `/genres` endpoint.
- MoviesPage and SeriesPage display pagination controls and advance correctly.
- SearchPage shows `<ErrorState>` when the API call fails.
- All new backend route tests pass (`pnpm --filter api test`).
- All new/updated frontend tests pass (`pnpm --filter web test`).
