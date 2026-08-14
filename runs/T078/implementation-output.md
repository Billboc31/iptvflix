All tasks complete. Here's a summary of everything implemented:

---

## Summary

### Files created
- `apps/api/src/services/playback-session-store.ts` — In-memory TTL session store (2h expiry), keeps provider URLs server-side
- `apps/api/src/services/__tests__/playback-session-store.test.ts` — 5 tests covering round-trip, TTL expiry, unknown ids
- `apps/api/src/routes/__tests__/playback-gateway.test.ts` — 10 tests covering 404/403 session validation, mp4 pass-through with Range, upstream error codes (401/403/404/504), ts remux
- `apps/web/src/components/player/PlayerControls.tsx` — Custom player overlay with play/pause, seek, volume, mute, fullscreen, time display, variants dropdown, close button, auto-hide after 3s

### Files modified
- `packages/api-contracts/src/playback.ts` — `streamUrl` → `gatewayUrl`
- `apps/api/src/services/playback-resolver.ts` — Creates session after building provider URL, returns `gatewayUrl: /api/playback/stream/:sessionId`; logs correlate `mediaId+availabilityId+sourceId` without credentials
- `apps/api/src/routes/playback.ts` — Added `GET /playback/stream/:sessionId`: mp4 pass-through (Range-aware), `.m3u8` pass-through, `.ts`/`.mkv` remux to fmp4 via ffmpeg (awaits first chunk before committing response; 415 if ffmpeg unavailable), upstream error → HTTP status mapping
- `apps/api/src/services/__tests__/playback-resolver.test.ts` — Updated all `streamUrl` assertions to `gatewayUrl`; added session store mock; credential-not-in-response assertions
- `apps/web/src/hooks/usePlayback.ts` — `streamUrl` → `gatewayUrl`
- `apps/web/src/pages/PlayerPage.tsx` — Switched to `gatewayUrl`, replaced native `controls` with `PlayerControls`, added error category display
- `apps/web/src/hooks/useProgressSync.ts` — Added `pause` event handler and unmount cleanup for final progress persistence
