## Objective

Define the canonical IPTVFlix media catalog domain — Genre, Movie, Series, Season, Episode, and source availability tables — as Drizzle ORM schema files and a SQL migration, completely decoupled from any IPTV provider format (Xtream Codes, M3U, or future sources).

## Included

### Assumptions

- ORM is Drizzle ORM with `postgres-js` driver (established by T002 / issue #3). No Prisma.
- Canonical identity is UUID-based, not provider-derived.
- Provider identity in availability tables is a plain `provider_id` text key (e.g. `"xtream:server1"`) — no separate `IptvSource` entity in this ticket.
- Application-level upsert logic (not a DB trigger) is responsible for preserving `first_seen_at`; the schema supports it by keeping the two timestamp fields separate.
- `series_id` is denormalized onto `episodes` for query convenience (derivable via season, but avoids join in hot paths).

---

### Schema files — `apps/api/src/db/schema/`

**`genres.ts`**
- Table: `genres`
- `id` uuid PK `defaultRandom()`
- `name` text NOT NULL
- `slug` text UNIQUE NOT NULL
- `created_at` timestamptz NOT NULL `defaultNow()`

**`movies.ts`**
- Table: `movies`
- `id` uuid PK `defaultRandom()`
- `title` text NOT NULL
- `original_title` text
- `year` integer
- `duration_minutes` integer
- `synopsis` text
- `poster_path` text
- `backdrop_path` text
- `tmdb_id` integer UNIQUE
- `imdb_id` text UNIQUE
- `created_at` / `updated_at` timestamptz NOT NULL `defaultNow()`

- Table: `movie_genres` (co-located in this file)
- `movie_id` uuid FK → `movies.id` CASCADE NOT NULL
- `genre_id` uuid FK → `genres.id` CASCADE NOT NULL
- Composite PK `(movie_id, genre_id)`

**`series.ts`**
- Table: `series`
- `id` uuid PK `defaultRandom()`
- `title` text NOT NULL
- `original_title` text
- `first_air_year` integer
- `synopsis` text
- `poster_path` text
- `backdrop_path` text
- `tmdb_id` integer UNIQUE
- `imdb_id` text UNIQUE
- `created_at` / `updated_at` timestamptz NOT NULL `defaultNow()`

- Table: `series_genres` (co-located in this file)
- `series_id` uuid FK → `series.id` CASCADE NOT NULL
- `genre_id` uuid FK → `genres.id` CASCADE NOT NULL
- Composite PK `(series_id, genre_id)`

**`seasons.ts`**
- Table: `seasons`
- `id` uuid PK `defaultRandom()`
- `series_id` uuid FK → `series.id` CASCADE NOT NULL
- `season_number` integer NOT NULL
- `title` text
- `air_year` integer
- `synopsis` text
- `created_at` / `updated_at` timestamptz NOT NULL `defaultNow()`
- UNIQUE constraint: `(series_id, season_number)`

**`episodes.ts`**
- Table: `episodes`
- `id` uuid PK `defaultRandom()`
- `season_id` uuid FK → `seasons.id` CASCADE NOT NULL
- `series_id` uuid FK → `series.id` CASCADE NOT NULL (denormalized — see assumptions)
- `episode_number` integer NOT NULL
- `title` text
- `synopsis` text
- `duration_minutes` integer
- `air_date` date
- `created_at` / `updated_at` timestamptz NOT NULL `defaultNow()`
- UNIQUE constraint: `(season_id, episode_number)`

**`availabilities.ts`**
- Table: `movie_availabilities`
  - `id` uuid PK `defaultRandom()`
  - `movie_id` uuid FK → `movies.id` CASCADE NOT NULL
  - `provider_id` text NOT NULL
  - `provider_item_id` text NOT NULL
  - `first_seen_at` timestamptz NOT NULL
  - `last_seen_at` timestamptz NOT NULL
  - `created_at` timestamptz NOT NULL `defaultNow()`
  - UNIQUE constraint: `(movie_id, provider_id, provider_item_id)`

- Table: `episode_availabilities`
  - `id` uuid PK `defaultRandom()`
  - `episode_id` uuid FK → `episodes.id` CASCADE NOT NULL
  - `provider_id` text NOT NULL
  - `provider_item_id` text NOT NULL
  - `first_seen_at` timestamptz NOT NULL
  - `last_seen_at` timestamptz NOT NULL
  - `created_at` timestamptz NOT NULL `defaultNow()`
  - UNIQUE constraint: `(episode_id, provider_id, provider_item_id)`

---

### Modified files

**`apps/api/src/db/schema/index.ts`**
- Add re-exports for all new tables: `genres`, `movies`, `movieGenres`, `series`, `seriesGenres`, `seasons`, `episodes`, `movieAvailabilities`, `episodeAvailabilities`

---

### Migration

- Run `pnpm --filter api db:generate` to produce `apps/api/migrations/<timestamp>_canonical_media_catalog.sql`
- Commit the generated SQL migration file alongside the schema files

---

### Tests — `apps/api/src/db/__tests__/catalog-constraints.test.ts`

Six integration tests against a real PostgreSQL database (`DATABASE_URL` must point to a running instance with migrations applied). No mocks of the DB layer.

Setup: `beforeAll` inserts the prerequisite parent rows (one genre, one movie, one series, one season, one episode) used across tests. `afterEach` deletes test-inserted rows by their test-specific IDs to avoid state leakage.

1. **Season uniqueness** — insert two `seasons` rows with same `(series_id, season_number)` → expect unique constraint violation.
2. **Episode uniqueness** — insert two `episodes` rows with same `(season_id, episode_number)` → expect unique constraint violation.
3. **Movie availability uniqueness** — insert two `movie_availabilities` rows with same `(movie_id, provider_id, provider_item_id)` → expect unique constraint violation.
4. **`first_seen_at` preservation** — insert a `movie_availabilities` row; update `last_seen_at` to a later timestamp without modifying `first_seen_at`; verify `first_seen_at` is unchanged in the retrieved row.
5. **Multi-source availability** — insert one movie, then two `movie_availabilities` rows with distinct `provider_id` values; verify both rows are retrievable and associated to the same movie.
6. **Episode availability uniqueness** — insert two `episode_availabilities` rows with same `(episode_id, provider_id, provider_item_id)` → expect unique constraint violation.

## Excluded

- Any use of Prisma or alternative ORMs
- Provider-specific adapters, Xtream Codes DTOs, M3U parsers, or sync jobs
- `IptvSource` entity with credentials, URL, or polling configuration
- Metadata enrichment algorithm (TMDB/IMDB matching, poster fetching, language normalization)
- REST or GraphQL API endpoints over the catalog entities
- Recommendation scoring, cinema radar logic, frontend screens
- Android TV client
- Business logic: deduplication strategy, catalog merge, change detection

## Acceptance criteria

1. `apps/api/src/db/schema/` contains schema files for: `genres`, `movies` (+ `movie_genres`), `series` (+ `series_genres`), `seasons`, `episodes`, `availabilities` (+ `movie_availabilities` and `episode_availabilities`). No field name references Xtream- or M3U-specific terminology.
2. `apps/api/src/db/schema/index.ts` re-exports all nine new Drizzle table objects.
3. `pnpm --filter api db:generate` produces a new migration file with no errors; `pnpm --filter api db:migrate` applies it against a clean database with no errors.
4. UNIQUE `(series_id, season_number)` on `seasons` is enforced at the database level — test 1 passes.
5. UNIQUE `(season_id, episode_number)` on `episodes` is enforced at the database level — test 2 passes.
6. UNIQUE `(movie_id, provider_id, provider_item_id)` on `movie_availabilities` is enforced at the database level — test 3 passes.
7. `first_seen_at` on a `movie_availabilities` row is unchanged after an update that only modifies `last_seen_at` — test 4 passes.
8. One movie can hold two `movie_availabilities` rows with distinct `provider_id` values — test 5 passes.
9. UNIQUE `(episode_id, provider_id, provider_item_id)` on `episode_availabilities` is enforced at the database level — test 6 passes.
10. `vitest run` on the new test file passes against a running PostgreSQL instance with migrations applied.
