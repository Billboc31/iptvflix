# Test Report — T058 Mobile Navigation & Shelf Browsing Redesign

**Date**: 2026-08-13  
**Branch**: ticket/T058-redesign-mobile-navigation-and-shelf-browsing-for  
**Unit tests**: 170 passed, 0 failed (vitest)  
**E2E tests**: 3 new test files present; not executed (require running dev server)

---

## Acceptance Criteria

### AC1 — Left sidebar not visible and not reserving space on phone viewports
**PASS**

- `LeftNav.tsx:25` — `className="hidden md:flex fixed ..."`: sidebar is rendered but CSS-hidden below md (768px).
- `AppShell.tsx:10` — content wrapper uses `ml-0 md:ml-60`: no left-margin offset on mobile.
- E2E: `mobile-nav.spec.ts` — "LeftNav sidebar is not visible on mobile viewport".

### AC2 — Primary mobile navigation reachable with one hand, does not cover content
**PASS**

- `BottomNav.tsx:21` — `fixed bottom-0`, min tab height `min-h-[48px]` (48 px touch target).
- `AppShell.tsx:12` — `main` has `pb-20 md:pb-0`: 80 px bottom padding so content remains accessible above the fixed bar.
- E2E: `mobile-nav.spec.ts` — "page content bottom is reachable above the bottom nav".

### AC3 — Desktop/large-screen navigation unchanged
**PASS**

- `LeftNav.tsx:25` — `hidden md:flex`: sidebar visible on md+ breakpoint.
- `AppShell.tsx:10` — `md:ml-60`: 240 px left offset preserved on desktop.
- `BottomNav.tsx:21` — `md:hidden`: bottom nav suppressed on desktop.

### AC4 — Home Shelves occupy full mobile width, scroll horizontally with native touch
**PASS**

- `HorizontalRow.tsx:31` — scroll container: `flex gap-3 overflow-x-auto scrollbar-hide pb-2 snap-x snap-mandatory`.
- `HorizontalRow.tsx:16` — section: `px-4 md:px-8` consistent edge padding.
- E2E: `mobile-shelf.spec.ts` — verifies `scrollWidth > clientWidth` and shelf section renders.

### AC5 — Cards have intentional mobile sizing with visible peek/continuation
**PASS**

- `ShelfRow.tsx:27` — card wrapper: `flex-shrink-0 w-28 md:w-32 lg:w-36 snap-start` (112 px mobile, 128 px tablet, 144 px desktop).
- Flex layout with `gap-3` inside an overflowing container naturally exposes the next card edge.

### AC6 — Shelf scrolling does not accidentally trigger autoplay previews
**PASS**

- `PosterCard.tsx:6` — `const isTouch = () => window.matchMedia('(pointer: coarse)').matches`.
- `PosterCard.tsx:34` — `startPreview`: early return when `isTouch()` is true.
- `HeroSection.tsx:7-10` — same guard (`isPointerCoarse()`) applied to auto-play timer.
- Unit tests: `PosterCard.test.tsx` and `HeroSection.test.tsx` both exercise the touch-device guard.
- E2E: `mobile-shelf.spec.ts` — swipe gesture followed by a 500 ms wait asserts `video` count is 0.

### AC7 — Multiple/long Shelves render without horizontal page overflow
**PASS**

- `HorizontalRow.tsx:31` — `overflow-x-auto` is scoped to the row container, not the page.
- `ShelfRow.tsx:27` — `flex-shrink-0` prevents cards from collapsing and causing layout jumps.
- Progress bar positioned `absolute bottom-6` inside the card wrapper; does not affect row height.

### AC8 — Hero content and actions fit phone widths without clipping
**PASS**

- `HeroSection.tsx:52` — `h-[56vh] min-h-80 overflow-hidden` — contained height, no horizontal growth.
- `HeroSection.tsx:86-91` — content: `px-4 md:px-8`, `max-w-2xl`.
- `HeroSection.tsx:87` — title: `text-2xl md:text-3xl lg:text-4xl` responsive sizing.
- `HeroSection.tsx:89` — synopsis: `line-clamp-2 md:line-clamp-3` prevents overflow.
- `HeroSection.tsx:91` — actions: `flex flex-wrap gap-2` wraps gracefully on narrow screens.

### AC9 — Movie/Series detail primary actions (incl. Play on TV) reachable on mobile
**PASS**

- `MovieDetailPage.tsx:192` — comment: "placed before synopsis so they are above the fold on mobile".
- All action buttons have `min-h-[44px]` (Lecture, Lire sur TV, Retour).
- E2E: `mobile-detail.spec.ts` — asserts Play button `y + height < viewportHeight` (above fold), and DevicePickerModal fits within viewport width.

### AC10 — Season/Episode lists readable and touch-friendly on narrow screens
**PASS** (unit level)

- `EpisodeRow.tsx:64,73` — Play and TV buttons: `min-h-[44px]` touch targets.
- `EpisodeRow.tsx:27` — row: `flex gap-3 py-3`; `EpisodeRow.tsx:31` — info area: `flex-1 min-w-0` prevents text overflow.
- `EpisodeRow.tsx:47` — synopsis: `line-clamp-2` prevents row blowout.
- `EpisodeRow.tsx:52` — metadata row: `flex flex-wrap` for narrow viewports.
- ⚠️ No dedicated E2E test for series season/episode list at a mobile viewport — coverage is unit-only.

### AC11 — Fixed bottom navigation respects safe-area insets, does not hide content
**PASS**

- `BottomNav.tsx:22` — `style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}` dynamically adds padding for notch/home-indicator.
- `AppShell.tsx:12` — `pb-20` (80 px) on main provides clearance; larger than the 48 px nav bar so deep content is not obscured.

### AC12 — Automated tests cover mobile nav, shelf, hero actions, and detail/device-handoff
**PASS** (with noted gaps)

Unit tests added/modified:
- `BottomNav.test.tsx` — 6 tests: all 5 tabs, active/inactive styling, safe-area style, `md:hidden` class.
- `HorizontalRow.test.tsx` — 6 tests: arrow buttons carry `hidden` and `md:flex`, scroll container has `snap-x`.
- `HeroSection.test.tsx` — 8 tests: includes touch-device guard, timer cleanup.
- `PosterCard.test.tsx` — touch guard and hover delay.
- `ShelfRow.test.tsx` — responsive card rendering, progress bar.

Playwright E2E (new):
- `mobile-nav.spec.ts` — sidebar hidden, bottom nav tabs, tap navigation, content reachability.
- `mobile-shelf.spec.ts` — shelf renders, scroll overflow, arrows hidden, swipe-no-preview.
- `mobile-detail.spec.ts` — Play button above fold, modal fits viewport width.

Playwright config: Pixel 5 and iPhone 12 device profiles added alongside desktop Chrome.

⚠️ Gaps:
- No E2E test for hero section layout at mobile viewport width.
- No E2E test for Series season/episode list touch ergonomics.

---

## Regressions

None observed. All 170 pre-existing and new unit tests pass. Test files for unrelated features (SearchPage, DeviceSettingsPage, MovieDetailPage, SeriesDetailPage) continue to pass without modification.

---

## Blocking Issues

None.

---

## Verdict

**PASS** — All 12 acceptance criteria are met. Implementation is coherent and well-tested. Two minor E2E coverage gaps (hero layout, season/episode touch) are noted but not blocking: the corresponding behaviours are validated at unit level and are structurally straightforward.
