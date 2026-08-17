# Plan — T085: Prove one real Xtream movie plays end-to-end

## Objective

Produce reproducible evidence that exactly one real Xtream VOD movie plays with moving video and audio through the deployed IPTVFlix path (browser + Railway). Every diagnostic layer between `Regarder` and pixel output must be traced and validated; generic guesses and mock-only tests are not accepted as done.

## Included

### Phase 1 — Upstream stream validation (no IPTVFlix code involved)

- Query the production/prod-like database for one concrete `movieAvailability` row with `source.type = 'xtream'`; record movie ID, availability ID, source ID, stream ID, `container_extension`, quality/language fields (no credentials in artefacts).
- From the API Railway environment (or a network-equivalent shell), run:
  - `curl -I <upstream-url>` → HTTP status, Content-Type, Content-Length, redirects
  - `curl -r 0-1023 <upstream-url>` → Range 206 behavior
  - `ffprobe -v quiet -print_format json -show_streams <upstream-url>` → container, video codec/profile/resolution/pixel format, audio codec/channels/sample rate, duration
  - `ffmpeg -t 30 -i <upstream-url> -f null -` → decode 30 s without fatal error
- Save sanitized output to `runs/T085/evidence/phase1-upstream.md`.
- If the upstream URL is unreachable or returns non-2xx, fix `buildXtreamMovieUrl()` in `apps/api/src/providers/xtream/playback.ts` first; do not proceed until Phase 1 passes.

### Phase 2 — Xtream VOD URL semantics

- Audit `buildXtreamMovieUrl()` and `buildXtreamEpisodeUrl()` in `apps/api/src/providers/xtream/playback.ts` against the actual provider API spec. Confirm the pattern is `/movie/{username}/{password}/{streamId}.{ext}` and that `container_extension` is taken verbatim from the availability row (not hard-coded).
- Verify no live-TV URL shape (`/live/…`) is accidentally used for VOD.
- Add `apps/api/src/providers/xtream/__tests__/xtream-vod-url.test.ts`:
  - Unit test: given a fixture source + availability, `buildXtreamMovieUrl()` produces the exact expected URL shape.
  - Unit test: `container_extension` is embedded in the URL, not overridden.
  - Unit test: episode URL is not used for movies.

### Phase 3 — End-to-end correlation trace

- Add `X-Correlation-ID` request header propagation to `apps/api/src/routes/playback.ts`:
  - Generate a UUID v4 at the `resolve` handler entry point.
  - Thread the ID through `playback-resolver.ts`, `providers/xtream/playback.ts`, `hls-session-store.ts`.
  - Return `X-Correlation-ID` in the resolve response header and embed it in the session record.
  - Emit a structured log line at each step: `{ correlationId, step, result, durationMs }`.
  - Steps to log: `resolve_start`, `availability_fetched`, `upstream_url_built`, `probe_result`, `delivery_mode_selected`, `session_created`, `gateway_url_issued`.
- Document the actual trace for the golden-path movie in `runs/T085/evidence/phase3-trace.md` (no credentials).

### Phase 4 — Delivery artifact validation outside React

**If DIRECT or proxy stream:**
- `curl -I <gateway-url>` → 200/206, correct Content-Type (e.g. `video/mp4`), Content-Length or Transfer-Encoding.
- `curl -r 0-65535 <gateway-url> | xxd | head` → confirm real media bytes (not JSON/HTML).
- `ffprobe <gateway-url>` → container recognised through the gateway.
- `curl -r 999999999-1000000000 <gateway-url>` → graceful 416 or partial Content-Range.

**If HLS:**
- `curl <session-url>/master.m3u8` → HTTP 200, MIME `application/vnd.apple.mpegurl`, syntactically valid M3U8.
- Parse every playlist and segment URL from the manifest; verify each resolves with HTTP 200 and media bytes.
- `ffmpeg -t 30 -i <manifest-url> -f null -` through the IPTVFlix gateway → no fatal error.
- Record sanitized manifest example and request sequence in `runs/T085/evidence/phase4-artifact.md`.

### Phase 5 — Railway runtime verification

- SSH/exec into the Railway API service (or review deployment logs) to confirm:
  - `ffmpeg -version` and `ffprobe -version` succeed.
  - The deployed git SHA matches the expected playback commit.
  - The HLS temp directory path (used by `hls-session-store.ts`) exists and is writable by the API process.
  - Segment files written by ffmpeg are accessible to subsequent HTTP requests on the same instance.
  - Xtream upstream host is reachable via `curl` from the Railway instance (IPv4 path via `resolveXtreamFetchTarget()`).
  - Railway horizontal replicas are not causing manifest/segment split-brain (document the single-instance constraint or propose a fix if replicas are active).
- Record findings in `runs/T085/evidence/phase5-railway.md`.

### Phase 6 — Browser network inspection

- Open a real browser (desktop Chrome DevTools → Network panel).
- Click `Regarder` for the golden-path movie; capture:
  - `GET /playback/resolve/…` response body (sanitized) and status.
  - Final playback URL given to the `<video>` element.
  - Manifest request + response headers (MIME, CORS headers).
  - First segment/media requests + status codes.
  - Any `media` element `error.code` + `error.message`.
  - Any hls.js console errors (fatal/non-fatal).
- Record findings in `runs/T085/evidence/phase6-browser.md`.

### Phase 7 — Fix the golden path

Based on phases 1–6, apply the minimum targeted fix to make the one golden-path movie produce moving video and audio. Scope is limited to fixing the discovered root cause only — no speculative refactors.

