# T080 — Diagnostic Report: Safari/iOS Playback Failure

**Status**: HANDOFF DOCUMENT — AI-completed instrumentation + static analysis done. Production evidence requires human execution. See Handoff section.

---

## AI-Completed vs Human-Required Steps

| Step | Executor | Status |
|---|---|---|
| Deploy diagnostic instrumentation (logging in `playback.ts`, telemetry in `PlayerPage.tsx`) | AI | DONE |
| Add `GET /api/diagnostics/env` route | AI | DONE |
| Add `apps/api/scripts/check-env.mjs` local env checker | AI | DONE |
| Add `apps/api/scripts/diagnose-stream.mjs` local pipeline replicator | AI | DONE |
| Static code analysis → identify Candidate 1 structural defect | AI | DONE |
| Static code analysis → largely disprove Candidate 2 (nixpacks.toml) | AI | DONE |
| Deploy T080 branch to Railway | **HUMAN** | PENDING |
| Call `GET /api/diagnostics/env` on Railway deployment | **HUMAN** | PENDING |
| Run `diagnose-stream.mjs` against a real failing Xtream URL | **HUMAN** | PENDING |
| Test failing stream on iPhone Safari with Web Inspector open | **HUMAN** | PENDING |
| Copy results into Sections 1–8 of this document | **HUMAN** | PENDING |

**The following sections contain evidence blocks marked `REQUIRES HUMAN EXECUTION`. These fields cannot be filled by an automated agent — they require a physical iPhone, real Xtream provider credentials, and an active Railway deployment.**

---

## Executive Summary

Static code analysis of the T079 compat pipeline has **confirmed one structural defect from code alone**:

**Root cause hypothesis (confirmed from static code analysis — production verification required)**: `apps/api/src/routes/playback.ts:207` — `useCompat = request.query.compat === '1' || isSafariOrIOS(userAgent)`. For any Safari/iOS User-Agent, BOTH the initial `gatewayUrl` and the retry `compatUrl` (`?compat=1`) execute the **identical** compat code path. The frontend "fallback" fires on `MEDIA_ERR_DECODE`/`MEDIA_ERR_SRC_NOT_SUPPORTED`, retries with `compatUrl`, which appends `?compat=1` — but for Safari UA, the `?compat=1` flag is redundant since `isSafariOrIOS()` already triggers compat. The two attempts are behaviorally identical. If the compat path fails once, it will fail twice.

**This remains a hypothesis until confirmed by the production trace in Sections 1 and 7.**

**Largely disproved (code-level)**: `apps/api/nixpacks.toml:2` — `nixPkgs = ["ffmpeg"]` is present. ffmpeg (and bundled ffprobe) is configured in the Railway build. This makes Candidate 2 (ffmpeg absent) unlikely, though runtime PATH still requires `/api/diagnostics/env` to fully rule out.

Sections 2, 3, 4, and 6 are collectable locally (without Railway) using `apps/api/scripts/diagnose-stream.mjs`. A production trace is still required for Sections 1, 5, 7, and 8.

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

### Production Evidence (requires Steps 2–3 in Handoff section)

```
sessionId:           REQUIRES HUMAN EXECUTION
                       → Stream a failing movie/episode on iPhone Safari
                       → Run: railway logs -t --service api | grep "playback-gateway"
                       → Paste sessionId from log line here

availabilityId:      REQUIRES HUMAN EXECUTION — paste from Railway log

sourceId:            REQUIRES HUMAN EXECUTION — paste from Railway log

containerExtension:  REQUIRES HUMAN EXECUTION — paste from Railway log

deliveryMode:        REQUIRES HUMAN EXECUTION — paste from Railway log (classifyDelivery result)

upstreamStatus:      REQUIRES HUMAN EXECUTION — paste from Railway log

upstreamContentType: REQUIRES HUMAN EXECUTION — paste from Railway log

upstreamFirstBytes:  REQUIRES HUMAN EXECUTION — paste from Railway log

ffmpegExitCode:      REQUIRES HUMAN EXECUTION — paste from Railway log (ffmpeg closed event)

ffmpegStderrTail:    REQUIRES HUMAN EXECUTION — paste from Railway log (ffmpeg closed event)

responseContentType: REQUIRES HUMAN EXECUTION — paste from Railway log (response headers to browser)

Safari errorCode:    REQUIRES HUMAN EXECUTION — paste from Safari Web Inspector console.warn

Safari urlMode:      REQUIRES HUMAN EXECUTION — paste from Safari Web Inspector console.warn

Safari eventSequence:REQUIRES HUMAN EXECUTION — paste from Safari Web Inspector console.warn
```

