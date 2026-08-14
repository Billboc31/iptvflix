# T080 — Diagnostic Report: Safari/iOS Playback Failure

**Status**: Instrumentation deployed — awaiting production trace

---

## Executive Summary

Code-level analysis of the T079 compat pipeline reveals two structural defects that collectively explain why iPhone Safari ends in `MEDIA_ERR_DECODE` / `MEDIA_ERR_SRC_NOT_SUPPORTED` even after the compat fallback fires. The instrumentation added in this ticket (structured backend logs + Safari `console.warn` telemetry + `/api/diagnostics/env`) must be deployed to Railway and a real session traced before the root cause can be confirmed with production evidence. The two primary suspects are documented below; the correction ticket should address whichever one (or both) the production trace confirms.

---

## Section 1 — Playback Pipeline End-to-End Trace

### How to Collect

1. Open Safari Web Inspector (iPhone connected via USB or Simulator).
2. Navigate to a failing Xtream Movie/Episode.
3. Capture Railway log stream (`railway logs -t --service api`).
4. In Web Inspector → Console, look for `[iptvflix:player] video error event` warnings.

### Fields to Correlate

| Field | Where |
|---|---|
| `sessionId` | Railway log: `playback-gateway: compat delivery mode selected` |
| `availabilityId` | Railway log: same line |
| `sourceId` | Railway log: same line |
| `containerExtension` | Railway log: same line (from `SessionEntry`) |
| `deliveryMode` | Railway log: `classifyDelivery` result |
| `upstreamContentType` | Railway log: `upstream response headers` |
| `upstreamFirstBytesHex` | Railway log: `upstream body signature` |
| `ffmpegPid` / `ffmpegExitCode` | Railway log: `ffmpeg spawn` + `ffmpeg closed` |
| `ffmpegStderrTail` | Railway log: `ffmpeg closed` or `ffmpeg unavailable` |
| `responseContentType` | Railway log: `response headers to browser` |
| `errorCode` / `urlMode` | Safari Web Inspector: `console.warn` |
| `eventSequence` | Safari Web Inspector: `console.warn` |

### Production Evidence (to fill after Railway deployment)

```
sessionId:           <PENDING>
availabilityId:      <PENDING>
sourceId:            <PENDING>
containerExtension:  <PENDING>
deliveryMode:        <PENDING>
upstreamStatus:      <PENDING>
upstreamContentType: <PENDING>
upstreamFirstBytes:  <PENDING>
ffmpegExitCode:      <PENDING>
ffmpegStderrTail:    <PENDING>
responseContentType: <PENDING>
Safari errorCode:    <PENDING>
Safari urlMode:      <PENDING>
Safari eventSequence:<PENDING>
```

---

## Section 2 — Upstream Media Metadata

### How to Collect

After deploying the instrumentation, Railway logs will emit `playback-gateway: probe complete` with:
- `probeVideoCodec`
- `probeAudioCodec`
- `probeContainerFormat`

If probe fails, the log `playback-gateway: probe failed, using extension-based routing` will emit `extensionFallbackRoute` and `probeError`.

### Independent Verification (manual)

Run `ffprobe` (with credentials redacted in the report) against the failing stream URL from a machine with ffprobe installed:

```bash
ffprobe -v quiet -print_format json -show_streams -show_format <XTREAM_URL_REDACTED>
```

Expected output fields to record:
- `streams[].codec_type` / `codec_name` / `profile` / `level` / `pix_fmt`
- `streams[].width` / `height` / `r_frame_rate`
- `streams[].sample_rate` / `channels`
- `format.format_name` / `duration`
- Whether response starts with `<!DOCTYPE html>` (first bytes hex)

### Known Xtream IPTV Common Formats

Most Xtream providers serve either:
- **TS container / H.264 + AAC** → `classifyDelivery` returns `REMUX` → ffmpeg remux to fMP4
- **TS container / H.264 + AC3** → `classifyDelivery` returns `TRANSCODE_AUDIO` → ffmpeg transcode audio to AAC
- **TS container / HEVC + AAC** → `classifyDelivery` returns `REMUX` (for Safari) → ffmpeg remux to fMP4
- **MP4 container / H.264 + AAC** → `classifyDelivery` returns `DIRECT` → Safari should play natively

### Production Metadata (to fill after trace)

