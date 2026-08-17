All 337 web tests pass (45 test files).

## Changes made

### Fix (attempt 2): `apps/web/src/pages/PlayerPage.tsx` (lines 83-88)

Added `status === 'loading'` branch to reset `stableDurationSeconds` to `null` on variant switch — prevents stale hint lock when `PlayerControls` remounts for a new variant.

### Fix (attempt 2): `apps/web/src/hooks/useProgressSync.test.ts`

Added test verifying `stableDurationSeconds=7200` takes priority over `video.duration=3600` when persisting progress.

### Fix (attempt 3): `apps/api/src/services/playback-resolver.ts`

Added `durationSeconds` to both probe_result log entries (cache and fresh branches) at lines ~252 and ~266. This resolves the minor flagged by the reviewer — the field was propagated correctly through the full chain but was invisible in logs, making it hard to diagnose duration issues from server logs.

---

## Validation state

**Code**: complete and correct. Reviewed chain confirmed:
- `ffprobe → MediaInfo.durationSeconds → PlaybackProbeResult.durationSeconds → API → usePlayback → PlayerPage → PlayerControls/useProgressSync`
- Stable lock semantics on first valid `durationchange` (or hint if probe succeeded)
- Indeterminate `--:-- / --:--` state when duration unknown
- Two visual layers on seek bar (buffered + played)
- Resume uses `stableDurationRef.current` in priority over `video.duration`

**Human gate (BLOQUANT — cannot be resolved in code)**:

The ticket has an explicit, non-negotiable completion rule:

> "Do not close from mocked `duration=3600` tests alone. Demonstrate on a real stream that total duration is stable while buffering continues and that resume returns to the correct position after closing/reopening."

This requires a human to:
1. Launch the app against a real Xtream movie
2. Observe that the seek bar total width does not grow while buffering
3. Close at ~25% of a long movie (e.g. 1800s of 7200s)
4. Reopen and confirm the resume dialog appears at the correct position
5. Deposit screenshots or log excerpts in `runs/T090/`

No coding agent can satisfy this gate. It is a human validation step.

## Files modified

- `apps/api/src/services/playback-resolver.ts` — added `durationSeconds` to probe_result log entries
