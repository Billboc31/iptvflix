## Objective

Build the IPTVFlix web frontend in `apps/web/`, establishing the Netflix-inspired visual shell, navigation, reusable component library, and all catalog/source/sync screens described in the validated UI reference board (`docs/design/`). The result is the reusable frontend foundation upon which all future IPTVFlix features will be built.

## Included

### 1. Dependency additions — `apps/web/package.json`

- `react-router-dom@^6` — client-side routing
- `tailwindcss` + `@tailwindcss/vite` — utility-first dark-theme styling
- `autoprefixer` — Tailwind peer dependency
- `vitest` + `@testing-library/react` + `@testing-library/user-event` + `jsdom` — component testing
- `msw` — API mocking in tests

### 2. API contract extensions — `packages/api-contracts/src/`

New file `catalog.ts`:
```
MovieResponse      { id, title, year, synopsis, posterUrl, backdropUrl, runtime, genres, quality, availabilityStatus }
SeriesResponse     { id, title, year, synopsis, posterUrl, backdropUrl, genres, seasonCount, availabilityStatus }
GenreResponse      { id, name }
AvailabilityStatus 'AVAILABLE' | 'UNAVAILABLE'
PaginatedList<T>   { items: T[], total: number, page: number, pageSize: number }
MovieFilters       { genreId?, year?, quality?, page?, pageSize? }
SeriesFilters      { genreId?, year?, page?, pageSize? }
```

New file `sync.ts`:
```
SyncRunStatus      'PENDING' | 'RUNNING' | 'DONE' | 'FAILED'
SyncRunResponse    { id, sourceId, status, startedAt, finishedAt, moviesAdded, seriesAdded, error? }
TriggerSyncBody    { sourceId: string }
```

Re-export both from `packages/api-contracts/src/index.ts`.

### 3. Global theme — `apps/web/tailwind.config.ts` + `apps/web/src/index.css`

Custom Tailwind tokens matching the reference board:
- `background`: `#0a0a0f` (near-black)
- `surface`: `#111118` (dark card background)
- `surface-elevated`: `#1a1a24`
- `accent`: `#e50914` (IPTVFlix red, not Netflix)
- `accent-secondary`: `#f5a623` (amber for cinema radar)
- Typography scale, font-family: system-ui with fallback to sans-serif

### 4. API client — `apps/web/src/lib/api.ts`

Typed fetch wrapper using `VITE_API_BASE`. Exported functions:
```
listMovies(filters: MovieFilters): Promise<PaginatedList<MovieResponse>>
getMovie(id: string): Promise<MovieResponse>
listSeries(filters: SeriesFilters): Promise<PaginatedList<SeriesResponse>>
getSeries(id: string): Promise<SeriesResponse>
searchContent(q: string): Promise<{ movies: MovieResponse[], series: SeriesResponse[] }>
listSources(): Promise<SourceResponse[]>
createSource(body: CreateSourceBody): Promise<SourceResponse>
updateSource(id: string, body: UpdateSourceBody): Promise<SourceResponse>
deleteSource(id: string): Promise<void>
testSource(id: string): Promise<TestSourceResult>
listSyncRuns(): Promise<SyncRunResponse[]>
triggerSync(body: TriggerSyncBody): Promise<SyncRunResponse>
```

Throws a typed `ApiError` with `status` and `message` for error handling.

### 5. Custom hooks — `apps/web/src/hooks/`

- `useApi<T>(fetcher)` — generic `{ data, loading, error, refetch }` state
- `useSources()` — list + create + update + delete + test; optimistic list update after mutations
- `useMovies(filters)` — paginated movie list, refetches on filter change
- `useSeries(filters)` — paginated series list
- `useSync()` — list runs, `triggerSync(sourceId)`, auto-poll every 3s while a run is `PENDING | RUNNING`

### 6. Layout shell — `apps/web/src/components/layout/`

- `AppShell.tsx` — root layout: fixed left nav + scrollable main content area
- `LeftNav.tsx` — vertical sidebar with IPTVFlix logo, nav items (Accueil, Films, Séries, Radar Cinéma, Ma Liste, Historique, Recherche, Sources IPTV), active-route highlight via `NavLink`
- `TopBar.tsx` — search input that navigates to `/search?q=…` on submit; rendered inside main area header

### 7. Primitive UI components — `apps/web/src/components/ui/`

- `Button.tsx` — `variant: 'primary' | 'secondary' | 'ghost'`, `loading` prop, `size: 'sm' | 'md' | 'lg'`
- `Badge.tsx` — small pill for quality (HD, 4K), availability, genre labels
- `Dialog.tsx` — modal overlay with `open`, `onClose`, `title`, `children`
- `Skeleton.tsx` — animated placeholder block, configurable width/height
- `Spinner.tsx` — centered loading spinner
- `EmptyState.tsx` — icon + heading + description for empty list/grid
- `ErrorState.tsx` — error message + retry button
- `Toast.tsx` — transient notification (success/error) via a simple context provider

### 8. Content components — `apps/web/src/components/content/`

- `PosterCard.tsx` — image, title, year; hover overlay with "Détails" action; quality badge top-right
- `HeroSection.tsx` — full-width backdrop with gradient overlay, title, synopsis excerpt, primary CTA (Détails), secondary CTA (+ Ma Liste)
- `HorizontalRow.tsx` — section label + horizontally scrollable row of `PosterCard`; arrow navigation buttons
- `PosterGrid.tsx` — responsive CSS-grid of `PosterCard` (5 columns → 3 on md → 2 on sm)
- `FilterBar.tsx` — genre `<select>`, year `<select>`, quality `<select>`; emits filter object on change

