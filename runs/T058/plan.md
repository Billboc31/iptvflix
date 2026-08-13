# T058 — Redesign mobile navigation and Shelf browsing

## Objective

Replace the permanent desktop left sidebar with a mobile bottom navigation bar on narrow viewports, and make Home Shelves, hero, detail pages, and the Play on TV flow ergonomic on phone-sized screens — without altering the desktop or tablet-large navigation.

## Included

### 1. Layout — AppShell & LeftNav

- `apps/web/src/components/layout/AppShell.tsx`
  - Change hardcoded `ml-60` to `ml-0 md:ml-60` so the content area no longer loses 240 px on mobile.
  - Render new `<BottomNav>` component inside AppShell, visible on `block md:hidden`.

- `apps/web/src/components/layout/LeftNav.tsx`
  - Wrap the root element with `hidden md:flex` (or equivalent) so the sidebar is removed from the layout on mobile viewports.

### 2. New component — BottomNav

- **Create** `apps/web/src/components/layout/BottomNav.tsx`
  - Five primary tabs: Home (`/`), Search (`/search`), My List (`/library`), Activity (`/activity`), Profile (`/profile`).
  - Fixed position at the bottom of the viewport (`fixed bottom-0 inset-x-0 z-40`).
  - Background matches surface color (`bg-[#111118]`), top border `border-t border-white/5`.
  - Bottom safe-area inset via inline style `paddingBottom: 'env(safe-area-inset-bottom)'` so the bar clears the iOS home indicator.
  - Each tab: icon + label, minimum touch target height 48 px, active state with `text-[#e50914]`.
  - Uses `NavLink` from React Router for active-route detection.
  - Secondary destinations (Sources, Devices, Settings) deferred to a follow-up ticket; no hamburger or drawer in this ticket.

- **Create** `apps/web/src/components/layout/BottomNav.test.tsx`
  - Renders on mobile viewport mock (matchMedia `max-width: 767px` → matches).
  - Active link gets accent colour class.
  - Safe-area style is present on the root element.

### 3. HorizontalRow — mobile shelf scroll

- `apps/web/src/components/content/HorizontalRow.tsx`
  - Hide arrow nav buttons on mobile: add `hidden md:flex` to each `<button>` arrow.
  - Remove the `px-8` wrapper padding from `ShelfRow.tsx` and move it into HorizontalRow as `px-4 md:px-8` so shelves bleed to 16 px from the edge on phones.
  - Add `scroll-snap-type-x-mandatory` via Tailwind or inline (`scroll-snap-type: x mandatory`) on the scroll container; add `scroll-snap-align: start` on each card wrapper so swipe feels intentional.
  - Keep `scrollbar-hide` and `overflow-x-auto` unchanged.

- `apps/web/src/components/content/ShelfRow.tsx`
  - Remove the outer `px-8` wrapper div; HorizontalRow now owns horizontal padding.

### 4. PosterCard — mobile sizing & preview guard

- `apps/web/src/components/content/PosterCard.tsx`
  - Change fixed `w-36` to `w-28 md:w-32 lg:w-36` so at least 1.5 cards peek on a 375 px screen and the next card communicates scrollability.
  - Ensure the `startPreview` touch guard (`isPointerCoarse`) already present is preserved; no change needed to preview logic itself.

### 5. HeroSection — narrow-screen layout

- `apps/web/src/components/content/HeroSection.tsx`
  - Title: add `text-2xl md:text-3xl lg:text-4xl` responsive scale (currently hard-coded `text-4xl` or similar).
  - Synopsis: already `line-clamp-3`; verify it does not overflow on 360 px — reduce to `line-clamp-2` on `sm:` if needed.
  - Action buttons row: add `flex-wrap gap-2` so buttons stack when they do not fit in one line.
  - Ensure no action button has a fixed pixel width that forces horizontal overflow.
  - Mute/unmute button overlay: already conditionally rendered; no change needed.

### 6. Movie/Series detail pages — mobile ergonomics

- `apps/web/src/pages/MovieDetailPage.tsx`
- `apps/web/src/pages/SeriesDetailPage.tsx`
  - Change `px-8 py-6` content area to `px-4 py-4 md:px-8 md:py-6`.
  - Action buttons (`flex flex-wrap gap-3`) already present; verify Play, Resume, Play on TV, and WatchlistButton all have at least 44 px touch height (`min-h-[44px]` or `py-3` which is 12 px × 2 + line-height ≈ 44 px — confirm and fix if short).
  - Play on TV button must remain in the primary row (not collapsed), reachable without scrolling on a 667 px tall phone; if the info block is too tall, move actions above synopsis or add a sticky footer bar for Play + Play on TV on mobile only.

### 7. EpisodeRow — touch-friendly

- `apps/web/src/components/detail/EpisodeRow.tsx`
  - Ensure action buttons (`▶ Lire`, `📺 TV`) have `min-h-[44px]` or equivalent.
  - Episode synopsis: already `line-clamp-2`; no change needed.
  - On widths < 400 px: if the row overflows horizontally, add `flex-wrap` to the actions container.

