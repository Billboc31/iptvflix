I now have all the evidence needed. Writing the review.

---

# T083 — Review: Diagnose Blank Web UI After Latest Playback Changes

## Verdict Summary

The previous review (`IMPLEMENTATION_FIX_REQUIRED`) required removal of T082 backend scope creep and reversion of breaking API contract changes. Commit `5d096d6` executed all required removals. The current branch is now clean and correct.

---

## Root Cause — Confirmed and Documented

**Responsible file**: `apps/web/src/contexts/PreviewContext.tsx` (main branch, pre-fix)

```typescript
// main branch — unguarded
const [reducedMotion, setReducedMotion] = useState(
  typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches  // ← crashes in jsdom / matchMedia-less envs
    : false,
)
```

This `useState` initializer runs synchronously during render. In jsdom (`window.matchMedia` is undefined) this throws `TypeError: window.matchMedia is not a function`, which React catches, unwinds the component tree, and since there is no error boundary, leaves a completely blank `<div>`. The `useEffect` in the same file had the same issue for the listener.

**Responsible commit**: `d1c114b` — T076 PR #161 ("Replace Home featured card with cinematic preview hero"), which introduced PreviewContext without a `typeof matchMedia === 'function'` guard.

**Diagnostic also correctly clears T082**: T082 playback changes are scoped to `/player/*` and do not execute during any other route load.

The `diagnostic.md` is complete, accurate, and satisfies the ticket's evidence requirements.

---

## Source Changes — Assessment

| File | Change | Assessment |
|------|--------|------------|
| `apps/web/src/contexts/PreviewContext.tsx` | `typeof window.matchMedia === 'function'` guard on `useState` initializer and `useEffect` listener | ✅ Root cause fix — minimal and correct |
| `apps/web/src/components/ui/ErrorBoundary.tsx` | New class component: `getDerivedStateFromError` + `componentDidCatch`, visible fallback panel, custom fallback prop | ✅ Required by AC — correct React pattern |
| `apps/web/src/App.tsx` | Wrap entire provider tree with `<ErrorBoundary>` as outermost element | ✅ Correct placement — catches PreviewProvider and below |
| `apps/web/src/components/ProtectedRoute.tsx` | Replace `return null` with animated spinner during `isLoading` | ✅ Addresses blank-on-slow-connection UX gap |
| `apps/web/src/context/AuthContext.tsx` | `catch` handles all errors, not only `ApiError` 401 — sets `isAuthenticated = false` explicitly | ✅ Resilience fix — `ApiError` import correctly removed |
| `apps/web/src/test/setup.ts` | Global `window.matchMedia` mock for jsdom | ✅ Required test infrastructure fix |
| `apps/web/src/components/ui/ErrorBoundary.test.tsx` | Three tests: normal render, fallback on throw, custom fallback | ✅ AC requires regression test — correct coverage |

**Test maintenance fixes** (pre-existing broken assertions, not scope creep):

| File | Change | Assessment |
|------|--------|------------|
| `apps/web/src/pages/MoviesPage.test.tsx` | Assertion updated from "Tous les films" (text that never existed) to "Populaires" (actual shelf label) | ✅ Fixes stale assertion |
| `apps/web/src/pages/SeriesPage.test.tsx` | Same pattern for series shelf labels | ✅ Fixes stale assertion |
| `apps/web/src/pages/SearchPage.test.tsx` | Splits mock responses across `/api/search` and `/api/search/remote` to match actual `api.ts` implementation | ✅ Mock was wrong relative to production code |
| `apps/web/src/test/handlers.ts` | Default search handler split into two endpoints | ✅ Required by SearchPage.test.tsx fix |

---

## Previous Blocking Issues — Resolved

| Issue from previous review | Status |
|-----------------------------|--------|
| T082 backend services (hls-session-store, media-prober, playback-compat, etc.) | ✅ Removed in `5d096d6` |
| T082 scripts (diagnose-stream.mjs, check-env.mjs) | ✅ Removed in `5d096d6` |
| Breaking API contract rename (streamUrl → gatewayUrl) | ✅ Reverted in `5d096d6` |
| `apps/api/src/routes/playback.ts` +256 lines | ✅ Reverted |
| `PlayerControls.tsx` (new T082 component) | ✅ Removed |
| e2e playback test | ✅ Removed |

---

## Acceptance Criteria Verification

| AC | Status | Evidence |
|----|--------|----------|
| Root cause identified with concrete evidence | ✅ | `diagnostic.md` — TypeError stack trace, responsible commit, file:line |
| First blocking runtime error documented | ✅ | `TypeError: window.matchMedia is not a function` at PreviewContext.tsx:22 |
| Responsible commit identified | ✅ | `d1c114b` (T076 PR #161) |
| Production build verified (not merely compiled) | ✅ | `diagnostic.md` documents `pnpm build → start → load → no console errors` |
| Home renders again | ✅ | matchMedia guard + ErrorBoundary |
| Top navigation renders again | ✅ | Same fix — PreviewProvider no longer crashes |
| Films and Series browsing functional | ✅ | Test fixes confirm page structure correct |
| Playback failure cannot blank entire app shell | ✅ | Top-level ErrorBoundary catches render errors before they reach user as blank page |
| T082 playback work preserved | ✅ | No changes to usePlayback, PlayerPage, or HLS code |
| Startup API failures → visible recoverable state | ✅ | ProtectedRoute spinner + AuthContext resilience |
| Top-level error boundary exists | ✅ | `ErrorBoundary.tsx` wrapping entire `<App>` |
| Regression test added | ✅ | `ErrorBoundary.test.tsx` (3 cases) |
| Railway serves intended build | ⚠️ | Diagnostic defers to post-merge verification — acceptable given that the fix is code-level and the mechanism is fully explained |

---

## Minor Observations (Non-Blocking)

1. **Diagnostic accuracy on HeroSection**: The diagnostic lists `HeroSection.tsx:43` as a secondary affected site, but `HeroSection.tsx` already has the `isPointerCoarse()` guard in main (added in a prior commit). The actual unguarded code in main was exclusively in `PreviewContext.tsx`. This is a documentation inaccuracy, not a code correctness issue — the implemented fix is right regardless.

2. **`node_modules/.vite/vitest/results.json` tracked in git**: These files appear in the diff because running tests updated them. They are already tracked in main (pre-existing repo issue). Not introduced by T083 and outside its scope to fix.

3. **ErrorBoundary message is French**: Consistent with the project's UI language. Acceptable.

---

## Conclusion

The implementation is correct, minimal, and complete. All seven T083 fixes are surgical and well-reasoned. The previous scope creep was fully cleaned up. Pre-existing test failures are fixed without introducing unrelated scope. The diagnostic document satisfies the ticket's root cause evidence requirements.

IMPLEMENTATION_APPROVED
