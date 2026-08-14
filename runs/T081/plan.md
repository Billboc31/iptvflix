Now I have enough to write the plan. Let me produce it.

## Objective

Fix the structural defect — confirmed via static code analysis in T080 — where Safari/iOS always triggers the compat delivery path on both the initial `gatewayUrl` request and the `?compat=1` retry, making the frontend's automatic fallback a no-op. The fix routes the initial request through the standard extension-based path, so the `?compat=1` retry becomes a genuinely different second attempt via the probe-classified ffmpeg pipeline.

## Included

### T080 root cause (referenced per ticket requirement)

T080 diagnosis (static code analysis — production evidence BLOCKED, pending human execution of handoff steps):

> `apps/api/src/routes/playback.ts:207`: `const useCompat = request.query.compat === '1' || isSafariOrIOS(userAgent)`. For any Safari/iOS User-Agent, `isSafariOrIOS()` triggers compat on the initial `gatewayUrl` request. The frontend fallback then retries with `compatUrl` (`?compat=1`), which also sets `useCompat = true` via the `request.query.compat === '1'` branch. Both attempts execute the identical compat code path. If the compat path fails once, it fails the same way on retry.

Correction plan follows T080 Section 10, Candidate 1, Alternative approach.

---

### Change 1 — Remove `isSafariOrIOS()` from gateway compat trigger

**File**: `apps/api/src/routes/playback.ts`

- Line 207: change `const useCompat = request.query.compat === '1' || isSafariOrIOS(userAgent)` to `const useCompat = request.query.compat === '1'`
- Remove `isSafariOrIOS` from the import statement on line 11 (keep `classifyDelivery`, `buildFfmpegArgs`, `DeliveryMode`)
- Remove the now-unused `userAgent` local variable and the `request.headers['user-agent']` read at line 206

Effect: `gatewayUrl` (no `?compat=1`) uses the existing extension-based routing for all clients. `?compat=1` uses the probe-classified ffmpeg path. The frontend's existing auto-retry on `MEDIA_ERR_DECODE`/`MEDIA_ERR_SRC_NOT_SUPPORTED` now triggers a genuinely different delivery attempt.

### Change 2 — Harden ffmpeg args for TS stream reliability (Candidate 3 mitigation)

**File**: `apps/api/src/routes/playback.ts` — `runFfmpegStream()` (around line 68–70)

- Add `-analyzeduration 5000000 -probesize 5000000` as global options before `-i pipe:0` in `fullArgs` and `sanitizedArgs`:
  ```ts
  const fullArgs = ['-analyzeduration', '5000000', '-probesize', '5000000', '-i', 'pipe:0', ...ffmpegArgs, 'pipe:1']
  const sanitizedArgs = ['-analyzeduration', '5000000', '-probesize', '5000000', '-i', '<stdin>', ...ffmpegArgs, 'pipe:1']
  ```
- These allow ffmpeg to buffer more input before failing, reducing spurious exits on slow-starting or malformed TS headers.

**File**: `apps/api/src/services/playback-compat.ts` — `buildFfmpegArgs()`

- Add `-max_interleave_delta 0` to the `REMUX` and `TRANSCODE_AUDIO` output args to handle TS streams with large PTS gaps that would otherwise cause corrupted fMP4 interleaving:
  ```ts
  const OUTPUT_FLAGS = ['-movflags', 'frag_keyframe+empty_moov+default_base_moof', '-f', 'mp4', '-max_interleave_delta', '0']
  ```

### Change 3 — Remove unauthenticated diagnostics route

**File**: `apps/api/src/index.ts`

- Remove the `diagnosticsRoutes` import and `app.register(diagnosticsRoutes)` call added in T080.

**File**: `apps/api/src/routes/diagnostics.ts`

- Delete or archive this file. It was a temporary diagnostic route flagged as a security risk (unauthenticated, publicly accessible path) in both the T080 implementation review and the test report.

### Change 4 — Regression tests

**File**: `apps/api/src/routes/__tests__/playback-gateway.test.ts`

Add a new `describe` block: `'compat path selection — structural defect regression'` with:

- Test: `'Safari UA without ?compat=1 uses extension-based (non-compat) routing'`
  — Session with `containerExtension: 'mp4'`, request with Safari User-Agent, no `?compat=1`
  — Asserts: response is 200, `Content-Type: video/mp4`, `Accept-Ranges: bytes` (mp4 pass-through, not ffmpeg)
  — Asserts: `probeMedia` mock is NOT called (would be called if compat path ran)

- Test: `'Safari UA with ?compat=1 triggers compat path'`
  — Session with `containerExtension: 'mp4'`, request with Safari User-Agent and `?compat=1`
  — Asserts: `probeMedia` mock IS called (compat path invoked probe)

- Test: `'Non-Safari UA without ?compat=1 uses extension-based routing'`
  — Session with `containerExtension: 'mp4'`, standard Chrome UA, no `?compat=1`
  — Asserts: response 200 mp4 pass-through, `probeMedia` NOT called

- Test: `'?compat=1 without Safari UA still triggers compat path'`
  — Session with `containerExtension: 'mp4'`, Chrome UA, `?compat=1`
  — Asserts: `probeMedia` IS called

These tests fail against the pre-fix `playback.ts:207` (Safari UA without `?compat=1` incorrectly calls `probeMedia`) and pass after the fix.

**File**: `apps/api/src/__tests__/playback-compat.test.ts`

- Verify `buildFfmpegArgs('REMUX')` and `buildFfmpegArgs('TRANSCODE_AUDIO')` now include `-max_interleave_delta 0`.

## Excluded

- Frontend changes to `PlayerPage.tsx` — the existing auto-retry mechanism is correct once the backend structural defect is fixed
- Changes to `playback-resolver.ts` — `compatGatewayUrl` construction is correct
- Changes to `isSafariOrIOS()` function itself — keep it exported from `playback-compat.ts` (useful for future UA detection or tests; just no longer called in the gateway route)
- Modifications to `nixpacks.toml` or Railway build config — T080 static analysis confirmed `ffmpeg` is already declared in `nixPkgs`
- Changes to the `REMUX_EXTENSIONS` / `PASSTHROUGH_EXTENSIONS` sets — extension-based routing logic is not the root cause
- Production iPhone/Safari validation — this requires human execution and is explicitly marked as a BLOCKING manual check
- Full rewrite of the playback pipeline architecture
- TRANSCODE_VIDEO or TRANSCODE_FULL path changes — no evidence supports issues there

## Acceptance criteria

- `playback.ts:207` reads `const useCompat = request.query.compat === '1'` — `isSafariOrIOS` is not called anywhere in the gateway stream handler
- A request to `/api/playback/stream/:sessionId` with a Safari/iOS `User-Agent` and **no** `?compat=1` uses extension-based routing (mp4 pass-through or legacy ext remux), not the probe-classified compat path
- A request with `?compat=1` (any UA) invokes `probeMedia` and uses the ffmpeg delivery path
- New regression tests pass; existing `playback-gateway.test.ts`, `playback-compat.test.ts`, `playback-stream-compat.test.ts`, `vertical-slice.test.ts` continue to pass
- `buildFfmpegArgs('REMUX')` output includes `-max_interleave_delta 0`
- `fullArgs` in `runFfmpegStream` includes `-analyzeduration 5000000 -probesize 5000000` before `-i pipe:0`
- `GET /api/diagnostics/env` route is no longer registered (returns 404 on the deployed API)
- The implementation report explicitly states: **iPhone/Safari production playback is a BLOCKING manual acceptance check — not marked PASS until confirmed by the user on a real device**
