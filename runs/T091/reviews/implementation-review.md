I have all the information I need. Let me write the review now.

---

# T091 — Implementation Review (Attempt 2)

## Review scope

This review covers the second coder commit (`69e9c93`), addressing the two issues raised in review attempt 1: the empty measurements file and the retry-on-disconnect edge case.

---

## Changes made since review 1

### Fix 1 — Retry-on-disconnect guard ✅

`apps/api/src/routes/playback.ts:277`

```ts
if (!outcome.ok && outcome.retriable && !request.raw.socket?.destroyed) {
```

The `!request.raw.socket?.destroyed` guard is correctly applied. This is exactly what was requested. One-line change, no scope creep.

### Fix 2 — Measurements file expanded ✅ (with caveat below)

`runs/T091/measurements.md` now contains:
- **Static root cause analysis** (8 causes identified from code review) — well-constructed and accurate
- **Code-level before/after table** for every parameter changed by T091 — factually correct and complete
- Runtime measurement tables preserved with explicit `REQUIRES MANUAL MEASUREMENT` labels

---

## Full code verification

All six phases confirmed against current source:

| Phase | File | Change | Status |
|---|---|---|---|
| 1 — HLS.js buffer | `PlayerPage.tsx:186-189` | `maxBufferLength: 60`, `maxMaxBufferLength: 180`, `lowLatencyMode: false`, `progressive: true` | ✅ |
| 2 — ffmpeg probe | `providers/xtream/playback.ts:239-240` | `-analyzeduration 500000 -probesize 500000` | ✅ |
| 3 — Proxy backpressure | `routes/playback.ts:216` | `highWaterMark: 256 * 1024` | ✅ |
| 3 — Segment timeout + retry | `routes/playback.ts:17, 260, 277` | `SEGMENT_TIMEOUT_MS = 15_000`, 1-retry with socket guard | ✅ |
| 4 — Session TTL | `playback-session-store.ts:4`, `hls-session-store.ts:10-11` | 4 h playback, 3 h HLS, 1500 max segments | ✅ |
| 5 — Cache-Control | `routes/playback.ts:337` | `max-age=4, public` on playlist route | ✅ |
| 6 — Duplicate source reload | `PlayerPage.tsx` | Audit confirmed, no change needed | ✅ |

---

## Remaining gap — Runtime measurements (structural, human-only)

The measurements file now documents everything an AI can document without a live Xtream session. The following ticket requirements cannot be satisfied by any further AI coder iteration:

- **AC #2**: "Startup time and rebuffer behavior measured before/after" — tables are empty
- **AC #6**: "Real movie plays materially more smoothly on the same network/device" — requires observation
- **AC #9**: "Performance findings documented using a real Xtream stream" — no real-stream data
- **Completion rule**: "Do not close based on synthetic unit tests. Run a real long movie for enough time to observe buffering"

These are inherently human-only requirements. Another `IMPLEMENTATION_FIX_REQUIRED` cycle cannot produce them. The measurements file is honest about this with `REQUIRES MANUAL MEASUREMENT` labels throughout.

**Required human action before closing the ticket**: play the same real Xtream VOD for 10+ minutes in IPTVFlix (on this branch) and fill in the before/after runtime tables in `runs/T091/measurements.md`. The checklist in the Phase-by-phase section gives the exact items to verify.

---

## Scope compliance

Six files changed across both coder commits (excluding run artifacts). All changes are within the plan's six phases. The exclusion list (ABR, media-relay, CDN, `useProgressSync` refactor, probe cache TTL) is respected. No features added beyond scope.

---

## Summary

All code changes are correct, verified against source, and match the plan exactly. Both issues from review 1 are resolved. The measurements file is now the best a coder agent can produce — static root-cause analysis and full code-level documentation — and is honest about what remains for human verification. The implementation is approved; runtime testing must be completed by a human before the ticket is closed per the product completion rule.

IMPLEMENTATION_APPROVED
