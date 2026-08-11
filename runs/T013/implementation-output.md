All tests pass and TypeScript is clean. Here's a summary of everything implemented:

---

## Implementation complete

### Files created (11)
| File | Purpose |
|---|---|
| `apps/api/src/services/catalog-service.ts` | Drizzle query functions: `listMovies`, `getMovie`, `listSeries`, `getSeries`, `searchContent`, `listGenres` |
| `apps/api/src/routes/movies.ts` | `GET /movies` (validated filters) + `GET /movies/:id` |
| `apps/api/src/routes/series.ts` | `GET /series` (validated filters) + `GET /series/:id` |
| `apps/api/src/routes/search.ts` | `GET /search?q=` with 400 for missing/empty/too-long q |
| `apps/api/src/routes/genres.ts` | `GET /genres` |
| `apps/api/src/routes/movies.test.ts` | 17 tests: list, filters, invalid inputs, 404 |
| `apps/api/src/routes/series.test.ts` | 14 tests: same pattern |
| `apps/api/src/routes/search.test.ts` | 7 tests: valid query, empty results, missing/empty/long q, no Xtream fields |
| `apps/api/src/routes/genres.test.ts` | 3 tests: array shape, empty list, ordering |
| `apps/web/src/hooks/useGenres.ts` | Hook wrapping `listGenres()` via `useApi` |

### Files modified (10)
| File | Change |
|---|---|
| `packages/api-contracts/src/catalog.ts` | Added `q`, `availability`, `sortBy` to `MovieFilters` and `SeriesFilters` |
| `apps/api/src/index.ts` | Registered 4 new route modules |
| `apps/web/src/lib/api.ts` | Added `listGenres()` |
| `apps/web/src/components/content/FilterBar.tsx` | Added availability and sortBy dropdowns; `role="alert"` on ErrorState |
| `apps/web/src/components/ui/ErrorState.tsx` | Added `role="alert"` for accessibility |
| `apps/web/src/pages/MoviesPage.tsx` | `useGenres` → FilterBar; pagination controls |
| `apps/web/src/pages/SeriesPage.tsx` | Same as MoviesPage |
| `apps/web/src/pages/SearchPage.tsx` | Replaced silent `.catch(() => {})` with `error` state + `<ErrorState>` |
| `apps/web/src/test/handlers.ts` | Added `GET /api/genres` MSW handler and `MOCK_GENRES` |
| `apps/web/src/pages/MoviesPage.test.tsx` | Added genre population, availability/sort, error state, pagination tests |
| `apps/web/src/pages/SearchPage.test.tsx` | Added empty-results and error-state tests |

**Results:** 81 backend route tests pass, 32 frontend tests pass, web typecheck clean. The 2 pre-existing API failures require a live database and are unrelated to this ticket.
