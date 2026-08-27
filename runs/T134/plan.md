## Objective

Add a Live TV mode to the Android TV app with an orange visual identity, a D-pad-navigable Live TV home screen backed by canonical channel data from the existing backend API, and a clear VOD / TV mode switch — without touching VOD playback paths.

## Included

### New package `livetv/`

**`livetv/ChannelModels.kt`**
- `@Serializable data class ChannelResponse(id, name, logoUrl, categories, language, country, iptvOrgId, epg, isFavorite)` matching `packages/api-contracts/src/channels.ts`
- `@Serializable data class EpgProgram(title, startTime, endTime)`
- `@Serializable data class ChannelListResponse(channels: List<ChannelResponse>)`

**`livetv/ChannelApi.kt`**
- `suspend fun getChannels(recentlyWatched: Boolean = false, favoritesFirst: Boolean = false): List<ChannelResponse>` → `GET /channels` with query params
- Uses the existing `App.apiClient.apiHttpClient` and `kotlinx.serialization`
- No raw stream URLs returned; all streams resolved separately via playback endpoint

**`livetv/ChannelRepository.kt`**
- `suspend fun recentChannels(): List<ChannelResponse>` (calls `getChannels(recentlyWatched = true)`, empty list on empty/error)
- `suspend fun favoriteChannels(): List<ChannelResponse>` (calls `getChannels(favoritesFirst = true)`, filtered client-side by `isFavorite`)
- `suspend fun allChannels(): List<ChannelResponse>` (calls `getChannels()`)
- All three functions return empty list rather than propagating 404/empty — callers decide visibility

**`livetv/LiveTvHomeViewModel.kt`**
- `sealed class LiveTvHomeState { Loading; Error(message); Ready(recent, favorites, all) }`
- Launches the three parallel coroutines on `viewModelScope`; merges into `StateFlow<LiveTvHomeState>`
- No dependency on VOD ViewModels or `CommandViewModel`

**`livetv/LiveTvHomeScreen.kt`**
- Compose TV screen using `TvLazyColumn` / `TvLazyRow` (Compose TV Foundation)
- Three conditional sections, each hidden when the list is empty:
  - "Recently Watched" (`TvLazyRow` of channel cards)
  - "Favorites" (`TvLazyRow` of channel cards)
  - "All Channels" (`TvLazyColumn` or `TvLazyRow` of channel cards)
- Channel card shows: logo (coil `AsyncImage`), channel name, EPG now/next when present, category badge
- EPG block omitted silently when `epg == null` — no placeholder fake schedule
- Loading state: full-screen centered `CircularProgressIndicator` (orange tint)
- Error state: centered error message + retry button; focus lands on retry
- Empty state (all three sections empty): centered "No channels available" text
- Focus enters first card of first non-empty section on screen open
- Back key: calls `onBack()` lambda → returns to VOD home
- `@Composable fun LiveTvHomeScreen(viewModel: LiveTvHomeViewModel, onBack: () -> Unit)`

### Theme changes

**`ui/TvTheme.kt`**
- Add `val LiveTvAccent = Color(0xFFFF8C00)` (orange) to `TvColors`
- Keep existing `Accent = Color(0xFFE50914)` (red) for VOD untouched
- No separate theme object; all screens choose between `Accent` and `LiveTvAccent` explicitly

### Navigation changes

**`AppNavGraph.kt`**
- Add `LiveTvHome` to the `Screen` enum
- In the main `when(currentScreen.value)` block add `Screen.LiveTvHome → LiveTvHomeScreen(vm, onBack = { currentScreen.value = Screen.Home })`
- Mode entry: `Screen.Home` passes `onSwitchToLiveTv = { currentScreen.value = Screen.LiveTvHome }` to `HomeScreen`
- No other nav changes; existing Pairing / WhoIsWatching / Player flows untouched

### VOD home changes

