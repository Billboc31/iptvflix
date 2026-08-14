# Plan — T078: Make web playback actually play resolved Xtream streams end-to-end

## Objective

Introduce a backend streaming gateway that proxies Xtream provider media to the browser (eliminating CORS, mixed-content, and credential-exposure), remux non-browser-native containers (ts, mkv) on the fly via ffmpeg, and upgrade the existing `PlayerPage` with custom controls and actionable error display so that a real imported Movie and Episode can be played end-to-end from the web UI.

## Included

### 1. Playback session store (new)

**`apps/api/src/services/playback-session-store.ts`**
- In-memory TTL cache (`Map` + expiry, 2 h TTL) — no schema migration.
- Entry shape: `{ sessionId: uuid, profileId, mediaType, mediaId, availabilityId, sourceId, providerStreamUrl, containerExtension }`.
- Expose `createSession(data) → sessionId` and `getSession(sessionId) → entry | null`.
- Provider URL and credentials stay server-side; only `sessionId` leaves the process.

### 2. Playback resolver — return gateway URL (modify)

**`apps/api/src/services/playback-resolver.ts`**
- After building the provider URL, call `createSession()` and return `gatewayUrl: /api/playback/stream/${sessionId}` instead of the raw `streamUrl`.
- Keep existing availability selection, resume-position lookup, and variant list logic unchanged.
- Logging: correlate `mediaId + availabilityId + sourceId` on each resolve; do not log provider credentials or the full provider URL.

### 3. API contracts — add `gatewayUrl` (modify)

**`packages/api-contracts/src/playback.ts`** (or equivalent shared-types file)
- Add `gatewayUrl: string` to `PlaybackSessionResponse`.
- Deprecate / remove `streamUrl` from the public response type so the frontend cannot accidentally use the raw URL.

### 4. Streaming gateway endpoint (new)

**`apps/api/src/routes/playback.ts`** — add `GET /playback/stream/:sessionId`
- Require valid JWT (existing Fastify auth middleware).
- Validate `sessionId` belongs to the authenticated profile; reject 403 otherwise.
- Resolve entry from session store; 404 if expired or unknown.
- **Format dispatch:**
  - **`.m3u8`** — pass-through: reverse-proxy the manifest text, rewriting segment URLs to go through a companion `GET /playback/stream/:sessionId/segment?url=…` sub-route (or inline credential substitution) so HLS segments also flow through the gateway. If the manifest already uses relative URLs the browser will request them from the same origin and the gateway will handle them.
  - **`.mp4`** — pass-through with Range support: honour the `Range` request header, forward `Content-Type: video/mp4`, `Content-Length`, `Content-Range`, `Accept-Ranges: bytes`. Stream response body; do not buffer in memory.
  - **`.ts` / `.mkv`** — on-the-fly remux to fragmented MP4 (fmp4) using an ffmpeg child process (`ffmpeg -i pipe:0 -c copy -movflags frag_keyframe+empty_moov -f mp4 pipe:1`). Set `Content-Type: video/mp4`. Do not transcode audio or video codecs; if ffmpeg exits non-zero, return 415 Unsupported Media Type with a structured error body.
  - **Codec transcoding**: out of scope (see Excluded).
- Support upstream disconnect: abort the provider fetch and kill the ffmpeg child on client disconnect.
- Set upstream request timeout (30 s). Return 504 on timeout.
- Log at INFO level: sessionId, mediaId, availabilityId, sourceId, containerExtension, response status. Never log provider URL, username, or password.
- Return distinct HTTP status codes mapped to error categories (see §9 requirements).

### 5. PlayerPage — custom controls and error display (modify)

**`apps/web/src/pages/PlayerPage.tsx`**
- Replace `controls` native attribute with a custom overlay component.
- Switch from `streamUrl` to `gatewayUrl` when constructing the video source.
- Show a loading spinner while `readyState < HAVE_ENOUGH_DATA`.
- Show a buffering indicator on `waiting` event / hide on `playing`.
- On `error` event: decode `video.error.code` + gateway response status, display a user-facing category string (see error categories below).
- Resume from `startPositionSeconds` on `loadedmetadata` (already partially implemented; verify and keep).
- On unmount / route change: pause, persist final progress position via the existing `useProgressSync` hook.

**`apps/web/src/components/player/PlayerControls.tsx`** (new component)
- Play / pause toggle.
- Seek bar (input[type=range] bound to `currentTime` / `duration`); disable seek when duration is not finite (live).
- Volume slider + mute toggle.
- Fullscreen button (Fullscreen API).
- Current time / duration display (HH:MM:SS format).
- Variants dropdown (already wired in PlayerPage; move into this component).
- Close / back button: navigate(-1) and persist progress.

### 6. Entry-point audit (verify, minimal fix if needed)

Check each play entry point routes to `/player/:mediaType/:mediaId` with the correct `?availabilityId=` param:
- **HeroSection.tsx** `onPlay()` → `navigate('/player/movie/{id}')` — verify.
- **MovieDetailPage.tsx** `MediaActions` "▶ Lecture" → `navigate('/player/movie/{id}?availabilityId=...')` — verify.
- **EpisodeCard.tsx** "▶ Lire" → `navigate('/player/episode/{episodeId}?availabilityId=...')` — verify.
- **SeriesDetailPage.tsx** — confirm no orphaned "Regarder" button that triggers no navigation.

