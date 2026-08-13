# T059 — Plan d'implémentation

## Objective

Replace the current left-sidebar desktop navigation with a persistent horizontal top navigation, extend `HeroSection` to be availability-aware, and redesign `MoviesPage` and `SeriesPage` as immersive shelf-first browsing pages that open with a cinematic Hero followed by horizontal media shelves and a compact genre selector.

## Included

### 1. `apps/web/src/components/layout/TopNav.tsx` — **new file**

Horizontal sticky navigation bar that unifies logo, primary destinations and utility actions.

- Logo (IPTVFlix brand text) on the far left.
- Primary nav links (NavLink): Home `/`, Movies `/movies`, Series `/series`, My List `/my-list`, Arrivals `/arrivals`.
- Right section: inline search input (reuses the submit logic from current `TopBar`) + profile/settings icon linking to `/settings/playback`.
- `md+` breakpoint: full horizontal layout. Below `md`: hide primary nav links (mobile uses `BottomNav` unchanged); keep logo + search icon only.
- Active link style: accent underline or text color, no left border indicator.

### 2. `apps/web/src/components/layout/AppShell.tsx` — **modified**

- Remove `LeftNav` import and render.
- Remove `ml-60` offset on the content column.
- Mount `TopNav` at the top of the full-width column instead of `TopBar`.
- `BottomNav` stays for `< md` viewports.

Layout becomes: `flex-col` full-width → `<TopNav />` → `<main>` → `<BottomNav />`.

### 3. `apps/web/src/components/layout/LeftNav.tsx` — **deleted**

No longer rendered anywhere. Remove the file.

### 4. `apps/web/src/components/layout/TopBar.tsx` — **deleted**

Search logic is absorbed into `TopNav`. Remove the file.

### 5. `apps/web/src/components/content/HeroSection.tsx` — **modified**

Add two optional props:

```ts
availabilityStatus?: AvailabilityStatus   // from @iptvflix/api-contracts
onPlay?: () => void
```

Behaviour:
- Render a "Lire" (Play) primary button only when `availabilityStatus === 'AVAILABLE'` **and** `onPlay` is provided.
- Rename existing `onDetails` button label to "Plus d'infos" for clarity.
- When `availabilityStatus === 'UNAVAILABLE'` (or not provided), show only "Plus d'infos" — no Play affordance.
- All existing props remain; the change is purely additive and backward-compatible.
- Hero height raised from `h-[56vh]` to `h-[65vh]` to feel more cinematic on browsing pages.

### 6. `apps/web/src/components/content/HeroSection.test.tsx` — **modified**

Add test cases:
- Play button is rendered when `availabilityStatus="AVAILABLE"` and `onPlay` is provided.
- Play button is **not** rendered when `availabilityStatus="UNAVAILABLE"`.
- Play button is **not** rendered when `onPlay` is absent even if `availabilityStatus="AVAILABLE"`.
- `onPlay` callback fires on click.

### 7. `apps/web/src/components/content/GenreChips.tsx` — **new file**

Compact horizontal scrollable genre selector rendered above the shelves on browsing pages.

```ts
type GenreChipsProps = {
  genres: GenreResponse[]
  selected: string | undefined
  onSelect: (genreId: string | undefined) => void
}
```

- Renders a scrollable row of pill `<button>` elements.
- "Tous" chip (no genre filter) is always first.
- Selected chip uses accent colour; others use muted style.
- No year / quality / sort dropdowns — those remain accessible only through the existing `FilterBar` if the user explicitly needs them (out of scope for this ticket to redesign the advanced filter panel).

### 8. `apps/web/src/pages/MoviesPage.tsx` — **rewritten**

New page layout:

1. **Hero**: fetch `useMovies({ pageSize: 1, sortBy: 'recentAvailability', availability: 'AVAILABLE' })` for the featured film. If no available film exists fall back to first movie regardless of availability. Pass `availabilityStatus` and `onPlay={() => navigate('/player/movie/<id>')}` (only when available).
2. **GenreChips**: compact selector using `useGenres()`. Selection updates a `selectedGenreId` state.
3. **Shelves below hero**:
   - When no genre is selected: two `HorizontalRow` sections — "Disponibles" (first 20 available movies by recent availability) and "Tous les films" (first 20 by title). Each is rendered using the existing `HorizontalRow` + `PosterCard` composition.
   - When a genre is selected: one `HorizontalRow` for that genre using `useMovies({ genreId, pageSize: 20 })`.