**`home/HomeScreen.kt`**
- Add a mode toggle bar at the top of the screen: two `TvButton`s — "VOD" and "TV"
- "VOD" is selected/highlighted with red accent; "TV" with orange accent; focus uses D-pad left/right
- Selecting "TV" calls `onSwitchToLiveTv()` lambda; "VOD" is a no-op (already on VOD)
- Toggle bar sits above the "Continue Watching" row; back from it should not exit the app
- Signature change: `@Composable fun HomeScreen(..., onSwitchToLiveTv: () -> Unit)`

### App wiring

**`App.kt`**
- Instantiate `ChannelApi(apiClient)` and `ChannelRepository(channelApi)` in the application container
- Pass `channelRepository` when constructing `LiveTvHomeViewModel` (via `viewModels { }` factory or manual factory)

### Tests

**`livetv/ChannelApiParserTest.kt`**
- Unit-test JSON deserialization of `ChannelResponse` in four cases:
  - Full response (name, logo, categories, EPG now + next, isFavorite)
  - EPG absent (`epg` field null)
  - Logo absent
  - Minimal response (only `id` and `name`)

**`livetv/LiveTvHomeViewModelTest.kt`**
- Mock `ChannelRepository`; test:
  - All three sections loading → `Loading` state
  - All three resolve → `Ready` state with correct data
  - All three return empty → `Ready` with all-empty lists (not Error)
  - Network error in one section → other sections still show, error surfaced in state (or treated as empty — document the choice)

**`livetv/ModeSwitchTest.kt`**
- Pure logic / state-machine unit test (no Compose infra):
  - Starting at `Screen.Home`, invoking `onSwitchToLiveTv` updates state to `Screen.LiveTvHome`
  - Invoking `onBack` from `LiveTvHomeScreen` returns to `Screen.Home`
  - `Screen.Player` is reachable from VOD home; `Screen.LiveTvHome` does not share the Player navigation path in this ticket

**Existing test suite** — run as regression check, no modifications expected.

## Excluded

- Channel playback initiation, player overlay, and zapping from the Live TV home (follow-up ticket)
- Resolving `POST /channels/:id/playback/resolve` and passing to the player — deferred
- Channel search within TV mode
- Category-filtered channel browsing page
- Favorites add/remove actions from Android TV
- EPG guide / full schedule view
- Any changes to the backend API, database, or channel canonical model
- Changes to the web Live TV app (`apps/live-tv`)
- Changes to the pairing flow, profile selection, or auth system
- Android TV player changes (VOD playback paths remain untouched)

## Acceptance criteria

- `Screen.LiveTvHome` exists in the `Screen` enum and is reachable by activating the "TV" toggle from the VOD home screen using D-pad only.
- Pressing back from `LiveTvHomeScreen` returns to `Screen.Home` (VOD) and does not exit the app.
- `TvColors.LiveTvAccent` is defined as an orange constant (`0xFFFF8C00`); `TvColors.Accent` (red) is unchanged.
- `LiveTvHomeScreen` displays channel data from `GET /channels` (canonical backend API); no raw stream URL or provider-specific deduplication is done on the Android side.
- Channels with EPG data show `now.title`; channels without EPG show no placeholder text.
- `LiveTvHomeScreen` renders a loading indicator, an error message with retry button, and an empty-state message in the three corresponding states — confirmed by `LiveTvHomeViewModelTest`.
- The "Recently Watched" and "Favorites" sections are hidden (not shown as empty rows) when their lists are empty.
- `ChannelApiParserTest` passes for all four JSON shapes (full, no-EPG, no-logo, minimal).
- `ModeSwitchTest` passes: VOD→TV and TV→VOD navigation transitions are correct.
- `./gradlew :app:test` passes with no regressions in existing tests (`CommandParserTest`, `PlaybackResolverTest`, etc.).
- No channel ID, stream URL, or category string is hardcoded in Android TV source files.
