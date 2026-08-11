Now I have everything I need. Let me produce the plan.

## Objective

Add an external metadata enrichment layer for canonical Movies and Series using TMDB as the initial provider, persisting enriched fields (title, synopsis, poster, backdrop, genres, runtime, external IDs) alongside explicit provenance, without coupling the enrichment layer to Xtream-specific models.

## Included

### Schema changes — `apps/api/src/db/schema/`
- `movies.ts`: add nullable columns `metadataProvider: text` and `metadataEnrichedAt: timestamp`.
- `series.ts`: same two nullable columns.
- Run `drizzle-kit generate` to produce a new migration in `apps/api/migrations/`.

### Environment config — `apps/api/src/config/env.ts`
- Add optional `TMDB_API_KEY` (string | undefined). When absent the enrichment service is disabled; IPTV catalog remains fully operational.
- Add `TMDB_STALE_DAYS` (default 7) controlling when enriched records are considered outdated.
- Add `TMDB_API_KEY=` placeholder to `.env.example`.

### Metadata provider abstraction — `apps/api/src/providers/metadata/types.ts`
- Export interface `MetadataProvider` with two methods:
  - `getMovieMetadata(tmdbId: number): Promise<ExternalMovieMetadata>`
  - `getSeriesMetadata(tmdbId: number): Promise<ExternalSeriesMetadata>`
- Export plain data types `ExternalMovieMetadata` and `ExternalSeriesMetadata` (title, originalTitle, year, synopsis, posterPath, backdropPath, genres: string[], runtimeMinutes, imdbId, popularity, voteAverage).

### TMDB provider — `apps/api/src/providers/metadata/tmdb/`
- `types.ts`: TMDB API response shapes for `GET /movie/{id}` and `GET /tv/{id}`.
- `client.ts`: class `TmdbClient implements MetadataProvider`.
  - Constructor accepts `{ apiKey: string, timeoutMs?: number }`.
  - Base URL `https://api.themoviedb.org/3`, auth via `Authorization: Bearer <apiKey>` header.
  - `getMovieMetadata(tmdbId)`: calls `/movie/{tmdbId}`, maps response to `ExternalMovieMetadata`.
  - `getSeriesMetadata(tmdbId)`: calls `/tv/{tmdbId}`, maps to `ExternalSeriesMetadata`.
  - Returns `null` on 404 (unknown ID) rather than throwing.
  - Retry on 429 (rate-limit): honour `Retry-After` header with one retry; throw `TmdbRateLimitError` if second attempt also fails.
  - Throw `TmdbNetworkError` on connectivity failures.
  - Never log the API key.
- `__tests__/client.test.ts`: Vitest tests using `vi.stubGlobal('fetch', mockFetch)`.
  - Fixtures: `__tests__/fixtures/movie-detail.json`, `series-detail.json`, `not-found.json`, `rate-limited.json`.
  - Cases: happy path (movie + series), 404 returns null, 429 retries once and succeeds, 429 twice throws, network error throws, malformed JSON throws.

### Enrichment service — `apps/api/src/services/metadata-enrichment-service.ts`
- Class `MetadataEnrichmentService` accepting `db`, `provider: MetadataProvider`.
- `enrichMovie(movieId: string, opts?: { force?: boolean }): Promise<'enriched' | 'skipped' | 'no-tmdb-id' | 'provider-failed'>`.
  - Loads movie from DB; returns `'no-tmdb-id'` if `tmdbId` is null.
  - Returns `'skipped'` if `metadataEnrichedAt` is within stale threshold and `force` is false.
  - Calls `provider.getMovieMetadata(tmdbId)`.
  - If provider returns null, logs a warning and returns `'provider-failed'` (does not throw).
  - On success, updates `title`, `originalTitle`, `year`, `synopsis`, `posterPath`, `backdropPath`, `durationMinutes`, `imdbId`, upserts genres, sets `metadataProvider = 'tmdb'` and `metadataEnrichedAt = now()`.
  - Genre upsert: insert-or-ignore into `genres` by slug, then sync `movieGenres` junction.
- `enrichSeries(seriesId: string, opts?)`: mirror of enrichMovie for series.
- `enrichPending(opts?: { staleDays?: number, force?: boolean }): Promise<{ movies: { enriched, skipped, failed }, series: { enriched, skipped, failed } }>`.
  - Queries movies WHERE `tmdbId IS NOT NULL AND (metadataEnrichedAt IS NULL OR metadataEnrichedAt < NOW() - interval)`.
  - Same for series.
  - Calls `enrichMovie` / `enrichSeries` per item; collects counters.
  - Rate-throttles to avoid exhausting the TMDB free tier (minimum 250 ms between calls).
- `__tests__/metadata-enrichment-service.test.ts`:
  - Mock `MetadataProvider` via `vi.fn()`.
  - Mock DB with in-memory objects or a minimal stub (no live DB required).
  - Cases: skip when no tmdbId, skip when fresh, enrich when stale, enrich when never enriched, provider null → provider-failed, provider throw → provider-failed, genres created and linked, provenance columns written.

### Enrichment route — `apps/api/src/routes/enrichment.ts`
- `POST /enrichment/trigger` — calls `enrichmentService.enrichPending()`, returns `{ movies, series }` counters.
- Register in `apps/api/src/index.ts` behind an `if (tmdbApiKey)` guard; route returns 503 when provider not configured.

### No changes to
- `packages/api-contracts` — existing `MovieResponse` / `SeriesResponse` already expose synopsis, posterUrl, backdropUrl, genres, year, runtime. Enrichment fills those columns; contract is unchanged.
- `CatalogSyncService` — enrichment is a separate concern triggered independently.
- Any existing routes or Xtream provider code.

## Excluded

- Fuzzy title matching between raw IPTV stream names and TMDB search results (separate ticket).
- Automatic enrichment trigger as part of catalog sync (can be wired later).
- Background scheduled enrichment (no cron in current architecture).
- M3U source type enrichment.
- Movie/series catalog query routes (`GET /movies`, `GET /series`) — assumed provided by another ticket; T010 only ensures enriched data is persisted in the database.
- Caching of TMDB responses in-memory or Redis.
- Recommendations, radar, playback.

## Acceptance criteria

- `POST /enrichment/trigger` returns 200 with enrichment counters when `TMDB_API_KEY` is set; returns 503 when absent.
- Movies and series that have a `tmdbId` and no `metadataEnrichedAt` receive enriched fields and `metadataProvider = 'tmdb'` after a trigger.
- A second trigger within the stale window skips already-enriched records (`skipped` counter increments, no TMDB calls made).
- Movies and series with no `tmdbId` are skipped silently; no error is raised.
- A TMDB 404 or network error for a single item does not abort the batch; remaining items are processed and the failed item's status is `'provider-failed'`.
- `TMDB_API_KEY` is never returned by any API response and is absent from logs.
- `vitest run` in `apps/api` passes with no live network calls (all TMDB calls mocked).
- New migration applies cleanly to an empty database alongside existing migrations.