---

## Section 2 — Upstream Media Metadata

### How to Collect (LOCAL — no Railway needed)

Run the local diagnostic script (uses the same ffprobe invocation as `probeMedia()`):

```bash
node apps/api/scripts/diagnose-stream.mjs --url 'http://provider/stream' --ext ts
```

The `section2_upstreamProbe` field of the JSON output gives:
`videoCodec`, `audioCodec`, `containerFormat`, `videoProfile`, `videoLevel`, `pixelFormat`, `resolution`, `frameRate`, `audioChannels`, `sampleRate`, `duration`

Copy those values into the evidence block below.

### Also Collectable from Railway Logs (after deployment)

Railway logs will emit `playback-gateway: probe complete` with `probeVideoCodec`, `probeAudioCodec`, `probeContainerFormat`. If probe fails: `playback-gateway: probe failed, using extension-based routing` with `extensionFallbackRoute` and `probeError`.

### Known Xtream IPTV Common Formats

Most Xtream providers serve either:
- **TS container / H.264 + AAC** → `classifyDelivery` returns `REMUX` → ffmpeg remux to fMP4
- **TS container / H.264 + AC3** → `classifyDelivery` returns `TRANSCODE_AUDIO` → ffmpeg transcode audio to AAC
- **TS container / HEVC + AAC** → `classifyDelivery` returns `REMUX` (for Safari) → ffmpeg remux to fMP4
- **MP4 container / H.264 + AAC** → `classifyDelivery` returns `DIRECT` → Safari should play natively

### Production Metadata (requires Step 3 in Handoff section)

```
containerFormat:  REQUIRES HUMAN EXECUTION
                    → node apps/api/scripts/diagnose-stream.mjs --url '<xtream-url>' --ext <ext>
                    → Paste section2_upstreamProbe.containerFormat here

videoCodec:       REQUIRES HUMAN EXECUTION — paste section2_upstreamProbe.videoCodec

videoProfile:     REQUIRES HUMAN EXECUTION — paste section2_upstreamProbe.videoProfile

videoLevel:       REQUIRES HUMAN EXECUTION — paste section2_upstreamProbe.videoLevel

pixelFormat:      REQUIRES HUMAN EXECUTION — paste section2_upstreamProbe.pixelFormat

resolution:       REQUIRES HUMAN EXECUTION — paste section2_upstreamProbe.resolution

frameRate:        REQUIRES HUMAN EXECUTION — paste section2_upstreamProbe.frameRate

audioCodec:       REQUIRES HUMAN EXECUTION — paste section2_upstreamProbe.audioCodec

audioChannels:    REQUIRES HUMAN EXECUTION — paste section2_upstreamProbe.audioChannels

sampleRate:       REQUIRES HUMAN EXECUTION — paste section2_upstreamProbe.sampleRate

duration:         REQUIRES HUMAN EXECUTION — paste section2_upstreamProbe.duration

firstBytesHex:    REQUIRES HUMAN EXECUTION — paste section2_upstreamProbe.firstBytesHex

isValidMedia:     REQUIRES HUMAN EXECUTION — paste section2_upstreamProbe.isValidMedia
```

---

## Section 3 — Compatibility Decision (classifyDelivery)

### How to Collect (LOCAL — no Railway needed)

The `section3_compatDecision` field from `diagnose-stream.mjs` shows the exact mode selected by the inline copy of `classifyDelivery(isSafari=true)` using the probed codec info.

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

### Production Decision (requires Step 3 in Handoff section)

