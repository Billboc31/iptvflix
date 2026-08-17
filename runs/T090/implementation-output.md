`useProgressSync.test.ts` ran 7 tests (was 6 before the new test), all passing.

Here's a summary of what was done:

## Changes made

### Fix: `apps/web/src/pages/PlayerPage.tsx` (lines 83-88)

Added the `status === 'loading'` branch to reset `stableDurationSeconds` to `null` when a variant switch begins:

```ts
useEffect(() => {
  if (status === 'loading') {
    setStableDurationSeconds(null)   // ← new: clears stale duration on variant switch
  } else if (status === 'ready') {
    setStableDurationSeconds(probeDurationSeconds)
  }
}, [status, probeDurationSeconds])
```

**Why this fixes the bug**: When `PlayerControls` unmounts (status `'loading'`) and re-mounts (status `'ready'`), it would receive the old variant's duration as `hintDurationSeconds` and immediately lock on it — before the `setStableDurationSeconds(probeDurationSeconds)` effect had a chance to run. Now `stableDurationSeconds` is `null` by the time `PlayerControls` mounts for the new variant, so no stale lock occurs.

### New test: `apps/web/src/hooks/useProgressSync.test.ts`

Added a test verifying that `stableDurationSeconds=7200` takes priority over `video.duration=3600` when persisting progress — covering the core behavior of the ticket.

---

**Remaining open item (BLOQUANT 2)**: The real-stream validation required by the ticket's completion rule ("Demonstrate on a real stream that total duration is stable while buffering continues and that resume returns to the correct position") must be done manually by running the app against a real Xtream movie. This cannot be satisfied in code — it requires a browser session with an actual stream.
