# Plan — T072: Immersive modal Movie & Series detail experience

## Objective

Convert Movie and Series detail views from full-page routes into a modal overlay on desktop (75–85 % viewport width, background dimmed and visible) and a full-screen immersive layer on mobile, while preserving all existing detail components, deep linking, browser-back behaviour, and scroll-position restoration.

## Included

### 1. `MediaDetailShell` — new component
**File:** `apps/web/src/components/detail/MediaDetailShell.tsx`

Wraps all detail content inside the correct container depending on viewport:
- **Desktop (`md:`):** fixed centered modal overlay, `min(82vw, 1100px)` width, visible left/right margins, dark semi-opaque dimmed backdrop that locks body scroll.
- **Mobile:** fixed full-screen layer (`inset-0`), same dark surface.
- Circular `×` close button, top-right, always visible (z above hero).
- `onClose` prop triggers close; `Escape` keydown also fires `onClose`.
- On mount: save `window.scrollY` into ref, set `document.body.style.overflow = 'hidden'`.
- On unmount: restore overflow and scroll position.
- No left-sidebar layout, no back-arrow as primary close UI.

### 2. `useOpenDetail` — new hook
**File:** `apps/web/src/hooks/useOpenDetail.ts`

Returns `openDetail(mediaType: 'movie' | 'series', id: string) => void`.
- Calls `navigate(`/${mediaType === 'movie' ? 'movies' : 'series'}/${id}`, { state: { background: location } })`.
- Entry points that already use direct `navigate` will be updated to call this hook instead.

### 3. Background-location routing — `App.tsx`
**File:** `apps/web/src/App.tsx`

In the route tree, read `location.state?.background`. When present:
- Render the **background** route (browsing page) at the background location.
- Render `MovieDetailPage` / `SeriesDetailPage` as a portal/overlay on top, wrapped in `MediaDetailShell`.
- `onClose` callback: `navigate(state.background ?? -1)` (goes back to exact browsing path without adding history entry).

When no background state (direct deep link), render the existing full-page detail layout unchanged (no regression for direct URLs).

### 4. Update entry points to use `useOpenDetail`
Affected files:
- `apps/web/src/components/content/PosterCard.tsx` — replace `navigate()` call with `openDetail()`.
- `apps/web/src/components/detail/SimilarTitlesShelf.tsx` — clicking a similar title calls `openDetail()` so the modal content navigates in-place (background state unchanged → `×` still exits to original browsing context).
- `apps/web/src/pages/HomePage.tsx` (shelf click handlers) — use `openDetail()`.
- `apps/web/src/pages/MoviesPage.tsx` and `apps/web/src/pages/SeriesPage.tsx` — use `openDetail()`.
- `apps/web/src/pages/SearchPage.tsx` — use `openDetail()`.
- `apps/web/src/pages/WatchlistPage.tsx` — use `openDetail()`.

### 5. Wrap detail pages in `MediaDetailShell`
**Files:** `apps/web/src/pages/MovieDetailPage.tsx`, `apps/web/src/pages/SeriesDetailPage.tsx`

When `location.state?.background` is present (modal mode):
- Render content inside `<MediaDetailShell onClose={...}>`.
- No change to the existing component composition (MediaHero, MediaMetadata, MediaActions, AvailabilityPanel, CastRow, SimilarTitlesShelf, SeasonSelector, EpisodeCard).

When no background state (direct deep link, full-page mode):
- Render as before, no shell wrapper.

### 6. Scroll position restoration
- `useOpenDetail` captures `window.scrollY` and stores it in navigation state (`state.scrollY`).
- `onClose` in `App.tsx` passes `scrollY` back; `MediaDetailShell` `onUnmount` calls `window.scrollTo(0, scrollY)`.

### 7. Body scroll lock
- `MediaDetailShell` adds `overflow: hidden` to `document.body` on mount, removes it on unmount.
- Ensures the browsing page does not scroll while the modal is open.

### Tests
- Unit: `MediaDetailShell` — renders `×`, fires `onClose` on Escape, locks/restores body scroll.
- Unit: `useOpenDetail` — calls navigate with correct path and background state.
- Integration: clicking a PosterCard from MoviesPage opens modal (background visible), pressing Escape closes and restores scroll.
- Integration: clicking a similar title replaces modal content without closing the modal.

## Excluded

- Trailer video autoplay / muted inline video in the hero — `MediaHero` already handles trailer via YouTube iframe; no changes to video logic in this ticket.
- Certification, country/language, collection/franchise metadata fields — not currently in the API contract; adding them requires a backend ticket.
- Tablet-specific breakpoint tuning beyond what Tailwind `md:` already provides.
- Changes to `SeasonSelector`, `EpisodeCard`, `CastRow`, `AvailabilityPanel`, `MediaHero`, `MediaMetadata`, `MediaActions` internals — those components already exist and compose correctly.
- Backend / API changes — no new endpoints needed.
- Admin or source-management pages — out of scope.

## Acceptance criteria

1. On desktop (`md:` and above), clicking any Movie or Series card (from any page — Home, Films, Séries, Search, Ma Liste, SimilarTitlesShelf) opens a centered modal overlay; the browsing page remains visible and dimmed behind it.
2. No left sidebar is introduced in any detail view.
3. Body scroll is locked while the modal is open; background page does not move.
4. The circular `×` button is visible at the top-right of the modal at all times. Clicking it closes the modal.
5. Pressing `Escape` closes the modal.
6. Closing the modal restores the exact originating page, filter, and scroll position.
7. On mobile, the detail fills the entire screen; `×` is still the primary visible close action (no back arrow as primary).
8. Direct deep links (`/movies/:id`, `/series/:id`) still render the full-page detail without the modal shell.
9. Browser Back button closes the modal (navigates to background location).
10. Clicking a similar title inside the modal replaces the modal content without closing it; the `×` still returns to the original browsing context.
11. `useOpenDetail` is the single entry point used across all pages and components; no page navigates directly to a detail route without going through it.
12. All existing detail content (hero, metadata, cast, availability, episodes, similar titles, watchlist, feedback, playback) remains functional.
13. Unit tests for `MediaDetailShell` and `useOpenDetail` pass.
14. Integration tests for PosterCard → modal open → Escape → scroll restore pass.