```
deliveryMode:              REQUIRES HUMAN EXECUTION
                             → node apps/api/scripts/diagnose-stream.mjs --url '<xtream-url>' --ext <ext>
                             → Paste section3_compatDecision.deliveryMode here

classifyInputVideoCodec:   REQUIRES HUMAN EXECUTION — paste section3_compatDecision.videoCodec

classifyInputAudioCodec:   REQUIRES HUMAN EXECUTION — paste section3_compatDecision.audioCodec

classifyInputContainer:    REQUIRES HUMAN EXECUTION — paste section3_compatDecision.container

classifyInputExtension:    REQUIRES HUMAN EXECUTION — paste section3_compatDecision.extension
```

---

## Section 4 — ffmpeg Execution

### How to Collect (LOCAL — no Railway needed)

The `section4_ffmpegExecution` field from `diagnose-stream.mjs` captures `exitCode`, `exitSignal`, `stderrTail`, `msToFirstByte`, `firstOutputBytesHex`. The script replicates the production pipeline exactly: `fetch(url) → Readable.fromWeb → pipe → ffmpeg stdin` with the same args as `runFfmpegStream()`.

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

### Production Evidence (requires Step 3 in Handoff section)

```
ffmpegPid:          REQUIRES HUMAN EXECUTION
                      → node apps/api/scripts/diagnose-stream.mjs --url '<xtream-url>' --ext <ext>
                      → Paste section4_ffmpegExecution.pid here

ffmpegExitCode:     REQUIRES HUMAN EXECUTION — paste section4_ffmpegExecution.exitCode

ffmpegExitSignal:   REQUIRES HUMAN EXECUTION — paste section4_ffmpegExecution.exitSignal

ffmpegStderrTail:   REQUIRES HUMAN EXECUTION — paste section4_ffmpegExecution.stderrTail

msToFirstByte:      REQUIRES HUMAN EXECUTION — paste section4_ffmpegExecution.msToFirstByte

ffmpegSpawnSuccess: REQUIRES HUMAN EXECUTION — paste section4_ffmpegExecution.spawnSuccess
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

### Production Evidence (requires Steps 2–3 in Handoff section)

```
responseContentType:       REQUIRES HUMAN EXECUTION
                             → Deploy T080 to Railway (Step 1 in Handoff)
                             → curl -v -H "User-Agent: Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1" \
                                  "https://<railway-api>/api/playback/stream/<sessionId>?compat=1" \
                                  -o /dev/null 2>&1 | grep -E "Content-Type|Transfer-Encoding|Content-Length|Accept-Ranges|HTTP/"
                             → Paste Content-Type header value here

responseContentLength:     REQUIRES HUMAN EXECUTION — paste Content-Length header value (or "absent")

responseTransferEncoding:  REQUIRES HUMAN EXECUTION — paste Transfer-Encoding header value

responseAcceptRanges:      REQUIRES HUMAN EXECUTION — paste Accept-Ranges header value

responseMode:              REQUIRES HUMAN EXECUTION — REMUX / TRANSCODE_AUDIO / DIRECT (from Railway log)

httpStatus:                REQUIRES HUMAN EXECUTION — paste HTTP status code (e.g. 200, 415, 500)
```

---

## Section 6 — Independent Compat Output Validation

### How to Collect (LOCAL — no Railway needed)

The `section6_outputValidation` field from `diagnose-stream.mjs` runs ffprobe on the ffmpeg output file and reports `outputIsValidMedia`, `outputContainer`, `outputVideoCodec`, `outputAudioCodec`. This directly answers whether the pipeline produces valid fMP4 independent of Safari integration.

### Also Collectable from Railway (after deployment)

```bash
curl -s -H "User-Agent: Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15" \
  "https://<railway-api>/api/playback/stream/<sessionId>?compat=1" \
  | ffprobe -v quiet -print_format json -show_streams -show_format -i pipe:0
```

### Production Evidence (requires Step 3 in Handoff section)

```
outputContainer:    REQUIRES HUMAN EXECUTION
                      → node apps/api/scripts/diagnose-stream.mjs --url '<xtream-url>' --ext <ext>
                      → Paste section6_outputValidation.outputContainer here

outputVideoCodec:   REQUIRES HUMAN EXECUTION — paste section6_outputValidation.outputVideoCodec

