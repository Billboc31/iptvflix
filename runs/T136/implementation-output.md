Everything is consistent. Here's a summary of the two files changed:

---

## Changes

### `player/PlayerScreen.kt`

- Replaced the explicit `mediaType` early-return + `!isChannelSelectorOpen` guard in the CHANNEL key `LaunchedEffect` with a single call to the new `shouldZapChannel` function.
- Added `internal fun shouldZapChannel(isOverlayOpen: Boolean, mediaType: String?): Boolean` at package scope — the extracted pure function encoding both guard conditions (overlay closed AND mediaType is "channel", case-insensitive). `internal` makes it accessible from unit tests in the same package without Compose.
- Added a comment on the `LaunchedEffect` documenting that CHANNEL_UP/DOWN are scoped to full-screen Live TV only.

### `player/ChannelZappingTest.kt`

- Added imports: `assertFalse`, `assertTrue`.
- Added `class OverlayGuardTest` with 5 tests covering all branches of `shouldZapChannel`:
  - overlay open → false (regardless of mediaType)
  - overlay closed + wrong mediaType → false (episode, null)
  - overlay closed + `"channel"` → true
  - case-insensitive: `"CHANNEL"`, `"Channel"` → true
