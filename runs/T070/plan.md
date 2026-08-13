Now I have everything I need to write the plan.

## Objective

Replace the current 2-shelf, availability-gated Movies and Series discovery pages with canonical-catalog-driven pages showing multiple automatic shelves (popular, top-rated, recent, upcoming, available now), with a clear "All catalog / Available now" toggle so the pages remain rich even with zero providers connected.

## Included

### `packages/api-contracts/src/catalog.ts`
- Extend `MovieFilters.sortBy` union type to `'title' | 'year' | 'recentAvailability' | 'popularity' | 'voteAverage'`
- Extend `SeriesFilters.sortBy` identically
- Add `upcoming?: boolean` to both `MovieFilters` and `SeriesFilters` (true = titles not yet released / in production)

### `apps/api/src/routes/movies.ts`
- Accept `'popularity'` and `'voteAverage'` as valid `sortBy` values (update validation guard)
- Parse `upcoming` query param as boolean (`'true'` → `true`), reject other non-boolean strings

### `apps/api/src/routes/series.ts`
- Same validation changes as `movies.ts`

### `apps/api/src/services/catalog-service.ts`
- `listMovies`: add order-by cases for `popularity` → `DESC movies.popularity NULLS LAST`, `voteAverage` → `DESC movies.vote_average NULLS LAST`
- `listMovies`: handle `upcoming=true` → `WHERE (theatrical_release_date > NOW() OR status IN ('Rumored','Planned','In Production','Post Production'))`
- `listSeries`: same popularity/voteAverage sort cases; `upcoming=true` → `WHERE (in_production = true OR status IN ('In Production','Planned'))`

### `apps/api/src/db/schema/movies.ts` and `apps/api/src/db/schema/series.ts`
- Add Drizzle `index()` definitions on `popularity` and `vote_average` columns
- Generate and apply migration for these four indexes

### `apps/web/src/lib/api.ts`
- Pass `upcoming` and the two new `sortBy` values through to query string for `listMovies` / `listSeries`

### `apps/web/src/hooks/useMovies.ts` and `apps/web/src/hooks/useSeries.ts`
- Accept and forward `upcoming?: boolean` and the extended `sortBy` union

### `apps/web/src/pages/MoviesPage.tsx`
- Add availability mode state: `'all' | 'available'` (default `'all'`)
- Render a toggle pill near the genre chips to switch between modes
- Hero: query `sortBy='popularity'` with no availability filter; the existing fallback query is removed
- Shelves rendered in default `'all'` mode (all from canonical catalog, no availability gate):
  - "Populaires" — `sortBy='popularity'`, limit 20
  - "Les mieux notés" — `sortBy='voteAverage'`, limit 20
  - "Sorties récentes" — `sortBy='year'`, limit 20
  - "À venir" — `upcoming=true`, limit 20; shelf hidden when `items.length === 0`
- In `'available'` mode: same shelves with `availability='AVAILABLE'` added to each query; "Disponibles" shelf (`sortBy='recentAvailability', availability='AVAILABLE'`) prepended
- When a genre chip is selected, genre shelf replaces all shelves (existing behaviour preserved)

### `apps/web/src/pages/SeriesPage.tsx`
- Identical restructuring: availability mode toggle, canonical hero from `sortBy='popularity'`, four canonical shelves, genre override

## Excluded

- Persisting the chosen availability mode across sessions or in user preferences
- Collection/franchise grouping shelves (requires dedicated UI to group by `collectionId`)
- Language/country-filtered shelves (no locale-filter UI planned in this ticket)
- Personalized recommendation shelves on Movies/Series pages (handled by Home page)
- Changes to the Home page, existing DYNAMIC/MANUAL/GENERATED shelf types, or the shelf generation service
- New DB tables beyond the four index additions

## Acceptance criteria

- With zero providers configured, the Movies page shows ≥ 3 populated canonical shelves (Populaires, Les mieux notés, Sorties récentes)
- With zero providers configured, the Series page shows the same ≥ 3 populated canonical shelves
- The "À venir" shelf renders only when `upcoming=true` returns at least one title; it is hidden otherwise
- Selecting "Disponible maintenant" mode adds the availability filter to all shelves and prepends the "Disponibles" shelf
- The hero on both pages renders from the highest-popularity canonical item, regardless of provider availability
- `GET /api/movies?sortBy=popularity` returns items sorted by `popularity DESC NULLS LAST`
- `GET /api/movies?upcoming=true` returns only titles matching the upcoming filter; non-boolean `upcoming` values return 400
- `GET /api/series?sortBy=voteAverage` returns items sorted by `vote_average DESC NULLS LAST`
- An upcoming or unavailable title's poster card navigates to its detail page; "Add to My List" is functional for it
- The four new DB indexes on `popularity` / `vote_average` exist in the applied migration