outputAudioCodec:   REQUIRES HUMAN EXECUTION — paste section6_outputValidation.outputAudioCodec

outputIsValidMedia: REQUIRES HUMAN EXECUTION — paste section6_outputValidation.outputIsValidMedia

ffprobeExitCode:    REQUIRES HUMAN EXECUTION — paste section6_outputValidation.ffprobeExitCode
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

### Production Evidence (requires Steps 3–4 in Handoff section)

```
errorCode (normal URL):    REQUIRES HUMAN EXECUTION
                             → Connect iPhone via USB, open Safari Web Inspector
                             → Navigate to failing stream on iPhone Safari
                             → In Web Inspector → Console, find: console.warn('[iptvflix:player] video error event', ...)
                             → Paste errorCode where urlMode = "normal" here

errorCode (compat URL):    REQUIRES HUMAN EXECUTION — paste errorCode where urlMode = "compat"

urlMode at failure:        REQUIRES HUMAN EXECUTION — paste urlMode from final error event

readyState:                REQUIRES HUMAN EXECUTION — paste readyState from error event

networkState:              REQUIRES HUMAN EXECUTION — paste networkState from error event

eventSequence:             REQUIRES HUMAN EXECUTION — paste full eventSequence array from console.warn
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

### nixpacks Configuration Check — VERIFIED FROM CODE

`apps/api/nixpacks.toml` (line 2) contains:
```toml
[phases.setup]
nixPkgs = ["ffmpeg"]
```

ffmpeg is configured. In Nix packages, `ffmpeg` includes `ffprobe`. Build config also confirmed via `apps/api/railway.toml`: `builder = "NIXPACKS"`. The build pipeline will install ffmpeg from nixpkgs.

**Remaining gap**: This confirms build config, not runtime presence. `/api/diagnostics/env` still needed to confirm ffmpeg is on PATH at runtime (no PATH override, no Docker layer mismatch).

### Security Limitation — Unauthenticated diagnostics route

`GET /api/diagnostics/env` is publicly accessible to any client that knows the URL on Railway. The information exposed (PATH, binary versions, memory) does not include credentials or secrets, and the `RAILWAY_ENVIRONMENT` guard limits it to Railway deployments. However, the path is guessable. This is acceptable for a temporary diagnostic route, but the follow-up correction ticket must remove or protect this endpoint before merging to a long-lived branch.

### Production Evidence (requires Step 2 in Handoff section)

```
ffmpegPresent:    REQUIRES HUMAN EXECUTION
                    → Deploy T080 branch to Railway (Step 1 in Handoff)
                    → Call: GET https://<railway-api>/api/diagnostics/env
                    → Paste ffmpegWhich.ok value here

ffmpegVersion:    REQUIRES HUMAN EXECUTION — paste ffmpegVersion.stdout here

ffprobePresent:   REQUIRES HUMAN EXECUTION — paste ffprobeWhich.ok here

ffprobeVersion:   REQUIRES HUMAN EXECUTION — paste ffprobeVersion.stdout here

tmpDirWritable:   REQUIRES HUMAN EXECUTION — paste tmpDirWritable.ok here

railwayPath:      REQUIRES HUMAN EXECUTION — paste resolvedPath here
```

---

## Section 9 — Root Cause Candidates

**Note: The analysis below is based on static code analysis alone. Section 9 constitutes a hypothesis, not a confirmed root cause. Production evidence from Sections 1–8 is required to confirm or disprove each candidate.**

Based on code-level analysis, ranked by probability:

### Candidate 1 (ROOT CAUSE HYPOTHESIS — CONFIRMED FROM CODE, AWAITING PRODUCTION VERIFICATION): compat fallback is structurally inert on Safari

**Static evidence**:
- `apps/api/src/routes/playback.ts:207`: `const useCompat = request.query.compat === '1' || isSafariOrIOS(userAgent)`
- `apps/api/src/services/playback-resolver.ts:200`: `compatGatewayUrl: \`${gatewayUrl}?compat=1\``
- `apps/web/src/pages/PlayerPage.tsx:171-181`: on `MEDIA_ERR_DECODE`/`MEDIA_ERR_SRC_NOT_SUPPORTED`, retries with `compatUrl` (= `?compat=1`)