### 9. Source/sync components — `apps/web/src/components/sources/`

- `SourceCard.tsx` — source name, type badge, enabled toggle (`PATCH /sources/:id`), Test / Edit / Delete actions
- `SourceForm.tsx` — form inside `Dialog`: name, type radio (XTREAM | M3U), baseUrl, username, password; "Tester la connexion" button calls `testSource`; submit calls create or update
- `SyncStatusBanner.tsx` — compact banner showing last sync time and status badge; "Synchroniser" button triggers sync for a given source
- `SyncRunList.tsx` — table/list of `SyncRunResponse` rows: source name, status, started/finished, counts, error message on failure

### 10. Pages — `apps/web/src/pages/`

- `HomePage.tsx` — `HeroSection` (first available movie), then `HorizontalRow` sections: Recommandés IPTV, Récemment ajoutés Films, Récemment ajoutées Séries; shows `EmptyState` if no content with link to Sources
- `MoviesPage.tsx` — `FilterBar` + `PosterGrid`; `Skeleton` grid while loading; `EmptyState` if no results
- `SeriesPage.tsx` — same pattern as MoviesPage
- `MovieDetailPage.tsx` — cinematic backdrop, gradient overlay, title, synopsis, year, runtime, genres (badges), availability badge, actions; `HorizontalRow` for related movies
- `SeriesDetailPage.tsx` — same backdrop pattern; season/episode accordion list
- `SearchPage.tsx` — `TopBar` search drives query; mixed results grid (movies then series); debounced at 300 ms
- `SourcesPage.tsx` — `SourceCard` list; "Ajouter une source" button opens `SourceForm`; `SyncRunList` section below; `OnboardingPrompt` if sources list is empty
- `OnboardingPage.tsx` — three-step wizard: step 1 = add source (embeds `SourceForm`), step 2 = sync (calls `triggerSync`, polls until done), step 3 = done, navigate to Home

### 11. Routing — `apps/web/src/App.tsx`

Replace current App with `BrowserRouter` + `Routes`:

| Path | Component |
|---|---|
| `/` | `HomePage` |
| `/movies` | `MoviesPage` |
| `/movies/:id` | `MovieDetailPage` |
| `/series` | `SeriesPage` |
| `/series/:id` | `SeriesDetailPage` |
| `/search` | `SearchPage` |
| `/sources` | `SourcesPage` |
| `/onboarding` | `OnboardingPage` |

All routes are wrapped in `AppShell` except `/onboarding`.

### 12. Tests — `apps/web/src/`

- `vitest.config.ts` — jsdom environment, `setupFiles: ['./src/test/setup.ts']`
- `src/test/setup.ts` — `@testing-library/jest-dom` matchers
- `src/test/handlers.ts` — MSW handlers for `/movies`, `/series`, `/sources`, `/sources/:id/test`, `/sync-runs`
- Component tests:
  - `components/ui/Button.test.tsx` — renders, click, disabled, loading
  - `components/ui/Dialog.test.tsx` — open/close
  - `components/content/PosterCard.test.tsx` — title, year, badge render
  - `components/sources/SourceForm.test.tsx` — required field validation, submit payload, test-connection feedback
- Page tests:
  - `pages/SourcesPage.test.tsx` — lists sources, opens add form, creates source, shows error state
  - `pages/MoviesPage.test.tsx` — renders poster grid from mocked API, filter change triggers refetch, empty state
  - `pages/SearchPage.test.tsx` — debounced search, mixed results render

## Excluded

- Cinema radar business logic: watch/monitor lists, availability change notifications
- Video playback (no player component)
- Android TV implementation
- Metadata enrichment (TMDB, OMDB, etc.)
- Netflix import
- Recommendation engine
- Authentication / user accounts
- i18n / multi-language support
- Infinite scroll or cursor-based pagination (a flat capped list is sufficient for this ticket)
- PWA / service worker / offline support
- Backend route changes beyond `packages/api-contracts/` extension
- Backend endpoint implementation for catalog routes (those are T006 deliverables; this plan assumes they exist)

## Acceptance criteria

- `npm run dev` in `apps/web/` starts without errors and renders the AppShell with LeftNav.
- Navigating each route (`/`, `/movies`, `/series`, `/movies/:id`, `/series/:id`, `/search`, `/sources`) renders without runtime errors.
- Active route is highlighted in `LeftNav`.
- `SourcesPage`: user can open `SourceForm`, fill in Xtream credentials, click "Tester la connexion" and see the result, then submit to create the source.
- `MoviesPage` and `SeriesPage`: `PosterGrid` renders with `Skeleton` placeholders while loading and `EmptyState` when the list is empty.
- `MovieDetailPage`: backdrop image, title, genres, and availability badge are all visible.
- All loading states use `Skeleton` or `Spinner`; all error states display `ErrorState` with a retry action.
- No symbol from `@iptvflix/api-contracts` whose name contains "Xtream" is imported in any file under `apps/web/src/pages/` or `apps/web/src/components/`.
- `vitest run` in `apps/web/` exits 0 with all tests passing.
- `tsc --noEmit` in `apps/web/` exits 0 with no type errors.
- Visual layout, color palette, and navigation structure match the reference board in `docs/design/a_wide_screenshot_mockup_style_layout_image_show.png`.
