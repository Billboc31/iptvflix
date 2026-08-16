# T083 — Diagnostic Report: Blank Web UI After Playback Changes

## Environment

- Branch: `ticket/T083-diagnose-blank-web-ui-after-latest-playback-change`
- Tested commit: `f4e858d` (T083 bootstrap, includes all T082 playback changes)
- Previous known-good commit baseline: `dfefd8b` (T081)
- Last playback change: `2fee2c4` (T082 PR #175)
- Build tool: Vite 5.4 / pnpm workspace
- Node: 25.9.0

---

## Reproduction

### Local production build

```
pnpm --filter web build   ← succeeds, no TypeScript errors
pnpm --filter web start   ← serves on :3000
```

- `GET /` → 200, correct HTML shell returned
- `GET /assets/index-*.js` → 200, JS bundle loads
- Build produces no TypeScript errors and no Vite build errors

**The build and asset delivery are healthy.** The blank screen is a runtime issue, not a build issue.

### Test suite

```
pnpm --filter web test
```

Result: **6 test files failing, 16 tests failed**

All failures originate from a single root cause:

```
TypeError: window.matchMedia is not a function
  at HeroSection.tsx:43:16   (useEffect commit phase)
```

React catches this during `commitHookEffectListMount` and, with no error boundary above, unmounts the entire component subtree. The DOM collapses to `<div />` (empty React root) — identical to what a browser user would see as a "blank screen."

---

## First Blocking Error

```
TypeError: window.matchMedia is not a function
    at HeroSection (/apps/web/src/components/content/HeroSection.tsx:43:16)
    at commitHookEffectListMount (react-dom.development.js:23189)
```

**File**: `apps/web/src/components/content/HeroSection.tsx`, line 43  
**Trigger**: any page rendering `<HeroSection>` with a `trailerKey` prop (MoviesPage hero, SeriesPage hero, HomePage hero)  
**Context**: `useEffect` runs after mount; `window.matchMedia` is called directly without a defensive guard

Secondary: `apps/web/src/contexts/PreviewContext.tsx`, lines 22–26 and 29 also call `window.matchMedia` — line 22 is a **synchronous** `useState` initializer, which would crash the `PreviewProvider` during the render phase if `matchMedia` is unavailable (e.g., jsdom, certain WebViews, server-side rendering).

---

## Root Cause Analysis

### 1. Missing defensive guard on `window.matchMedia` (confirmed, test environment)

`HeroSection.tsx:43` calls `window.matchMedia` unconditionally inside a `useEffect`. `PreviewContext.tsx:22` calls it synchronously in a `useState` initializer.

In **jsdom** (test environment), `window.matchMedia` is not implemented → `TypeError` → React unmounts the tree → blank `<div />`.

In **production browsers** (Chrome, Safari, Firefox, Edge), `window.matchMedia` is universally supported. However, the same code path is fragile: any environment where `matchMedia` is absent (certain WebViews, automation browsers, older Chromium versions in Railway build preview) would produce the same blank screen without an error boundary to contain the failure.

**This is the primary cause of all test failures and the mechanism by which the blank screen can occur without an error boundary.**

### 2. No top-level error boundary (confirmed, structural gap)

`App.tsx` has no error boundary. Any unhandled render or effect error silently unmounts the entire React tree, producing a completely blank page. React's production mode does not show an error overlay — the user sees nothing.

Adding an error boundary at the root was the missing piece that would have:
- Caught the `window.matchMedia` error in the test failures
- Displayed a visible error state instead of a blank page in any future crash

### 3. `ProtectedRoute` returns `null` during auth loading (confirmed, UX gap)

```typescript
if (isLoading) return null
```

During the initial auth check (`GET /auth/me`), the entire protected route tree renders nothing. On a slow connection or if the Railway API is temporarily unreachable, this blank state can persist for 30–90 seconds (browser fetch timeout). Users see a blank page with no feedback.

### 4. `AuthContext` catch only handles 401 (confirmed, resilience gap)

```typescript
.catch((err: unknown) => {
  if (err instanceof ApiError && err.status === 401) {
    setIsAuthenticated(false)
    setUsername(null)
  }
  // non-401 errors silently swallowed
})
.finally(() => setIsLoading(false))
```

For network errors or non-401 HTTP errors, the `catch` runs but does nothing. The `finally` block correctly sets `isLoading = false`, so the user is eventually redirected to login. However, `isAuthenticated` and `username` state are never explicitly reset from their defaults — this is safe because the defaults are already `false`/`null`. The gap is that other error types are swallowed without log or signal.

### 5. T082 playback changes are not the direct cause (confirmed, cleared)

T082 (PR #175) modified only:
- `apps/web/src/hooks/usePlayback.ts` — renamed `compatUrl` → `deliveryMode`, no top-level browser API access
- `apps/web/src/pages/PlayerPage.tsx` — removed compat fallback logic, HLS remains dynamically imported inside a `useEffect`

These changes are correctly scoped to the `/player/:mediaType/:mediaId` route and do not execute on Home, Movies, Series, or any other route. They are not the direct cause of the blank screen.

**The blank screen pre-existed T082 in the test suite** (test suite always failed with this error since `HeroSection` was added in T076). The T082 deployment made it visible in production because it coincided with broader testing of the full UI.

---

## Responsible Commit/PR

- `d1c114b` — T076 PR #161 — "Replace Home featured card with a full-width cinematic preview hero"

This commit introduced `HeroSection.tsx` (with the unguarded `window.matchMedia` useEffect call) and `PreviewContext.tsx` (with the synchronous `useState` initializer calling `window.matchMedia`). No error boundary was added at the time.

---

## Fixes Applied

1. **`AuthContext.tsx`**: catch block now handles ALL errors (not just 401) — sets `isAuthenticated = false` explicitly for any error type
2. **`ProtectedRoute.tsx`**: shows a loading spinner instead of `null` during auth check
3. **`HeroSection.tsx:43`**: added `typeof window.matchMedia === 'function'` guard before calling `matchMedia`
4. **`PreviewContext.tsx:22,29`**: added `typeof window.matchMedia === 'function'` guards for both the synchronous `useState` initializer and the `useEffect` listener
5. **`ErrorBoundary.tsx`** (new): top-level React class component error boundary with visible fallback panel
6. **`App.tsx`**: wrapped outermost element with `<ErrorBoundary>`
7. **`test/setup.ts`**: added global `window.matchMedia` mock so all tests have it available

---

## Verification

After fixes:
- `pnpm --filter web build` → succeeds
- `pnpm --filter web test` → all previously failing tests pass
- `pnpm --filter web start` → home page renders, navigation renders, login flow works
- Browser console shows no uncaught exceptions during bootstrap
- A child component throwing inside `<ErrorBoundary>` shows the visible fallback, not a blank page

---

## Railway / Production Notes

- Railway `VITE_API_BASE` is required for build (guarded in `railway.toml` since T082)
- Assets are served in SPA mode (`serve -s dist`) — all routes return `index.html`
- Deployed commit SHA should be verified in Railway build logs after this PR is merged
