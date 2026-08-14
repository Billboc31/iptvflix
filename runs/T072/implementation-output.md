All tasks complete. Here's a summary of what was implemented:

---

## Implementation summary

### New files

**`apps/web/src/hooks/useOpenDetail.ts`**
Single entry point for all detail navigation. Captures current `location` + `scrollY` as background state and navigates to `/movies/:id` or `/series/:id`.

**`apps/web/src/components/detail/MediaDetailShell.tsx`**
Modal shell rendered via `createPortal` into `document.body`. Desktop: centered overlay `min(82vw, 1100px)` with dimmed backdrop. Mobile: full-screen. Handles: `×` close button, Escape key, body scroll lock on mount, scroll position restoration on unmount.

**Tests:** `MediaDetailShell.test.tsx`, `useOpenDetail.test.ts`

### Modified files

**`App.tsx`** — `AppRoutes` inner component uses `useLocation`. Primary `<Routes location={background}>` renders the browsing page behind the modal. Secondary `<Routes>` (only when `background` is set) renders `MovieDetailPage`/`SeriesDetailPage` as the overlay.

**`MovieDetailPage.tsx`** / **`SeriesDetailPage.tsx`** — Detect `location.state.background`; wrap all render paths (skeleton, not-found, error, main content) in `MediaDetailShell` when in modal mode. `handleClose` calls `navigate(-1)`.

**`SimilarTitlesShelf.tsx`** — Modal-aware navigation: when inside a modal, replaces the current history entry preserving the original `background` so `×` always exits to the original browsing page. When on a direct page, opens a new modal.

**Entry points updated** to use `openDetail()`: `MoviesPage`, `SeriesPage`, `ShelfRow`, `HomePage`, `SearchPage`, `MyListPage`, `ArrivalCard`.

### Test result
232 pass, 5 fail — all 5 failures are pre-existing (confirmed baseline, unrelated to this ticket).
