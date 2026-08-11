Now I have everything needed. Let me write the plan.

## Objective

Evolve the existing canonical catalog so Movies, Series, Seasons and Episodes have an identity and lifecycle independent from source availabilities, exposing explicit availability count through the canonical API while eliminating the episode availability status gap and preserving all existing canonical references.

## Included

### 1. Schema — `apps/api/src/db/schema/availabilities.ts`
- Add `status: availabilityStatusEnum` (default `'AVAILABLE'`) and `unavailableAt: timestamp` to `episodeAvailabilities`, matching the existing structure of `movieAvailabilities` and `seriesAvailabilities`.

### 2. Migration
- Create `apps/api/migrations/0007_<slug>.sql` — `ALTER TABLE episode_availabilities ADD COLUMN status availability_status NOT NULL DEFAULT 'AVAILABLE'`, `ADD COLUMN unavailable_at timestamptz`.
- Backfill: all existing rows receive `status = 'AVAILABLE'` (the DEFAULT covers this).

### 3. API contract — `packages/api-contracts/src/catalog.ts`
- Add `availabilityCount: number` to `MovieResponse`, `SeriesResponse`, and `EpisodeResponse`. The field carries the count of records whose `status = 'AVAILABLE'` for that canonical item. This surfaces the zero/one/many distinction without leaking provider identifiers.
- `availabilityStatus` remains `'AVAILABLE' | 'UNAVAILABLE'` (derived: `availabilityCount > 0 ? 'AVAILABLE' : 'UNAVAILABLE'`).

### 4. Catalog service — `apps/api/src/services/catalog-service.ts`
- `listMovies()` / `getMovie()`: extend the `availRows` fetch to also `count()` records with `status = 'AVAILABLE'` per movie; populate `availabilityCount` in the mapped response.
- `listSeries()` / `getSeries()`: same pattern for series.
- Episode listing (currently in `apps/api/src/routes/catalog.ts` lines 328–368, may be refactored or left in route): join `episodeAvailabilities` and derive `availabilityStatus` from the new `status` field, plus emit `availabilityCount`.
- The `availability='UNAVAILABLE'` filter already covers the zero-availability case via `NOT EXISTS (... status = 'AVAILABLE')` — no change needed there.

### 5. Catalog sync service — `apps/api/src/services/catalog-sync-service.ts`
- After a successful sync pass, mark stale `episode_availabilities` rows `status = 'UNAVAILABLE'` (and set `unavailableAt = now()`) for any `episodeId` whose `(providerId, providerItemId)` pair was not seen in the current snapshot, mirroring the existing logic for movies and series.
- This ensures source disappearance does not delete canonical episode data or user progress references.

### 6. Tests
- **Schema/constraint test** (`apps/api/src/db/__tests__/catalog-constraints.test.ts`): assert a canonical Movie with zero availability rows is inserted and retrievable; assert episode availability status column accepts and defaults correctly.
- **API unit tests** (`apps/api/src/routes/movies.test.ts`, `apps/api/src/routes/series.test.ts`): assert `availabilityCount: 0` is returned for a movie/series with no availability rows; assert `availabilityCount: 2` when two provider records both have `status = 'AVAILABLE'`.
- **Integration disappearance test** (`apps/api/src/__tests__/integration/vertical-slice.test.ts`): insert a movie with one availability, run a sync that omits it, assert `status` becomes `'UNAVAILABLE'`; assert canonical movie row, watchlist entry and viewing progress entry survive intact.

## Excluded

- Plex ingestion or M3U source type changes.
- Language/quality preference resolution.
- Release notification system.
- Importing or seeding from an external movie database.
- Admin UI or frontend changes.
- Changes to the title-matching or metadata-enrichment pipeline (those services create canonical records; the FK structure already supports zero-availability creation upstream).
- Migrating or transforming existing watchlist/viewing-progress rows (canonical IDs are unchanged; no data migration needed for user-state tables).

## Acceptance criteria

- `GET /movies` returns a movie row that has zero availability records; `availabilityCount` is `0` and `availabilityStatus` is `'UNAVAILABLE'`.
- `GET /series` returns a series with zero availability records; same fields behave consistently.
- `GET /series/:id/seasons/:n/episodes` returns episodes with zero availability records with `availabilityCount: 0`.
- A canonical movie with two availability records from different providers returns `availabilityCount: 2`.
- After a sync that drops a previously known episode stream, the `episode_availabilities` row has `status = 'UNAVAILABLE'` and the canonical episode, season, series rows all still exist.
- After the same disappearance event, watchlist and viewing-progress rows referencing the canonical IDs are intact.
- The new migration applies cleanly with `drizzle-kit migrate` on a fresh database and on a database that already has existing episode availability rows.
- All existing tests pass; new tests for zero, one, and multiple availability cases plus disappearance pass.
- No provider-specific identifier (`providerId`, `providerItemId`) appears in any `MovieResponse`, `SeriesResponse`, or `EpisodeResponse` field.