```
containerFormat:  <PENDING>
videoCodec:       <PENDING>
videoProfile:     <PENDING>
videoLevel:       <PENDING>
pixelFormat:      <PENDING>
resolution:       <PENDING>
frameRate:        <PENDING>
audioCodec:       <PENDING>
audioChannels:    <PENDING>
sampleRate:       <PENDING>
duration:         <PENDING>
firstBytesHex:    <PENDING>
isValidMedia:     <PENDING>
```

---

## Section 3 — Compatibility Decision (classifyDelivery)

### Code Path (from `playback-compat.ts`)

```
classifyDelivery(mediaInfo, isSafari=true)
  container includes 'hls' / 'm3u8' / 'm3u'  → DIRECT
  H264 + AAC + MP4 container                  → DIRECT
  H264 + AAC + non-MP4 (e.g. TS)             → REMUX
  H264 + non-AAC                              → TRANSCODE_AUDIO
  HEVC + AAC + MP4 + Safari                  → DIRECT
  HEVC + AAC + non-MP4 + Safari              → REMUX
  HEVC + non-AAC + Safari                    → TRANSCODE_AUDIO
  other video + AAC                           → TRANSCODE_VIDEO
  other video + non-AAC                       → TRANSCODE_FULL
```

### Critical Observation: Safari UA triggers compat on BOTH URLs

`isSafariOrIOS()` matches the Safari User-Agent on the **initial** `gatewayUrl` request. This means:
1. Safari's first request to `/api/playback/stream/:sessionId` (without `?compat=1`) ALREADY follows the compat code path.
2. The frontend fallback then retries with `compatUrl` (`?compat=1`), which ALSO follows the compat code path.
3. Both attempts are **identical** in behavior — if the first fails, the second will fail the same way.

This is a structural defect: the "compat fallback" in the frontend provides no diagnostic differentiation and no actual second chance with a different strategy.

### Production Decision (to fill after trace)

```
deliveryMode:              <PENDING>
classifyInputVideoCodec:   <PENDING>
classifyInputAudioCodec:   <PENDING>
classifyInputContainer:    <PENDING>
classifyInputExtension:    <PENDING>
```

---

## Section 4 — ffmpeg Execution

### Critical Observation: stderr was silently discarded (pre-T080)

Before this ticket, `ffmpeg.stderr.on('data', () => {})` in `runFfmpegStream` discarded all ffmpeg stderr. No exit code or signal was logged. There was no way to know why ffmpeg failed.

After T080, Railway logs will emit:
- `ffmpegPid`, `ffmpegArgs` (sanitized, `-i <stdin>`) at spawn
- `ffmpegExitCode`, `ffmpegExitSignal`, `ffmpegStderrTail` at close
- `msToFirstByte` when first output byte arrives
- `ffmpegAliveAtDisconnect: false` when client disconnects before ffmpeg finishes

### Hypothesis A: ffmpeg absent from Railway PATH

If Railway's nixpacks build does not install ffmpeg (verify via `/api/diagnostics/env`), then:
- `runFfmpegStream` spawn emits an `error` event (ENOENT)
- `firstChunk` resolves to `null`
- Gateway returns HTTP 415
- Safari receives 415 → `MEDIA_ERR_NETWORK` (not decode error) → no compat fallback is triggered
- But the compat fallback fires on decode errors, not network errors → the 415 may still bubble as a decode error in some Safari versions

### Hypothesis B: ffmpeg present but produces invalid/stalled output

If ffmpeg spawns successfully but:
- Emits no stdout (pipe stall due to stdin EOF before valid sync frame)
- Exits with code != 0 before producing any output
- Produces fMP4 with corrupted/missing moov box

Then `firstChunk` resolves to `null` (exit before output) or Safari receives malformed data.

### Production Evidence (to fill after trace)

```
ffmpegPid:          <PENDING>
ffmpegExitCode:     <PENDING>
ffmpegExitSignal:   <PENDING>
ffmpegStderrTail:   <PENDING>
msToFirstByte:      <PENDING>
ffmpegSpawnSuccess: <PENDING>
```

---

## Section 5 — HTTP Response to Safari

### Expected Headers (compat REMUX/TRANSCODE path)

```
Content-Type: video/mp4
Transfer-Encoding: chunked   (no Content-Length since streamed)
```

