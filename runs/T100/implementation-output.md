The file looks correct. The fix is complete.

**What changed in `PlayerViewModel.kt`:**

- **`sessionEnded: Boolean` flag** — tracks whether the session has been closed (either by `PLAY_COMPLETED` or `PLAY_ABANDONED`). Reset to `false` in `load()`, set to `true` on `STATE_ENDED`.

- **`emitAbandonIfNeeded(positionMs: Long)`** — guards against double-firing (`if (sessionEnded) return`), then emits `PLAY_ABANDONED` with the correct `mediaType`, `mediaId`, `sessionId`, and pre-captured position. Fire-and-forget with logged failure (never breaks playback).

- **`stop()`** — captures `currentPosition` before stopping the player (position resets to 0 after `player.stop()`), then calls `emitAbandonIfNeeded` inside the existing `NonCancellable` coroutine alongside the progress flush.

- **`onCleared()`** — same pattern: captures position first, then calls `emitAbandonIfNeeded` inside the existing `withTimeout(2_000L)` block so both the progress report and the abandon event are flushed within the 2s budget.

This ensures `ViewingSession.endedAt` is always populated on Android TV — whether the user presses back, the ViewModel is destroyed by the system, or playback ends naturally.
