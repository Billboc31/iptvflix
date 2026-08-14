# Plan — T079: Fix Safari/iOS video decode failures with automatic playback compatibility fallback

## Objective

Make Movie and Episode playback work on Safari/iOS by probing actual media codecs server-side and automatically routing each stream through the minimum-cost compatible delivery path (direct pass-through, remux, or transcode). The user presses `Regarder` once; the backend handles all compatibility decisions transparently. ffmpeg/ffprobe must be explicitly declared in the Railway deployment.

## Included

### 1. Railway ffmpeg packaging
- **`apps/api/nixpacks.toml`** (new) — declare `pkgs.ffmpeg` so Railway/Nixpacks installs it at build time. Removes reliance on an undeclared binary.

### 2. Media prober service
- **`apps/api/src/services/media-prober.ts`** (new):
  - `probeMedia(url: string): Promise<MediaInfo>` — spawns `ffprobe -v quiet -print_format json -show_streams <url>`, parses `codec_name` and `codec_type` fields.
  - Returns `MediaInfo { videoCodec: string, audioCodec: string, containerFormat: string }`.
  - Logs only `availabilityId` on probe start/end, never the raw provider URL.

### 3. Probe cache
- **`apps/api/src/services/probe-cache.ts`** (new):
  - In-memory `Map<availabilityId, { mediaInfo: MediaInfo, expiresAt: number }>` with 24-hour TTL.
  - Exports `getProbe(availabilityId)` and `setProbe(availabilityId, mediaInfo)`.
  - Prevents re-probing the same variant on every play request.

### 4. Safari/iOS compatibility classifier
- **`apps/api/src/services/playback-compat.ts`** (new):
  - `isSafariOrIOS(userAgent: string): boolean` — UA string detection.
  - `DeliveryMode` enum: `DIRECT | REMUX | TRANSCODE_AUDIO | TRANSCODE_VIDEO | TRANSCODE_FULL`.
  - `classifyDelivery(mediaInfo: MediaInfo, isSafari: boolean): DeliveryMode`:
    - MP4 + H.264 + AAC → `DIRECT`
    - HLS (m3u8/m3u) → `DIRECT` (Safari plays natively)
    - Any container + H.264 + AAC → `REMUX` (stream copy to fMP4)
    - Any container + H.264 + non-AAC audio → `TRANSCODE_AUDIO`
    - HEVC/H.265 + AAC in MP4 on iOS/macOS Safari → `DIRECT` (supported natively)
    - HEVC + non-AAC audio → `TRANSCODE_AUDIO`
    - Unsupported video codec (not H.264, not HEVC) → `TRANSCODE_VIDEO`
    - Unsupported video + unsupported audio → `TRANSCODE_FULL`

### 5. Extended stream handler
- **`apps/api/src/routes/playback.ts`** (modify — `GET /playback/stream/:sessionId`):
  - Accept optional `?compat=1` query parameter.
  - Trigger compat path when: Safari/iOS UA detected **or** `?compat=1` present.
  - Compat path:
    1. Look up probe cache by `session.availabilityId`.
    2. On miss: call `probeMedia(session.providerStreamUrl)`, store in cache.
    3. Call `classifyDelivery(mediaInfo, true)` → `DeliveryMode`.
    4. Route to the appropriate delivery path.
  - Non-Safari, non-compat: existing logic unchanged (no regression for other browsers).
  - New ffmpeg invocation arguments per mode:
    - `REMUX`: existing `-c copy -movflags frag_keyframe+empty_moov+default_base_moof -f mp4` (no change)
    - `TRANSCODE_AUDIO`: `-c:v copy -c:a aac -b:a 192k -movflags frag_keyframe+empty_moov+default_base_moof -f mp4`
    - `TRANSCODE_VIDEO`: `-c:v libx264 -preset veryfast -crf 23 -c:a copy -movflags frag_keyframe+empty_moov+default_base_moof -f mp4`
    - `TRANSCODE_FULL`: `-c:v libx264 -preset veryfast -crf 23 -c:a aac -b:a 192k -movflags frag_keyframe+empty_moov+default_base_moof -f mp4`
  - All ffmpeg processes killed on client disconnect (existing AbortSignal pattern extended to new paths).
  - Log `DeliveryMode` with `availabilityId` only.

### 6. API contract extension
- **`packages/api-contracts/src/playback.ts`** (modify):
  - Add `compatGatewayUrl: string` field to `PlaybackSessionResponse` — same value as `gatewayUrl` with `?compat=1` appended.