### Expected Headers (compat DIRECT path, MP4)

```
Content-Type: video/mp4  (or upstream value)
Content-Length: <from upstream>
Accept-Ranges: bytes
```

### Known Issue: No Content-Length for ffmpeg-streamed output

Safari's MSE (Media Source Extensions) and native `<video>` require either:
- A complete MP4 with `moov` before `mdat` (progressive download) for `Content-Length`-based playback
- OR a fragmented MP4 (`frag_keyframe+empty_moov`) for chunked/streaming playback

The current ffmpeg args use `frag_keyframe+empty_moov+default_base_moof` which is correct for streaming. However, if the `Content-Type` sent to Safari does not match the actual container format, Safari may refuse to play.

### Production Evidence (to fill after trace)

```
responseContentType:       <PENDING>
responseContentLength:     <PENDING>
responseTransferEncoding:  <PENDING>
responseAcceptRanges:      <PENDING>
responseMode:              <PENDING>
httpStatus:                <PENDING>
```

---

## Section 6 — Independent Compat Output Validation

### How to Collect

From a machine with `ffprobe` installed, while the Railway compat endpoint is streaming:

```bash
curl -s -H "User-Agent: Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15" \
  "https://<railway-api>/api/playback/stream/<sessionId>?compat=1" \
  | ffprobe -v quiet -print_format json -show_streams -show_format -i pipe:0
```

This will confirm whether the ffmpeg output is valid fMP4 that any player could decode, independent of Safari integration.

### Production Evidence (to fill after trace)

```
outputContainer:    <PENDING>
outputVideoCodec:   <PENDING>
outputAudioCodec:   <PENDING>
outputIsValidMedia: <PENDING>
ffprobeExitCode:    <PENDING>
```

---

## Section 7 — Safari Media Error Evidence

### What to Look for in Safari Web Inspector

After deploying this ticket, every `error` event on `<video>` emits `console.warn('[iptvflix:player] video error event', {...})` with:

- `errorCode` + `errorCodeName` (e.g., `3 = MEDIA_ERR_DECODE`, `4 = MEDIA_ERR_SRC_NOT_SUPPORTED`)
- `readyState` + `readyStateName` (e.g., `0 = HAVE_NOTHING`)
- `networkState` + `networkStateName` (e.g., `3 = NETWORK_NO_SOURCE`)
- `urlMode`: `normal` (first attempt) or `compat` (after fallback fires)
- `eventSequence`: array of events and their timing relative to load start

### Key Discriminators

| Observation | Likely Cause |
|---|---|
| `errorCode: 4` on `normal` URL, `errorCode: 4` again on `compat` URL | Gateway returns wrong Content-Type or invalid container |
| `errorCode: 2` (NETWORK) on both | Gateway returns non-2xx (e.g., 415 from ffmpeg failure) |
| `errorCode: 3` (DECODE) on `compat`, `readyState: 1` (HAVE_METADATA) | Metadata parsed but video data corrupt/incompatible |
| `loadedmetadata` fires then `error` | Codec negotiation failed after container was accepted |
| No `loadedmetadata` before `error` | Container not recognized at all |

### Production Evidence (to fill after trace)

```
errorCode (normal URL):    <PENDING>
errorCode (compat URL):    <PENDING>
urlMode at failure:        <PENDING>
readyState:                <PENDING>
networkState:              <PENDING>
eventSequence:             <PENDING>
```

---

## Section 8 — Railway Deployment Prerequisites

### How to Verify

Call `GET /api/diagnostics/env` on the deployed Railway API (returns 404 if not on Railway).

This returns:
- `ffmpegWhich.ok` / `ffmpegWhich.stdout` (path to ffmpeg binary)
- `ffmpegVersion.ok` / `ffmpegVersion.stdout` (version string)
- `ffprobeWhich.ok` / `ffprobeVersion.ok`
- `tmpDirWritable.ok`
- `resolvedPath` (full PATH env)
- `railwayEnvironment`

### nixpacks Configuration Check

Verify `nixpacks.toml` or `railway.json` in the repo root includes ffmpeg in providers/packages.

### Production Evidence (to fill after trace)

```
ffmpegPresent:    <PENDING>
ffmpegVersion:    <PENDING>
ffprobePresent:   <PENDING>
ffprobeVersion:   <PENDING>
tmpDirWritable:   <PENDING>
railwayPath:      <PENDING>
```