4. Remove `PosterGrid` and the paginated grid from this page. `FilterBar` is no longer rendered on this page.

The page no longer imports `FilterBar` or `PosterGrid`.

### 9. `apps/web/src/pages/MoviesPage.test.tsx` — **updated**

- Remove tests that assert on `FilterBar` or `PosterGrid`.
- Add: Hero is present; genre chips render; shelf rows render when data loads; Play button absent for unavailable hero; Play button present for available hero.

### 10. `apps/web/src/pages/SeriesPage.tsx` — **rewritten**

Identical structure to the new `MoviesPage`:

1. Hero: `useSeries({ pageSize: 1, sortBy: 'recentAvailability' })`. Series `availabilityStatus` is checked; because episodes drive playability, `onPlay` is **not** wired on the hero for series — the hero shows "Plus d'infos" only, navigating to `/series/<id>`. (`availabilityStatus` is still passed so the Hero can show the correct state visually without implying direct playback.)
2. GenreChips using `useGenres()`.
3. Two default `HorizontalRow` sections: "Disponibles" and "Toutes les séries". When genre selected: one filtered shelf.
4. Remove `FilterBar` and `PosterGrid`.

### 11. `apps/web/src/components/layout/TopNav.test.tsx` — **new file**

Unit tests:
- All primary nav links are rendered on `md+` (use `resize-observer-polyfill` or `window.innerWidth` override if needed, or simply assert elements are present in the DOM).
- Active link receives the active style for the current route.
- Search submit navigates to `/search?q=<query>`.
- Below `md`: primary nav links are hidden (aria-hidden or CSS class check).

### 12. `e2e/tests/` — **updated**

- `mobile-nav.spec.ts`: verify TopNav is not the primary mobile nav (BottomNav still handles mobile). No breakage expected but assertions on the old sidebar must be removed.
- Add or update an existing desktop spec to assert: LeftNav sidebar is absent, TopNav links are reachable, Movies and Series pages render a Hero element.

## Excluded

- Recommendation / personalization engine (future ticket).
- Automatic dynamic shelf generation beyond what the existing Shelf backend already provides.
- Video player implementation.
- Advanced filter panel redesign (year, sort, quality controls remain in `FilterBar` but are not surfaced on the new browsing pages in this ticket).
- Android TV / mobile layout changes (BottomNav is untouched).
- My List page content changes (only the nav link destination is wired).
- Pixel-copying any Netflix proprietary branding or visual assets.
- Profile/account page implementation (nav link links to existing `/settings/playback`).

## Acceptance criteria

- [ ] `LeftNav.tsx` and `TopBar.tsx` are deleted; `AppShell` renders `TopNav` and no left-sidebar.
- [ ] `TopNav` is visible on `md+` viewports with logo, primary destinations (Home, Movies, Series, My List, Arrivals), search input and a profile/settings link.
- [ ] On `< md` viewports `TopNav` shows only logo + search; `BottomNav` remains the primary mobile nav.
- [ ] `MoviesPage` renders a `HeroSection` as the first element above the fold.
- [ ] `SeriesPage` renders a `HeroSection` as the first element above the fold.
- [ ] `HeroSection` renders a "Lire" button only when `availabilityStatus === 'AVAILABLE'` and `onPlay` is provided.
- [ ] `HeroSection` renders no Play affordance when `availabilityStatus === 'UNAVAILABLE'`.
- [ ] Both `MoviesPage` and `SeriesPage` expose `GenreChips` for genre filtering and render `HorizontalRow` sections below the Hero.
- [ ] `PosterGrid` and paginated pagination controls are not rendered on `MoviesPage` or `SeriesPage`.
- [ ] All existing routes (Home, Movies detail, Series detail, Search, My List, Sources, Player) remain reachable from the new `TopNav`.
- [ ] Existing unit tests for `HeroSection`, `ShelfRow`, `BottomNav`, `PosterCard`, `Button`, `Dialog` pass without modification.
- [ ] New / updated tests cover: TopNav link rendering, HeroSection Play availability states, MoviesPage Hero presence, GenreChips selection.
- [ ] No Netflix logos, wordmarks or proprietary imagery are introduced.
- [ ] The layout is usable at 768 px, 1024 px and 1440 px viewport widths.