### 7. Resolve endpoint update
- **`apps/api/src/routes/playback.ts`** (same file, `POST /playback/resolve` handler):
  - After creating the session, set `compatGatewayUrl = gatewayUrl + '?compat=1'` in the response body.

### 8. Frontend auto-retry
- **`apps/web/src/hooks/usePlayback.ts`** (modify):
  - Store and expose `compatUrl` from the resolve response.
- **`apps/web/src/pages/PlayerPage.tsx`** (modify):
  - Add `isUsingCompat: boolean` ref (default `false`) to prevent infinite retry loop.
  - On `<video>` error event with `error.code === MediaError.MEDIA_ERR_DECODE` (code 3):
    - If `compatUrl` is available and `!isUsingCompat`: set `isUsingCompat = true`, reassign `video.src = compatUrl`, call `video.load()` then `video.play()`.
    - If already using compat and still failing: display a concise user-facing message ("Impossible de lire ce contenu sur ce navigateur") with a `Réessayer` button that resets and retries from scratch.
  - Remove the current generic `Erreur de décodage vidéo` dead-end for the MEDIA_ERR_DECODE case.

### 9. Tests
- **`apps/api/src/__tests__/playback-compat.test.ts`** (new) — unit tests for `isSafariOrIOS` and `classifyDelivery`:
  - MP4 + H.264 + AAC → `DIRECT`
  - MKV + H.264 + AAC → `REMUX`
  - TS + H.264 + AC3 → `TRANSCODE_AUDIO`
  - any + HEVC + AAC, non-Safari → `TRANSCODE_VIDEO`
  - any + HEVC + AAC, Safari iOS 14 UA → `DIRECT`
  - any + HEVC + AC3 → `TRANSCODE_AUDIO` (audio-only transcode when video stays)
  - any + VP9 + AAC → `TRANSCODE_VIDEO`
  - any + VP9 + Vorbis → `TRANSCODE_FULL`
- **`apps/api/src/__tests__/probe-cache.test.ts`** (new) — cache hit, miss, and TTL expiry scenarios.
- **`apps/api/src/__tests__/playback-stream-compat.test.ts`** (new) — stub-level integration tests for the stream handler compat routing: verify each `DeliveryMode` triggers the correct ffmpeg command args; verify no provider URL appears in logs; verify client disconnect kills ffmpeg.

## Excluded

- DASH / MPEG-DASH output format.
- Multi-bitrate adaptive HLS segment generation (single-quality fMP4 output only).
- Variant language-switch fallback (Requirement 9 of the ticket — deferred to a follow-up).
- Persistent probe cache across API restarts (in-memory TTL is sufficient).
- TV/desktop Safari features beyond the iOS/mobile baseline compatibility matrix.
- Plex provider support.
- Changes to progress sync or session TTL logic.

## Acceptance criteria

1. `apps/api/nixpacks.toml` exists and declares `ffmpeg`; Railway build logs confirm the binary is present.
2. `probeMedia()` parses ffprobe JSON and returns correct `{ videoCodec, audioCodec, containerFormat }` for MP4, MKV, and TS test fixtures.
3. Second call to `probeMedia()` for the same `availabilityId` returns cached result without spawning ffprobe.
4. `classifyDelivery()` returns the expected `DeliveryMode` for every case listed in the test matrix.
5. `GET /playback/stream/:sessionId` with a Safari iOS User-Agent probes media and streams via the classified delivery mode (verifiable by checking `Content-Type: video/mp4` and fMP4 atoms in the response).
6. `GET /playback/stream/:sessionId?compat=1` forces compat path regardless of UA.
7. `PlaybackSessionResponse` includes a `compatGatewayUrl` field equal to `gatewayUrl + '?compat=1'`.
8. On `MEDIA_ERR_DECODE`, `PlayerPage` automatically retries with `compatGatewayUrl` without user action (no full-page reload required).
9. After auto-retry fails, a human-readable error message replaces the generic `Erreur de décodage vidéo` dead-end.
10. All ffmpeg child processes are killed when the client disconnects mid-stream.
11. Provider stream URLs do not appear in API logs at any log level; `availabilityId` is logged instead.
12. All tests in `playback-compat.test.ts` and `probe-cache.test.ts` pass (`pnpm --filter api test`).
13. Manual end-to-end test: a TS-container source plays on Safari/iOS without a decode error after deployment with the new nixpacks config.
