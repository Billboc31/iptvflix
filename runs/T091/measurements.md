# T091 — VOD streaming measurements

## Test setup

- **Source**: [fill in Xtream VOD URL / movie title — requires manual run]
- **Device**: [browser + OS + network type — requires manual run]
- **Reference client**: [TiviMate / IPTV Smarters / VLC]

---

## Root cause analysis (static — derived from code review, no runtime required)

These causes were identified by reviewing the codebase before T091 changes.

| Root cause | Location | Evidence |
|---|---|---|
| HLS.js forward buffer capped at 30 s | `PlayerPage.tsx` (pre-T091) | `maxBufferLength: 30` — browser rebuilds buffer every 30 s, each rebuild risks stall |
| No upper buffer ceiling | `PlayerPage.tsx` (pre-T091) | `maxMaxBufferLength` absent — HLS.js defaults cap prevents pre-buffering large segments |
| ffmpeg startup scans 5 MB before emitting first packet | `providers/xtream/playback.ts` (pre-T091) | `-probesize 5000000 -analyzeduration 5000000` delays first segment by ~2–4 s on slow sources |
| Session expires mid-movie (2 h limit) | `playback-session-store.ts` (pre-T091) | TTL 2 h — a 3-hour movie mid-session triggers 404, player reloads from zero |
| HLS segment cache evicted too early (500 max segments) | `hls-session-store.ts` (pre-T091) | At ~4 s/segment, 500 segments = ~33 min; seek backward past that returns 410 |
| HLS playlist served with `no-cache` | `routes/playback.ts` (pre-T091) | Forces a fresh playlist fetch on every HLS.js poll (~every 2 s) — redundant I/O |
| No retry on transient segment errors | `routes/playback.ts` (pre-T091) | Single provider timeout → 504 → HLS.js stall, no automatic recovery |
| Retry fires even when client disconnected | `routes/playback.ts` (pre-T091, minor) | AbortError on client close classified as `retriable: true` → wasted provider fetch |

---

## Code-level before/after (T091 changes — no runtime required)

| Parameter | Before T091 | After T091 | Expected effect |
|---|---|---|---|
| `maxBufferLength` | 30 s | 60 s | Browser keeps a 60 s ahead-buffer; fewer mid-stream stalls |
| `maxMaxBufferLength` | (default ~600 s but effective cap) | 180 s explicit | Prevents unbounded memory use; allows comfortable pre-buffer |
| `lowLatencyMode` | (default false) | false explicit | VOD path — no latency-reduction overhead |
| `progressive` | (absent) | true | HLS.js pre-fetches next segment sooner |
| ffmpeg `-probesize` | 5 000 000 | 500 000 | ~10× faster container detection → faster TTFF on HLS_REMUX |
| ffmpeg `-analyzeduration` | 5 000 000 | 500 000 | Same; duration analysis shorter |
| Segment proxy highWaterMark | (default 16 KB) | 256 KB | Larger chunks per write → fewer round-trips, better backpressure |
| Segment timeout | 30 s (shared) | 15 s (dedicated) | Faster failure detection; retry fires within 15 s instead of 30 s |
| Segment retry on timeout / 5xx | none | 1 retry after 1 s | Single transient error no longer visible to player |
| Retry on client disconnect | always | skipped when socket destroyed | Avoids wasted provider fetch when client is gone |
| Playback session TTL | 2 h | 4 h | No mid-movie session expiry for films up to 4 h |
| HLS session TTL | 2 h | 3 h | Longer rewind window |
| HLS max segments | 500 (~33 min) | 1 500 (~100 min) | Long-form VOD can seek backward past the 33-min mark |
| HLS playlist Cache-Control | `no-cache` | `max-age=4, public` | CDN / browser caches playlist for 4 s; cuts redundant requests |

---

## Before (runtime baseline — REQUIRES MANUAL MEASUREMENT)

> Measure on the branch BEFORE this T091 commit is present (e.g. parent commit `fe9b49b`).
> Use the same real Xtream VOD, device, network, and browser as the "After" run.

| Metric | IPTVFlix (pre-T091) | Reference client |
|---|---|---|
| Time to first frame (s) | | |
| TTFB on first HLS segment (ms) | | |
| Average download throughput (Mbps) | | |
| Rebuffer count over 10 min | | |
| Rebuffer total duration (s) | | |
| HLS.js buffer level at steady state (s) | | |
| Playback path (DIRECT / HLS_REMUX / RAILWAY relay) | | n/a |
| Delivery mode visible in DevTools | | |

## After (runtime — REQUIRES MANUAL MEASUREMENT)

> Measure on this branch (`ticket/T091-*`), same source/device/network.

| Metric | IPTVFlix (T091) | Reference client |
|---|---|---|
| Time to first frame (s) | | target: < before |
| TTFB on first HLS segment (ms) | | |
| Average download throughput (Mbps) | | |
| Rebuffer count over 10 min | | target: 0 or fewer than before |
| Rebuffer total duration (s) | | |
| HLS.js buffer level at steady state (s) | | target: ~60 s |
| Playback path | | n/a |

---

## Phase-by-phase observations (runtime — REQUIRES MANUAL VERIFICATION)

### Phase 1 — HLS.js buffer tuning
- maxBufferLength 30→60 s, maxMaxBufferLength 180 s, progressive: true
- [ ] Buffer level reaches 60 s during steady playback (check HLS.js stats / Network tab)
- [ ] No `progressive` key warning in browser console (HLS.js version compat)

### Phase 2 — ffmpeg startup (-analyzeduration / -probesize 5MB→500KB)
- [ ] Time to first frame faster on HLS_REMUX stream (compare server log `ffmpeg_start` → first segment written)

### Phase 3 — Segment proxy (highWaterMark 256 KB, timeout 15 s, retry)
- [ ] No Node process memory growth over 30-min session
- [ ] Segment timeouts trigger single retry before failing to client (check API logs)
- [ ] Retry does NOT fire when browser tab is closed (socket.destroyed guard)

### Phase 4 — Session TTL (4 h playback, 3 h HLS, 1500 max segments)
- [ ] 3-hour movie does not 404 mid-playback

### Phase 5 — HLS playlist Cache-Control (max-age=4, public)
- [ ] Network tab shows 304 on repeated playlist polls within 4 s window

### Phase 6 — No duplicate source reloads
- [ ] No `hls.loadSource()` called more than once per play session during normal playback
- [ ] `useProgressSync` does not cause player remount

---

## Known limits

- Runtime measurements in the table above require a real Xtream subscription and a comparable native IPTV client. The AI coder cannot execute these.
- Railway CPU/memory bottlenecks are not covered by these changes.
- ABR / quality selection is out of scope for T091.
- `progressive: true` behavior depends on the HLS.js version in use — verify no console warning.
