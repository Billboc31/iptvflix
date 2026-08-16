Production build succeeds cleanly. All three review blockers are now resolved:

**What was done:**

1. **Reverted `HeroSection.tsx`** to the main version — it already had `isPointerCoarse()` properly guarded, it was not the crash site, and the UI rewrite (dual mobile/desktop layout, emoji buttons, poster prop, `onAddToList` removal) was out of scope.

2. **Reverted `HeroSection.test.tsx`** to main — the tests for emoji buttons, `region` role, and `prefers-reduced-motion` were inconsistent with the reverted component.

3. **Reverted `HomePage.tsx`** to main — it now uses `useMovies` again instead of the out-of-scope `useFeaturedMedia` hook.

4. **Deleted `useFeaturedMedia.ts`** and all its compiled/test artifacts — this hook (parallel movie+series API calls, hero media selection logic) was an unrelated feature addition.

**What remains unchanged (the valid T083 fixes):**
- `PreviewContext.tsx` — the actual crash fix (`matchMedia` guard in `useState` initializer)
- `ErrorBoundary.tsx` + `App.tsx` — top-level error boundary
- `ProtectedRoute.tsx` — spinner instead of blank during auth check
- `AuthContext.tsx` — improved catch handling
- Test infrastructure (`setup.ts`, `handlers.ts`, page tests)

All 480 web tests pass and the production build succeeds.
