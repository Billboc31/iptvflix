## Objective

Create a `CatalogBootstrapService` that populates the canonical movies and series catalog directly from TMDB, independently of any provider source, with pagination, checkpointing, idempotent upserts, and observability. Add French metadata storage (`localizations` JSONB), browsing indexes, and protected admin endpoints to trigger and observe bootstrap runs.

## Included

### 1. Migration `apps/api/migrations/0030_catalog_bootstrap.sql`

- `CREATE TABLE catalog_bootstrap_runs` — fields: `id uuid PK`, `status` (PENDING/RUNNING/COMPLETED/FAILED), `started_at`, `completed_at`, `checkpoint jsonb`, `movies_created int`, `movies_updated int`, `series_created int`, `series_updated int`, `failed_count int`, `error_message text`; partial unique index on `status = 'RUNNING'` (one concurrent run at a time).
- `ALTER TABLE movies ADD COLUMN localizations jsonb` — shape `{ fr?: { title?: string, synopsis?: string, tagline?: string } }`.
- `ALTER TABLE series ADD COLUMN localizations jsonb` — same shape.
- Browsing indexes: `movies(popularity DESC NULLS LAST)`, `movies(original_language)`, `movies(year)`, `series(popularity DESC NULLS LAST)`, `series(original_language)`, `series(first_air_year)`.
- Genre join indexes: `movie_genres(genre_id)`, `series_genres(genre_id)`.

### 2. Schema `apps/api/src/db/schema/catalog-bootstrap-runs.ts`

Drizzle table definition for `catalog_bootstrap_runs` mirroring the migration. Export `catalogBootstrapRuns`.

### 3. Schema updates

- `apps/api/src/db/schema/movies.ts` — add `localizations: jsonb('localizations').$type<Localizations>()`.
- `apps/api/src/db/schema/series.ts` — same.
- `apps/api/src/db/schema/index.ts` — re-export `catalogBootstrapRuns`.

### 4. TMDB client extensions `apps/api/src/providers/metadata/tmdb/client.ts`

New public methods returning `MetadataCandidate[]`:

| Method | Endpoint |
|--------|----------|
| `fetchMovieTopRated(page)` | `/movie/top_rated` |
| `fetchSeriesTopRated(page)` | `/tv/top_rated` |
| `fetchMovieDiscover(params, page)` | `/discover/movie?sort_by=popularity.desc[&with_genres=X][&with_original_language=Y]` |
| `fetchSeriesDiscover(params, page)` | `/discover/tv?sort_by=popularity.desc[&with_genres=X][&with_original_language=Y]` |

Add optional `language?: string` param to existing `getMovieMetadata(tmdbId, opts?)` and `getSeriesMetadata(tmdbId, opts?)` — appends `?language=<lang>` to the TMDB URL. Return shape is unchanged.

### 5. MetadataProvider interface `apps/api/src/providers/metadata/types.ts`

Add the four new methods to the `MetadataProvider` interface. Add optional `language` param to `getMovieMetadata`/`getSeriesMetadata`. Add `DiscoverParams = { genreId?: number; language?: string }` type.

### 6. `apps/api/src/services/catalog-bootstrap-service.ts` (new)

#### Bootstrap step list

`buildSteps(config)` returns an ordered array of `BootstrapStep`:

```ts
type BootstrapStep =
  | { kind: 'feed'; mediaType: 'MOVIE' | 'SERIES'; feed: DiscoveryFeed | 'top_rated'; maxPages: number }
  | { kind: 'genre'; mediaType: 'MOVIE' | 'SERIES'; genreId: number; maxPages: number }
  | { kind: 'language'; mediaType: 'MOVIE' | 'SERIES'; language: string; maxPages: number }
```

Default step order:
1. Movie feeds: `popular`, `trending`, `upcoming`, `top_rated` (maxPages from env)
2. Series feeds: `popular`, `on_the_air` (via `upcoming` path on TV), `top_rated`
3. Movie genre discover: configured TMDB genre IDs
4. Series genre discover: configured TMDB genre IDs
5. Movie language discover: `fr` (French-origin films)
6. Series language discover: `fr`

#### Run orchestration

- `start(): Promise<string>` — acquires lock (throws `BootstrapAlreadyRunningError` if a RUNNING run exists), inserts new run record with status=RUNNING, calls `execute(runId)` as a detached async job, returns runId immediately.
- `resume(runId): Promise<void>` — for internal restart after server restart (future).
- `execute(runId): Promise<void>` — private:
  1. Load existing checkpoint (or initialize empty).
  2. For each step not yet marked `done` in checkpoint:
     a. Determine start page (last committed page + 1, or 1).
     b. Loop pages 1..maxPages:
        - Fetch candidates from TMDB client.
        - If empty page returned, mark step done and break.
        - Upsert batch to movies/series (see below).
        - Commit checkpoint page.
        - Throttle (250 ms).
     c. Mark step done in checkpoint.
  3. Set status=COMPLETED, set completedAt.
  4. On any uncaught error: set status=FAILED, errorMessage.

#### Upsert logic