**Consequence**: For any Safari/iOS UA:
1. Initial request to `gatewayUrl` → `isSafariOrIOS()` = true → `useCompat = true` → full compat path
2. Frontend fallback fires → retries `compatUrl` (`?compat=1`) → `request.query.compat === '1'` = true → `useCompat = true` → **identical compat path**

The two attempts are behaviorally identical. If compat path fails on attempt 1, it will fail the same way on attempt 2. The user always sees the error.

**What the production trace will add**: Which specific compat sub-failure occurs (probe fails → extension routing, ffmpeg exits with error, fMP4 malformed, Content-Type mismatch). The structural defect is visible from code; the specific execution failure requires production evidence.

**Correction**: The frontend should not retry with `compatUrl` on Safari (since both URLs already use compat). Instead, it should either switch to a different variant via `alternatives`, show the error immediately, or use a truly different delivery strategy on retry.

### Candidate 2 (LOW — largely disproved from code): ffmpeg absent or misconfigured on Railway

**Static evidence**: `apps/api/nixpacks.toml:2` confirms `nixPkgs = ["ffmpeg"]`. nixpkgs `ffmpeg` package includes both `ffmpeg` and `ffprobe` binaries. `apps/api/railway.toml` confirms `builder = "NIXPACKS"`.

**Remaining gap**: Build config confirmed, runtime PATH not yet verified. Edge cases still possible (nixpacks builder version mismatch, Nix store path not on PATH at runtime). Verify via `/api/diagnostics/env` — if `ffmpegWhich.ok = false`, this escalates to HIGH.

**If confirmed**: Update `nixpacks.toml` to explicitly pin `ffmpeg` version or add a `[phases.install]` PATH verification step. Though at current evidence level this is unlikely.

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

---

## Handoff — Required Human Steps

**These 4 steps must be executed by a human with access to a physical iPhone, Xtream provider credentials, and the Railway deployment.**

### Step 1 — Deploy T080 branch to Railway

```bash
# Push T080 branch and trigger Railway deployment
git push origin ticket/T080-diagnose-production-safari-ios-playback-failure-af
# Trigger deploy via Railway dashboard or: railway up --service api
# Wait for deployment to complete and verify new revision is live
```

### Step 2 — Verify Railway runtime environment

```bash
# Call the diagnostics endpoint on the Railway API
curl -s "https://<railway-api-url>/api/diagnostics/env" | jq .
# Copy full JSON response into Section 8 evidence fields
# Key fields to check: ffmpegWhich.ok, ffmpegVersion.stdout, ffprobeWhich.ok, tmpDirWritable.ok
```

### Step 3 — Run local pipeline against a real failing Xtream URL

```bash
# Use a known-failing Xtream Movie/Episode URL from the app
node apps/api/scripts/diagnose-stream.mjs \
  --url 'http://<xtream-provider>/movie/<user>/<pass>/<id>.ts' \
  --ext ts \
  > runs/T080/diagnose-output.json

# Paste section2, section3, section4, section6 fields into their respective evidence blocks above
cat runs/T080/diagnose-output.json | jq '{s2: .section2_upstreamProbe, s3: .section3_compatDecision, s4: .section4_ffmpegExecution, s6: .section6_outputValidation}'
```

### Step 4 — Test on iPhone Safari with Web Inspector

```bash
# 1. Connect iPhone to Mac via USB
# 2. On iPhone: Settings → Safari → Advanced → Web Inspector → ON
# 3. On Mac: Safari → Develop → [your iPhone] → [tab with iptvflix]
# 4. Navigate to a failing Movie/Episode on iPhone Safari
# 5. In Web Inspector → Console, capture all console.warn lines containing "[iptvflix:player]"
# 6. Run: railway logs -t --service api | grep "playback-gateway"
# 7. Correlate sessionId between Railway logs and Web Inspector output
# 8. Paste all captured values into Section 1 and Section 7 evidence fields
```

After completing all 4 steps, update this document's Status line to: `COMPLETE — production evidence collected` and commit the updated file.
