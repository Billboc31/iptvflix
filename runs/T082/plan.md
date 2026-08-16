# T082 — Plan: Cross-platform web playback standardisation

## Objective

Diagnose the shared backend delivery failure that breaks Xtream VOD playback on both iPhone Safari and Android Chrome, then replace the current split extension-based/compat delivery with a probe-first policy: native-compatible media gets a cheap pass-through; everything else gets a deterministic ffmpeg→HLS pipeline served through authenticated IPTVFlix endpoints.

## Included

### Phase 1 — Diagnosis

**`apps/api/scripts/diagnose-stream.mjs`** — extend to capture and report every field the ticket requires:
- media id / type, availability id, source id, provider item id, stored extension
- ffprobe container + codecs (full JSON)
- computed delivery mode
- gateway endpoint hit
- HTTP status, Content-Type, Content-Range, first 16 bytes hex
- ffmpeg spawn args (credentials redacted), exit code, stderr tail, time-to-first-byte
- whether output terminates prematurely
- independent ffprobe on ffmpeg output stream

Run the script against at least one failing Xtream Movie and one failing Xtream Episode in a production-like environment. Save sanitised output to `runs/T082/diagnosis.md`. Determine whether IPTVFlix itself produces invalid media or whether only browser integration fails.

---

### Phase 2 — Probe-first delivery policy

#### `apps/api/src/services/playback-resolver.ts`
- After building the provider stream URL, call `probeMedia()` on it.
- Compute delivery mode using updated `classifyDelivery()` (see below).
- Store probe result + delivery mode in the session.
- Return `deliveryMode` and `probeResult` in `PlaybackSessionResponse` for observability.
- If `deliveryMode === 'HLS'`, spawn ffmpeg into a temp HLS session immediately and store the session id; return HLS master playlist URL as `gatewayUrl`.
- Raise `503` if probing fails and no fallback is possible; add structured error log.

Consequence: the `?compat=1` query param and `compatGatewayUrl` field become unnecessary. Remove them.

#### `apps/api/src/services/playback-compat.ts`
- Remove `isSafariOrIOS()` — delivery policy must be browser-agnostic.
- Update `classifyDelivery()` to return one of: `'DIRECT' | 'HLS_REMUX' | 'HLS_TRANSCODE_AUDIO' | 'HLS_TRANSCODE_FULL'`.
  - `DIRECT`: H.264+AAC in MP4/M4V container, or already-valid HLS stream.
  - `HLS_REMUX`: codecs are browser-compatible (H.264+AAC) but in non-MP4 container — use `ffmpeg -c copy`.
  - `HLS_TRANSCODE_AUDIO`: H.264 video, non-AAC audio — copy video, transcode audio to AAC 192k.
  - `HLS_TRANSCODE_FULL`: anything else — transcode video to H.264 veryfast CRF23, audio to AAC 192k.
- Update `buildFfmpegArgs()` to emit HLS output: `-f hls -hls_time 6 -hls_list_size 0 -hls_flags delete_segments+append_list -hls_segment_filename <tempdir>/seg%05d.ts <tempdir>/master.m3u8` appended with the appropriate codec flags.

#### New file: `apps/api/src/services/hls-session-store.ts`
- `createHlsSession(providerUrl, ffmpegArgs)` → spawns ffmpeg writing to a unique temp dir, returns `hlsSessionId`.
- `getHlsSession(id)` → returns `{ tempDir, process, createdAt }` or null.
- `getPlaylist(id)` → reads and returns the m3u8 content from temp dir; rewrites segment filenames to `/playback/session/:id/segments/:filename` URLs (no credentials).
- `getSegment(id, filename)` → returns the absolute path to the segment file inside the temp dir (validated against the session temp dir to prevent path traversal).
- TTL: 2 hours. Background cleanup: kill process, delete temp dir on expiry.
- On ffmpeg process exit (unexpected): mark session as failed, next playlist/segment request returns 410.
- Segment accumulation limit: reject if `ls tempdir | wc` exceeds 500 segments.

