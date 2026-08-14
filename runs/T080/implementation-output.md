The TypeScript error is pre-existing in an unrelated test file (`authenticateDevice.test.ts`) — not caused by my changes. The `playback.ts` modification itself is type-safe (same `DeliveryMode` type, same `runFfmpegStream` signature).

Here's what was done:

---

## Changes applied

### `apps/api/src/routes/playback.ts` (lines 423–453)

Replaced the legacy inline ffmpeg spawn block (which silently discarded all stderr) with a call to `runFfmpegStream('REMUX', ...)`. The legacy path now emits the same structured log fields as the compat path:
- `ffmpegPid`, `ffmpegArgs` (sanitized) at spawn
- `ffmpegExitCode`, `ffmpegExitSignal`, `ffmpegStderrTail` at close
- `msToFirstByte` on first output chunk
- `ffmpegAliveAtDisconnect` on client disconnect
- `legacyExtPath: true` on all lines so this path is distinguishable in Railway logs

This closes the coverage gap where probe failure → extension-based routing → silent ffmpeg failure was invisible.

### `runs/T080/diagnosis.md`

- Updated status line to reflect the code fix
- Added **Security Limitation** note in Section 8 documenting that `GET /api/diagnostics/env` is unauthenticated on Railway, acceptable as temporary, must be removed in the correction ticket

---

## Remaining blocker (human action required)

**Blocking 1** (production evidence) cannot be resolved by code changes. It requires:
1. Deploying this branch to Railway
2. Calling `/api/diagnostics/env` to verify ffmpeg/ffprobe presence
3. Playing a failing stream on a real iPhone Safari with Railway log stream open
4. Capturing Web Inspector console output
5. Filling the `<PENDING>` fields in `runs/T080/diagnosis.md` Sections 1–8

This is a manual step that gates the ticket's acceptance criteria. The instrumentation is now fully in place to collect that evidence.
