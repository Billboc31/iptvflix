All tasks complete. Here's a summary of every file created or modified:

---

## Files modified

### `packages/api-contracts/src/catalog.ts`
- Extended `MovieFilters.sortBy` and `SeriesFilters.sortBy` to `'title' | 'year' | 'recentAvailability' | 'popularity' | 'voteAverage'`
- Added `upcoming?: boolean` to both filter types

### `apps/api/src/routes/movies.ts` + `series.ts`
- Accepts `popularity` and `voteAverage` as valid `sortBy` values
- Parses and validates `upcoming` query param (`'true'` → `true`, anything else → 400)

### `apps/api/src/services/catalog-service.ts`
- `listMovies`: adds `popularity` (`DESC NULLS LAST`) and `voteAverage` sort branches; adds `upcoming=true` → WHERE clause filtering on release date / status
- `listSeries`: same, with `in_production` / status condition for upcoming

### `apps/api/src/db/schema/movies.ts` + `series.ts`
- Added `index` import from `drizzle-orm/pg-core`
- Added `index('movies_popularity_idx')` + `index('movies_vote_average_idx')` to `movies` table definition
- Same for `series`

### `apps/api/migrations/0033_t070_discovery_indexes.sql` _(new)_
- Creates `movies_vote_average_idx` and `series_vote_average_idx` (the popularity indexes already existed from migration 0030)

### `apps/api/migrations/meta/_journal.json`
- Added entries for `0032_catalog_refresh` and `0033_t070_discovery_indexes` (0032 was missing from the journal)

### `apps/web/src/lib/api.ts`
- Extended `toQuery` to accept `boolean` values (for `upcoming`)

### `apps/web/src/pages/MoviesPage.tsx`
- Extracted `MovieShelf` helper component (hides itself when empty after loading)
- Hero now queries `sortBy='popularity'`, no availability gate
- Added "Tout le catalogue / Disponible maintenant" toggle pill
- Default (`all`) mode: Populaires, Les mieux notés, Sorties récentes, À venir shelves — all canonical, no availability gate
- `available` mode: prepends a "Disponibles" shelf and adds `availability='AVAILABLE'` to all other shelves

### `apps/web/src/pages/SeriesPage.tsx`
- Identical restructuring to MoviesPage