For movies: `INSERT INTO movies (tmdb_id, title, year, synopsis, poster_path, popularity, match_status, ...) VALUES (...) ON CONFLICT (tmdb_id) DO UPDATE SET title = EXCLUDED.title, popularity = EXCLUDED.popularity, updated_at = now()`.  Set `match_status = 'MATCHED'`, leave `metadata_enriched_at = NULL` for new rows so enrichment picks them up. Do not overwrite `metadata_enriched_at` on updates.

For series: same pattern on `tmdb_id`.

Error isolation: catch per-page fetch errors, increment `failed_count`, store message in `error_message`, continue to next page.

#### Config (read from env at construction time)

| Env var | Default | Meaning |
|---------|---------|---------|
| `CATALOG_BOOTSTRAP_MAX_PAGES_PER_FEED` | `20` | Pages per feed step |
| `CATALOG_BOOTSTRAP_MAX_PAGES_TOP_RATED` | `20` | Pages for top_rated |
| `CATALOG_BOOTSTRAP_MAX_PAGES_PER_GENRE` | `10` | Pages per genre step |
| `CATALOG_BOOTSTRAP_MAX_PAGES_FRENCH` | `10` | Pages for language=fr steps |
| `CATALOG_BOOTSTRAP_GENRE_IDS_MOVIE` | `'28,35,18,27,878,12,14,10749'` | TMDB genre IDs for movies |
| `CATALOG_BOOTSTRAP_GENRE_IDS_TV` | `'18,35,10765,10759,80,9648'` | TMDB genre IDs for TV |

### 7. MetadataEnrichmentService update `apps/api/src/services/metadata-enrichment-service.ts`

After a successful `enrichMovie` or `enrichSeries` TMDB fetch, perform a second call with `language='fr-FR'`. Extract `{ title, overview, tagline }` from the French response. If any field differs from the English value, write to `localizations = jsonb_set(localizations, '{fr}', ...)`. Noop if French values are identical to the default (no redundant storage). This adds one extra TMDB call per enriched item; throttle already covers it.

### 8. Routes `apps/api/src/routes/catalog-bootstrap.ts` (new)

Both routes are protected (admin auth required):

- `POST /catalog-bootstrap` — triggers a new run; returns `{ runId, status: 'RUNNING' }`. Returns 409 if a run is already RUNNING.
- `GET /catalog-bootstrap/status` — returns the latest run record: `{ id, status, startedAt, completedAt, moviesCreated, moviesUpdated, seriesCreated, seriesUpdated, failedCount, errorMessage, checkpoint }`.

### 9. Env config `apps/api/src/config/env.ts`

Add the six `CATALOG_BOOTSTRAP_*` exports listed in §6.

### 10. Wiring `apps/api/src/index.ts`

- Import `CatalogBootstrapService` and `catalogBootstrapRoutes`.
- Instantiate `CatalogBootstrapService` (only when `TMDB_API_KEY` is set).
- Register `catalogBootstrapRoutes` inside the protected scope, passing the service instance.

### 11. Tests `apps/api/src/routes/__tests__/catalog-bootstrap.test.ts`

- `POST /catalog-bootstrap` → 201 with `{ runId, status: 'RUNNING' }`.
- Second `POST` while first is RUNNING → 409.
- `GET /catalog-bootstrap/status` when no run exists → 404.
- `GET /catalog-bootstrap/status` after a completed run → 200 with all counter fields.

Unit tests for `CatalogBootstrapService.buildSteps()` covering default config and custom env overrides.

## Excluded

- Collection-based discovery (no TMDB bulk endpoint; collection membership filled by enrichment service on `belongsToCollection`).
- Season and episode bootstrap (handled by existing `MetadataEnrichmentService.enrichSeries` + `EpisodeBackfillService`).
- Automatic scheduled bootstrap (service is admin-triggered; scheduler integration is a follow-up).
- Frontend/UI changes.
- Full-text search index (`tsvector`); tracked separately.
- Multi-locale support beyond French (`fr-FR`).
- Push notifications or webhooks on bootstrap completion.
- Analytics or reporting beyond run counters.

## Acceptance criteria

1. `POST /catalog-bootstrap` (authenticated) returns `{ runId, status: 'RUNNING' }` within 200 ms (run executes in background).
2. Concurrent `POST /catalog-bootstrap` while a run is RUNNING returns HTTP 409.
3. `GET /catalog-bootstrap/status` returns the latest run with `status`, `moviesCreated`, `moviesUpdated`, `seriesCreated`, `seriesUpdated`, `failedCount`, `errorMessage`, `checkpoint`.
4. A cold database with no media sources shows ≥ 500 movies and ≥ 200 series after a completed bootstrap run (default config, valid TMDB API key).
5. Re-running bootstrap on a populated database does not create duplicate rows; `moviesCreated` stays 0, `moviesUpdated` increases.
6. Killing and restarting the server mid-bootstrap, then triggering a new run, skips pages already committed in `checkpoint` and completes without duplicates.
7. Movies with `originalLanguage = 'fr'` appear in the catalog after bootstrap.
8. `localizations.fr` is populated (title and/or synopsis) for enriched entries where TMDB returns a distinct French translation.
9. `EXPLAIN` on `SELECT * FROM movies ORDER BY popularity DESC` uses the new index (no sequential scan).
10. `EXPLAIN` on `SELECT * FROM movies WHERE original_language = 'fr'` uses the new index.
11. All existing tests pass after migration and schema changes.
