# T085 Evidence Summary

**Ticket result: BLOCKED / AWAITING REAL PLAYBACK VALIDATION**

This ticket cannot be marked complete because observable playback of at least one real Xtream movie through the deployed IPTVFlix path has not been achieved. The code instrumentation is in place; the real-device and real-provider validation steps must now be performed manually.

---

## What was done in this ticket

### Phase 2 — Xtream VOD URL semantics (COMPLETE)

- Audited `buildXtreamMovieUrl()`: confirmed `/movie/{user}/{pass}/{streamId}.{ext}` pattern
- Confirmed `container_extension` used verbatim from DB — no hard-coding
- No `/live/` URL shape used for VOD
- Added 18 unit tests in `apps/api/src/providers/xtream/__tests__/xtream-vod-url.test.ts` — all pass

### Phase 3 — Correlation trace instrumentation (COMPLETE)

- `X-Correlation-ID` UUID generated at resolve handler entry
- Returned in HTTP header: `X-Correlation-ID: {uuid}`
- Threaded through `resolvePlayback()` with structured log at each step:
  - `resolve_start`, `availability_fetched`, `upstream_url_built`, `probe_result`,
    `delivery_mode_selected`, `session_created`, `gateway_url_issued`
- `correlationId` stored in `SessionEntry` for retrieval by gateway handlers
- `correlationId` included in `PlaybackSessionResponse` body

### Typed error categories (COMPLETE)

Added `PlaybackErrorCategory` to `packages/api-contracts/src/playback.ts`:
- `SOURCE_UNREACHABLE`, `SOURCE_AUTH_REJECTED`, `STREAM_URL_INVALID`, `PROBE_FAILED`,
  `TRANSCODER_UNAVAILABLE`, `TRANSCODING_FAILED`, `MANIFEST_GENERATION_FAILED`,
  `SEGMENT_UNAVAILABLE`, `CODEC_REJECTED_BY_BROWSER`, `SESSION_EXPIRED`

API error responses now include `{ error, errorCategory, correlationId }`.
Frontend `player-errors.ts` maps each category to a French user message.

### Diagnostic endpoint (COMPLETE)

`GET /playback/diag/:availabilityId` returns:
```json
{
  "availabilityId": "...",
  "upstreamReachable": true | false | null,
  "upstreamHttpStatus": 200,
  "detectedContainer": "mov,mp4,...",
  "detectedVideoCodec": "h264",
  "detectedAudioCodec": "aac",
  "deliveryMode": "DIRECT",
  "ffmpegAvailable": true,
  "ffprobeAvailable": true,
  "sessionActive": false,
  "sessionId": null,
  "manifestReady": null,
  "segmentCount": null,
  "lastFfmpegError": null
}
```
No Xtream credentials or raw upstream URLs are included.

### Integration tests (COMPLETE)

`apps/api/src/__tests__/playback-integration.test.ts` — 11 tests covering:
- `X-Correlation-ID` header in resolve response
- `correlationId` in resolve response body
- No credentials (`testuser`, `testpass`) in resolve response body
- `gatewayUrl` opaque (no credentials)
- `deliveryMode: 'DIRECT'` for Xtream sources
- Gateway redirects to provider URL (default mode)
- Gateway proxy mode: returns `Content-Type: application/vnd.apple.mpegurl`
- Gateway proxy mode: rewrites segment URIs — no provider address or credentials in manifest
- `SESSION_EXPIRED` error category for unknown session
- `STREAM_URL_INVALID` error category for bad mediaId
- 400 with correlationId for no-availability case

---

## Known limitation — credentials in redirect Location header

Criterion 10 is **not satisfied** for the redirect (default) delivery path.

When the resolver issues `GET /playback/stream/{sessionId}` without `?proxy=1`, the server
responds with `302 Location: https://{provider}/movie/{user}/{pass}/{streamId}.m3u8`. The
Xtream username and password are visible in the browser's DevTools Network panel and browser
history.

**Why the redirect exists**: Railway datacenter IPs are blocked by the Xtream provider's
Cloudflare layer (HTTP 403). The redirect forces the viewer's browser to fetch the stream
directly from a residential/office IP, bypassing the Cloudflare block.

**Why proxy mode doesn't solve it**: With `?proxy=1`, the server fetches the stream itself
(Railway IP → Cloudflare 403). Hiding credentials requires provider-side support for
short-lived tokens or signed URLs, which is out of scope for this ticket.

The integration test `redirects to provider when proxy mode is off (default)` now explicitly
asserts that credentials ARE present in the `Location` header, documenting this behaviour
rather than misrepresenting it as fixed.

A future ticket should either negotiate short-lived Xtream tokens with the provider or
implement an HTTPS signed-redirect layer in the IPTVFlix API that does not touch Railway's
Cloudflare-blocked IP.

---

## What is blocked / requires manual action

### Phase 1 — Upstream stream validation
- Requires real Xtream source credentials from production DB
- Commands to run from Railway: `curl -I`, `ffprobe`, `ffmpeg -t 30` on the real stream URL

### Phase 5 — Railway runtime
- Verify `ffmpeg -version` and `ffprobe -version` on Railway API service
- Verify Xtream upstream reachability from Railway (expected: Cloudflare 403 = redirect strategy correct)
- Verify Railway replica count (single instance or session affinity required for HLS)

### Phase 6 — Browser network inspection
- Real browser session with DevTools capture
- `X-Correlation-ID` in resolve response header
- Manifest + segment request sequence
- Verify video element plays

### Phase 8 — Cross-device
- Desktop Chrome, Android Chrome, iPhone Safari
- Moving video + audio confirmed OR exact error documented with evidence

---

## Acceptance criteria status

| # | Criterion | Status |
|---|-----------|--------|
| 1 | Real Xtream upstream proven reachable + decodable | BLOCKED |
| 2 | Xtream VOD URL construction proven correct | ✅ DONE (18 unit tests) |
| 3 | Correlation trace from Regarder through all layers | ✅ DONE (instrumented; real trace blocked) |
| 4 | Final IPTVFlix media URL independently validated | BLOCKED |
| 5 | HLS manifest + segments resolve correctly | BLOCKED |
| 6 | Railway: ffmpeg/ffprobe + Xtream reach | BLOCKED |
| 7 | Golden-path movie plays in real browser | BLOCKED |
| 8 | Desktop Chrome validated | BLOCKED |
| 9 | Android/iPhone validated or blocker documented | BLOCKED |
| 10 | No credentials in browser-visible URLs/logs | ⚠️ KNOWN LIMITATION — see below |
| 11 | Typed error category + correlationId in error responses | ✅ DONE |
| 12 | `xtream-vod-url.test.ts` + `playback-integration.test.ts` pass | ✅ DONE |
| 13 | `GET /playback/diag/:availabilityId` works | ✅ DONE |
