## Objective

Add the missing backend catalog API routes, extend the API contracts with detail-level DTOs, and replace the basic Movie and Series detail stubs with rich canonical detail pages — including navigable seasons/episodes for series and graceful degradation when enrichment data is absent.

## Included

### API Contracts — `/packages/api-contracts/src/catalog.ts`

- Add `MovieDetailResponse` extending `MovieResponse` with: `originalTitle: string | null`, `imdbId: string | null`, `tmdbId: string | null`, `enrichmentStatus: 'matched' | 'partial' | 'unmatched'`.
- Add `SeriesDetailResponse` extending `SeriesResponse` with same enrichment fields plus `seasons: SeasonSummary[]`.
- Add `SeasonSummary`: `{ seasonNumber: number; title: string | null; episodeCount: number; airYear: number | null }`.
- Add `EpisodeResponse`: `{ id: string; episodeNumber: number; title: string | null; synopsis: string | null; durationMinutes: number | null; airDate: string | null; availabilityStatus: AvailabilityStatus }`.
- Export all new types from `/packages/api-contracts/src/index.ts`.

`enrichmentStatus` is derived at query time: `matched` when `tmdbId` or `imdbId` is present and synopsis is non-null; `partial` when only some fields are populated; `unmatched` when neither external ID nor synopsis exists. No separate column is added to the DB.

### Backend — `/apps/api/src/routes/catalog.ts` (new file)

Fastify route plugin registering:

- `GET /movies` — paginated list with optional `genreId`, `year`, `quality`, `page`, `pageSize` filters. Drizzle query joins `movies → movieGenres → genres` and aggregates genre names. Availability status derived from `movieAvailabilities` (AVAILABLE if at least one AVAILABLE row for an enabled source exists).
- `GET /movies/:id` — single movie detail returning `MovieDetailResponse`. 404 when not found.
- `GET /series` — paginated list, same availability logic via `seriesAvailabilities`.
- `GET /series/:id` — single series detail returning `SeriesDetailResponse` with `seasons` aggregated from the `seasons` table (joined with episode count via `episodes`). 404 when not found.
- `GET /series/:id/seasons/:seasonNumber/episodes` — episode list for one season returning `EpisodeResponse[]`. Episode availability derived from `episodeAvailabilities`. 404 when series or season not found.
- `GET /search` — accepts `q` query param; returns `{ movies: MovieResponse[]; series: SeriesResponse[] }` filtered by `ILIKE '%q%'` on `title`, limited to 10 per type.

No provider-specific Xtream fields (category ID, stream ID, etc.) are included in any response.

### Backend — `/apps/api/src/index.ts`

- Import and register `catalogRoutes` plugin alongside existing `healthRoutes` and `sourcesRoutes`.

### Frontend API client — `/apps/web/src/lib/api.ts`

- Change return type of `getMovie(id)` from `MovieResponse` to `MovieDetailResponse`.
- Change return type of `getSeries(id)` from `SeriesResponse` to `SeriesDetailResponse`.
- Add `getSeriesSeasonEpisodes(seriesId: string, seasonNumber: number): Promise<EpisodeResponse[]>` calling `GET /series/:id/seasons/:seasonNumber/episodes`.

### Frontend pages

**`/apps/web/src/pages/MovieDetailPage.tsx`** (update):
- Change state type to `MovieDetailResponse`.
- Display `originalTitle` as secondary subtitle when it differs from `title`.
- Show `enrichmentStatus` badge: `Données manquantes` (gray) for `unmatched`, `Données partielles` (yellow) for `partial`; no badge for `matched`.
- Replace bare `<Spinner />` with a skeleton that mirrors the backdrop + poster + info layout.
- Handle 404 (`ApiError.status === 404`) with a dedicated not-found message instead of `null`.

**`/apps/web/src/pages/SeriesDetailPage.tsx`** (update):
- Change state type to `SeriesDetailResponse`.
- Same `originalTitle` and `enrichmentStatus` treatment as movie.
- Replace static season placeholders (built from `Array.from({ length: seasonCount })`) with real `seasons` array from `SeriesDetailResponse`.
- Each season row is a controlled accordion: clicking it fetches episodes via `getSeriesSeasonEpisodes` (only on first expand; cached in local state map keyed by `seasonNumber`).
- Render episode list inside expanded season using `EpisodeRow`.
- When `seasons` is empty, show a short fallback message: "Les saisons ne sont pas encore disponibles."
- Same skeleton and 404 handling as movie.

