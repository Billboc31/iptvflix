## Objective

Trace a real failing Safari/iOS Xtream playback session end-to-end on production-like Railway and produce an evidence-backed diagnostic report that unambiguously identifies the root cause and specifies the concrete correction for a follow-up ticket. No functional fix is delivered here.

## Included

### 1. Extend backend logging for compat path (`apps/api/src/routes/playback.ts`)

Add structured log lines (sanitized — no provider URL, no credentials) covering fields not yet emitted:

- **Probe inputs passed to `classifyDelivery()`**: video codec, audio codec, container format, exact extension stored in session (from `playback-session-store.ts` `SessionEntry.containerExtension`).
- **ffmpeg spawn result**: sanitized argument list (mask `-i <url>` → `-i <masked>`), process pid, spawn success/failure, exit code/signal, stderr tail (last 20 lines), milliseconds until first stdout byte, whether process is still alive at client disconnect.
- **Upstream fetch status and headers** before piping to ffmpeg: HTTP status, `Content-Type`, `Content-Length`, whether body is chunked, first 16 bytes hex signature.
- **Response headers sent to the browser** for both DIRECT and compat modes: `Content-Type`, `Content-Length` / `Transfer-Encoding`, `Accept-Ranges`, `Content-Range`, any `Cache-Control`.
- **Probe failure detail**: when `media-prober.ts` ffprobe fails, log exit code, stderr, and the extension-based fallback codec assumptions used.

All new log lines use the existing `logCtx` object (`{ sessionId, mediaId, availabilityId, sourceId, containerExtension }`) so they are correlatable.

### 2. Add frontend diagnostic telemetry (`apps/web/src/pages/PlayerPage.tsx`)

Inside the existing `error` event handler (lines ~99–129), before any fallback or user-facing message, emit a `console.warn` (visible in Safari Web Inspector) containing:

- `video.error.code` and `video.error.message`
- `video.readyState` and `video.networkState`
- which URL mode is active (`normal` / `compat`)
- event sequence since last `load()`: collect `loadstart`, `loadedmetadata`, `canplay`, `stalled`, `waiting`, `error` timestamps via `addEventListener` on mount, reset on each `load()` call.

No server call, no exposure of stream URLs in the log output.

### 3. Verify Railway deployment prerequisites

Write a one-shot diagnostic script `apps/api/scripts/check-env.mjs` that:

- runs `which ffmpeg`, `ffmpeg -version`, `which ffprobe`, `ffprobe -version` and captures output/exit codes;
- prints tmp-dir write-ability (`fs.mkdtempSync`);
- prints available memory (`process.memoryUsage()`) and platform;
- prints resolved PATH.

Add a `/api/diagnostics/env` GET route (Railway-only, guarded by `process.env.RAILWAY_ENVIRONMENT`) that returns this as JSON. This route is removed in the correction ticket.

### 4. Probe one real upstream stream independently

Using `media-prober.ts` ffprobe logic (or `curl -s -I`) applied manually against a real failing Xtream URL (credentials redacted in the report):

- capture actual container format, video codec name, codec profile/level/pixel format, resolution, frame rate, audio codec, channel count, sample rate, duration if VOD;
- confirm the upstream response is valid media and not an HTML error page (check first bytes).

Result is pasted sanitized into the diagnostic report.

### 5. Validate compat output independently

For the same failing stream, retrieve the compat gateway output (`/api/playback/stream/:sessionId?compat=1`) from Railway using `curl` with a Safari-like `User-Agent` header. Run `ffprobe` on the output bytes to confirm or deny that the generated stream is valid media independently of the browser. Record the ffprobe result in the report.

### 6. Produce `runs/T080/diagnosis.md`

Structured report containing exactly the fields required by the ticket deliverable:

- exact failing stage in the playback pipeline;
- sanitized upstream media metadata;
- `classifyDelivery()` mode selected and the probe inputs that produced it;
- ffmpeg spawn/execution result (sanitized args, exit, stderr);
- HTTP headers / MIME type / first bytes delivered to Safari;
- independent validity of compat output (step 5 result);
- Safari `MediaError` code, `readyState`/`networkState`, event sequence;
- Railway ffmpeg/ffprobe version and PATH verification result (step 3);
- unambiguous root cause statement;
- recommended correction with explicit files and functions.

### Files touched

| File | Change |
|---|---|
| `apps/api/src/routes/playback.ts` | Add structured log lines (probe inputs, ffmpeg spawn, HTTP headers) |
| `apps/web/src/pages/PlayerPage.tsx` | Add Safari-visible `console.warn` in error handler with MediaError/event context |
| `apps/api/scripts/check-env.mjs` | New script: print ffmpeg/ffprobe/path/mem info |
| `apps/api/src/routes/diagnostics.ts` | New route: `GET /api/diagnostics/env` (Railway-only, temporary) |
| `runs/T080/diagnosis.md` | New artifact: evidence-backed diagnostic report |

## Excluded

- Implementing any fix to the compat pipeline, `classifyDelivery()`, ffmpeg arguments, or HTTP headers — belongs in the follow-up ticket determined by the diagnosis.
- Changing `classifyDelivery()` logic or delivery mode definitions.
- Modifying the probe cache TTL or probe logic.
- Any UI change beyond the temporary `console.warn` telemetry.
- Addressing other browsers, non-Xtream sources, or non-movie/episode media types.
- Removing the temporary `/api/diagnostics/env` route — deferred to the correction ticket.
- Performance optimizations or architectural refactors.

## Acceptance criteria

- `runs/T080/diagnosis.md` exists and contains each required section: failing stage, upstream metadata, selected delivery mode with probe inputs, ffmpeg execution result, HTTP response headers to Safari, independent compat output validity verdict, Safari `MediaError`/event log, Railway ffmpeg verification, root cause, correction plan.
- At least one real failing Xtream Movie or Episode stream is traced with a correlated `sessionId`, `availabilityId`, `sourceId`, and `containerExtension`.
- The actual video codec, audio codec, and container of the upstream stream are known from ffprobe output (not inferred from extension alone).
- The delivery mode chosen by `classifyDelivery()` for that stream is recorded alongside the sanitized probe inputs.
- When ffmpeg is involved: sanitized argument list, exit code/signal, and relevant stderr are recorded; process lifecycle relative to client disconnect is noted.
- HTTP `Content-Type` and transfer behavior are recorded for both the upstream response and the compat gateway response delivered to Safari.
- Independent ffprobe of the compat gateway output confirms whether the output is valid media.
- Safari `MediaError.code`, `readyState`, `networkState`, and key event sequence are captured from Safari Web Inspector.
- Railway ffmpeg and ffprobe are confirmed present (or confirmed absent) with version strings from `/api/diagnostics/env`.
- Root cause is stated as a single unambiguous sentence (e.g., "ffmpeg is absent from Railway PATH", "compat gateway emits MP4 with `Content-Type: video/mp2t`", "classifyDelivery returns DIRECT for a TS stream Safari cannot decode").
- The correction plan names the exact files and functions to change.
- No provider credentials or secret-bearing URLs appear in any log output, report, or commit.
- Ticket is not closed based solely on unit-test or local evidence — production-like Railway environment must be used.
