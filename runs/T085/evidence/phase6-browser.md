# Phase 6 — Browser Network Inspection

**Status: BLOCKED / AWAITING REAL BROWSER VALIDATION**

## What to capture in browser DevTools

Open Chrome DevTools → Network panel, then click `Regarder` for the golden-path movie.

### Step 1: Resolve request
```
POST /api/playback/resolve/movie/{movieId}
```
Expected:
- Status: 200
- Response header: `X-Correlation-ID: {uuid}`
- Response body: `{ gatewayUrl, deliveryMode: "DIRECT", containerExtension: "m3u8", correlationId: "{uuid}", ... }`
- No Xtream username or password in response body

### Step 2: Gateway redirect
```
GET /api/playback/stream/{sessionId}
```
Expected:
- Status: 302 → Location: `https://{xtream_provider}/movie/{user}/{pass}/{streamId}.m3u8`
- Browser follows redirect automatically

### Step 3: Xtream HLS manifest (browser fetches directly)
```
GET https://{xtream_provider}/movie/{user}/{pass}/{streamId}.m3u8
```
Expected:
- Status: 200
- Content-Type: `application/vnd.apple.mpegurl` or `application/x-mpegurl`
- Body: valid M3U8 with `#EXTM3U` header

### Step 4: HLS segments
Each segment URL from the manifest:
- Status: 200
- Content-Type: `video/MP2T` or similar MPEG-TS type
- Real binary bytes (not JSON/HTML)

## Failure modes to diagnose

If playback fails, capture:
- `video.error.code` and `video.error.message` from the `<video>` element
- hls.js fatal/non-fatal errors in console (if applicable)
- CORS headers on manifest/segment responses
- Mixed-content warnings (HTTP resource on HTTPS page)
- 401/403 on segment requests (authentication issue)
- 404 on segments (wrong URL construction)

## Typed error categories now in API

If the API returns an error response, it now includes:
```json
{
  "error": "...",
  "errorCategory": "SOURCE_UNREACHABLE | SOURCE_AUTH_REJECTED | ...",
  "correlationId": "..."
}
```
The correlationId can be used to search Railway logs for the full server-side trace.

## Evidence to collect
- Screenshot of Network panel showing full request sequence
- Video element playing with moving video + audio (screen recording or screenshot)
- Any error codes if playback fails
