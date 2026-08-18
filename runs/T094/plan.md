# Plan — T094 Prompt to resume or restart when starting partially watched movies and episodes

## Objective

Improve the existing resume dialog in `PlayerPage` so that the choice appears before any video plays, with correct ARIA semantics, focus management, Escape-key cancellation, and descriptive body text. Expand test coverage to verify all threshold and interaction cases. No backend changes are required — `startPositionSeconds` and `probeDurationSeconds` are already returned by `resolvePlayback`.

## Included

### `apps/web/src/pages/PlayerPage.tsx`

**Prevent playback before the dialog is shown**

- Add a `startPositionRef` (parallel to `stableDurationRef`) that always holds the latest `startPositionSeconds` value.
- In the `attach()` closure (inside the `[gatewayUrl, deliveryMode, containerExtension]` effect), guard every `void video.play()` call: only call play immediately when `startPositionRef.current <= RESUME_THRESHOLD_START_S`. When above the threshold, skip the initial play; the `onMetadata` handler becomes responsible for starting playback in all cases.
- Remove the `autoPlay` attribute from the `<video>` element — play is managed exclusively by `attach()` / `onMetadata`.
- Update `onMetadata`: when no dialog is needed (progress = 0, below threshold, or near end), seek if `startPositionSeconds > 0` then call `video.play()`.

**Dialog accessibility and descriptive content**

- Give the inner dialog panel `role="dialog"`, `aria-modal="true"`, and `aria-labelledby="resume-dialog-title"`.
- Replace the single `<p>` with:
  - `<h2 id="resume-dialog-title">Reprendre la lecture ?</h2>` for movies.
  - When `episodeLabel` is available (episodes): `<h2 id="resume-dialog-title">{episodeLabel}</h2>`.
  - `<p id="resume-dialog-desc">Vous vous êtes arrêté à {formatTime(startPositionSeconds)}.</p>` below the heading, with `aria-describedby="resume-dialog-desc"` on the panel.
- Add `autoFocus` on the primary "Reprendre à {formatTime(startPositionSeconds)}" button (or set focus via `useEffect` when `showResumeDialog` becomes `true`).
- Change secondary button label to "Recommencer l'épisode" for episodes, keep "Recommencer" for movies (use `resolvedMediaType` to decide).
- Update `aria-label` on the resume button to include the formatted timestamp.

**Escape-key cancellation**

- Add a `useEffect` that attaches a `keydown` listener when `showResumeDialog === true`: `Escape` → `setShowResumeDialog(false)` without calling `video.play()`. The video remains paused; the user can press play from the controls or navigate back.

**Constants and thresholds**

- Keep `RESUME_THRESHOLD_START_S = 30` and `RESUME_THRESHOLD_END_S = 60` (already reasonable per ticket).

**`handleRestart`**

- No changes needed. Normal `useProgressSync` sync will overwrite the stored position as playback proceeds from 0, satisfying "reset/replace the active resume position appropriately once playback progresses".

### `apps/web/src/pages/PlayerPage.test.tsx`

Add or expand tests:

| Scenario | Expected |
|---|---|
| Movie with `startPositionSeconds = 120`, `probeDurationSeconds = 3600` | Dialog shown |
| Episode with `startPositionSeconds = 120`, `probeDurationSeconds = 3600` | Dialog shown |
| `startPositionSeconds = 0` | No dialog, immediate play |
| `startPositionSeconds = 20` (below 30 s threshold) | No dialog |
| `startPositionSeconds = 3550`, `probeDurationSeconds = 3600` (within 60 s of end) | No dialog |
| Escape key pressed while dialog is visible | Dialog closes, no playback starts |
| Click "Reprendre" | `video.currentTime` set to saved position, `video.play()` called |
| Click "Recommencer" | `video.currentTime` set to 0, `video.play()` called |
| Episode dialog heading uses `episodeLabel` | Heading text matches episode label |

Tests remain in jsdom; seek assertions note the jsdom `currentTime` stub limitation where applicable (consistent with existing test comments).

## Excluded

- Backend or API-contract changes (`PlaybackSessionResponse` already contains `startPositionSeconds`; no `title` field needed — episodes use `episodeLabel` from `useEpisodeNavigation`; movies use a generic heading).
- Continue Watching direct-resume path (ticket says "may", explicitly deferred).
- Mobile-specific CSS overhaul (current `max-w-sm w-full mx-4` layout is already touch-friendly).
- Source/quality switching progress preservation (canonical `startPositionSeconds` is independent of source by existing design — `resolvePlayback` returns the same value regardless of `availabilityId`).
- Resume-seek failure recovery UI (recoverable error message on failed seek) — deferred to a follow-up.
- Any changes to `MediaActions.tsx`, `EpisodeCard.tsx`, `ContinueWatchingRow.tsx`, or any page outside PlayerPage.

## Acceptance criteria

- Clicking "Lecture" on a Movie with `startPositionSeconds > 30` and not within 60 s of duration shows the dialog before the first video frame is rendered (no audible or visible playback before the choice).
- Clicking "Lecture" on an Episode with the same conditions shows the dialog independently (episode-level `mediaId`, not series-level).
- Never-started content (`startPositionSeconds = 0`) plays immediately without a dialog.
- Trivial progress (`startPositionSeconds ≤ 30`) plays from that position without a dialog.
- Near-completed content (`startPositionSeconds ≥ duration − 60`) plays from position without a dialog.
- The dialog container has `role="dialog"`, `aria-modal="true"`, `aria-labelledby` pointing to the heading.
- Focus lands on the "Reprendre" button when the dialog opens.
- Pressing Escape closes the dialog; no playback starts.
- Clicking "Reprendre à HH:MM:SS" seeks to `startPositionSeconds` and starts play.
- Clicking "Recommencer" / "Recommencer l'épisode" seeks to 0 and starts play.
- All new test scenarios in `PlayerPage.test.tsx` pass with `vitest`.
- Manually: play a Movie for > 60 s, close, reopen, click "Lecture" → dialog appears → verify both "Reprendre" and "Recommencer" paths. Repeat with one Episode.
