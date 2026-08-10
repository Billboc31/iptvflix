## Objective

Define the canonical IPTVFlix media catalog domain — Movie, Series, Season, Episode, Genre, ExternalId, and SourceAvailability — as a Prisma-backed schema and typed domain layer completely independent from any IPTV provider format (Xtream Codes, M3U, or future sources).

## Included

### Assumptions

- Tech stack: TypeScript, Prisma ORM, PostgreSQL (as established by the persistence foundation, GitHub issue #3).
- Canonical identity is UUID-based, not provider-derived.
- Provider-specific identifiers live exclusively in `SourceAvailability`.
- A `Source` (IPTV source/account) entity exists or will be created by ticket #3; `SourceAvailability.sourceId` references it as a UUID foreign key. If absent from #3's schema, add a minimal `IptvSource` stub (id, label) in this ticket to satisfy the FK.
- Application-level upsert logic (not a DB trigger) enforces `firstSeenAt` immutability; the schema supports it by separating the two timestamp fields.

---

### Prisma schema — `prisma/schema.prisma`

Add the following models to the existing base schema.

**`Genre`**
- `id` UUID, PK
- `slug` String, unique — normalized key (`action`, `sci-fi`, …)
- `label` String — display name
- Relations: many-to-many with `Movie` and `Series` via implicit Prisma join tables

**`Movie`**
- `id` UUID, PK
- `title` String
- `originalTitle` String?
- `year` Int?
- `durationMinutes` Int?
- `synopsis` String?
- `posterPath` String?
- `backdropPath` String?
- `createdAt`, `updatedAt`
- Relations: genres (M:N Genre), externalIds (1:N ExternalId), availabilities (1:N SourceAvailability)

**`Series`**
- `id` UUID, PK
- `title` String
- `originalTitle` String?
- `firstAirYear` Int?
- `synopsis` String?
- `posterPath` String?
- `backdropPath` String?
- `createdAt`, `updatedAt`
- Relations: genres (M:N Genre), seasons (1:N Season), externalIds (1:N ExternalId), availabilities (1:N SourceAvailability)

**`Season`**
- `id` UUID, PK
- `seriesId` FK → Series (cascade delete)
- `seasonNumber` Int
- `title` String?
- `year` Int?
- `synopsis` String?
- `createdAt`, `updatedAt`
- Unique constraint: `(seriesId, seasonNumber)`
- Relations: episodes (1:N Episode)

**`Episode`**
- `id` UUID, PK
- `seasonId` FK → Season (cascade delete)
- `episodeNumber` Int
- `title` String?
- `synopsis` String?
- `durationMinutes` Int?
- `createdAt`, `updatedAt`
- Unique constraint: `(seasonId, episodeNumber)`
- Relations: availabilities (1:N SourceAvailability)

**`ExternalId`** — metadata references (TMDB, IMDB, etc.; not provider stream IDs)
- `id` UUID, PK
- `mediaType` Enum `MediaType { MOVIE SERIES }`
- `movieId` UUID? FK → Movie (nullable)
- `seriesId` UUID? FK → Series (nullable)
- `provider` String — e.g. `tmdb`, `imdb`
- `externalValue` String — the provider's identifier
- `createdAt`
- Unique constraint: `(provider, externalValue)` — no duplicate external ID per provider
- Check constraint (enforced via Prisma validation + migration raw SQL): exactly one of `movieId` / `seriesId` is non-null

**`SourceAvailability`** — links a canonical item to a provider stream item
- `id` UUID, PK
- `mediaType` Enum `AvailabilityMediaType { MOVIE SERIES EPISODE }`
- `movieId` UUID? FK → Movie
- `seriesId` UUID? FK → Series
- `episodeId` UUID? FK → Episode
- `sourceId` UUID FK → IptvSource (the IPTV account/source)
- `providerItemId` String — provider's internal stream identifier
- `firstSeenAt` DateTime — set on first insert, never overwritten on sync
- `lastSeenAt` DateTime — updated on every sync pass
- `isActive` Boolean, default true
- `createdAt`, `updatedAt`
- Unique constraint: `(sourceId, providerItemId, mediaType)` — prevents duplicate availability records per source/item pair
- Check constraint (raw SQL in migration): exactly one of `movieId` / `seriesId` / `episodeId` is non-null

---

### Migration

- Run `prisma migrate dev --name canonical-media-catalog` to generate and commit the migration.
- Migration file: `prisma/migrations/<timestamp>_canonical_media_catalog/migration.sql`
- Include raw SQL `CHECK` constraints in the migration for the "exactly one FK" invariants on `ExternalId` and `SourceAvailability` (Prisma does not generate these natively).

---

### Domain types — `src/domain/catalog/`

TypeScript interfaces decoupled from Prisma-generated types. No business logic.

- `src/domain/catalog/types.ts`
  - `CatalogMovie`, `CatalogSeries`, `CatalogSeason`, `CatalogEpisode`, `CatalogGenre`, `CatalogExternalId`, `CatalogSourceAvailability` interfaces
  - Fields match schema; use plain scalar types (string, number, Date) — no Prisma imports
- `src/domain/catalog/enums.ts`
  - `MediaType` (`MOVIE | SERIES`)
  - `AvailabilityMediaType` (`MOVIE | SERIES | EPISODE`)

---

### Tests — `src/domain/catalog/__tests__/`

All tests run against a real test database (no mocks). Six representative constraint tests:

1. **Season uniqueness** — inserting two seasons with the same `seasonNumber` for the same series must throw a unique constraint error.
2. **Episode uniqueness** — inserting two episodes with the same `episodeNumber` in the same season must throw a unique constraint error.
3. **SourceAvailability uniqueness** — inserting two availability rows with the same `(sourceId, providerItemId, mediaType)` must throw a unique constraint error.
4. **`firstSeenAt` preservation** — upserting a `SourceAvailability` that already exists must leave `firstSeenAt` unchanged while updating `lastSeenAt` to the new timestamp.
5. **Multi-source availability** — one `Movie` can be linked to two `SourceAvailability` rows from different sources; both rows coexist and are independently retrievable.
6. **ExternalId uniqueness** — inserting two `ExternalId` rows with the same `(provider, externalValue)` must throw a unique constraint error.

## Excluded

- Tech stack selection (owned by the persistence foundation, issue #3).
- Provider-specific adapter or sync logic (Xtream Codes DTOs, M3U parsers, import jobs).
- Full `IptvSource` model with credentials, polling configuration, etc. — only the minimal stub needed to satisfy the FK is in scope if #3 does not provide it.
- Metadata enrichment (TMDB/IMDB matching, poster fetching, language normalization).
- Recommendation, radar, and scoring models.
- Frontend screens, REST/GraphQL API endpoints, and Android TV client.
- Business logic on domain entities (hydration, comparison, deduplication strategy).

## Acceptance criteria

1. `prisma/schema.prisma` defines all seven models (`Genre`, `Movie`, `Series`, `Season`, `Episode`, `ExternalId`, `SourceAvailability`) with no Xtream- or M3U-specific field names or structures.
2. `prisma migrate deploy` runs clean against a fresh PostgreSQL database with no errors.
3. The unique constraint `(seriesId, seasonNumber)` on `Season` is enforced at the database level — test 1 passes.
4. The unique constraint `(seasonId, episodeNumber)` on `Episode` is enforced at the database level — test 2 passes.
5. The unique constraint `(sourceId, providerItemId, mediaType)` on `SourceAvailability` is enforced at the database level — test 3 passes.
6. A `SourceAvailability` upsert preserves `firstSeenAt` from the initial insert and updates only `lastSeenAt` — test 4 passes.
7. One `Movie` row can be associated with two `SourceAvailability` rows from different sources — test 5 passes.
8. The unique constraint `(provider, externalValue)` on `ExternalId` is enforced at the database level — test 6 passes.
9. `src/domain/catalog/types.ts` exports typed interfaces for all canonical entities; no Prisma-generated type is re-exported as a canonical domain type.
10. No file under `src/domain/catalog/` imports from a provider-specific module or references Xtream/M3U terminology.
