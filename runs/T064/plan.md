## Objective

Enrich the canonical media schema with the complete set of TMDB metadata fields required for a premium streaming UI (popularity, vote counts, languages, countries, collections, keywords, external IDs, sync provenance timestamps), add a `collections` table, and update the enrichment service and API contracts so TMDB identity is the single canonical anchor. Existing user state (watchlist, progress, shelves, feedback) is unaffected because it already tracks canonical UUIDs.

## Included

### 1. New migration — `apps/api/migrations/0020_tmdb_first_catalog.sql`

**`movies` table** — add nullable columns:
- `popularity REAL`
- `vote_count INTEGER`
- `original_language VARCHAR(10)` (ISO 639-1, e.g. `"en"`)
- `spoken_languages JSONB` (array of `{iso_639_1, name}`)
- `production_countries JSONB` (array of `{iso_3166_1, name}`)
- `tagline TEXT`
- `status TEXT` (TMDB release status: "Released", "Post Production", "Rumored", etc.)
- `keywords JSONB` (array of keyword strings)
- `collection_id UUID REFERENCES collections(id)` (nullable FK)
- `external_ids JSONB` (e.g. `{tvdb_id, wikidata_id, facebook_id}`)
- `tmdb_synced_at TIMESTAMPTZ`

**`series` table** — add nullable columns:
- `popularity REAL`
- `vote_count INTEGER`
- `original_language VARCHAR(10)`
- `spoken_languages JSONB`
- `production_countries JSONB`
- `tagline TEXT`
- `in_production BOOLEAN`
- `networks JSONB` (array of `{id, name, logo_path, origin_country}`)
- `created_by JSONB` (array of `{id, name, profile_path}`)
- `number_of_seasons INTEGER`
- `number_of_episodes INTEGER`
- `keywords JSONB`
- `external_ids JSONB` (e.g. `{tvdb_id, imdb_id, wikidata_id}`)
- `tmdb_synced_at TIMESTAMPTZ`

**`seasons` table** — add nullable columns:
- `tmdb_id INTEGER UNIQUE`
- `poster_path TEXT`
- `episode_count INTEGER`

**`episodes` table** — add nullable columns:
- `tmdb_id INTEGER`
- `poster_path TEXT`
- `vote_average REAL`
- `vote_count INTEGER`

**`genres` table** — add nullable column:
- `tmdb_id INTEGER UNIQUE`

