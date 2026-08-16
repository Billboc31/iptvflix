# T084 — Test Report

**Branch**: `ticket/T084-repair-blank-ui-merge-regression-restore-playback`  
**Tester run**: 2026-08-16  
**Result**: PARTIAL PASS — automated criteria all pass; manual smoke test required before marking complete

---

## Fix applied during testing

A TypeScript compilation error was found in the newly added `apps/web/src/context/AuthContext.test.tsx`: the `apiLogin` mock used `{ token: 'tok' }` but `LoginResponse` requires `{ ok: true; token: string }`. Fixed and committed as `4467e1e`.

---

## Acceptance criteria

### Generated artifacts removed from git

| Criterion | Status |
|-----------|--------|
| `apps/web/src/` — zero `.js`, `.js.map`, `.d.ts`, `.d.ts.map` files (excluding `vite-env.d.ts`) | **PASS** — 0 tracked |
| `apps/web/dist/` not tracked in git | **PASS** — 0 tracked |
| `node_modules/.vite/vitest/results.json` removed | **PASS** — 0 tracked |
| Production build writes to `dist/` and `dist/` stays untracked (`.gitignore` effective) | **PASS** |

> **Note**: `apps/api/node_modules/` has 50 tracked symlinks (`.bin/`, package dirs). These pre-exist T083 (first tracked in T046 per git history) and are **not** a regression introduced by T083 or T084.

---

### T082 playback/HLS architecture restored

| Criterion | Status |
|-----------|--------|
| `apps/api/src/services/hls-session-store.ts` | **PASS** |
| `apps/api/src/services/media-prober.ts` | **PASS** |
| `apps/api/src/services/playback-compat.ts` | **PASS** |
| `apps/api/src/services/playback-session-store.ts` | **PASS** |
| `apps/api/src/services/probe-cache.ts` | **PASS** |
| `apps/api/src/routes/playback.ts` — 4 gateway routes present (`/stream/:id`, `/stream/:id/segment`, `/session/:id/master.m3u8`, `/session/:id/segments/:filename`) | **PASS** |
| `packages/api-contracts/src/playback.ts` exports `gatewayUrl`, `deliveryMode`, `DeliveryMode`, `PlaybackProbeResult` | **PASS** |
| `apps/web/src/hooks/usePlayback.ts` returns `gatewayUrl` (not `streamUrl`) | **PASS** |
| `apps/web/src/components/player/PlayerControls.tsx` exists | **PASS** |
| `apps/web/src/hooks/useFeaturedMedia.ts` exists | **PASS** |
| `apps/web/src/pages/PlayerPage.tsx` uses `gatewayUrl` + `deliveryMode` | **PASS** |
| `apps/api/src/providers/xtream/playback.ts` split into `buildXtreamMovieUrl` / `buildXtreamEpisodeUrl` | **PASS** |

---

### ffmpeg/ffprobe production configuration

| Criterion | Status |
|-----------|--------|
| `apps/api/nixpacks.toml` exists with `nixPkgs = ["ffmpeg"]` | **PASS** |
| `apps/api/src/index.ts` performs ffmpeg/ffprobe availability check at startup | **PASS** |

---

### T083 resilience preserved

| Criterion | Status |
|-----------|--------|
| `apps/web/src/components/ui/ErrorBoundary.tsx` exists | **PASS** |
| `ErrorBoundary` wrapping in `apps/web/src/App.tsx` | **PASS** |
| `ProtectedRoute` shows spinner when `isLoading=true` | **PASS** |
| `PreviewContext` `matchMedia` guard (`typeof window.matchMedia === 'function'`) | **PASS** |

---

### Auth regression (login / ProtectedRoute)

| Criterion | Status |
|-----------|--------|
| `AuthContext` boot flow: `getMe` success → `isAuthenticated=true`, `isLoading=false` | **PASS** (unit test passes) |
| `AuthContext` boot flow: `getMe` 4xx/5xx → `isAuthenticated=false`, `isLoading=false` (no hang) | **PASS** (`.finally()` always clears `isLoading`) |
| `login()` success → `setIsAuthenticated(true)`, `setUsername` | **PASS** (unit test passes) |
| `LoginPage` catches login error → displays visible error message | **PASS** (catches `ApiError 401` and generic errors) |
| `ProtectedRoute` shows spinner during loading, redirects when unauthenticated | **PASS** (unit test passes) |
| Login end-to-end with production backend | **AWAITING MANUAL VALIDATION** |
| Page refresh with valid session stays authenticated | **AWAITING MANUAL VALIDATION** |

---

### Build / TypeScript

| Criterion | Status |
|-----------|--------|
| `pnpm tsc --noEmit` in `apps/web` | **PASS** (0 errors after tester fix) |
| `pnpm tsc --noEmit` in `apps/api` | **FAIL (pre-existing)** — `authenticateDevice.test.ts:84` type error on `revokedAt: Date` vs `null`; pre-exists on `main` branch, unrelated to T084 |
| `pnpm test` in `apps/web` | **PASS** — 71 files, 501 tests |
| `pnpm test` in `apps/api` | **3 test files fail (pre-existing)** — `vertical-slice.test.ts`, `scheduler-service.test.ts`, `title-matching-service.test.ts`; none touched by T084 |
| `pnpm build` in `apps/web` | **PASS** — Vite build succeeds, `dist/` not re-tracked |

---

### Regression tests

| Criterion | Status |
|-----------|--------|
| `apps/web/src/context/AuthContext.test.tsx` — boot success/failure, login success | **PASS** — 3 tests |
| `apps/web/src/components/ProtectedRoute.test.tsx` — spinner/redirect/outlet | **PASS** — 3 tests |
| `apps/web/src/pages/LoginPage.test.tsx` — 401/generic error display | **PASS** — 3 tests |
| `apps/web/src/components/ui/ErrorBoundary.test.tsx` | **PASS** — 3 tests |
| `apps/api/src/__tests__/playback-compat.test.ts` | **PASS** |
| `apps/api/src/__tests__/probe-cache.test.ts` | **PASS** |
| `apps/api/src/routes/__tests__/playback-gateway.test.ts` | **PASS** |
| `apps/api/src/services/__tests__/hls-session-store.test.ts` | **PASS** |
| `apps/api/src/services/__tests__/playback-session-store.test.ts` | **PASS** |

---

### Manual smoke test (BLOCKING)

Per ticket requirement:

> Do not mark this ticket complete solely because unit tests/builds pass. A production-like manual smoke test of BOTH login and authenticated UI rendering is mandatory.

**Status: AWAITING MANUAL LOGIN/UI VALIDATION**

The following items cannot be verified by automated tests and require a human operator against a production-like environment:

1. Web app visibly renders (not blank)
2. Login with valid credentials succeeds and redirects to Home
3. Page refresh while logged in → stays authenticated
4. Home, Films, Series pages load
5. Opening a media detail works
6. Clicking "Regarder" reaches the T082 playback pipeline (`gatewayUrl` resolved)
7. A playback failure produces player error state, does not blank the entire app

---

## Summary

All automated acceptance criteria pass after one tester fix (LoginResponse mock). Three pre-existing API test failures and one pre-existing API TypeScript error are confirmed unrelated to T084.

**This ticket is NOT complete until manual smoke test items (login + authenticated UI) are validated against a production-like backend.**
