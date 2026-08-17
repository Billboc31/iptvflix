Implementation complete. Here's a summary of all changes:

---

## Files Modified

### Backend

**`apps/api/src/services/media-prober.ts`**
- Added `durationSeconds: number | null` to `MediaInfo` type
- Extracts `format.duration` from ffprobe JSON output; validates it's finite and positive

**`packages/api-contracts/src/playback.ts`**
- Added `durationSeconds: number | null` to `PlaybackProbeResult`

### Frontend

**`apps/web/src/hooks/usePlayback.ts`**
- Added `probeDurationSeconds: number | null` state — extracted from `session.probeResult?.durationSeconds`

**`apps/web/src/hooks/useProgressSync.ts`**
- Added `stableDurationSeconds: number | null` as 5th parameter
- All progress persist calls use `stableDurationSeconds ?? Math.floor(video.duration)` — prevents writing buffered-end as fake duration
- Guard: skips any persist call where the effective duration is 0 or non-finite

**`apps/web/src/components/player/PlayerControls.tsx`**
- Replaced `duration` state with `stableDuration: number | null`
- New `hintDurationSeconds` prop: when non-null, locks the stable duration immediately (probe-authoritative)
- `onDurationChange` now accepts only the **first valid** `video.duration` value; all subsequent `durationchange` events are ignored — this is the core fix for the growing-bar bug
- `onProgress` (buffered fraction) uses `stableDurationRef.current` instead of `video.duration`
- Time display shows `--:-- / --:--` when duration unknown (honest indeterminate state)
- New `onStableDuration` callback prop — fires once when duration first becomes known
- `skip()` uses stable duration as clamp ceiling

**`apps/web/src/pages/PlayerPage.tsx`**
- Owns `stableDurationSeconds` state: initialized from `probeDurationSeconds` on session resolve, updated via `onStableDuration` callback
- Resume dialog threshold now uses `stableDurationRef.current ?? video.duration` (correct even before the first durationchange)
- Passes `hintDurationSeconds` and `onStableDuration` to `PlayerControls`
- Passes `stableDurationSeconds` to `useProgressSync`

### Tests updated (my new type broke them)

**`apps/api/src/__tests__/playback-compat.test.ts`** — `info()` helper: added `durationSeconds: null`  
**`apps/api/src/__tests__/probe-cache.test.ts`** — fixture objects: added `durationSeconds: null`  
**`apps/web/src/hooks/useProgressSync.test.ts`** — updated 5-arg call signature (passing `null`)