### New components — `/apps/web/src/components/detail/`

- **`SeasonAccordion.tsx`**: receives `seasons: SeasonSummary[]` and `seriesId: string`. Manages expansion state and episode fetch per season. Renders each season header (number, title if any, episode count, airYear). When expanded, fetches and renders episode rows or a `<Spinner />` while loading.
- **`EpisodeRow.tsx`**: renders one `EpisodeResponse` — episode number, title, synopsis truncated to 2 lines, duration, air date, and availability badge.

### Tests

**`/apps/api/src/routes/catalog.test.ts`** (new):
- `GET /movies/:id` returns canonical DTO without provider-specific fields.
- `GET /movies/:id` returns 404 for unknown ID.
- `GET /series/:id` includes `seasons` array.
- `GET /series/:id/seasons/:seasonNumber/episodes` returns episode list.
- `GET /series/:id/seasons/99/episodes` returns 404 when season does not exist.
- Availability status reflects `movieAvailabilities` rows.

**`/apps/web/src/pages/MovieDetailPage.test.tsx`** (new):
- Renders title, year, genres, synopsis from `MovieDetailResponse`.
- Shows `enrichmentStatus` badge for `unmatched` and `partial` cases.
- Shows not-found message when API returns 404.
- Shows error state on network failure.

**`/apps/web/src/pages/SeriesDetailPage.test.tsx`** (new):
- Renders season list from `SeriesDetailResponse.seasons`.
- Expanding a season triggers episode fetch and renders episode rows.
- Shows fallback message when `seasons` is empty.

**`/apps/web/src/test/handlers.ts`** (update):
- `GET /api/movies/:id` returns `MovieDetailResponse` (including new fields).
- `GET /api/series/:id` returns `SeriesDetailResponse` with a `seasons` array.
- Add `GET /api/series/:id/seasons/:seasonNumber/episodes` returning `EpisodeResponse[]`.
- Add a second `MOCK_UNMATCHED_MOVIE` with `enrichmentStatus: 'unmatched'` for fallback tests.

## Excluded

- Actual video playback or any playback button wired to a real stream URL.
- Recommendation rows or related content.
- Cinema Radar feature.
- Manual metadata correction UI.
- Cast, crew, production company, budget, or revenue fields (no DB schema for these).
- Watchlist or user rating persistence (no user/auth model yet).
- TMDB/IMDb data-fetching pipeline — enrichment data consumed here is whatever already exists in the canonical DB from prior ingestion tickets.
- Pagination of episodes within a season.

## Acceptance criteria

- `GET /api/movies/:id` returns a JSON body matching `MovieDetailResponse` with no Xtream-specific keys (e.g. `stream_id`, `category_id`).
- `GET /api/series/:id` response includes a `seasons` array; each entry has `seasonNumber` and `episodeCount`.
- `GET /api/series/:id/seasons/:seasonNumber/episodes` returns an array of `EpisodeResponse` objects.
- `GET /api/movies/nonexistent` and `GET /api/series/nonexistent` return HTTP 404.
- `MovieDetailPage` renders `originalTitle` when it differs from `title`.
- `MovieDetailPage` shows `Données manquantes` badge when `enrichmentStatus === 'unmatched'`.
- `MovieDetailPage` shows a not-found message (not a blank screen) for an unknown ID.
- `SeriesDetailPage` renders real season rows from `seasons`, not a static counter loop.
- Expanding a season in `SeriesDetailPage` fetches and displays its episode list.
- `SeriesDetailPage` with `seasons: []` displays the "Les saisons ne sont pas encore disponibles." fallback.
- All new API route tests pass (`pnpm --filter api test`).
- All new/updated frontend tests pass (`pnpm --filter web test`).
- TypeScript compilation succeeds with no errors across all workspaces (`pnpm tsc --noEmit`).
- No Xtream-specific types are imported in any detail page component or API contract type.