**New `collections` table**:
```sql
CREATE TABLE collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tmdb_id INTEGER UNIQUE NOT NULL,
  name TEXT NOT NULL,
  overview TEXT,
  poster_path TEXT,
  backdrop_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

All new columns are nullable; existing rows remain valid without re-enrichment.

### 2. Drizzle schema files

- `apps/api/src/db/schema/movies.ts` — add all new movie columns with correct Drizzle types (`real`, `integer`, `text`, `jsonb`, `timestamp`); add `collectionId` FK referencing `collections`
- `apps/api/src/db/schema/series.ts` — add all new series columns
- `apps/api/src/db/schema/seasons.ts` — add `tmdbId`, `posterPath`, `episodeCount`
- `apps/api/src/db/schema/episodes.ts` — add `tmdbId`, `posterPath`, `voteAverage`, `voteCount`
- `apps/api/src/db/schema/genres.ts` — add `tmdbId` (integer, unique)
- New `apps/api/src/db/schema/collections.ts` — define `collections` table
- `apps/api/src/db/schema/index.ts` — export `collections`

### 3. TMDB types — `apps/api/src/providers/metadata/tmdb/types.ts`

Add interfaces:
- `TmdbCollection` — `{ id, name, overview, poster_path, backdrop_path }`
- `TmdbExternalIds` — `{ imdb_id?, tvdb_id?, wikidata_id?, facebook_id? }`
- `TmdbKeyword` — `{ id, name }`
- `TmdbSpokenLanguage` — `{ iso_639_1, name }`
- `TmdbProductionCountry` — `{ iso_3166_1, name }`
- `TmdbNetwork` — `{ id, name, logo_path, origin_country }`
- `TmdbCreatedBy` — `{ id, name, profile_path }`

Extend `TmdbMovieDetail` with: `popularity`, `vote_count`, `original_language`, `spoken_languages`, `production_countries`, `tagline`, `status`, `keywords`, `belongs_to_collection`, `external_ids`

Extend `TmdbSeriesDetail` with: `popularity`, `vote_count`, `original_language`, `spoken_languages`, `production_countries`, `tagline`, `in_production`, `networks`, `created_by`, `number_of_seasons`, `number_of_episodes`, `keywords`, `external_ids`

Extend `TmdbSeason` with: `id` (TMDB season ID), `poster_path`, `episode_count`

Extend `TmdbEpisode` with: `id` (TMDB episode ID), `still_path`, `vote_average`, `vote_count`

### 4. TMDB client — `apps/api/src/providers/metadata/tmdb/client.ts`

- Update `fetchMovieDetails(tmdbId)` to request `append_to_response=keywords,external_ids` and map new fields via `mapMovieDetail()`
- Update `fetchSeriesDetails(tmdbId)` to request `append_to_response=keywords,external_ids` and map new fields via `mapSeriesDetail()`
- Add `fetchCollection(collectionTmdbId): Promise<TmdbCollection>` — `GET /collection/{id}`
- Update `mapMovieDetail()` to populate all new fields from raw TMDB response
- Update `mapSeriesDetail()` to populate all new fields
- Update `fetchSeasonDetails()` mapping to include `tmdbId`, `posterPath`, `episodeCount`
- Update episode mapping to include `tmdbId`, `posterPath`, `voteAverage`, `voteCount`

### 5. Metadata enrichment service — `apps/api/src/services/metadata-enrichment-service.ts`

- After fetching movie detail, upsert collection into `collections` table if `belongs_to_collection` is set; set `collectionId` FK on the movie row
- Populate all new movie columns (`popularity`, `voteCount`, `originalLanguage`, `spokenLanguages`, `productionCountries`, `tagline`, `status`, `keywords`, `externalIds`) on movie upsert
- Set `tmdbSyncedAt = now()` at the end of a successful movie enrichment
- Populate all new series columns on series upsert; set `tmdbSyncedAt = now()`
- When upserting genres during enrichment, set `tmdbId` from TMDB genre object
- When processing series season details, update `seasons` rows with `tmdbId`, `posterPath`, `episodeCount`
- When processing episodes, update `episodes` rows with `tmdbId`, `posterPath`, `voteAverage`, `voteCount`

### 6. API contracts — `packages/api-contracts/src/catalog.ts`

Add to `MovieResponse` / `MovieDetailResponse`:
- `popularity: number | null`
- `voteCount: number | null`
- `originalLanguage: string | null`
- `spokenLanguages: Array<{ iso639_1: string; name: string }> | null`
- `productionCountries: Array<{ iso3166_1: string; name: string }> | null`
- `tagline: string | null`
- `status: string | null`
- `keywords: string[] | null`
- `collection: { tmdbId: number; name: string; posterPath: string | null; backdropPath: string | null } | null`
- `externalIds: Record<string, string | number | null> | null`

Add to `SeriesResponse` / `SeriesDetailResponse`:
- Same `popularity`, `voteCount`, `originalLanguage`, `spokenLanguages`, `productionCountries`, `tagline`, `keywords`, `externalIds` fields
- `inProduction: boolean | null`
- `networks: Array<{ id: number; name: string; logoPath: string | null; originCountry: string }> | null`
- `createdBy: Array<{ id: number; name: string; profilePath: string | null }> | null`
- `numberOfSeasons: number | null`
- `numberOfEpisodes: number | null`

Add to `EpisodeResponse`:
- `tmdbId: number | null`
- `posterPath: string | null`
- `voteAverage: number | null`
- `voteCount: number | null`

### 7. Route handlers

- `apps/api/src/routes/movies.ts` — include new columns in SELECT; populate new fields in response mapping
- `apps/api/src/routes/series.ts` — same for series, including collection join

### 8. TypeScript compilation check

After all changes: run `pnpm tsc --noEmit` in `apps/api` and `packages/api-contracts` to confirm zero type errors.

## Excluded

- Proactive TMDB catalog seeding (pre-seeding canonical entries from TMDB trending/popular without a provider having the content — follow-up ticket)
- Changing the title-matching flow (providers still drive initial canonical entity creation; the matching layer is unchanged)
- Modifying provider adapters (Xtream, Plex, M3U client code unchanged)
- UI changes beyond updated API contract types
- Removing or restructuring `matchStatus` / `titleMatchResults` (separate architectural step if needed)
- Changing user state tables (watchlist, progress, feedback, taste, shelves, arrivals, release lifecycle)
- Auth, device pairing, playback commands, sync runs, scheduler

## Acceptance criteria

1. Migration `0020_tmdb_first_catalog.sql` applies cleanly to an existing production-shaped database with no data loss (all new columns nullable).
2. `movies` table has columns: `popularity`, `vote_count`, `original_language`, `spoken_languages`, `production_countries`, `tagline`, `status`, `keywords`, `collection_id`, `external_ids`, `tmdb_synced_at`.
3. `series` table has equivalent new columns plus `in_production`, `networks`, `created_by`, `number_of_seasons`, `number_of_episodes`.
4. `seasons` table has `tmdb_id` (unique), `poster_path`, `episode_count`.
5. `episodes` table has `tmdb_id`, `poster_path`, `vote_average`, `vote_count`.
6. `genres` table has `tmdb_id` (unique).
7. `collections` table exists; `movies.collection_id` FK references it; `collections.tmdb_id` is unique.
8. Running metadata enrichment on a TMDB-matched movie: populates `tmdb_synced_at`, `popularity`, `voteCount`; upserts a `collections` row and sets `collectionId` when TMDB returns a collection.
9. `GET /movies/:id` response includes all new fields (nulls acceptable for unenriched rows).
10. `GET /series/:id` response includes all new fields.
11. Existing watchlist, progress, and feedback rows remain intact after migration.
12. `pnpm tsc --noEmit` passes in `apps/api` and `packages/api-contracts`.
13. Existing Vitest suite passes without modification.