### 8. DevicePickerModal — mobile sizing

- `apps/web/src/components/devices/DevicePickerModal.tsx`
  - Verify the underlying `<Dialog>` sets `w-full max-w-sm` or full-screen on mobile; if max-width is larger than the viewport, add `mx-4` safety margin or constrain with `sm:max-w-sm`.
  - Device selection buttons already `w-full py-3` — height is ≈ 48 px; confirm and adjust if the actual Dialog renders them narrower.
  - "Depuis le début" / "Reprendre" toggle: add `flex-1` so both buttons share width equally on narrow screens.

### 9. CSS / Tailwind

- `apps/web/src/index.css`
  - No new utilities needed; `scrollbar-hide` already present.
  - Optionally add `.pb-safe { padding-bottom: env(safe-area-inset-bottom); }` if Tailwind's built-in `pb-safe` is not available in this Tailwind version; use that class in BottomNav if simpler than inline style.

### 10. Tests

#### Unit / component tests (Vitest + jsdom)

- **New** `apps/web/src/components/layout/BottomNav.test.tsx` — see §2.
- **Update** `apps/web/src/components/content/HorizontalRow.test.tsx` (create if absent):
  - Arrow buttons carry `hidden md:flex` and are therefore not reachable on a `window.innerWidth = 375` environment; assert `queryByRole('button', { name: /précédent/i })` returns null after setting innerWidth to 375 and firing a resize event.
- **Update** `apps/web/src/components/content/PosterCard.test.tsx` (create if absent):
  - Assert card root element contains `w-28` class (via `classList`) at narrow viewport.

#### E2E tests (Playwright)

- `e2e/playwright.config.ts`
  - Add two mobile project entries alongside the existing Desktop Chrome:
    ```ts
    { name: 'mobile-chrome', use: { ...devices['Pixel 5'] } },
    { name: 'mobile-safari', use: { ...devices['iPhone 12'] } },
    ```
- **New** `e2e/mobile-nav.spec.ts`
  - On Pixel 5: LeftNav sidebar has `display: none` (or is not in the DOM visible).
  - BottomNav is visible and all 5 tab links are present.
  - Clicking the Home tab navigates to `/`.
  - Page content is not hidden behind the bottom bar (scroll to bottom of page, last card is visible above the nav).
- **New** `e2e/mobile-shelf.spec.ts`
  - Home page renders at least one Shelf row.
  - The shelf scroll container overflows horizontally (`scrollWidth > clientWidth`).
  - Arrow buttons are not visible on the Pixel 5 viewport.
  - Scrolling the shelf does not trigger the preview overlay (verify no `<video>` element appears during a simulated touch scroll).
- **New** `e2e/mobile-detail.spec.ts`
  - On Pixel 5: navigate to a Movie detail page.
  - Play button and Play on TV button are both visible without vertical scrolling (within initial viewport).
  - DevicePickerModal opens when tapping Play on TV; all buttons are rendered within viewport width.

## Excluded

- Native iOS / Android apps.
- Secondary navigation items (Sources, Devices, Settings) in the mobile bottom bar — deferred to a follow-up ticket.
- Hamburger / slide-out drawer navigation — not in scope; bottom nav covers the primary destinations.
- Redesigning the desktop visual identity or left nav appearance.
- Replacing the Shelf/recommendation data model or API contracts.
- New product features unrelated to responsive UX.
- Autoplay preview logic changes beyond confirming the existing touch guard is respected.
- Offline / PWA considerations.

## Acceptance criteria

1. On a 375 px wide viewport, `LeftNav` is not rendered or has `display: none`; the content area starts at the left edge with no 240 px offset.
2. `BottomNav` is visible on mobile, fixed at the bottom, and correctly highlights the active route with the accent colour.
3. `BottomNav` root element carries `padding-bottom: env(safe-area-inset-bottom)` so it does not overlap the iOS home indicator.
4. On desktop (≥ 768 px), `LeftNav` is visible and `BottomNav` is hidden; behaviour is identical to the pre-ticket state.
5. Home Shelf rows occupy the full content width on mobile (16 px edge padding each side); no horizontal page-level overflow.
6. Arrow navigation buttons are not rendered (or have `display: none`) on mobile viewports.
7. Shelf cards show the peek of the next card on a 375 px phone (card width ≤ 112 px with the default gap leaving visible continuation).
8. Swiping a Shelf row does not produce a `<video>` preview overlay.
9. Hero title, synopsis, and action buttons fit within a 375 px viewport without clipping or horizontal scroll.
10. On a Movie detail page at 375 px, the Play and Play on TV buttons are reachable without scrolling past the hero.
11. DevicePickerModal renders fully within a 375 px viewport with no horizontal overflow.
12. EpisodeRow action buttons have a minimum touch height of 44 px.
13. All existing Vitest unit tests pass unchanged.
14. New Vitest tests for BottomNav, HorizontalRow mobile arrows, and PosterCard mobile sizing pass.
15. Playwright E2E tests for `mobile-nav`, `mobile-shelf`, and `mobile-detail` pass on the Pixel 5 profile.
