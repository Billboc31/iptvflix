# T084 — Repair blank-UI merge regression

## Objective

Reconstruct the correct post-T082+T083 combined state by: removing all generated build
artifacts committed by T083, restoring every T082 playback/HLS file and service that T083
deleted or reverted, preserving the T083 resilience additions (ErrorBoundary, ProtectedRoute
spinner, AuthContext guard, PreviewContext matchMedia guard), and repairing the resulting auth
regression so that login works end-to-end again.

## Included

### 0. Source-of-truth reference

All restorations use `git show 2fee2c45243d0fbe9c1c0d331545ebe10f28a040:<path>` (T082 merge)
as the canonical source. T083 preserved files are taken from the current HEAD state.

---

### 1. Remove generated build artifacts from git

Use `git rm --cached` (keep `.gitignore` patterns, which already cover these) to stop tracking
every generated file T083 committed. Files to remove:

**`apps/web/src/**` — all TypeScript compiler output except `vite-env.d.ts`:**
- `*.js`, `*.js.map`, `*.d.ts`, `*.d.ts.map` throughout `components/`, `context/`,
  `contexts/`, `hooks/`, `lib/`, `pages/`, `test/`, and root `src/`

**`apps/web/dist/`** — entire directory (4 files):
- `assets/hls-BJNQvdyP.js`, `assets/index-BsZeBz4H.js`, `assets/index-D3CBlBfI.css`,
  `index.html`

**`apps/web/node_modules/.vite/vitest/results.json`**

**`apps/api/node_modules/.vite/vitest/results.json`**

Verify `.gitignore` already covers all patterns (it does); no `.gitignore` change required.

---

### 2. Restore T082 API services (deleted by T083)

Restore exact file content from `git show 2fee2c4:<path>`:

| File | Description |
|------|-------------|
| `apps/api/src/services/hls-session-store.ts` | ffmpeg HLS session lifecycle, `SEGMENT_RE`, TTL cleanup |
| `apps/api/src/services/media-prober.ts` | ffprobe wrapper, `MediaInfo` type |
| `apps/api/src/services/playback-compat.ts` | `classifyDelivery()`, `DeliveryMode` type, `buildFfmpegArgs()` |
| `apps/api/src/services/playback-session-store.ts` | In-memory session store, `SessionEntry`, `createSession()` |
| `apps/api/src/services/probe-cache.ts` | 24-hour probe cache, `getProbe()` / `setProbe()` |

---

### 3. Restore T082 API route (reverted by T083)

`apps/api/src/routes/playback.ts` — replace current simplified version with T082 version
containing the full gateway:
- `POST /playback/resolve/:mediaType/:mediaId` (unchanged resolve logic)
- `GET /playback/stream/:sessionId` — DIRECT MP4 + provider-native HLS proxy (with
  `rewriteHlsManifest()`, Range header forwarding)
- `GET /playback/stream/:sessionId/segment` — HLS segment proxy (base64url-encoded URI)
- `GET /playback/session/:sessionId/master.m3u8` — backend-generated HLS playlist
- `GET /playback/session/:sessionId/segments/:filename` — backend HLS segment file

Import deps: `createReadStream`, `Readable`, `getSession`, `getPlaylist`, `getSegment`,
`SEGMENT_RE`.

---

### 4. Restore T082 playback-resolver (reverted by T083)

`apps/api/src/services/playback-resolver.ts` — replace current version with T082 version,
which:
- imports `createSession`, `probeMedia`, `getProbe/setProbe`, `classifyDelivery`,
  `createHlsSession`, `buildXtreamMovieUrl`, `buildXtreamEpisodeUrl` (not `buildXtreamStreamUrl`)
- fetches `containerExtension` from availability rows
- runs probe → classifies delivery mode → creates typed session
- returns `PlaybackSessionResponse` with `gatewayUrl`, `deliveryMode`, `probeResult`,
  `containerExtension`

---

### 5. Restore T082 API contracts (reverted by T083)

`packages/api-contracts/src/playback.ts` — replace current version with T082 version:

```ts
export type DeliveryMode = 'DIRECT' | 'HLS_REMUX' | 'HLS_TRANSCODE_AUDIO' | 'HLS_TRANSCODE_FULL'
export type PlaybackProbeResult = { videoCodec: string; audioCodec: string; containerFormat: string }
export type PlaybackResolveRequest = { availabilityId?: string }
export type PlaybackSessionResponse = {
  gatewayUrl: string
  deliveryMode: DeliveryMode
  probeResult: PlaybackProbeResult | null
  containerExtension: string
  availabilityId: string
  startPositionSeconds: number
  alternatives: AvailabilityVariantResponse[]
}
```