---

## Section 9 — Root Cause Candidates

Based on code-level analysis, ranked by probability:

### Candidate 1 (HIGH): compat fallback is structurally inert on Safari

**Evidence**: `isSafariOrIOS(userAgent)` triggers compat mode for ALL Safari requests to `gatewayUrl`, including the initial load. When this fails and the frontend retries with `compatUrl` (`?compat=1`), the backend executes the **same** compat code path again. There is no behavioral difference between the two attempts for Safari. If the compat path fails once, it will fail twice.

**Consequence**: The frontend "fallback" provides no additional recovery opportunity on Safari. The user always sees the error after two identical failures.

**Correction**: The frontend should not retry with `compatUrl` on Safari (since both URLs already use compat). Instead, it should either switch to a different variant via `alternatives`, show the error immediately, or use a truly different delivery strategy on retry.

### Candidate 2 (MEDIUM): ffmpeg absent or misconfigured on Railway

**Evidence**: The legacy extension-based remux path (`REMUX_EXTENSIONS`, lines 312–365 in pre-T080 code) also silently discards ffmpeg stderr and does not log exit codes. No Railway deployment verification existed. If ffmpeg is absent, the gateway returns 415, which Safari may interpret inconsistently (network error vs. decode error).

**Correction**: Verify via `/api/diagnostics/env`. If absent, update nixpacks config. If present but failing, the stderr tail from `runFfmpegStream` will identify the specific error.

### Candidate 3 (MEDIUM): Wrong Content-Type for ffmpeg output

**Evidence**: The compat REMUX/TRANSCODE path sends `Content-Type: video/mp4`. Safari is known to reject fMP4 streams if Content-Type is inconsistent with the container. If the upstream TS stream has non-standard characteristics (e.g., mixed H.264 + Dolby), ffmpeg may produce output that does not validate as `video/mp4`.

**Correction**: Ensure `Content-Type: video/mp4` is accurate and `movflags` args produce a valid fMP4 stream (verify via independent ffprobe in Section 6).

### Candidate 4 (LOW): Probe always fails → extension-based routing used instead of mode-based routing

**Evidence**: If `probeMedia` fails on Railway (ffprobe absent, network timeout to provider, or provider redirects to a web page for authentication), `deliveryMode` stays `null` and the non-compat extension-based routing is used. For `.ts` files this still attempts ffmpeg remux, so behavior may be similar to Candidate 2.

---

## Section 10 — Recommended Correction Plan

After production evidence is collected, the follow-up ticket should implement one or more of the following based on confirmed root cause:

### If Candidate 1 confirmed (compat fallback is structurally inert):

- **File**: `apps/web/src/pages/PlayerPage.tsx`, `onError` handler
- **Change**: On Safari (detected via `navigator.userAgent`), skip the `compatUrl` retry (since `gatewayUrl` already used compat) and go directly to the error state or `alternatives` variant switch
- **Alternative**: Remove the `isSafariOrIOS()` UA detection from the backend compat trigger and rely solely on the `?compat=1` query param, so `gatewayUrl` serves the stream in non-compat mode and `compatUrl` provides a genuinely different second attempt

### If Candidate 2 confirmed (ffmpeg absent):

- **File**: `nixpacks.toml` or `railway.json`
- **Change**: Add `ffmpeg` to the nixpacks providers list (e.g., `nixPkgs = ["ffmpeg"]`)
- **Verification**: Re-run `/api/diagnostics/env` after deploy

### If Candidate 3 confirmed (invalid fMP4 output):

- **File**: `apps/api/src/services/playback-compat.ts`, `buildFfmpegArgs()`
- **Change**: Add `-analyzeduration 5000000 -probesize 5000000` before `-i pipe:0` to give ffmpeg more time to analyze the input; or add `-max_interleave_delta 0` to handle streams with large PTS gaps; or transcode the problematic codec explicitly instead of relying on `-c copy`

### If Candidate 4 confirmed (probe fails → wrong routing):

- **File**: `apps/api/src/routes/playback.ts`, probe failure path
- **Change**: When `deliveryMode` stays `null` after probe failure, apply extension-based compat defaults (force REMUX for .ts files, DIRECT for .mp4) rather than falling through to the legacy non-compat routing
