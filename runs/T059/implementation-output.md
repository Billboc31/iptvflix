All fixes applied. 189/189 tests passing. Here's what changed:

---

**Files modified**

| File | Change |
|---|---|
| `components/content/HeroSection.tsx` | `availabilityStatus` now uses `import type { AvailabilityStatus }` from `@iptvflix/api-contracts` instead of an inline literal union |
| `pages/SeriesPage.tsx` | Hero now does a double-fetch (available-first + fallback) matching the MoviesPage strategy |
| `e2e/tests/smoke.spec.ts` | Empty-catalog assertions replaced: check for `'Disponibles'` shelf heading + no Play button instead of removed `'Aucun film/série trouvé'` strings |
| `e2e/tests/mobile-nav.spec.ts` | Stale `nav[hasText=IPTVFlix]` selector replaced with a positive assertion on `getByRole('banner')` and a count check for `aside nav` |

**File created**

| File | Change |
|---|---|
| `pages/SeriesPage.test.tsx` | 6 new tests: hero renders, no Play button (episode-driven), genre chips, default dual shelves, no hero on empty API, genre chip filter |

**Not done (optional, requires hook refactor)**

- `enabled: !selectedGenreId` on shelfB — `useMovies`/`useSeries` don't support an `enabled` flag; wiring it in would require modifying both hooks, which is out of scope for this patch.