---

### 6. Restore T082 frontend playback (reverted by T083)

`apps/web/src/hooks/usePlayback.ts` — replace with T082 version:
- state fields: `gatewayUrl`, `deliveryMode`, `containerExtension` (not `streamUrl`)
- imports `DeliveryMode` from `@iptvflix/api-contracts`

`apps/web/src/components/player/PlayerControls.tsx` — restore from T082 commit (268 lines;
deleted by T083).

`apps/web/src/pages/PlayerPage.tsx` — replace with T082 version:
- imports `PlayerControls`
- uses `gatewayUrl`, `deliveryMode`, `containerExtension` from `usePlayback`
- `videoErrorMessage()` helper with HTTP status codes
- media error / readyState / networkState named maps for diagnostics

`apps/web/src/hooks/useFeaturedMedia.ts` — restore from T082 commit (deleted by T083).

---

### 7. Restore T082 API index (ffmpeg startup check)

`apps/api/src/index.ts` — add back the T082 ffmpeg/ffprobe availability check that runs at
startup before accepting traffic:

```ts
import { spawn } from 'node:child_process'
// ...
async function checkBinary(binary: string): Promise<void> { ... }
await Promise.all([checkBinary('ffmpeg'), checkBinary('ffprobe')])
```

Also add the temp-directory writability check. These run after `scheduler.start()`, before
`app.listen()`.

---

### 8. Restore nixpacks.toml

`apps/api/nixpacks.toml` — restore from T082 commit:

```toml
[phases.setup]
nixPkgs = ["ffmpeg"]
```

---

### 9. Restore T082 provider (if reverted)

`apps/api/src/providers/xtream/playback.ts` — verify current version vs T082; if T082 split
the function into `buildXtreamMovieUrl` and `buildXtreamEpisodeUrl`, restore those exports
(required by the T082 resolver).

---

### 10. Diagnose and fix auth regression — BLOCKING

The auth flow code (AuthContext, ProtectedRoute) appears architecturally sound in the current
HEAD. The most likely root cause of the auth regression is stale generated `.js` files in
`apps/web/src/` that were served instead of the TypeScript source (step 1 removal fixes this).

However, perform an explicit audit of the auth flow before declaring it fixed:

1. **Login function** (`apps/web/src/context/AuthContext.ts` line 33–38):
   - `login()` currently propagates all errors; verify `LoginPage` catches and displays them.
   - If `getMe()` fails after successful `apiLogin()`, `setIsAuthenticated` is never called —
     add explicit catch that shows a usable error (not silently leaves user in limbo).

2. **ProtectedRoute loading race**: Confirm `isLoading=true` is set correctly during bootstrap
   and resolves in all paths (including network timeout) via the `finally` block.

3. **API error vs unauthenticated**: Confirm a 5xx from `/api/me` at startup sets
   `isAuthenticated=false` + `isLoading=false` (redirects to login) rather than hanging.

4. **Token persistence**: Verify the login cookie/JWT is set and survives a page refresh by
   checking that `getMe()` succeeds on reload.

If a real defect is found, document and fix it in `AuthContext.tsx` and/or `LoginPage.tsx`.

---

### 11. Restore T082 tests (deleted by T083)

Restore from `git show 2fee2c4:<path>`:
- `apps/api/src/__tests__/playback-compat.test.ts`
- `apps/api/src/__tests__/probe-cache.test.ts`
- `apps/api/src/routes/__tests__/playback-gateway.test.ts`
- `apps/api/src/services/__tests__/hls-session-store.test.ts`
- `apps/api/src/services/__tests__/playback-session-store.test.ts`
- `apps/api/src/services/__tests__/playback-resolver.test.ts` (T082 version)
- `e2e/tests/playback.spec.ts`
- `apps/web/src/hooks/useFeaturedMedia.test.ts`

---

### 12. Add required regression tests

Add or update tests covering (can be done in existing test files):

**Auth (`apps/web/src/context/AuthContext.test.tsx` or new file):**
- Login success: `apiLogin` + `getMe` succeed → `isAuthenticated=true`, `isLoading=false`
- Login failure: `apiLogin` throws → error is visible, `isAuthenticated` stays false
- Bootstrap with valid session: `getMe` succeeds → authenticated state without login
- Bootstrap 4xx / 5xx: `getMe` fails → `isAuthenticated=false`, `isLoading=false` (no hang)
- Page refresh with valid cookie: mocked `getMe` success → authenticated state

