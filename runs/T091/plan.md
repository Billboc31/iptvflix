## Objective

Identify and fix the IPTVFlix-specific overhead that causes more buffering than a native IPTV client on the same source, without regressing the existing direct/HLS delivery path or seekability.

## Included

### Phase 0 — Measurement baseline (required before any change)

Play the same real Xtream VOD in both IPTVFlix and a reference IPTV client (e.g. TiviMate, IPTV Smarters) on the same device/network. Record:
- time to first frame;
- DevTools Network waterfall: TTFB, download throughput, request count;
- HLS.js buffer level (exposed via `hls.on(Hls.Events.STATS_UPDATE, …)` log or the existing debug panel);
- rebuffer count and duration over 5-10 minutes;
- whether playback is DIRECT (client → Xtream) or routed through Railway.

Document findings in `runs/T091/measurements.md` (before values). Repeat after each phase to confirm improvement.

---

### Phase 1 — Frontend HLS.js buffer tuning

**File:** `apps/web/src/pages/PlayerPage.tsx` (lines ~184–202)

- Increase `maxBufferLength` from `30` → `60` seconds.
- Add `maxMaxBufferLength: 180` to cap the absolute ceiling.
- Add `lowLatencyMode: false` (ensure it is off for VOD; default is false but make it explicit).
- Add `progressive: true` to start playback as soon as the first segment is available.
- Keep `enableWorker: true` (already set).

These settings give HLS.js more headroom to pre-buffer and survive transient network dips without stalling.

---

### Phase 2 — ffmpeg startup latency reduction (applies to HLS_REMUX / HLS_TRANSCODE paths)

**File:** `apps/api/src/providers/xtream/playback.ts` (lines ~239–240)

- Lower `-analyzeduration` from `5000000` (5 MB) → `500000` (500 KB).
- Lower `-probesize` from `5000000` → `500000`.

Most container metadata is in the first 100–200 KB; reducing these values cuts 1–3 s of ffmpeg pre-analysis before the first segment appears. Apply only for Xtream input args function; verify the change does not break codec detection by running probe-based delivery-mode selection against a real stream.

---

### Phase 3 — Segment proxy: backpressure and highWaterMark

**File:** `apps/api/src/routes/playback.ts` (lines ~215, ~254)

Direct-stream proxy (line ~215):
- Wrap `Readable.fromWeb(streamBody)` with an explicit `highWaterMark` of `256 * 1024` (256 KB) to prevent the Node read buffer from draining too far ahead of the client, which wastes Railway egress and causes large in-flight gaps.

Segment proxy timeout (line ~254):
- Reduce per-segment timeout from `30 s` → `15 s` (30 s is too long to detect a dead segment silently).
- Add basic retry: on timeout or 5xx from upstream, retry the same segment URL once after 1 s before failing. HLS.js will handle the rest with its own error recovery.

---

### Phase 4 — Session TTL and HLS segment limits

**File:** `apps/api/src/services/playback-session-store.ts` (line ~4)
- Increase `TTL_MS` from 2 hours → 4 hours to cover long movies without mid-session expiry.

**File:** `apps/api/src/services/hls-session-store.ts` (lines ~10, ~183)
- Increase `TTL_MS` from 2 hours → 3 hours.
- Increase `MAX_SEGMENTS` from `500` → `1500` (at 6 s/segment, 500 = ~50 min; 1500 = ~2.5 h).

---

### Phase 5 — HLS playlist Cache-Control

**File:** `apps/api/src/routes/playback.ts` (the route that serves `master.m3u8` / segment playlists)

- Change `Cache-Control: no-cache` on playlist responses to `Cache-Control: max-age=4, public`.
- Segment responses remain uncacheable (binary, single-use).

This eliminates one extra RTT per playlist poll (HLS.js polls every ~target duration seconds).

---

### Phase 6 — Validate no duplicate source reloads

**File:** `apps/web/src/pages/PlayerPage.tsx` (HLS.js load call and React effect deps)

- Audit the `useEffect` that calls `hls.loadSource(…)`: confirm the source URL is stable across renders and does not change on progress-sync state updates.
- Confirm `useProgressSync` hook changes do not cause the parent component to remount the player.
- No code change expected here — this is a verification step. If a re-render bug is found, fix the effect dependency array.

---

### Tests / validation

- After Phase 1: observe HLS.js `maxBufferLength` metric in DevTools; confirm buffer stays at 60 s during steady playback.
- After Phase 2: compare time-to-first-frame before/after on an HLS_REMUX stream.
- After Phase 3: confirm Node process memory stays stable over a 30-minute session (no buffer accumulation).
- After Phase 4: start a 3-hour movie, verify session does not 404 at the 2-hour mark.
- After Phase 5: observe Network tab; playlist requests should return `304 Not Modified` within their max-age window.
- Final: run the same real movie for 10+ minutes in IPTVFlix and record after-measurements; compare to baseline in `runs/T091/measurements.md`.

## Excluded

- ABR (Adaptive Bitrate) policy changes in HLS.js — no multi-bitrate ladder exists in the current Xtream direct stream; out of scope.
- Adding a quality selector UI — separate UX ticket.
- Media relay (`apps/media-relay`) changes — relay is an optional external component; optimizing it is a separate concern.
- Transcoding pipeline changes beyond the `-analyzeduration`/`-probesize` tweak — the goal is to avoid transcoding, not to optimize it.
- CDN or Railway infrastructure changes.
- Probe cache TTL changes.
- Any change to the provider fallback URL selection logic.
- `useProgressSync` refactor unless a re-render bug is confirmed in Phase 6.

## Acceptance criteria

- Baseline measurements documented in `runs/T091/measurements.md` before the first code change.
- `maxBufferLength` visible at 60 s in HLS.js stats during steady playback of a real Xtream VOD.
- ffmpeg first segment appears ≤ 1 s faster than baseline on a remux stream (measured via TTFB on `master.m3u8` response).
- No Node memory growth observed over a 30-minute direct-proxy session.
- A 3-hour VOD does not 404 mid-playback due to session expiry.
- Playlist responses carry `Cache-Control: max-age=4` and browser returns `304` on subsequent polls within the window.
- The real movie used in the baseline plays for 10+ minutes with zero or fewer rebuffer events than baseline on the same network/device.
- Seek, pause, and resume remain functional after all changes.
- No existing passing tests regressed.
- After-measurements documented alongside before-measurements in `runs/T091/measurements.md`.
