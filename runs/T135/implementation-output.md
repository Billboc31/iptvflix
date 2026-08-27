All 8 files are in place. Here's a summary of the implementation:

---

## Summary

### New files

**`livetv/LiveChannelSelectorViewModel.kt`** — ViewModel scoped to `PlayerScreen`. Calls `repo.allChannels()` once on init; exposes `LiveChannelSelectorState` (Loading / Ready / Error). Factory uses `app.channelRepository`.

**`livetv/LiveChannelSelectorOverlay.kt`** — Left-side panel (320 dp wide, full height). Handles Loading/Error/Ready states internally. `ChannelSelectorRow` shows: logo or initial fallback, channel name, EPG title + `HH:mm–HH:mm` time range when available, now-playing indicator (▶), favorite badge. Focused row is orange; the currently playing row has an orange border. Per-row spinner replaces logo while that channel's stream is loading. `LaunchedEffect` scrolls to and focuses the current channel on open and after each switch.

**`livetv/LiveChannelSelectorViewModelTest.kt`** — 4 tests: Ready on success, Ready with empty list, Error on repository throw, EPG-present/absent coexistence.

**`player/LiveChannelSwitchTest.kt`** — 7 tests covering `buildChannelSwitchCommand`: `mediaType`, `mediaId`, `title`/`posterUrl` propagation, `startPositionMs = 0`, null fields, unique IDs per call, `ch-` prefix.

### Modified files

**`player/PlayerViewModel.kt`** — `switchChannel(channelId, title, logoUrl)` calls `load(buildChannelSwitchCommand(...))`. Internal `buildChannelSwitchCommand` builds a `PlaybackCommand(mediaType="channel", id="ch-{UUID}", …)` — testable independently.

**`player/PlayerScreen.kt`** — Obtains `LiveChannelSelectorViewModel` via factory. Tracks `isChannelSelectorOpen`, `loadingChannelId`, `currentChannelId` as local state. Key hierarchy extended: BACK closes overlay first; DPAD_RIGHT closes overlay; DPAD_LEFT opens overlay when playing a channel with chrome hidden. Auto-hide timer suppressed while overlay is open. Overlay mounted in `chromeContent` independently of chrome visibility.

**`livetv/LiveTvHomeScreen.kt`** — `onChannelSelected: (ChannelResponse) -> Unit` added (default no-op). Wired to `ChannelCard.onClick` and `ChannelListRow.onClick`, replacing the deferred stubs.

**`AppNavGraph.kt`** — `onChannelSelected` lambda on `LiveTvHomeScreen` builds a `PlaybackCommand(mediaType="channel")`, calls `commandVm.playLocal()`, then navigates to `Screen.Player`.
