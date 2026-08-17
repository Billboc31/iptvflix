Now I have all I need. Here is the plan:

---

## Objective

Fix the VOD player so that the displayed total duration is stable from stream start, is never driven by buffered end, and so that resume progress is persisted and restored using true media duration rather than a loading-state artifact.

## Included

### Backend — expose probe duration

**`apps/api/src/services/media-prober.ts`**
- Extend the ffprobe invocation to include `-show_format` (already present) and extract `format.duration` (a float string in seconds) from the JSON output.
- Add `durationSeconds: number | null` to the `MediaInfo` return type (null when ffprobe doesn't report a finite value).

**`packages/api-contracts/src/playback.ts`**
- Add `durationSeconds: number | null` to `PlaybackProbeResult`.
- `PlaybackSessionResponse` already carries `probeResult`; no structural change to that type is needed beyond the field above.

**`apps/api/src/routes/playback.ts` / playback resolver**
- Map `mediaInfo.durationSeconds` through to `probeResult.durationSeconds` wherever `PlaybackSessionResponse` is assembled (probe-success branch; leave null in the no-probe path).

### Frontend — stable duration and indeterminate state

**`apps/web/src/components/player/PlayerControls.tsx`**
- Accept a new optional prop `hintDurationSeconds: number | null` (probe duration passed down from `PlayerPage`).
- Replace the bare `duration` state with a `stableDuration: number | null`:
  - Initialize to `hintDurationSeconds` when the prop is truthy.
  - On `onDurationChange`: accept the value only if `stableDuration` is still null AND `isFinite(video.duration) && video.duration > 0`, then set once and stop updating. If a hint was already set, ignore subsequent `durationchange` events entirely (the hint is authoritative).
- Derive `seekable = stableDuration !== null && stableDuration > 0`.
- Fix `bufferedFraction` calculation to divide by `stableDuration` (was `video.duration`); skip the update when `stableDuration` is null.
- Fix the seek bar and time display to use `stableDuration` in place of `duration`.
- When `stableDuration === null`, render the time display as `--:-- / --:--` and the seek bar in an indeterminate visual state (pulsing/greyed) instead of showing a growing value.
- Expose an `onStableDuration(seconds: number)` callback prop; fire it once when `stableDuration` first becomes non-null, so `PlayerPage` can own the value for use by `useProgressSync`.

**`apps/web/src/pages/PlayerPage.tsx`**
- Extract `session.probeResult?.durationSeconds ?? null` and store as `stableDurationSeconds` state (set once; updated via `onStableDuration` callback from `PlayerControls`).
- Pass `stableDurationSeconds` as `hintDurationSeconds` prop to `PlayerControls`.
- Fix the resume threshold guard: use `stableDurationSeconds` (falling back to `video.duration` if still null) in the `startPositionSeconds < duration - 60` check, so "near end" detection works correctly from the first render.

**`apps/web/src/hooks/useProgressSync.ts`**
- Add a `stableDurationSeconds: number | null` parameter.
- In the progress body constructed on `timeupdate`, `pause`, `ended`, and `beforeunload`, replace `Math.floor(video.duration)` with `stableDurationSeconds ?? Math.floor(video.duration)`.
- Guard: skip any persist call where the effective `durationSeconds` is 0 or non-finite (prevents corrupting stored duration when metadata is not yet available).

### No database migrations

The `viewing_progress.durationSeconds` column already exists with the correct semantics. The fix is in what value is written to it.

### No TMDB catalog fallback in this ticket

Using `durationMinutes` from the catalog as an additional hint (for streams where ffprobe doesn't run or probe fails) is explicitly deferred — probe coverage is sufficient for the acceptance criteria.

## Excluded

- Rendering a separate buffered progress visual layer on the seek bar track (the buffered bar already exists visually; the only bug here is the denominator used for its width — covered by the `stableDuration` fix above; a full redesign of the track layers is out of scope).
- TMDB/catalog `durationMinutes` as a fallback hint when probe is unavailable.
- Any probing or duration injection for HLS segments (ffprobe on the master playlist URL already returns VOD duration correctly for Xtream HLS).
- Changes to `durationMinutes` storage in `movies` or `episodes` tables.
- Server-side "completed" reclassification of existing rows with wrong `durationSeconds` (historical records are out of scope; only new writes are fixed).
- New unit tests mocking `duration=3600` (ticket explicitly excludes these as insufficient proof).

## Acceptance criteria

- Launching a long real Xtream movie: the seek bar total width does not grow while the stream buffers. It matches the ffprobe-reported duration within ±5 s from the moment `probeResult` arrives.
- When ffprobe succeeds, `PlayerControls` receives a non-null `hintDurationSeconds` before the first `durationchange` event; the `--:--` indeterminate state is never visible for more than a fraction of a second.
- When ffprobe does not report duration (null probe result), the player shows the indeterminate state honestly until `video.duration` stabilizes; it does not render a growing bar.
- Closing a movie at ~25% (e.g., 1800 s of a 7200 s film): the DB row stores `progressSeconds=1800, durationSeconds=7200`. Reopening shows the resume dialog and seeks back to 1800 s.
- Percentage shown in "Continue Watching" after the above test: ≈25%, not a value inflated by prior buffer state.
- The resume dialog suppression thresholds (< 30 s, > duration − 60 s) work correctly using stable duration, not a transient `video.duration`.
- Tested and confirmed on at least one real Xtream movie and one real Xtream episode; screenshots or log excerpts captured as evidence in `runs/T090/`.
