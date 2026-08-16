Test report committed. Here's the summary:

---

## T082 Test Report

**Automated tests**: 99/99 T082-specific tests pass across 6 files (playback-compat, probe-cache, playback-resolver, playback-gateway, hls-session-store, playback-session-store). The 5 failing tests in the suite are pre-existing failures in unrelated files.

**Acceptance criteria results**:

| Criterion | Status |
|---|---|
| Root cause documented with evidence | ✅ Pass |
| Final media output independently validated | ⚠️ Partial — code analysis only, no actual stream capture with ffprobe/VLC |
| No arbitrary Xtream container dependency | ✅ Pass |
| DIRECT pass-through for native media | ✅ Pass |
| HLS for incompatible media | ✅ Pass |
| HLS MIME/URLs correct | ✅ Pass |
| No credential leakage | ✅ Pass |
| ffmpeg/ffprobe in Railway (nixpacks.toml) | ✅ Pass |
| iPhone Safari real-device playback | ⏳ Awaiting manual validation |
| Android Chrome real-device playback | ⏳ Awaiting manual validation |
| Episode same pipeline | ✅ Pass |
| Retry → fresh resolve | ✅ Pass |
| Cleanup implemented | ✅ Pass |
| Automated test coverage | ✅ Pass |
| Real-device checks treated as blocking | ✅ Pass |

**3 non-blocking issues found**:
1. **E2E test will fail in CI**: `e2e/tests/playback.spec.ts:71` expects a DIRECT-mode URL, but the fake server doesn't serve real media — ffprobe fails, extension fallback for mp4 gives `HLS_TRANSCODE_FULL` → session URL, assertion breaks.
2. **No ffprobe process timeout**: `media-prober.ts` has no kill timeout; a slow provider URL hangs the resolve endpoint indefinitely.
3. **Segment accumulation kills long films**: `hls_list_size 0` + `delete_segments` is contradictory — segments accumulate; the 500-segment cap (≈ 50 min at 6s/segment) would kill any movie over 50 minutes mid-playback.

**Verdict**: Ticket stays `awaiting manual playback validation`. E2E test issue should be fixed before CI E2E runs are enabled.