Acceptable targeted fixes include (based on actual findings):
- Correct URL construction in `providers/xtream/playback.ts`.
- Fix a manifest rewrite bug in `routes/playback.ts` (e.g. wrong base URL, wrong segment path).
- Fix HLS session temp-dir configuration for Railway.
- Fix Range request passthrough in the DIRECT proxy handler.
- Force H.264/AAC HLS transcode for the golden stream if codec probe shows an incompatible format.

Do NOT refactor unrelated layers. Do NOT change the frontend player logic unless the browser trace shows a frontend-specific bug.

### Phase 8 — Cross-device validation

- Desktop Chrome: capture a network trace screenshot confirming 200 responses and video playing.
- Android Chrome: same (or document exact error with HTTP status + `MediaError` code if blocked).
- iPhone Safari: same (or document exact HLS segment error / MIME rejection if blocked).
- Save screenshots / error captures in `runs/T085/evidence/phase8-devices.md`.

### Diagnostic endpoint

- Add `GET /playback/diag/:availabilityId` to `apps/api/src/routes/playback.ts`.
- Returns JSON (admin-gated, never exposed via public client): upstream reachable (bool), HTTP status, detected container/codecs (from cached or fresh ffprobe), selected delivery mode, ffmpeg/ffprobe available, session state, manifest ready, segment count, last ffmpeg stderr excerpt (no credentials).
- Must not include Xtream credentials or raw upstream URLs in the response.

### Error UX

- Replace generic playback error in `apps/web/src/lib/player-errors.ts` with typed categories:
  `SOURCE_UNREACHABLE` | `SOURCE_AUTH_REJECTED` | `STREAM_URL_INVALID` | `PROBE_FAILED` | `TRANSCODER_UNAVAILABLE` | `TRANSCODING_FAILED` | `MANIFEST_GENERATION_FAILED` | `SEGMENT_UNAVAILABLE` | `CODEC_REJECTED_BY_BROWSER` | `SESSION_EXPIRED`
- The server (resolver + playback routes) emits the typed reason in the error response body along with `correlationId`.
- User-facing UI shows a short French message; the browser console logs the typed reason + correlationId for support.

### Integration tests

- `apps/api/src/__tests__/playback-integration.test.ts` — realistic HTTP-level test (not mock-only):
  - Spins up a local Xtream fixture server (reuse/extend `e2e/fixtures/xtream-server.ts`).
  - Calls `/playback/resolve/movie/:id` → asserts session created, delivery mode set, no credentials in response.
  - Calls the resolved gateway/manifest URL → asserts HTTP 200, correct MIME type.
  - For HLS path: parses manifest, fetches first segment, asserts media bytes returned.
  - Asserts `X-Correlation-ID` is present in resolver response.
  - Asserts error response body includes typed error category when the fixture upstream is unreachable.

### Evidence document

- `runs/T085/evidence/summary.md`: compile all phase results — movie/availability IDs (no secrets), root cause(s), upstream ffprobe summary, delivery mode chosen, sanitized resolver response, manifest shape, ffmpeg-through-IPTVFlix 30 s validation, browser network result, per-device result, Railway runtime verification.

## Excluded

- Supporting multiple Xtream sources or movie selections simultaneously (prove one, then generalize in a follow-up ticket).
- Plex, M3U, or any non-Xtream provider (out of scope for this ticket).
- Series/episode playback (VOD movie only).
- Adaptive bitrate ladder / multiple HLS quality levels.
- Player UI redesign or additional controls.
- Progress tracking, resume, or watch-history features.
- Android TV Kotlin app.
- DRMR/DRM-protected streams.
- CDN caching or performance optimization.
- Multi-replica Railway session affinity architecture (document the constraint; fix only if it is the proven blocker for the golden path).
- Any refactor not required to fix the discovered root cause.

## Acceptance criteria

1. A real Xtream upstream URL is fetched from the database and proven reachable; `ffprobe` produces a valid stream summary; `ffmpeg -t 30` exits without fatal error. Evidence saved.
2. `buildXtreamMovieUrl()` unit tests pass and confirm the `/movie/{u}/{p}/{streamId}.{ext}` pattern with correct `container_extension`.
3. A `X-Correlation-ID` is returned in the resolve response and appears in all server-side log lines for the request.
4. The final gateway/manifest URL is validated with `curl`/`ffprobe` outside the browser (HTTP 200, correct MIME, real media bytes or valid HLS structure). Evidence saved.
5. For HLS: every segment URL in the manifest resolves to HTTP 200 with media bytes; `ffmpeg -t 30 -i <manifest>` succeeds through the IPTVFlix gateway.
6. Railway environment confirms: `ffmpeg -version` and `ffprobe -version` succeed; Xtream upstream is reachable from Railway; temp-dir paths are writable; deployed SHA is as expected.
7. The golden-path movie displays moving video and produces audio in a real browser session (screen capture or annotated DevTools screenshot as evidence).
8. Desktop Chrome is manually validated with evidence.
9. Android Chrome or iPhone Safari is validated, or the exact device-specific blocker (HTTP status + MediaError code) is documented with evidence and the ticket result is `BLOCKED / AWAITING DEVICE VALIDATION`.
10. No Xtream credentials appear in resolver response bodies, browser-visible URLs, or client-side logs.
11. Error responses from the playback API include a typed error category and `correlationId`; the UI displays a categorized French error message rather than a generic "cannot play".
12. `apps/api/src/providers/xtream/__tests__/xtream-vod-url.test.ts` and `apps/api/src/__tests__/playback-integration.test.ts` pass in CI.
13. `GET /playback/diag/:availabilityId` returns valid JSON with the fields listed above and does not expose credentials.
