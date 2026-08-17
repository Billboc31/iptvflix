# T091 — VOD streaming measurements

## Test setup

- **Source**: [fill in Xtream VOD URL / movie title]
- **Device**: [browser + OS + network type]
- **Reference client**: [TiviMate / IPTV Smarters / VLC]

## Before (baseline — measure against the branch before T091 is merged)

| Metric | IPTVFlix | Reference client |
|---|---|---|
| Time to first frame (s) | | |
| TTFB on first HLS segment (ms) | | |
| Average download throughput (Mbps) | | |
| Rebuffer count over 10 min | | |
| Rebuffer total duration (s) | | |
| HLS.js buffer level at steady state (s) | | |
| Playback path (DIRECT / HLS_REMUX / RAILWAY relay) | | n/a |
| Delivery mode visible in DevTools | | |

## After (measure on this branch, same source/device/network)

| Metric | IPTVFlix | Reference client |
|---|---|---|
| Time to first frame (s) | | |
| TTFB on first HLS segment (ms) | | |
| Average download throughput (Mbps) | | |
| Rebuffer count over 10 min | | |
| Rebuffer total duration (s) | | |
| HLS.js buffer level at steady state (s) | | target: ~60 s |
| Playback path | | n/a |

## Phase-by-phase observations

### Phase 1 — HLS.js buffer tuning
- maxBufferLength 30→60 s, maxMaxBufferLength 180 s, progressive: true
- [ ] Buffer level reaches 60 s during steady playback

### Phase 2 — ffmpeg startup (-analyzeduration / -probesize 5MB→500KB)
- [ ] Time to first frame faster on HLS_REMUX stream

### Phase 3 — Segment proxy (highWaterMark 256 KB, timeout 30→15 s, retry)
- [ ] No Node process memory growth over 30-min session
- [ ] Segment timeouts trigger single retry before failing to client

### Phase 4 — Session TTL (4 h playback, 3 h HLS, 1500 max segments)
- [ ] 3-hour movie does not 404 mid-playback

### Phase 5 — HLS playlist Cache-Control (max-age=4, public)
- [ ] Network tab shows 304 on repeated playlist polls within 4 s window

### Phase 6 — No duplicate source reloads
- [ ] No hls.loadSource() called more than once per play session during normal playback
- [ ] useProgressSync does not cause player remount

## Known limits

- Measurements require a real Xtream subscription and a comparable native IPTV client.
- Railway CPU/memory bottlenecks are not covered by these changes.
- ABR / quality selection is out of scope for T091.
