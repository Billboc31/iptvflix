# T087 — Railway runtime probe

**Status: COMPLETE — 2026-08-17**

API: `https://iptvflixapi-production.up.railway.app`  
Availability: `0dd848ec-310a-45d4-b29c-07105de5c9f2`

## diag response (sanitized)

```json
{
  "availabilityId": "0dd848ec-310a-45d4-b29c-07105de5c9f2",
  "upstreamReachable": false,
  "upstreamHttpStatus": 403,
  "upstreamContentType": "text/plain; charset=UTF-8",
  "upstreamIsMediaBody": false,
  "upstreamRedirectFinalUrl": "http://104.21.67.253/movie/[REDACTED]/[REDACTED]/344921.ts",
  "detectedContainer": null,
  "detectedVideoCodec": null,
  "detectedAudioCodec": null,
  "deliveryMode": "DIRECT",
  "ffmpegAvailable": true,
  "ffprobeAvailable": true,
  "sessionActive": true,
  "manifestReady": null,
  "segmentCount": null,
  "lastFfmpegError": null
}
```

## proxy attempt

`GET /playback/stream/:sessionId?proxy=1` → **502** with upstream **403** (Cloudflare).

## Analysis

| Field | Value |
|-------|-------|
| `upstreamHttpStatus` | **403** |
| `upstreamIsMediaBody` | **false** |
| ffmpeg/ffprobe on Railway | **true** (binaries present, unused because fetch fails) |
| **RAILWAY_PROVIDER_BLOCK_CONFIRMED** | **yes** |

Railway can talk to `player_api` (source test OK) but **cannot** pull VOD bytes through `cf.tviso.tech` (Cloudflare blocks datacenter egress). Origin CDN `http://185.245.1.217` was not reachable for probing from Railway without first obtaining the tokenized path (token only issued after a successful CF hop).
