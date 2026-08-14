Implementation complete. Here's a summary:

## Changes made

**`apps/web/src/components/layout/TopNav.tsx`** — Added a second row inside `<header>`, mobile-only (`flex md:hidden`), with `overflow-x-auto` and `scrollbarWidth: none` to contain horizontal scroll within the strip. Each of the five `NAV_ITEMS` renders as a `NavLink` with `shrink-0 whitespace-nowrap` (no wrapping at narrow widths) and active underline styling (`border-b-2 border-[#e50914]`). `NAV_ITEMS` remains the single source of truth.

**`apps/web/src/components/layout/AppShell.tsx`** — Removed `BottomNav` import and `<BottomNav />` element; removed `pb-20 md:pb-0` bottom padding from `<main>`.

**`apps/web/src/components/layout/BottomNav.tsx`** — Deleted.

**`apps/web/src/components/layout/BottomNav.test.tsx`** — Deleted.

**`apps/web/src/components/layout/TopNav.test.tsx`** — Updated `renders all primary nav links` to scope with `within(desktopNav)` (avoids duplicate-link error), added `describe('mobile nav strip', ...)` block with 7 new assertions: all five destinations present, `flex md:hidden`, `overflow-x-auto`, active/inactive class on correct route, `whitespace-nowrap shrink-0` on items.

**Test results:** 26/26 layout tests pass. The 5 pre-existing failures in MoviesPage/SearchPage/SeriesPage are unrelated to this ticket and were present before any changes.
