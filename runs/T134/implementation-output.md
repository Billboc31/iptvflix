`BUILD SUCCESSFUL` — all tests pass. Here's a summary of the implementation:

---

## Files created

| File | Purpose |
|---|---|
| `livetv/ChannelModels.kt` | `ChannelResponse`, `ChannelEpg`, `EpgProgram`, `ChannelListResponse` — matches `api-contracts/channels.ts` |
| `livetv/ChannelApi.kt` | `GET /channels?recentlyWatched=&favoritesFirst=` via existing `ApiClient` |
| `livetv/ChannelRepository.kt` | Three suspend fns returning empty list on error (other sections never blocked) |
| `livetv/LiveTvHomeViewModel.kt` | `sealed class LiveTvHomeState { Loading, Error, Ready }` + parallel coroutines |
| `livetv/LiveTvHomeScreen.kt` | D-pad-navigable TV screen: spinner → orange-bordered cards in three lazy sections |
| `test/livetv/ChannelApiParserTest.kt` | 4 JSON deserialization cases (full, no EPG, no logo, minimal) |
| `test/livetv/LiveTvHomeViewModelTest.kt` | State transitions: all data, all empty, one section failed |
| `test/livetv/ModeSwitchTest.kt` | Pure state-machine: VOD→TV, TV→VOD, Player only reachable from Home |

## Files modified

| File | Change |
|---|---|
| `ui/TvTheme.kt` | Added `val LiveTvAccent = Color(0xFFFF8C00)` alongside existing red `Accent` |
| `App.kt` | Wired `channelApi` and `channelRepository` lazy singletons |
| `AppNavGraph.kt` | Added `Screen.LiveTvHome` enum value + navigation case; passes `onSwitchToLiveTv` to `HomeScreen` |
| `home/HomeScreen.kt` | Added `onSwitchToLiveTv` parameter + `ModeToggleBar` (VOD/TV pill buttons) above the content |

**One deviation from plan:** `CircularProgressIndicator` from `material3` was not on the compile classpath (no explicit `material3` dependency), so the loading spinner was implemented with `Canvas` + `rememberInfiniteTransition` — functionally equivalent, using already-available Foundation APIs.
