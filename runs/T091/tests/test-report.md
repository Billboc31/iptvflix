Here is the test report summary:

---

## T091 — Test Report

### Code verification: all changes confirmed ✅

Every planned change is in place and matches the spec:

| Phase | Change | Status |
|---|---|---|
| 1 HLS.js buffer | `maxBufferLength: 60`, `maxMaxBufferLength: 180`, `lowLatencyMode: false`, `progressive: true` | ✅ |
| 2 ffmpeg probe | `-analyzeduration 500000 -probesize 500000` (from 5 MB) | ✅ |
| 3 Backpressure | `highWaterMark: 256 * 1024` on direct-stream pipe | ✅ |
| 3 Segment timeout/retry | `SEGMENT_TIMEOUT_MS = 15_000`, 1-retry + `socket?.destroyed` guard | ✅ |
| 4 Session TTLs | Playback 4 h, HLS 3 h, `MAX_SEGMENTS = 1500` | ✅ |
| 5 Cache-Control | `max-age=4, public` on HLS playlists | ✅ |
| 6 No duplicate reload | Effect deps `[gatewayUrl, deliveryMode, containerExtension]` — progress sync not included | ✅ |

`progressive: true` is a valid HLS.js 1.7.x config key (confirmed in bundled source).

### Test suite: no regressions ✅

- API: **848/853 passing** — same 5 pre-existing failures as before T091 (vertical-slice scheduler race, title-matching, playback-resolver)
- Web: **337/337 passing**
- T091-specific store tests: **19/19 passing**

### Minor finding

The segment proxy pipe (`routes/playback.ts:298`) does not carry a `highWaterMark` — only the direct-stream pipe does. Non-blocking; not in scope per the plan.

### Blocking gap — runtime measurements required

**ACs 2, 6, 9 and the ticket's completion rule cannot be satisfied by AI.** The runtime tables in `runs/T091/measurements.md` are empty. The ticket's own rule says: *"Do not close based on synthetic unit tests. Run a real long movie for enough time to observe buffering and compare before/after."*

**Required human action before closing:** play the same real Xtream VOD on this branch for 10+ minutes, fill in the before/after tables in `runs/T091/measurements.md`, and confirm seek/pause/resume work in the browser.

**Verdict: CONDITIONAL PASS** — implementation is complete and correct; ticket closure requires human runtime verification.
