# T050 — Secure Web Playback Flow from Selected Availability

## Objective

Add a backend playback-resolution endpoint that revalidates a profile's preferred Availability server-side and returns a credential-isolated playback descriptor, then wire a web `<video>` player that consumes that descriptor, syncs progress, and allows manual variant selection.

## Included

### API contracts — `packages/api-contracts/src/playback.ts` (new)

- `PlaybackResolveRequest`: `{ availabilityId?: string }` (optional explicit override)
- `PlaybackSessionResponse`: `{ streamUrl: string; availabilityId: string; startPositionSeconds: number; alternatives: AvailabilityVariantResponse[] }`
  - `streamUrl` is the only place credentials-bearing URLs appear; this type is kept out of all catalog/detail DTOs.
  - Export from `packages/api-contracts/src/index.ts`.

### Provider playback modules

- `apps/api/src/providers/xtream/playback.ts` (new)
  - `buildXtreamStreamUrl(baseUrl, username, password, providerItemId, ext?)` → returns stream URL (`{baseUrl}/{username}/{password}/{id}.{ext}`)
  - `ext` defaults to `ts`; no logging of the returned URL.

- `apps/api/src/providers/m3u/playback.ts` (new)
  - `buildM3UStreamUrl(streamUrl)` → returns the raw `streamUrl` from the availability record (already stored, no extra credentials needed).

### Playback resolver service — `apps/api/src/services/playback-resolver.ts` (new)

- `resolvePlayback(db, profileId, mediaType, mediaId, explicitAvailabilityId?)` → `PlaybackSessionResponse`
  - Loads profile preferences from DB.
  - Loads all `AVAILABLE` availability rows for the media item, joined with their source (`enabled = true` only).
  - If `explicitAvailabilityId` is provided, validates it is in the candidate set; rejects with a typed error if not found, not AVAILABLE, or source is disabled.
  - Otherwise delegates to `resolveVariant()` (existing `availability-resolver.ts`) for default selection.
  - Fetches current `viewingProgress.progressSeconds` for resume position (default 0).
  - Dispatches to `buildXtreamStreamUrl` or `buildM3UStreamUrl` based on source `kind`.
  - Returns `PlaybackSessionResponse`; never logs `streamUrl`.

### Playback route — `apps/api/src/routes/playback.ts` (new)

- `POST /playback/resolve/:mediaType/:mediaId`
  - Protected by existing `authenticate` JWT middleware (same scope as catalog routes).
  - Body: `PlaybackResolveRequest`.
  - Calls `resolvePlayback()`; maps typed errors to HTTP 400/404/403.
  - On resolution failure, returns `{ error: 'Variant not available' }` — no provider internals.

- Register in `apps/api/src/index.ts` inside the authenticated scope (alongside `watchlist`, `progress`, etc.).

### Web frontend — player page

- `apps/web/src/pages/PlayerPage.tsx` (new)
  - Full-screen `<video>` element; loads HLS via `hls.js` if `streamUrl` ends in `.m3u8`, otherwise sets `src` directly.
  - Receives `mediaType` + `mediaId` from URL params; optional `availabilityId` from query string.
  - On mount: calls `resolvePlayback()` API → gets `streamUrl`, `startPositionSeconds`, `alternatives`.
  - Sets `video.currentTime = startPositionSeconds` on `loadedmetadata`.
  - Loading spinner while resolving; `ErrorState` (existing component) on failure.
  - Variant selector: shown when `alternatives.length > 0`; clicking a variant re-resolves with that `availabilityId`.
  - Back navigation: pause + navigate to detail page.

- `apps/web/src/hooks/usePlayback.ts` (new)
  - Calls `resolvePlayback(mediaType, mediaId, availabilityId?)` on init.
  - Exposes `{ streamUrl, startPositionSeconds, alternatives, status, error, switchVariant }`.
  - On `switchVariant(id)`, re-invokes resolve with explicit `availabilityId`.

- `apps/web/src/hooks/useProgressSync.ts` (new)
  - Accepts `videoRef`, `mediaType`, `mediaId`, enabled flag.
  - On `timeupdate`, debounced to ≤ every 10 s, calls `upsertProgress()` (existing API client function).
  - On `ended`, sends a final update at full duration.

- `apps/web/src/lib/api.ts` — add `resolvePlayback(mediaType, mediaId, body)` typed function (mirrors existing pattern).

### Routing & Play button wiring

- `apps/web/src/App.tsx`: add `/player/:mediaType/:mediaId` route, protected, no `AppShell`.
- `apps/web/src/pages/MovieDetailPage.tsx`: wire existing "Play" button to `navigate('/player/movie/:id')` (append `?availabilityId=` if user has selected a non-default variant).
- `apps/web/src/pages/SeriesDetailPage.tsx`: add "Play" button per episode row navigating to `/player/episode/:episodeId`.

### Tests

- `apps/api/src/services/__tests__/playback-resolver.test.ts` (new)
  - Preferred-variant selection (delegates to `resolveVariant`).
  - Explicit `availabilityId` accepted when valid.
  - Explicit `availabilityId` rejected when status ≠ AVAILABLE.
  - Explicit `availabilityId` rejected when source is disabled.
  - Resume position taken from `viewingProgress`.
  - `streamUrl` is not present in any logged output (spy on logger).
  - Both Xtream and M3U URL builders produce expected URL shape without credentials in errors.

## Excluded

- DRM-protected providers.
- Adaptive transcoding or backend stream proxying.
- Full Android TV player (the contract is designed to support it, but no Kotlin implementation here).
- Live TV channels.
- Real-time Xtream credential refresh or token rotation.
- Player UI beyond play/pause, loading, error, resume, and variant selection (no subtitles UI, no fullscreen API wiring beyond CSS).
- Any change to general catalog/detail DTOs (stream URLs must never appear there).

## Acceptance criteria

- `POST /playback/resolve/movie/:id` returns `streamUrl` for a profile with a matching AVAILABLE variant.
- `POST /playback/resolve/episode/:id` returns `streamUrl` for a matching episode availability.
- Submitting a disabled or UNAVAILABLE `availabilityId` returns HTTP 400/403; no provider URL or credential appears in the response body.
- `streamUrl` does not appear in any catalog/detail endpoint (`GET /movies/:id`, `GET /series/:id`, episode list).
- No call to the resolver logs a credential-bearing URL (verified by logger spy in tests).
- `startPositionSeconds` reflects the stored `viewingProgress` value when one exists.
- The web player navigates to `/player/movie/:id`, resolves the session, and sets `video.currentTime` from `startPositionSeconds`.
- Periodic `PUT /progress` calls update viewing progress while playing; `GET /continue-watching` reflects the updated position.
- When `alternatives` is non-empty, the variant selector is visible and switching variant re-resolves without a full page reload.
- `resolvePlayback` tests cover: preferred selection, explicit variant (valid + invalid), disabled source, resume position, secret redaction.
- `tsc --noEmit` and `vitest run` pass with no new errors or skipped tests.
