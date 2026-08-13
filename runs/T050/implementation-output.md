Implementation complete. Here's a summary of all files created or modified:

---

## Files created

**API contracts**
- `packages/api-contracts/src/playback.ts` — `PlaybackResolveRequest` and `PlaybackSessionResponse` types; `streamUrl` kept isolated from all catalog DTOs
- `packages/api-contracts/src/index.ts` — added `export * from './playback.js'`

**Provider URL builders**
- `apps/api/src/providers/xtream/playback.ts` — `buildXtreamStreamUrl` (no logging of credentials)
- `apps/api/src/providers/m3u/playback.ts` — `buildM3UStreamUrl` (pass-through of stored URL)

**Backend service & route**
- `apps/api/src/services/playback-resolver.ts` — `resolvePlayback(profileId, mediaType, mediaId, explicitAvailabilityId?)`: loads availabilities, filters by enabled sources, delegates to `resolveVariant` or validates explicit ID, fetches resume progress, dispatches to Xtream/M3U URL builders; never logs `streamUrl`
- `apps/api/src/routes/playback.ts` — `POST /playback/resolve/:mediaType/:mediaId` behind `authenticate`; maps typed errors to 400/403/404; no provider internals in responses
- `apps/api/src/index.ts` — registered `playbackRoutes` in the protected scope

**Web frontend**
- `apps/web/src/hooks/usePlayback.ts` — resolves playback session on mount, exposes `switchVariant`
- `apps/web/src/hooks/useProgressSync.ts` — debounced (10s) `timeupdate` + `ended` progress sync
- `apps/web/src/pages/PlayerPage.tsx` — full-screen `<video>`, HLS via `hls.js` if `.m3u8`, resume from `startPositionSeconds`, variant selector overlay
- `apps/web/src/lib/api.ts` — added `resolvePlayback()`
- `apps/web/src/App.tsx` — added `/player/:mediaType/:mediaId` route (protected, no AppShell)
- `apps/web/src/pages/MovieDetailPage.tsx` — added **▶ Lecture** button when `availabilityStatus === 'AVAILABLE'`
- `apps/web/src/components/detail/EpisodeRow.tsx` — added **▶ Lire** button per available episode

**Tests**
- `apps/api/src/services/__tests__/playback-resolver.test.ts` — 17 tests covering preferred selection, explicit variant (valid/invalid/disabled), resume position, M3U URL shape, Xtream URL shape, secret non-logging, and no-candidate error paths

**Result:** `tsc --noEmit` clean on both packages; `vitest run` — 44 test files, 623 tests, all green.
