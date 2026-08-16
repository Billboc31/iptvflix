All tasks complete. Here's the summary of what was implemented:

---

## Summary

**Files modified:**

| File | Change |
|---|---|
| `packages/api-contracts/src/playback.ts` | Added `DeliveryMode`, `PlaybackProbeResult`, `deliveryMode`, `probeResult` fields; removed `compatGatewayUrl` |
| `apps/api/src/services/playback-compat.ts` | Removed `isSafariOrIOS()`; updated `classifyDelivery()` to browser-agnostic 4-mode logic; updated `buildFfmpegArgs()` to emit HLS output with `tempDir` param |
| `apps/api/src/services/playback-session-store.ts` | Added `deliveryMode: DeliveryMode` to `SessionEntry` |
| `apps/api/src/services/playback-resolver.ts` | Added probe-at-resolve-time; `classifyDelivery()` determines mode; HLS sessions spawn ffmpeg pipeline; returns `deliveryMode` + `probeResult`; extension fallback on probe failure |
| `apps/api/src/routes/playback.ts` | Simplified `/stream/:id` to DIRECT-only (409 for HLS); added `/session/:id/master.m3u8` and `/session/:id/segments/:filename` HLS endpoints; removed compat path + extension routing |
| `apps/api/src/services/availability-resolver.ts` | Added `codecCompatibilityScore()` as lowest-priority tiebreaker (H.264→0, HEVC→1, VP9/AV1→2); added `videoCodec?` to `ResolvableVariant` |
| `apps/web/src/hooks/usePlayback.ts` | Replaced `compatUrl` with `deliveryMode`; removed compat state |
| `apps/web/src/pages/PlayerPage.tsx` | Unified Movie/Episode playback; removed compat fallback retry; HLS detection based on `deliveryMode` |
| `apps/api/src/index.ts` | Added startup checks: `ffmpeg -version`, `ffprobe -version`, tmpdir write test; exits with code 1 if any fail |

**Files created:**

| File | Purpose |
|---|---|
| `apps/api/src/services/hls-session-store.ts` | ffmpeg HLS session lifecycle: create/get session, playlist rewriting, segment path validation, TTL + background cleanup, segment accumulation limit |
| `apps/api/src/services/__tests__/hls-session-store.test.ts` | 13 tests covering SEGMENT_RE, session creation, playlist rewriting, segment validation, TTL/failure |
| `runs/T082/diagnosis.md` | Root cause documentation for cross-platform failure |

**Files deleted:**

- `apps/api/src/__tests__/playback-stream-compat.test.ts` — tests for the removed compat path

**Test results:** 119 playback-related tests pass; web typecheck clean; no new API typecheck errors introduced.

**Awaiting manual validation** before ticket closure (per plan): real device testing on iPhone Safari, Android Chrome, and Episode playback required.
