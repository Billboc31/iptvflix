# T135 — Plan: Android TV live channel selector overlay

## Objective

Add a persistent left-side channel selector overlay inside the Android TV live player so users can browse and switch channels with the remote while playback continues behind the panel, matching the set-top-box zapping interaction described in the ticket. Wiring the deferred channel-click in `LiveTvHomeScreen` is included as the necessary entry point into Live playback.

## Included

### New files

**`livetv/LiveChannelSelectorOverlay.kt`** — `LiveChannelSelectorOverlay` composable:
- Left-aligned side panel (~320 dp wide), displayed above the video layer while playback continues
- `TvLazyColumn` of `ChannelSelectorRow` items: channel logo (or initials fallback), name, EPG program title + start/end times when `epg.now != null`, `isFavorite` indicator
- Orange-highlighted focused row; a distinct "now playing" marker on the row matching `currentChannelId`
- `FocusRequester` targets the row matching `currentChannelId` on first open
- Per-row loading spinner while the stream switch is in progress (replaces the orange ring)
- EPG-absent rows degrade cleanly — no fake data, no empty placeholder crash
- Exposes `onChannelSelected(ChannelResponse)` and `onClose()` lambdas; owns no playback logic

**`livetv/LiveChannelSelectorViewModel.kt`** — `LiveChannelSelectorViewModel(repo: ChannelRepository)`:
- `LiveChannelSelectorState`: `Loading` | `Ready(channels: List<ChannelResponse>)` | `Error`
- `load()` calls `repo.allChannels()` once; result cached in `StateFlow` — not re-fetched on every channel switch
- ViewModel is scoped to `PlayerScreen`, so it survives channel switches but is released when the player exits
- No client-side dedup needed; backend already de-duplicates `ChannelSource` entries

**`livetv/LiveChannelSelectorViewModelTest.kt`** — unit tests (MockK + coroutines-test, matching project conventions):
- `Ready` state populated on successful load
- Empty channel list produces `Ready` with empty list, not `Error`
- Repository failure surfaces as `Error`
- Channels with and without EPG coexist in the same list without crash

**`player/LiveChannelSwitchTest.kt`** — unit tests for `PlayerViewModel.switchChannel`:
- Switch builds a command with `mediaType = "channel"` and the supplied `mediaId`
- Repeated calls replace the previous command (no accumulation)
- `title` and `logoUrl` propagate to the command fields

### Modified files

**`player/PlayerViewModel.kt`** — add `switchChannel(channelId: String, title: String?, logoUrl: String?)`:
- Constructs `PlaybackCommand(mediaType = "channel", mediaId = channelId, startPositionMs = 0L, title = title, posterUrl = logoUrl)`
- Calls the existing internal `load(newCommand)` — existing `Buffering → Playing` state transitions apply
- No navigation side-effect; overlay remains open throughout

**`player/PlayerScreen.kt`**:
- Add `var isChannelSelectorOpen by remember { mutableStateOf(false) }` local state
- Key-event handler extension: when `command?.mediaType == "channel"` and no chrome panel is open, `DPAD_LEFT` sets `isChannelSelectorOpen = true`
- BACK hierarchy extended: if overlay is open → set `isChannelSelectorOpen = false` and consume event (existing chrome-hide → stop-playback steps follow on subsequent BACK presses)
- `DPAD_RIGHT` sets `isChannelSelectorOpen = false` when overlay is open
- Mount `LiveChannelSelectorOverlay` in `PlayerOverlayStack` above the video/scrim layers, below chrome; rendered only when `isChannelSelectorOpen == true`
- Callbacks wired: `currentChannelId = command?.mediaId`, `onChannelSelected = { ch -> vm.switchChannel(ch.id, ch.name, ch.logoUrl) }`, `onClose = { isChannelSelectorOpen = false }`
- `LiveChannelSelectorViewModel` obtained via `viewModel()` inside `PlayerScreen`, keeping it scoped to the player

**`livetv/LiveTvHomeScreen.kt`**:
- Add `onChannelSelected: (ChannelResponse) -> Unit` parameter to `LiveTvHomeScreen`
- Replace `/* channel playback deferred */` stub in `ChannelCard.onClick` (line 250) and `ChannelListRow.onClick` (line 344) with `onChannelSelected(channel)`
- No other layout or logic change

**`AppNavGraph.kt`**:
- Pass `onChannelSelected` to `LiveTvHomeScreen`: lambda constructs `PlaybackCommand(mediaType = "channel", mediaId = ch.id, title = ch.name, posterUrl = ch.logoUrl, startPositionMs = 0L)`, calls `commandVm.playLocal(command)`, then sets `currentScreen = Screen.Player.name`

## Excluded

- Changes to the EPG data model or API (EPG is already embedded in `ChannelResponse.epg`)
- Category/genre filtering UI inside the overlay (future ticket; overlay shows all channels in backend-supplied order)
- Favorite toggle from inside the overlay (`isFavorite` is read-only display)
- Scrub bar, skip-intro, next-episode, audio/subtitle panels — existing VOD chrome is untouched
- androidTest / Compose UI instrumented tests (no existing androidTest source set in this project)
- Any server-side or backend changes

## Acceptance criteria

- `DPAD_LEFT` during Live TV playback (`command.mediaType == "channel"`) opens `LiveChannelSelectorOverlay`; the key has no overlay effect during VOD playback
- The overlay occupies a left-side strip; the active channel stream continues playing visibly to the right
- Channel rows display: logo or initials fallback, channel name, EPG program title + times when `epg.now != null`; rows without EPG render without that slot and without crashing
- `DPAD_UP`/`DPAD_DOWN` moves orange focus through rows; `TvLazyColumn` scrolls to keep the focused row visible
- `OK`/`ENTER` on a row calls `PlayerViewModel.switchChannel()`, updating the stream in place without closing the overlay
- After the switch reaches `PlayerUiState.Playing`, the overlay is still visible, the current-channel marker has moved to the newly selected row, and focus remains in a deterministic position (selected row or nearest visible row)
- The channel list is fetched exactly once per `PlayerScreen` session regardless of how many channel switches occur
- `BACK` closes the overlay first; a second `BACK` follows the existing chrome-hide → stop-playback sequence
- `DPAD_RIGHT` dismisses the overlay
- Clicking a channel card or row in `LiveTvHomeScreen` launches `Screen.Player` with a `PlaybackCommand` of `mediaType = "channel"` and the correct `mediaId`
- Existing VOD player controls (scrub, episodes, audio/subtitles, skip-intro/recap overlays) are not regressed
- `LiveChannelSelectorViewModelTest` passes: load, empty list, error, EPG present/absent
- `LiveChannelSwitchTest` passes: command shape, repeated switching, title/logo propagation
