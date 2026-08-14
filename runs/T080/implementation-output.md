All five deliverables are in place. Here is a summary of what was implemented:

---

## Implementation Summary

### Files Modified

**`apps/api/src/routes/playback.ts`**
- Enhanced `runFfmpegStream()`: now captures stderr (last 20 lines), logs `ffmpegPid` + sanitized args on spawn (`-i <stdin>`), logs `ffmpegExitCode` / `ffmpegExitSignal` / `ffmpegStderrTail` on close, logs `msToFirstByte` when first output chunk arrives, and logs client-disconnect timing
- Probe failure logging: emits `probeError` + `extensionFallbackRoute` (e.g. `remux-via-ffmpeg (ext=ts)`) so the extension-based fallback assumption is always visible
- Post-classify logging: emits full `classifyInputVideoCodec`, `classifyInputAudioCodec`, `classifyInputContainer`, `classifyInputExtension` alongside `deliveryMode`
- Upstream response logging: emits `upstreamStatus`, `upstreamContentType`, `upstreamContentLength`, `upstreamIsChunked`, `upstreamTransferEncoding` before body is consumed
- Body peek: `tee()`s the upstream stream and logs first 16 bytes hex as `upstreamFirstBytesHex` (detects HTML error pages vs. real media)
- Response headers logging: emits `responseContentType`, `responseMode`, and where applicable `responseContentLength` / `responseAcceptRanges` before each `reply.send()`

**`apps/web/src/pages/PlayerPage.tsx`**
- Adds event sequence tracking (`loadstart`, `loadedmetadata`, `canplay`, `stalled`, `waiting`, `error`) via a ref reset on each `load()`
- On every `error` event: emits `console.warn('[iptvflix:player] video error event', {...})` with `errorCode` + named string, `readyState` + named string, `networkState` + named string, `urlMode` (`normal` vs `compat`), and `eventSequence` timestamps — all visible in Safari Web Inspector

### Files Created

**`apps/api/scripts/check-env.mjs`** — standalone script to verify ffmpeg/ffprobe presence, versions, PATH, tmpdir writability, and memory; run as `node apps/api/scripts/check-env.mjs`

**`apps/api/src/routes/diagnostics.ts`** — `GET /api/diagnostics/env` route registered publicly but guarded by `RAILWAY_ENVIRONMENT` env var (returns 404 outside Railway); returns the same JSON as `check-env.mjs`

**`apps/api/src/index.ts`** — imports and registers `diagnosticsRoutes`

**`runs/T080/diagnosis.md`** — structured diagnostic report with 10 sections covering all acceptance criteria fields; documents the two highest-priority root cause candidates identified from code analysis (structurally-inert compat fallback on Safari, and silent ffmpeg failure), provides evidence collection instructions for each section, and gives concrete correction plans for each confirmed candidate
