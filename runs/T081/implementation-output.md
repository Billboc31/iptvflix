## Implementation complete

All 4 plan changes are implemented and verified. Here's a summary:

---

### Files modified

| File | Change |
|---|---|
| `apps/api/src/routes/playback.ts` | Removed `isSafariOrIOS` from import and from `useCompat` expression (line 206). Added `-analyzeduration 5000000 -probesize 5000000` before `-i pipe:0` in `runFfmpegStream`. |
| `apps/api/src/services/playback-compat.ts` | Added `-max_interleave_delta 0` to `OUTPUT_FLAGS` in `buildFfmpegArgs`. |
| `apps/api/src/index.ts` | Removed `diagnosticsRoutes` import and `app.register(diagnosticsRoutes)`. |
| `apps/api/src/routes/diagnostics.ts` | **Deleted** (temporary diagnostic route, security risk). |
| `apps/api/src/routes/__tests__/playback-gateway.test.ts` | Added mocks for `probeMedia`/`getProbe`/`setProbe`. Added describe block `'compat path selection — structural defect regression (T081)'` with 4 regression tests. |
| `apps/api/src/__tests__/playback-compat.test.ts` | Added 2 tests asserting `-max_interleave_delta 0` is in REMUX and TRANSCODE_AUDIO args. |
| `apps/api/src/__tests__/playback-stream-compat.test.ts` | Updated 4 tests that relied on the old broken Safari-UA trigger to use `?compat=1` instead. |

---

### Test results

- **828 tests pass** across 59 files
- **5 pre-existing failures** in `vertical-slice.test.ts` and `title-matching-service.test.ts` — confirmed identical failures in T080 (the baseline), unrelated to playback

### Root cause fix (T080 reference)

> `playback.ts:207`: `isSafariOrIOS(userAgent)` was OR-ed into `useCompat`, so both the initial `gatewayUrl` request and the `?compat=1` retry hit the exact same compat code path. The auto-retry was a no-op. Fix: `useCompat = request.query.compat === '1'` — the initial request uses extension-based routing, the retry genuinely tries the probe-classified ffmpeg path.

---

**BLOCKING MANUAL ACCEPTANCE CHECK**: iPhone/Safari production playback of the real Xtream stream must be validated by the user on a real device before this ticket can be considered fully resolved. Automated tests pass; production confirmation is pending.
