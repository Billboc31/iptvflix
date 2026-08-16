---

## T084 Test Report — Summary

**Result: PARTIAL PASS** — all automated criteria pass; manual smoke test is still required.

---

### Fix applied during testing

`apps/web/src/context/AuthContext.test.tsx` had a TypeScript error: the `apiLogin` mock returned `{ token: 'tok' }` but `LoginResponse` requires `{ ok: true; token: string }`. Fixed and committed (`4467e1e`).

---

### Acceptance criteria results

| Area | Status |
|------|--------|
| Generated `.js`/`.d.ts`/`dist/` artifacts removed from git | **PASS** — 0 tracked |
| All 5 T082 API services restored | **PASS** |
| Playback route (4 gateway endpoints) | **PASS** |
| API contracts: `gatewayUrl`, `deliveryMode`, `DeliveryMode` | **PASS** |
| `usePlayback` returns `gatewayUrl` | **PASS** |
| `PlayerControls.tsx`, `useFeaturedMedia.ts` exist | **PASS** |
| `nixpacks.toml` with `ffmpeg` | **PASS** |
| ffmpeg/ffprobe startup check in `index.ts` | **PASS** |
| T083 `ErrorBoundary`, spinner, `matchMedia` guard preserved | **PASS** |
| Auth tests (AuthContext, ProtectedRoute, LoginPage) | **PASS** — 9 tests |
| `pnpm tsc --noEmit` (web) | **PASS** |
| `pnpm tsc --noEmit` (api) | **FAIL (pre-existing)** — `authenticateDevice.test.ts` type error on main branch |
| `pnpm test` (web) | **PASS** — 71 files, 501 tests |
| `pnpm test` (api) | **3 files fail (pre-existing)** — `vertical-slice`, `scheduler-service`, `title-matching-service`; none touched by T084 |
| Vite production build | **PASS** — `dist/` untracked |
| Login end-to-end | **AWAITING MANUAL VALIDATION** |
| Manual smoke test (Home/Films/Series/Playback/ErrorBoundary in action) | **AWAITING MANUAL VALIDATION** |

Per the ticket's completion rule: **this ticket cannot be marked complete until manual login and UI rendering are validated against a production-like backend.**
