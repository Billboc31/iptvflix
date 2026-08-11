Implementation complete. Here's a summary of what was delivered:

---

## T007 — Implementation Summary

**55 files changed, 4017 insertions** committed as `feat(T007): build Netflix-inspired web frontend foundation`.

### Files Created/Modified

**`packages/api-contracts/src/`**
- `catalog.ts` — `MovieResponse`, `SeriesResponse`, `PaginatedList<T>`, `MovieFilters`, `SeriesFilters`, `AvailabilityStatus`
- `sync.ts` — `SyncRunResponse`, `SyncRunStatus`, `TriggerSyncBody`
- `index.ts` — re-exports both new modules

**`apps/web/`** — new dependencies (react-router-dom, tailwindcss v4, vitest, msw, @testing-library/*), Tailwind config, vitest config

**`src/lib/api.ts`** — typed fetch wrapper with `ApiError`, 12 exported functions covering movies, series, sources, search, sync

**`src/hooks/`** — `useApi`, `useMovies`, `useSeries`, `useSources` (optimistic CRUD), `useSync` (3s auto-poll), `useDebounce`

**`src/components/layout/`** — `AppShell` (fixed 240px nav + scrollable content), `LeftNav` (8 nav items, active highlight), `TopBar` (search → `/search?q=`)

**`src/components/ui/`** — `Button` (3 variants, loading), `Badge`, `Dialog`, `Skeleton`, `Spinner`, `EmptyState`, `ErrorState`, `Toast` (context)

**`src/components/content/`** — `PosterCard` (hover overlay, quality badge), `HeroSection` (gradient backdrop), `HorizontalRow` (arrow scroll), `PosterGrid` (5/3/2 columns), `FilterBar`

**`src/components/sources/`** — `SourceCard` (enable toggle, actions), `SourceForm` (create/update/test-connection), `SyncStatusBanner`, `SyncRunList`

**`src/pages/`** — `HomePage`, `MoviesPage`, `SeriesPage`, `MovieDetailPage`, `SeriesDetailPage`, `SearchPage` (300ms debounce), `SourcesPage`, `OnboardingPage` (3-step wizard)

**`src/App.tsx`** — `BrowserRouter` with 8 routes; `/onboarding` outside `AppShell`

**Tests** — 26/26 passing; 7 test files covering Button, Dialog, PosterCard, SourceForm, SourcesPage, MoviesPage, SearchPage with MSW handlers

**Verifications:** `tsc --noEmit` exits 0 on both packages; `vitest run` exits 0.