#### `apps/api/src/routes/playback.ts`
- **Simplify `GET /playback/stream/:sessionId`**: keep only the `DIRECT` path. Remove probe-on-compat branch, remove extension-based routing, remove ffmpeg-to-fMP4 logic. If session delivery mode is not `DIRECT`, return 409.
- **Add `GET /playback/session/:sessionId/master.m3u8`**: calls `hls-session-store.getPlaylist()`, serves with `Content-Type: application/vnd.apple.mpegurl`. Returns 404 while playlist not yet written (ffmpeg start latency), 410 if session failed/expired.
- **Add `GET /playback/session/:sessionId/segments/:filename`**: calls `hls-session-store.getSegment()`, streams file with `Content-Type: video/MP2T`. Validates filename is `seg\d+\.ts` pattern. Returns 404 if segment not yet available (progressive generation).
- All HLS endpoints require authenticated session (existing session-store `getSession()` ownership check).
- No provider URLs, credentials, or upstream hostnames must appear in playlist responses — verified by existing credential-safety test extended to HLS paths.

#### `packages/api-contracts/src/playback.ts`
- Add to `PlaybackSessionResponse`: `deliveryMode: 'DIRECT' | 'HLS_REMUX' | 'HLS_TRANSCODE_AUDIO' | 'HLS_TRANSCODE_FULL'`, `probeResult: { videoCodec, audioCodec, containerFormat } | null`.
- Remove `compatGatewayUrl`.

---

### Phase 3 — Variant compatibility scoring

#### `apps/api/src/services/availability-resolver.ts`
- Add a `codecCompatibilityScore()` dimension to the scoring tuple: prefer H.264 variants (score 2) over HEVC (score 1) over VP9/AV1/unknown (score 0) to minimise transcoding cost without changing content or language.
- This must not affect language or subtitle scoring (codec score is the lowest-priority tiebreaker before variantId).

---

### Phase 4 — Frontend unification

#### `apps/web/src/pages/PlayerPage.tsx`
- Remove the error-triggered compat fallback (`compatGatewayUrl` retry on MEDIA_ERR_DECODE / MEDIA_ERR_SRC_NOT_SUPPORTED). The backend now delivers a known-good URL.
- Unify Movie and Episode into one playback setup path — no divergent code branches.
- On `deliveryMode === 'DIRECT'`: set `video.src` directly (MP4 pass-through).
- On `deliveryMode === 'HLS_*'`: load `master.m3u8` via hls.js (if no native HLS) or native if Safari/iOS. Use existing hls.js integration.
- `Regarder` triggers playback unconditionally. No compat selector, no technical mode visible to user.
- Keep resume position (`startPositionSeconds` via `loadedmetadata`) unchanged.
- Keep variant switcher for alternative availabilities.

#### `apps/web/src/hooks/usePlayback.ts`
- Remove `compatUrl` from returned state.
- Expose `deliveryMode` for player setup logic.

---

### Phase 5 — Observability

#### `apps/api/src/routes/playback.ts` + `apps/api/src/services/hls-session-store.ts`
Add structured log entries (Fastify logger) at each decision point:
- resolve: `availabilityId`, `sourceId`, `providerItemId`, `containerExtension`, `probeResult`, `deliveryMode`
- HLS session create: `hlsSessionId`, `ffmpegMode`, `tempDir`
- HLS playlist serve: `hlsSessionId`, `playlistSizeBytes`, `segmentCount`
- HLS segment serve: `hlsSessionId`, `filename`, `sizeBytes`
- ffmpeg exit: `hlsSessionId`, `exitCode`, `stderrTail`
- Client errors: `sessionId`, `mediaErrorCode`, `networkState`, `readyState` (logged from frontend via existing error logging, no additional backend endpoint needed)

No provider credentials, URLs, usernames, or passwords in any log line.

---

### Phase 6 — Railway readiness