**App shell (`apps/web/src/App.test.tsx` or ErrorBoundary test):**
- ErrorBoundary catches a thrown provider child and renders fallback (not blank page)

**Playback contract (`apps/api/src/routes/__tests__/playback-gateway.test.ts`):**
- Resolve endpoint returns `gatewayUrl`, `deliveryMode`, `containerExtension`
- `usePlayback` hook maps to `gatewayUrl` (not `streamUrl`)

---

### 13. Build verification

Before committing, run:
1. `pnpm tsc --noEmit` (web + api) — no TypeScript errors
2. `pnpm test` in `apps/api` — all API tests pass
3. `pnpm test` in `apps/web` — all web tests pass
4. `pnpm build` in `apps/web` — Vite production build succeeds (outputs to `dist/`, not
   committed)
5. Confirm `dist/` is not re-tracked after the build (`.gitignore` covers it)

---

### 14. Manual smoke test — BLOCKING (not automatable by this worker)

After merge/deployment, validate manually:
1. Web app renders at production URL (not blank)
2. Login with valid credentials succeeds and redirects to Home
3. Page refresh while logged in → stays authenticated
4. Home, Films, Series pages load
5. Opening a media detail works
6. Clicking "Regarder" → player navigates to PlayerPage, `usePlayback` resolves a `gatewayUrl`
7. Playback failure (if any) shows player error, does not blank the entire app

---

## Excluded

- Rollback of T083 entirely — T083 resilience additions are preserved, not reverted.
- New T085+ features beyond repair scope.
- Android TV or other non-web/api targets.
- Restoration of `apps/api/scripts/check-env.mjs` and `apps/api/scripts/diagnose-stream.mjs`
  (diagnostic scripts, not required for production).
- Changes to DB schema or migrations.
- Any refactoring beyond what is required to reconnect the T082 services.

## Acceptance criteria

- [ ] `apps/web/src/` contains no `.js`, `.js.map`, `.d.ts`, or `.d.ts.map` files (except
      `vite-env.d.ts`).
- [ ] `apps/web/dist/` and `apps/api/dist/` are not tracked in git.
- [ ] `apps/web/node_modules/.vite/` and `apps/api/node_modules/.vite/` are not tracked.
- [ ] `apps/api/nixpacks.toml` exists with `nixPkgs = ["ffmpeg"]`.
- [ ] All five T082 services exist in `apps/api/src/services/`:
      `hls-session-store.ts`, `media-prober.ts`, `playback-compat.ts`,
      `playback-session-store.ts`, `probe-cache.ts`.
- [ ] `apps/api/src/routes/playback.ts` contains the four gateway endpoints
      (`/stream/:id`, `/stream/:id/segment`, `/session/:id/master.m3u8`,
      `/session/:id/segments/:filename`).
- [ ] `packages/api-contracts/src/playback.ts` exports `gatewayUrl` and `deliveryMode` on
      `PlaybackSessionResponse`.
- [ ] `apps/web/src/hooks/usePlayback.ts` returns `gatewayUrl` (not `streamUrl`).
- [ ] `apps/web/src/components/player/PlayerControls.tsx` exists.
- [ ] `apps/api/src/index.ts` performs ffmpeg/ffprobe availability check at startup.
- [ ] T083 additions still present: `ErrorBoundary.tsx`, ErrorBoundary wrapping in `App.tsx`,
      spinner in `ProtectedRoute.tsx`, matchMedia guard in `PreviewContext.tsx`.
- [ ] Login succeeds end-to-end with valid credentials (manual or integration test).
- [ ] Login failure displays a visible error message.
- [ ] Page refresh with valid session stays authenticated.
- [ ] `pnpm tsc --noEmit` passes in both apps.
- [ ] `pnpm test` passes in `apps/api` and `apps/web`.
- [ ] `pnpm build` in `apps/web` produces a clean `dist/` that is not committed.
- [ ] Manual smoke test: Home / Films / Series load, Regarder reaches T082 playback pipeline,
      playback errors produce player error state without blanking the app.
- [ ] Ticket is NOT marked complete until manual login + UI rendering is confirmed; report
      `awaiting manual login/UI validation` if that check cannot be performed.
