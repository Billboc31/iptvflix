# Plan — T136: Android TV live channel zapping with D-pad and channel +/- keys

## Objective

Add instant channel zapping to the Live TV full-screen player via `DPAD_UP`/`DPAD_DOWN` and `KEYCODE_CHANNEL_UP`/`KEYCODE_CHANNEL_DOWN`, including a transient orange HUD after each zap, debounced rapid-press handling, and clean overlay coexistence.

## Included

### 1. `PlayerViewModel.kt` — Zapping state and logic

- Add a `ChannelRepository` dependency (already used by `LiveChannelSelectorViewModel`; inject the same singleton).
- Add private `_zapChannels: List<ChannelResponse>` (cached on first zap; never reloaded per session).
- Add private `_zapIndex: Int` tracking the index of the currently playing channel in the cached list.
- Add `fun initZapContext(channelId: String)`: called on channel load, fetches `ChannelRepository.allChannels()` once, stores the list and sets `_zapIndex`. No-op if list already loaded.
- Add `fun zapNext()` and `fun zapPrevious()`: advance/decrement `_zapIndex` with wrap-around; skip channels with no available sources if the API exposes that flag (use existing `ChannelResponse` fields). Call the existing `switchChannel()` after updating the index.
- Serialize rapid zaps: cancel any in-flight `zapJob: Job?` before starting a new one (`zapJob?.cancel(); zapJob = viewModelScope.launch { … }`). This ensures the last key press wins.
- Expose `val zapHudChannel: StateFlow<ChannelResponse?>`: set to the target channel at zap start, cleared by the composable after the HUD auto-dismisses (or reset to null on the next zap before showing the new channel).
- D-pad mapping (document in a KDoc on `zapNext()`):
  - `DPAD_UP` = `zapPrevious()` (up in the list = previous channel).
  - `DPAD_DOWN` = `zapNext()` (down in the list = next channel).
  - `KEYCODE_CHANNEL_UP` = `zapNext()` (traditional TV zapping direction).
  - `KEYCODE_CHANNEL_DOWN` = `zapPrevious()`.

### 2. `PlayerScreen.kt` — Key event wiring

- In the `onKeyEvent` block (around line 247), add two new branches **before** the existing `isChannelSelectorOpen` guard:
  - `Key.DirectionUp` (full-screen, no overlay, `mediaType == "channel"`) → `vm.zapPrevious()`, return `true`.
  - `Key.DirectionDown` (full-screen, no overlay, `mediaType == "channel"`) → `vm.zapNext()`, return `true`.
- For `KEYCODE_CHANNEL_UP`/`CHANNEL_DOWN`: Compose's `Key` object does not expose these; handle them at the `View`/`Activity` level via `MainActivity.onKeyDown` dispatching to the PlayerViewModel via a shared `Flow` or by converting to a Compose key event in the root composable. Scope CHANNEL_UP/DOWN to full-screen only (ignore when `isChannelSelectorOpen`).
- When `isChannelSelectorOpen == true`: UP/DOWN remain fully consumed by the existing guard (TvLazyColumn handles overlay focus internally); CHANNEL_UP/DOWN also consumed without zapping (documented behavior: channel keys are full-screen-only).
- Wire `vm.zapHudChannel` to the new `ZapChannelHud` composable via `collectAsState()`. Show HUD when non-null; pass `onDismissed = { vm.clearZapHud() }`.

### 3. New file: `player/ZapChannelHud.kt`

- Composable `ZapChannelHud(channel: ChannelResponse, onDismissed: () -> Unit)`.
- Content: channel logo (AsyncImage, 48dp), channel name (bold white), current EPG program title from `channel.epg?.now?.title` (grey, omitted when null). No fake EPG data.
- Positioned bottom-right, orange-accent border/background matching the Live TV visual theme (orange `#FF6600` used in T135 overlays).
- Auto-dismiss via `LaunchedEffect(channel.id) { delay(3_000); onDismissed() }`.
- No key press required to dismiss.
- Add `fun clearZapHud()` to `PlayerViewModel` (sets `_zapHudChannel` to null).