#### `apps/api/src/index.ts` (or server startup file)
- Add startup check: spawn `ffmpeg -version` and `ffprobe -version`; if either fails, log `FATAL: ffmpeg/ffprobe not available` and exit 1. This surfaces Railway build misconfigurations at deploy time, not at first playback request.
- Add startup check: write and delete a temp file in `os.tmpdir()`; fail fast if not writable.

#### `apps/api/nixpacks.toml`
- Verify (read-only; already has `ffmpeg`). No change needed if ffmpeg package provides ffprobe — verify by checking nixpkgs `ffmpeg` package includes both binaries. Document finding.

---

### Tests

#### `apps/api/src/__tests__/playback-compat.test.ts`
- Remove `isSafariOrIOS` tests.
- Update `classifyDelivery` tests: cover `DIRECT`, `HLS_REMUX`, `HLS_TRANSCODE_AUDIO`, `HLS_TRANSCODE_FULL` cases.
- Update `buildFfmpegArgs` tests for HLS output format.

#### `apps/api/src/routes/__tests__/playback-gateway.test.ts`
- Add tests: `DIRECT` session serves MP4 stream; HLS session returns 409 on `/stream/:id`.
- Add tests: `GET /playback/session/:id/master.m3u8` returns playlist with rewritten segment URLs, no provider hostname.
- Add tests: `GET /playback/session/:id/segments/seg00001.ts` serves binary content.
- Add tests: path traversal attempt on segment filename returns 400.
- Add tests: credential safety — playlist response must not contain provider username, password, or base URL.
- Add tests: expired/failed HLS session returns 410.

#### New `apps/api/src/services/__tests__/hls-session-store.test.ts`
- Test session creation, playlist rewrite, segment path validation, TTL expiry, process cleanup, over-segment-limit rejection.

#### `e2e/tests/playback.spec.ts`
- Extend smoke test: resolve a stream, assert response has `deliveryMode` field, fetch playlist if HLS, assert playlist contains no provider credentials.

---

## Excluded

- Live/IPTV channel streaming (only Xtream VOD: Movie and Episode).
- Multi-bitrate adaptive HLS (single output bitrate per session).
- Subtitle/caption embedding in HLS output.
- DRM.
- Session persistence across server restarts (in-memory only, same as current).
- Any UI redesign beyond removing the compat selector and unifying the playback trigger.
- Changes to sync, metadata ingestion, or any non-playback route.
- Automated real-device browser testing (Playwright cannot run Safari on iOS or Android Chrome in CI).
- Audio language changing (codec scoring must not alter selected language).

## Acceptance criteria

- `runs/T082/diagnosis.md` exists and documents the root cause of the current cross-platform failure with captured ffprobe/HTTP evidence for at least one failing Movie and one failing Episode.
- `classifyDelivery()` no longer reads User-Agent; delivery mode is determined solely from probe data.
- `GET /playback/resolve/:mediaType/:mediaId` response contains `deliveryMode` and `probeResult`; does not contain `compatGatewayUrl`.
- `GET /playback/session/:id/master.m3u8` serves a valid HLS playlist with all segment URLs pointing to `/playback/session/:id/segments/...`.
- No provider hostname, username, password, or credential-bearing URL appears in any playlist response, segment URL, or log line — verified by the extended credential-safety test.
- Segment filename path traversal returns 400.
- DIRECT sessions served at `/playback/stream/:sessionId`; HLS sessions return 409 on that endpoint.
- Startup check fails fast (exit 1) if ffmpeg/ffprobe binaries are absent.
- All existing passing tests continue to pass; new tests listed above are green.
- `pnpm --filter api typecheck` passes with no new errors.
- Manual validation (blocking for ticket closure): Movie plays on iPhone Safari; Movie plays on Android Chrome; Episode plays on at least one mobile browser; one DIRECT stream verifies fast-path regression; one HLS stream (remux or transcode) verifies the compatibility pipeline.