If any entry point calls resolve but does not navigate, wire it to PlayerPage. No new routes.

### 7. Progress persistence (verify and complete)

**`apps/web/src/hooks/useProgressSync.ts`**  
Currently debounces `PUT /progress/:mediaType/:mediaId` every 10 s. Verify:
- Hook is mounted in PlayerPage (attach if missing).
- Final `PUT` fires on `pause`, `ended`, and component unmount.
- `mediaType` / `mediaId` are passed correctly for both Movie and Episode.

No backend changes needed for progress — the upsert logic is already complete.

### 8. Error category mapping

Frontend must surface distinct strings for:

| Condition | Source | User message |
|---|---|---|
| No playable availability | resolver 404 | "Aucune version disponible" |
| Provider credentials expired | gateway 401/403 from upstream | "Source expirée — contactez l'administrateur" |
| Provider item not found | gateway 404 from upstream | "Média introuvable chez le fournisseur" |
| Upstream timeout | gateway 504 | "Fournisseur ne répond pas" |
| Unsupported container | gateway 415 | "Format non supporté par votre navigateur" |
| Browser decode failure | video.error code 3/4 | "Erreur de décodage vidéo" |

CORS and mixed-content must not appear as user-visible errors — they are eliminated by the gateway architecture.

### 9. Tests

**`apps/api/src/routes/__tests__/playback-gateway.test.ts`** (new)
- Mock upstream HTTP server (MSW or nock).
- Test: valid session → mp4 passthrough with Range header forwarded.
- Test: expired/unknown sessionId → 404.
- Test: wrong profile → 403.
- Test: upstream 401 → gateway 401 response with error body.
- Test: upstream timeout → 504.
- Test: ts container → 200 with `Content-Type: video/mp4` (mock ffmpeg spawn).

**`apps/api/src/services/__tests__/playback-session-store.test.ts`** (new)
- Test create / get session round-trip.
- Test expired session returns null.

**`e2e/tests/playback.spec.ts`** (new)
- Seed a fake Xtream server (reuse `e2e/fixtures/`) that serves a short mp4 clip.
- Import source, trigger sync, navigate to movie detail → click play.
- Assert PlayerPage renders, video `currentTime` advances beyond 0.
- Assert no browser console CORS or mixed-content errors.

**Existing tests to update:**
- `apps/api/src/services/__tests__/playback-resolver.test.ts` — update assertions that currently expect a raw `streamUrl`; assert `gatewayUrl` is returned instead, and that the raw provider URL is not present in the response.

## Excluded

- Live / IPTV channel playback (scope: VOD only per T078).
- Subtitle / caption rendering in the player.
- Audio or video codec transcoding (only container remux is in scope).
- DRM / Widevine / FairPlay.
- Send-to-TV / Chromecast integration (gateway is designed to be reusable; wiring it is not in scope here).
- Download / offline mode.
- Any provider type other than Xtream (M3U / Plex gateway is not in scope; M3U URLs are already HLS/mp4 and do not require a gateway for the browser case, but extending the gateway to M3U is a follow-up).
- Player analytics / telemetry beyond the existing viewing-progress model.
- HLS adaptive bitrate (ABR) variant switching at the gateway level.
- Production ffmpeg installation automation / Docker image changes (assumed ffmpeg is available; if not, 415 is returned gracefully).
- Database migration for playback sessions (in-memory store avoids migration risk).

## Acceptance criteria

- [ ] `GET /playback/stream/:sessionId` exists and requires a valid JWT; returns 403 for sessions belonging to a different profile, 404 for expired or unknown sessions.
- [ ] A real mp4 Xtream Movie can be played end-to-end in Chrome/Firefox from an HTTPS origin with no CORS or mixed-content browser error.
- [ ] A real mp4 Xtream Episode plays end-to-end through the same gateway flow.
- [ ] Seeking (HTTP Range) works for mp4 VOD: scrubbing the seek bar jumps to the correct position without re-downloading from the start.
- [ ] A ts or mkv availability returns `Content-Type: video/mp4` from the gateway; the browser plays the remuxed stream or receives a 415 with a human-readable error if ffmpeg is unavailable.
- [ ] Xtream credentials (username, password, provider base URL) do not appear in any browser-visible URL, network request, or `console.log` output.
- [ ] PlayerPage shows: loading spinner on initial load, buffering indicator on stall, play/pause/seek/volume/fullscreen controls, current time and duration, variant dropdown, and a close button.
- [ ] Each of the five play entry points (HeroSection, MovieDetailPage, SeriesDetailPage/EpisodeCard ×2) navigates to PlayerPage and produces a working playback session.
- [ ] Viewing progress is persisted via `PUT /progress/:mediaType/:mediaId` on pause, on ended, and on PlayerPage unmount; video resumes from the stored position on re-open.
- [ ] Switching variants in the player re-resolves through the gateway without navigating away from PlayerPage.
- [ ] Playback failures surface a distinct, readable category string to the user rather than a silent empty player.
- [ ] `playback-gateway.test.ts` and `playback-session-store.test.ts` pass in CI.
- [ ] `e2e/tests/playback.spec.ts` smoke test passes against the fake Xtream fixture server.
- [ ] `playback-resolver.test.ts` updated assertions pass (no raw provider URL in response).
