All done. Here's a summary of every change made:

---

## Changes Summary

### Files created

| File | Description |
|---|---|
| `apps/live-tv/src/components/layout/BottomNav.tsx` | New bottom nav with 5 items: Accueil TV / Favoris / Guide TV / Chaînes / Recherche. Fixed at viewport bottom (`z-50`), orange `border-t-2` + text on active route, safe-area inset for mobile notches. |
| `apps/live-tv/src/pages/SearchPage.tsx` | Minimal search page: text input filters `ChannelsContext` channels by name, renders results as a `ChannelCard` grid. Registered at `/search`. |
| `apps/live-tv/src/__tests__/BottomNav.test.tsx` | 6 unit tests: all five items render, active-state classes correct per route, correct `href` per item. All pass. |
| `e2e/tests/live-tv-bottom-nav.spec.ts` | 7 E2E tests on a 375px viewport: five tabs visible, each tab navigates correctly, nav bar is fixed at viewport bottom, content is padded and not obscured. |

### Files modified

| File | Change |
|---|---|
| `apps/live-tv/src/components/layout/AppShell.tsx` | Removed `<Sidebar>`, switched `flex-row` body to a single `<main>` with `pb-[calc(4rem+env(safe-area-inset-bottom))]`, added `<BottomNav>` as last child. |
| `apps/live-tv/src/App.tsx` | Imported `SearchPage`, added `<Route path="/search" element={<SearchPage />} />` inside the `<AppShell>` group. |
| `e2e/tests/live-tv-smoke.spec.ts` | Updated "sidebar renders all 5 nav items" → "bottom nav renders all 5 nav items" with new item labels; updated "Toutes les chaînes" navigation test to use "Chaînes". |

### Files deleted

| File | Reason |
|---|---|
| `apps/live-tv/src/components/layout/Sidebar.tsx` | Replaced entirely by `BottomNav.tsx`; no remaining callers. |

**Test result: 40/40 unit tests pass, 0 TypeScript errors.**