### 4. Error handling

- If `switchChannel()` fails after all source fallbacks (existing behavior), clear the zap HUD, emit a non-blocking `Snackbar`-equivalent overlay (already handled by the existing player error state), and reset `_zapIndex` to the last successfully playing channel's index.
- Subsequent zap calls must still work: `_zapChannels` is retained; `_zapIndex` reverts to the last good index.

### 5. `MainActivity.kt` — CHANNEL key dispatch

- Override `onKeyDown(keyCode, event)`.
- For `KeyEvent.KEYCODE_CHANNEL_UP` and `KEYCODE_CHANNEL_DOWN`, post to a `MutableSharedFlow<Int>` in a shared `ChannelKeyEventBus` (singleton in the app's DI graph or a `companion object`).
- `PlayerScreen` (or `PlayerViewModel`) collects from this flow and calls `zapNext()`/`zapPrevious()` only when the player is in full-screen Live TV mode.

### 6. New test file: `player/ChannelZappingTest.kt`

Cover the following scenarios with unit tests (fake `ChannelRepository`, fake `ExoPlayer`):

- `zapNext()` advances index and calls `switchChannel()` with the correct channel ID.
- `zapPrevious()` decrements index and calls `switchChannel()` with the correct channel ID.
- Wrap-around: `zapNext()` at last index returns index 0; `zapPrevious()` at index 0 returns last index.
- Rapid zaps: two consecutive `zapNext()` calls within debounce window result in exactly one `switchChannel()` call (the second).
- Overlay-open guard: simulate overlay open — assert `zapNext()`/`zapPrevious()` are not called from `PlayerScreen` key events when `isChannelSelectorOpen == true`.
- Failed playback: after a failed channel switch, `zapNext()` continues to work from the last good index.
- `initZapContext()` called once: a second call is a no-op (list not refetched).
- `zapHudChannel` is set immediately on zap start and cleared after `clearZapHud()`.

Extend `LiveChannelSwitchTest.kt` to verify that `buildChannelSwitchCommand` is invoked correctly from the zap path (channel ID propagated).

## Excluded

- VOD player — no changes to seek/play-pause or VOD key handling.
- Channel selector overlay internal UI changes (T135 scope).
- EPG data fetching or enrichment beyond what `ChannelResponse.epg` already provides.
- Stable channel numbering UI (ticket explicitly marks as optional; no meaningful stable numbers exist in the current API model).
- Category/list context filtering for zapping (the ticket allows falling back to the all-channels order, which is what `ChannelRepository.allChannels()` provides; category-scoped zapping is a follow-up).
- Saving the zap channel list across process restarts.
- Visual theming changes outside the new `ZapChannelHud` composable.

## Acceptance criteria

- In full-screen Live TV (no overlay), `DPAD_UP` triggers `zapPrevious()` and `DPAD_DOWN` triggers `zapNext()`; neither fires when the channel selector overlay is open.
- `KEYCODE_CHANNEL_UP` triggers `zapNext()` and `KEYCODE_CHANNEL_DOWN` triggers `zapPrevious()` in full-screen mode; both are ignored while the overlay is open.
- Zapping uses the `allChannels()` ordered list; boundary behavior is wrap-around (index 0 ↔ last index).
- After each direct zap, `ZapChannelHud` appears with the correct channel name/logo and EPG title (when available), and auto-dismisses after 3 seconds without any key press.
- Holding a D-pad key rapidly produces no overlapping ExoPlayer `setMediaItem` calls; only the last requested channel is loaded.
- A channel playback failure leaves `_zapIndex` on the last good channel; subsequent zaps work normally.
- All new unit tests in `ChannelZappingTest.kt` pass; existing tests in `LiveChannelSwitchTest.kt`, `ModeSwitchTest.kt`, `LiveTvHomeViewModelTest.kt`, and `LiveChannelSelectorViewModelTest.kt` are unmodified and still pass.
- `./gradlew :app:testDebugUnitTest` passes with no regressions.
