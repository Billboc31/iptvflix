All done. Here's a summary of everything implemented:

---

## Summary

### New files

| File | Purpose |
|---|---|
| `player/ChannelKeyEventBus.kt` | Singleton `object` with a `SharedFlow<ChannelKeyEvent>` — routes `KEYCODE_CHANNEL_UP/DOWN` from `MainActivity` to `PlayerScreen` |
| `player/ChannelZapper.kt` | Self-contained zapping logic: canonical channel list cache, index tracking, wrap-around, 150ms debounce (last key wins), HUD state, playback success/error notification |
| `player/ZapChannelHud.kt` | Transient orange-accented HUD composable showing channel logo, name, and current EPG program; auto-dismisses after 3s via `LaunchedEffect` |
| `player/ChannelZappingTest.kt` | 12 unit tests: next/prev advance, wrap-around at both boundaries, rapid-press debounce, failure revert, list-fetch idempotency, HUD lifecycle, no-op before init |

### Modified files

**`PlayerViewModel.kt`** — Added lazy `ChannelZapper`, public `zapNext()` / `zapPrevious()` / `clearZapHud()` / `zapHudChannel: StateFlow`, `initZapContext` triggered from `load()` for channel commands, `notifyPlaybackSuccess/Error` wired into the ExoPlayer listener.

**`PlayerScreen.kt`** — DPAD_UP→`zapPrevious()` / DPAD_DOWN→`zapNext()` in the chrome-hidden branch (overlay guard already above it, so overlay-open UP/DOWN are consumed before reaching this code). `LaunchedEffect(command?.id)` collects `ChannelKeyEventBus` for CHANNEL_UP/DOWN with the same overlay guard. `ZapChannelHud` rendered at bottom-end when `zapHudChannel != null`.

**`MainActivity.kt`** — `onKeyDown` override posts to `ChannelKeyEventBus` for `KEYCODE_CHANNEL_UP` and `KEYCODE_CHANNEL_DOWN`.

**`LiveChannelSwitchTest.kt`** — One new test confirming zap-path field propagation through `buildChannelSwitchCommand`.

**Result: 80 tests, 0 failures.**
