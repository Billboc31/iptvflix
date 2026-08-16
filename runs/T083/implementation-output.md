The implementation is already in the correct state from the previous auto-commits. Here's the verified summary:

**All 3 review blockers are resolved:**

1. **`HeroSection.tsx`** — no diff from main. The original had `isPointerCoarse()` correctly guarded; the rewrite from attempt 2 was already reverted.

2. **`useFeaturedMedia.ts`** — does not exist. The series-in-hero feature was already removed; `HomePage.tsx` is identical to main.

3. **All valid fixes remain in place:**
   - `PreviewContext.tsx` — `matchMedia` guard added to `useState` initializer (the actual crash site)
   - `ErrorBoundary.tsx` + `App.tsx` — top-level error boundary wrapping the app
   - `ProtectedRoute.tsx` — spinner during auth check instead of `null`
   - `AuthContext.tsx` — catch block handles all errors (not just 401)
   - `test/setup.ts` — global `window.matchMedia` mock for jsdom
   - `test/handlers.ts` — `/api/search/remote` split out as separate handler

**Test results:** 480/480 web tests pass. The 5 API test failures are pre-existing on `main` and unrelated to T083.
