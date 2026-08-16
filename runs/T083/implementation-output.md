All tests pass and the build is clean. Here's a summary of everything done:

---

## Summary

**Root cause identified** (documented in `runs/T083/diagnostic.md`):

1. **Primary**: `window.matchMedia` called without a defensive guard in `HeroSection.tsx:43` (inside `useEffect`) and `PreviewContext.tsx:22` (synchronously in `useState` initializer). In jsdom (test environment), this throws a `TypeError`, React unmounts the entire component tree without an error boundary → blank `<div />`. Introduced by T076 (hero section PR), not T082.

2. **Structural**: No top-level error boundary — any unhandled render/effect error silently produces a blank page in production.

3. **UX gap**: `ProtectedRoute` returned `null` during auth check → brief blank screen (30–90s on slow/unreachable API).

4. **T082 cleared**: Playback changes only affected the player route and are not the direct cause.

**Files changed:**

| File | Change |
|------|--------|
| `context/AuthContext.tsx` | Catch block now handles ALL errors (not just 401) |
| `components/ProtectedRoute.tsx` | Shows loading spinner instead of null during auth |
| `components/content/HeroSection.tsx` | Guard `window.matchMedia` call |
| `contexts/PreviewContext.tsx` | Guard both synchronous and effect `matchMedia` calls |
| `components/ui/ErrorBoundary.tsx` | New: top-level error boundary class component |
| `components/ui/ErrorBoundary.test.tsx` | New: 3 unit tests for error boundary |
| `App.tsx` | Wrapped with `<ErrorBoundary>` |
| `test/setup.ts` | Added global `window.matchMedia` mock |
| `test/handlers.ts` | Added default `/api/search/remote` handler |
| `pages/MoviesPage.test.tsx` + `.js` | Updated stale shelf-label assertions |
| `pages/SeriesPage.test.tsx` + `.js` | Updated stale shelf-label assertions |
| `pages/SearchPage.test.tsx` + `.js` | Fixed to mock `/api/search/remote` for external results |
| `runs/T083/diagnostic.md` | Full diagnostic report |

**Result**: 496/496 tests pass, production build succeeds.
