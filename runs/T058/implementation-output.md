All 171 unit tests pass. Here's a summary of everything implemented:

---

## Files Modified

| File | Change |
|------|--------|
| `layout/LeftNav.tsx` | `hidden md:flex` — hidden on mobile viewports |
| `layout/AppShell.tsx` | `ml-0 md:ml-60` content offset; `pb-20 md:pb-0` clears BottomNav; adds `<BottomNav>` |
| `layout/BottomNav.tsx` | **New** — fixed bottom bar with 5 tabs, safe-area inset, `block md:hidden` |
| `content/HorizontalRow.tsx` | Arrow buttons get `hidden md:flex`; section gains `px-4 md:px-8`; scroll container gains `snap-x snap-mandatory` |
| `content/ShelfRow.tsx` | Outer `px-8` removed (HorizontalRow owns padding); card wrappers → `w-28 md:w-32 lg:w-36 snap-start` |
| `content/PosterCard.tsx` | Root div → `w-28 md:w-32 lg:w-36` |
| `content/HeroSection.tsx` | Title `text-2xl md:text-3xl lg:text-4xl`; synopsis `line-clamp-2 md:line-clamp-3`; padding `px-4 md:px-8 pb-6 md:pb-10`; actions `flex-wrap gap-2` |
| `pages/MovieDetailPage.tsx` | Content padding `px-4 py-4 md:px-8 md:py-6`; title `text-2xl md:text-4xl`; action buttons get `min-h-[44px]` |
| `pages/SeriesDetailPage.tsx` | Same responsive padding and title adjustments |
| `detail/EpisodeRow.tsx` | Action buttons get `inline-flex items-center min-h-[44px]` |
| `ui/Dialog.tsx` | `max-w-lg` → `max-w-sm` |
| `e2e/playwright.config.ts` | Added `mobile-chrome` (Pixel 5) and `mobile-safari` (iPhone 12) projects |

## Files Created

- `layout/BottomNav.tsx` — new mobile nav component
- `layout/BottomNav.test.tsx` — 6 unit tests (tabs, active state, safe-area style, `md:hidden`)
- `content/HorizontalRow.test.tsx` — 6 unit tests (arrows have `hidden`/`md:flex`, snap-x)
- `content/PosterCard.test.tsx` — +2 tests for `w-28`, `md:w-32 lg:w-36` classes
- `e2e/tests/mobile-nav.spec.ts` — sidebar hidden, BottomNav visible, tab navigation
- `e2e/tests/mobile-shelf.spec.ts` — shelf overflow, arrows hidden, no video on swipe
- `e2e/tests/mobile-detail.spec.ts` — action buttons above fold, modal fits viewport
