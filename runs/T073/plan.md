## Objective

Unify mobile and desktop navigation by extending `TopNav` to serve all primary destinations on mobile, then removing `BottomNav` as the primary navigation so both viewports share the same information architecture and routes.

## Included

### `apps/web/src/components/layout/TopNav.tsx`
- Keep the existing desktop row (logo | nav links `hidden md:flex` | search form | settings) unchanged.
- Add a second row, mobile-only (`flex md:hidden overflow-x-auto`), that renders all five `NAV_ITEMS` (Accueil, Films, Séries, Ma Liste, Nouveautés) as horizontally-scrollable compact `NavLink` tabs with active styling matching the desktop style.
- The existing mobile search button (currently `md:hidden`) already navigates to `/search` — keep it in the top header row. No change needed to search routing.
- `SettingsMenu` already renders on both breakpoints — keep it as-is.
- `NAV_ITEMS` remains the single source of truth for labels and routes (no duplication with `BottomNav`).

### `apps/web/src/components/layout/AppShell.tsx`
- Remove `<BottomNav />` import and JSX element.
- Remove the `pb-20 md:pb-0` padding on `<main>` (the sticky `TopNav` now owns the full header area; no bottom clearance needed).

### `apps/web/src/components/layout/BottomNav.tsx`
- Delete the file. It is no longer rendered anywhere; keeping it would create confusion about the canonical nav source.

### Tests / responsive validation
- Update or add Vitest/RTL tests for `TopNav` to assert:
  - The mobile nav strip renders all five destinations.
  - Active `NavLink` receives the active class on the correct route.
  - The component does not render a horizontal scrollbar at 320 px viewport (no page-level overflow).
- If a snapshot test for `AppShell` exists, update it to reflect the absence of `BottomNav`.

## Excluded

- Any change to existing page-level components (`HomePage`, `MoviesPage`, `SeriesPage`, `MyListPage`, `ArrivalsPage`).
- Any change to `SearchPage` internals or the search API (`searchContent`, `searchDiscover`).
- Any change to `SettingsMenu` or settings routes.
- Any change to `App.tsx` route configuration.
- Any new routes or destinations not already in `NAV_ITEMS`.
- Player and onboarding full-screen flows (they intentionally bypass `AppShell`).
- Animation or transition polish beyond functional active-state styling.
- Tablet-specific breakpoint beyond what Tailwind `md:` already provides.

## Acceptance criteria

- Opening the app on a mobile viewport (≤ 767 px) shows the five primary destinations (Accueil, Films, Séries, Ma Liste, Nouveautés) in the top header area, not at the bottom.
- Tapping a destination on mobile navigates to the correct route and the active tab is visually distinct.
- The search icon remains visible in the top header on mobile and navigates to `/search`.
- The settings gear icon remains visible and functional on mobile.
- `BottomNav` is no longer rendered at any viewport.
- Opening the app on a desktop viewport (≥ 768 px) shows the desktop navigation identical to the current state (no regression).
- At 320 px viewport width, the page has no horizontal scroll (overflow caused by the nav strip is contained within the strip, not the page).
- All five nav routes (`/`, `/movies`, `/series`, `/my-list`, `/arrivals`) continue to load their respective pages on both mobile and desktop.
- RTL tests for `TopNav` pass, asserting the five mobile nav items are present and the active link class is applied correctly.
- No reference to `BottomNav` remains in the codebase after deletion.
