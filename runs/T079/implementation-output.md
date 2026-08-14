All tasks complete. Here's the summary:

---

## T079 — Implementation complete

### Files created (5 new)
| File | Purpose |
|---|---|
| `apps/api/nixpacks.toml` | Declares `pkgs.ffmpeg` for Railway/Nixpacks — ensures binary is available at deploy time |
| `apps/api/src/services/media-prober.ts` | `probeMedia(url)` — spawns ffprobe, returns `{ videoCodec, audioCodec, containerFormat }` |
| `apps/api/src/services/probe-cache.ts` | 24-hour in-memory cache keyed by `availabilityId` — prevents re-probing on every play |
| `apps/api/src/services/playback-compat.ts` | `isSafariOrIOS()`, `classifyDelivery()` → `DeliveryMode`, `buildFfmpegArgs()` |
| `apps/api/src/__tests__/playback-compat.test.ts` | 21 tests covering UA detection, all delivery mode classifications, all ffmpeg arg sets |
| `apps/api/src/__tests__/probe-cache.test.ts` | 7 tests: hit, miss, TTL expiry, overwrite, independence |
| `apps/api/src/__tests__/playback-stream-compat.test.ts` | 9 integration tests: each DeliveryMode triggers correct ffmpeg args, no provider URL in logs, probe cache hit skips probeMedia, non-Safari bypasses compat, client disconnect kills ffmpeg |

### Files modified (5)
| File | Change |
|---|---|
| `packages/api-contracts/src/playback.ts` | Added `compatGatewayUrl: string` to `PlaybackSessionResponse` |
| `apps/api/src/services/playback-resolver.ts` | Returns `compatGatewayUrl = gatewayUrl + '?compat=1'` |
| `apps/api/src/routes/playback.ts` | Added compat path: probes + classifies on Safari UA or `?compat=1`, routes to REMUX/TRANSCODE_*/DIRECT; extracted `runFfmpegStream()` helper; all ffmpeg processes killed on disconnect |
| `apps/web/src/hooks/usePlayback.ts` | Exposes `compatUrl` from resolve response |
| `apps/web/src/pages/PlayerPage.tsx` | Auto-retries with `compatUrl` on `MEDIA_ERR_DECODE`/`MEDIA_ERR_SRC_NOT_SUPPORTED` before showing error; `Réessayer` resets and retries from primary URL |

### Test results
- **37 new tests — all pass**
- Pre-existing failures unchanged (6 tests in `vertical-slice`, `title-matching-service`, `scheduler-service` — all unrelated to this ticket)
- Web TypeScript: clean
- API TypeScript: 1 pre-existing error in `authenticateDevice.test.ts` (unrelated)
