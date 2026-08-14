## Test Report — T079

**Overall verdict: PASS** (with one unverifiable criterion requiring real device)

---

### Test execution

```
pnpm --filter api exec vitest run playback-compat.test.ts probe-cache.test.ts playback-stream-compat.test.ts
→ 38 passed / 0 failed
```

The 5 failures in the full suite (`vertical-slice.test.ts`, `title-matching-service.test.ts`) are pre-existing — confirmed by reverting T079 changes with `git stash` and reproducing them identically.

---

### Acceptance criteria

| Criterion | Status |
|-----------|--------|
| Real iPhone/Safari plays after deployment | ⚪ **CANNOT VALIDATE** — needs real device |
| Safari/iOS not served undecodable format | ✅ PASS |
| Media probed by actual codecs | ✅ PASS (`ffprobe` via `media-prober.ts`) |
| Compatible media stays on direct path | ✅ PASS |
| Remux preferred over transcode | ✅ PASS |
| Transcode only when codec incompatible | ✅ PASS |
| ffmpeg/ffprobe deployable on Railway | ✅ PASS (`nixpacks.toml` declares `nixPkgs = ["ffmpeg"]`) |
| Fallback automatic from single `Regarder` | ✅ PASS (`PlayerPage.tsx:99-116` auto-retries on `MEDIA_ERR_DECODE`) |
| Frontend receives browser-compatible URL | ✅ PASS (`compatGatewayUrl` in contract + resolver) |
| Retry/error UX improved | ✅ PASS (`'Impossible de lire ce contenu sur ce navigateur'` replaces generic dead-end) |
| Resume/seek functional where supported | ✅ PARTIAL — Range forwarded for `DIRECT` path only; REMUX/TRANSCODE pipe-streamed fMP4 cannot seek |
| Credentials never logged | ✅ PASS (test `'provider URL does not appear in any log call'` passes) |
| Automated tests cover matrix + fallback | ✅ PASS (38 tests) |

### Gaps (non-blocking)

- No automated test for seek/Range in REMUX/TRANSCODE paths (acknowledged in plan as "where technically feasible")
- No automated test for upstream failure HTTP codes (502/404/401/504) — route code handles them but untested
- Variant fallback (Requirement 9) deferred from scope per plan

### Non-blocking observations (pre-existing)

- `ffmpeg.stdin` has no error handler in `runFfmpegStream` — potential unhandled EPIPE under load
- Inline REMUX block in `playback.ts:312-365` duplicates `runFfmpegStream()` logic

Report saved to `runs/T079/tests/test-report.md`.
