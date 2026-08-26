# Plan — T133: Move Live TV primary navigation from left sidebar to bottom bar

## Objective

Replace the persistent left sidebar (`Sidebar.tsx`) in the Live TV app with a five-item bottom navigation bar that mirrors the VOD app navigation philosophy. Main content expands to full horizontal width; channel categories become inline content elements inside the home/channels pages rather than sidebar items.

## Included

### New component

**`apps/live-tv/src/components/layout/BottomNav.tsx`**
- Five items: Accueil TV (`/`), Favoris (`/favorites`), Guide TV (`/guide`), Chaînes (`/channels`), Recherche (`/search`)
- Uses React Router `NavLink` with `isActive` for orange active state: `text-[#f97316]` icon/label + `border-t-2 border-[#f97316]` top border
- Fixed at viewport bottom; `z-50`; `pb-[env(safe-area-inset-bottom)]` for mobile notch safety
- Layout: equal-column `flex` row on all breakpoints; desktop widens padding but keeps same structure
- Icons sourced from the existing icon set used in the VOD `TopNav`

### New page

**`apps/live-tv/src/pages/SearchPage.tsx`** (minimal)
- Search input bound to a text state
- Filters channels from `ChannelsContext` by name match
- Renders filtered results as `ChannelCard` grid (reuses existing component)
- Registered at `/search` inside `<AppShell>` in `App.tsx`

### Layout changes

**`apps/live-tv/src/components/layout/AppShell.tsx`**
- Remove `<Sidebar />` import and JSX
- Body switches from `flex-row` (sidebar + content) to single `<main>` that fills remaining height
- Wrap `<Outlet>` container with `pb-16` (or `pb-[calc(4rem+env(safe-area-inset-bottom))]`) so content never hides behind the bar
- Render `<BottomNav />` as last child (fixed positioning handles placement)

**`apps/live-tv/src/components/layout/Sidebar.tsx`**
- Delete file entirely (no callers after AppShell change)

### Category discoverability

**`apps/live-tv/src/pages/HomePage.tsx`** (or equivalent top-level home page)
- Add a horizontal scrollable chip row using `CATEGORY_DISPLAY_ORDER` / `CATEGORY_LABELS_FR` from `lib/categories.ts`
- Each chip links to `/channels?category=<encoded-name>` (identical behavior to current sidebar links)
- Chips styled with orange active/hover treatment consistent with the Live TV theme

### Routing

**`apps/live-tv/src/App.tsx`**
- Add `/search` route inside the existing `<AppShell>` / `<ProtectedRoute>` / `<ProfileRequiredRoute>` / `<ChannelsProvider>` wrapper

### Tests

**`apps/live-tv/src/__tests__/BottomNav.test.tsx`** (new)
- Renders all five nav items by label
- Active route (`/`) receives orange active classes; inactive routes do not
- Clicking a nav item fires navigation to the correct path

**`e2e/tests/live-tv-bottom-nav.spec.ts`** (new)
- Five tab labels visible on a 375 px-wide viewport (iPhone 12)
- Clicking each tab routes to its page
- Last channel card in a long list is not obscured by the bar (bounding box check)

## Excluded

- Redesign of any visual language in the Live TV app (colors, card treatment, density)
- Changes to the VOD app (`apps/web`)
- EPG data integration or enhancement of the existing Guide TV page
- Android TV / remote-focus / D-pad navigation (future ticket)
- Surfacing `Récemment regardées` (`/recent`) in the bottom nav — route is preserved but not a primary nav item
- Any back-end, database, or API change
- Redesigning desktop layout beyond removing the sidebar column

## Acceptance criteria

1. `apps/live-tv/src/components/layout/Sidebar.tsx` is deleted; no import of `Sidebar` remains in the project.
2. `BottomNav` renders exactly five items: Accueil TV, Favoris, Guide TV, Chaînes, Recherche.
3. The active nav item displays orange highlight (`#f97316`) on every route; inactive items do not.
4. Main content area fills the full viewport width (no left column offset).
5. On a 375 px viewport, the last visible channel card is not overlapped by the bottom bar.
6. Channel categories (Généralistes, Sport, Cinéma & Séries, Infos, Enfants, Musique, Documentaires, International) remain reachable via chips/filters on the home or channels page.
7. All existing Live TV routes (`/`, `/channels`, `/channels?category=*`, `/favorites`, `/recent`, `/guide`, `/watch/:channelId`) remain functional.
8. The `/search` route renders a working channel search page.
9. VOD ↔ TV app switch works without visual regression.
10. `BottomNav.test.tsx` passes: five items rendered, active-state class correct per route.
11. E2E test passes on iPhone-sized viewport: five tabs visible, tab switching navigates correctly, content not obscured.
