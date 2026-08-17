# Phase 4 — Delivery Artifact Validation

**Status: BLOCKED / AWAITING REAL PLAYBACK VALIDATION**

## Delivery architecture for Xtream sources

For Xtream VOD movies, the resolver always uses:
- **Delivery mode:** DIRECT
- **Extension forced:** `m3u8`
- **URL pattern:** `https://{provider_host}/movie/{user}/{pass}/{streamId}.m3u8`
- **Gateway behaviour:** 302 redirect to provider URL (no proxy by default)

The browser receives the redirect and fetches the HLS manifest directly from the Xtream panel.

## Integration test validation (local fake server)

The integration test (`apps/api/src/__tests__/playback-integration.test.ts`) validates:

1. **Gateway proxy mode** (`?proxy=1`) — when proxying:
   - Returns HTTP 200 with `Content-Type: application/vnd.apple.mpegurl`
   - Rewrites segment URIs to `/playback/stream/{sessionId}/segment?uri=<base64>`
   - No credentials visible in the rewritten manifest
   - No provider address in the rewritten manifest

2. **Direct redirect** — default mode:
   - Returns HTTP 302
   - `Location` header points to the provider m3u8 URL

## What requires manual validation on the real provider

```bash
# After clicking Regarder in browser, note the session ID from the resolve response.

# 1. Test gateway redirect URL (from resolver response body.gatewayUrl):
curl -I https://{api-host}/playback/stream/{sessionId}
# Expected: 302 → Location: https://{xtream-provider}/movie/.../...m3u8

# 2. Test the redirected URL directly (from browser's perspective):
curl https://{xtream-provider}/movie/{user}/{pass}/{streamId}.m3u8
# Expected: 200, Content-Type: application/vnd.apple.mpegurl, valid M3U8 body

# 3. Parse segments from the manifest and test each:
# Each segment URL in the manifest must resolve to MPEG-TS bytes (not JSON/HTML).

# 4. Test via ffmpeg:
# ffmpeg -t 30 -i "https://{xtream}/movie/.../...m3u8" -f null -
# Expected: no fatal errors, >= 30s decoded
```

## Diagnostic endpoint

`GET /playback/diag/{availabilityId}` returns sanitized runtime state:
- upstream reachable, HTTP status
- cached probe result (container, video/audio codecs)
- delivery mode, session state
- manifest/segment count
- last ffmpeg error if any

No credentials are exposed in this response.
