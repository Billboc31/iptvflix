Now I have enough context to write the plan. Let me produce it.

## Objective

Extend the search flow with an external catalog discovery fallback: when local search yields sparse results, the configured metadata provider (TMDB) is queried; results not already in the local DB are returned as external candidates. Clicking an external candidate materializes a canonical Media record (zero availabilities) that feeds into the existing detail pages.

## Included

### `packages/api-contracts/src/catalog.ts`
- Add `ExternalMovieCandidate` type: `{ tmdbId: string; title: string; year: number | null; synopsis: string | null; posterUrl: string | null; releaseStatus: string | null; releaseDate: string | null }`.
- Add `ExternalSeriesCandidate` type: same shape minus `releaseDate`, add `firstAirDate`.
- Extend `SearchResponse` (currently `{ movies, series }`) with `externalMovies: ExternalMovieCandidate[]` and `externalSeries: ExternalSeriesCandidate[]`.

### `apps/api/src/providers/metadata/types.ts`
- Extend `ExternalMovieMetadata` and `ExternalSeriesMetadata` with optional `releaseStatus?: string` and `releaseDate?: string` / `firstAirDate?: string` if those fields are not already mapped from TMDB responses.

### `apps/api/src/providers/metadata/tmdb/client.ts`
- Map `movie.status` and `movie.release_date` (TMDB fields) into the extended `ExternalMovieMetadata`. Map `series.status` and `series.first_air_date` for series.

### `apps/api/src/services/external-discovery-service.ts` _(new file)_
- Class `ExternalDiscoveryService(db, provider: MetadataProvider)`.
- `discoverMovies(query: string, excludeTmdbIds: Set<string>): Promise<ExternalMovieCandidate[]>` — calls `provider.searchMovies(query)`, filters out tmdbIds already in `excludeTmdbIds`, caps at 5 results, returns mapped candidates. Catches provider errors and returns `[]`.
- `discoverSeries(query, excludeTmdbIds): Promise<ExternalSeriesCandidate[]>` — same pattern.
- `materializeMovie(tmdbId: string): Promise<{ id: string }>` — find-or-create canonical Movie row (no availabilities), then call `MetadataEnrichmentService.enrichMovie()`. Returns the canonical id.
- `materializeSeries(tmdbId: string): Promise<{ id: string }>` — same for Series.
- In-memory TTL query cache (simple `Map<string, { value, expiresAt }>`, 60 s TTL) to bound repeated provider calls for the same query within an interactive session.

### `apps/api/src/routes/search.ts`
- After obtaining local results, collect their `tmdbId`s into a `Set`.
- If `TMDB_API_KEY` is configured and local total (movies + series) is below a threshold (≤ 5), call `ExternalDiscoveryService.discoverMovies` and `discoverSeries` in parallel, passing the exclude set.
- Append `externalMovies` and `externalSeries` to the response. On provider failure, those arrays are empty; local results are unaffected.

### `apps/api/src/routes/discovery.ts` _(new file)_
- `POST /discovery/movies` body `{ tmdbId: string }` → calls `ExternalDiscoveryService.materializeMovie(tmdbId)` → redirects to the existing movie detail query and returns `MovieDetailResponse`.
- `POST /discovery/series` body `{ tmdbId: string }` → same for Series.
- Returns `409` if tmdbId format is invalid; returns existing record (idempotent) if already materialized.

### `apps/api/src/index.ts`
- Register `discoveryRoutes` alongside existing route registrations.
- Pass `ExternalDiscoveryService` instance (only when `TMDB_API_KEY` is set; use a no-op stub otherwise that always returns empty arrays).

### `apps/api/src/services/__tests__/external-discovery-service.test.ts` _(new file)_
Unit tests (Vitest + mock `MetadataProvider`):
- Provider returns hits → candidates are mapped, sorted by relevance, capped at 5.
- `excludeTmdbIds` causes already-local results to be suppressed (deduplication).
- Upcoming title with no release date is returned correctly.
- Provider throws → returns `[]`, does not rethrow.
- Same query within TTL → provider is called only once (cache hit).
- `materializeMovie` with unknown tmdbId → row created with `availabilityCount: 0`.
- `materializeMovie` called twice with same tmdbId → idempotent, single row.

### Integration tests — extend `apps/api/src/__tests__/integration/vertical-slice.test.ts`
- Search for a title not in local catalog → `externalMovies` contains the candidate.
- TMDB mock returns the movie; it is not duplicated against local result with same tmdbId.
- `POST /discovery/movies` materializes; second call returns same id.
- Provider mock throws 500 → `GET /search` still returns local results, `externalMovies: []`.

### `apps/web/src/lib/api.ts`
- Extend `searchContent` return type to include `externalMovies` and `externalSeries`.
- Add `materializeMovie(tmdbId: string): Promise<{ id: string }>` calling `POST /discovery/movies`.
- Add `materializeSeries(tmdbId: string): Promise<{ id: string }>`.

### `apps/web/src/pages/SearchPage.tsx`
- Render existing local `movies`/`series` grids unchanged.
- Below local results, render an "Also found externally — not available to you" section showing `externalMovies` and `externalSeries` via `PosterCard`.
- On click of an external card: call `materializeMovie`/`materializeSeries` then navigate to `/movies/:id` or `/series/:id`.
- If `externalMovies` and `externalSeries` are both empty (or TMDB not configured), the section is not rendered.
- If local results are already abundant (> 5 combined), the external section is not shown even if populated.

### `apps/web/src/components/content/PosterCard.tsx`
- Add optional `badge?: { label: string; variant: 'unavailable' | 'upcoming' }` prop.
- Render a small overlay chip (e.g., "Not available" in grey, "Upcoming" in amber) on the bottom of the poster when provided.

## Excluded

- Importing all TMDB movies/series into the local database proactively.
- Release-follow notifications or watchlist triggers on future release.
- Recommendation ranking or "similar titles" suggestions.
- Availability on commercial streaming services not configured as sources.
- Pagination of external discovery results (capped at 5 per type).
- Persistent search result cache (TTL is in-memory, cleared on restart).
- UI changes to `MoviesPage`/`SeriesPage` catalog listing — only `SearchPage` is affected.
- Any changes to the sync, enrichment trigger, or source management flows.

## Acceptance criteria

- `GET /search?q=<title-not-in-local-db>` returns `externalMovies` containing the TMDB candidate when TMDB is configured and local results < 5.
- The same tmdbId present in a local `MovieResponse` does **not** appear again in `externalMovies` (no duplicates).
- `POST /discovery/movies` with a valid tmdbId creates exactly one canonical Movie row (verified by repeating the call — same `id` returned).
- The created movie has `availabilityCount: 0` and `availabilityStatus: 'UNAVAILABLE'` in the subsequent `GET /movies/:id` response.
- `GET /search?q=<anything>` succeeds and returns local results even when the TMDB client returns a 5xx error (`externalMovies: []`).
- A TMDB title with `status: "In Production"` and a future release date is returned as an external candidate with non-null `releaseStatus`; navigating to its materialized detail page renders without error.
- The web UI shows an "externally found" section only when external candidates exist and local results are sparse; clicking a card navigates to the canonical detail page after materialization.
- `PosterCard` renders a badge for external results with `availabilityCount: 0`; no badge appears on local available results.
- All new unit tests and integration tests pass (`pnpm test` from repo root).
