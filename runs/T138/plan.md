## Objective

Add a universal Live TV search screen to the Android TV app that lets the user find canonical channels and EPG programs by text or voice, groups results by live/upcoming/channel, and launches live playback through the existing source-selection/failover path.

## Included

### New files

**`apps/android-tv/app/src/main/kotlin/com/iptvflix/androidtv/livetv/LiveSearchViewModel.kt`**
- Sealed state: `Idle | Loading | Results(liveNow, upcoming, channels, query) | NoResults | Error`.
- `fun onQueryChanged(q: String)` — debounce 400 ms, cancel previous job, call `repository.searchLiveTV(q)`, update state.
- `fun onVoiceResult(text: String)` — feeds text into the same `onQueryChanged` path.
- `fun clearQuery()` — resets to `Idle`.
- Expose `val isSingleLiveNowResult: Boolean` derived from state — `true` when `liveNow.size == 1` (used by the UI to show the prominent launch affordance).
- Factory via companion `factory(app: App)`.

**`apps/android-tv/app/src/main/kotlin/com/iptvflix/androidtv/livetv/LiveSearchScreen.kt`**

Top-level layout (dark background, orange identity):
- Full-width search bar at the top: focusable `BasicTextField` styled with orange underline/border on focus; microphone icon button on the right.
- Voice button launches `RecognizerIntent.ACTION_RECOGNIZE_SPEECH` via `rememberLauncherForActivityResult`; hidden/disabled if the device has no activity to handle the intent (checked with `PackageManager.resolveActivity`).
- Spoken text is shown as the query text; user can edit it.
- Result area below: `TvLazyColumn` with three optional sections rendered in order when non-empty:
  1. **"En direct maintenant"** — one row per `LiveNowResult`: channel logo, channel name, program title, `EN DIRECT` orange badge, progress bar, start–end time. Orange focus border (3 dp). Selecting a result launches playback (see Playback integration below). When `isSingleLiveNowResult` is true, the single card auto-receives focus and its label reads `Lancer · EN DIRECT` so one OK press is sufficient — no timed auto-launch.
  2. **"À venir"** — one row per `UpcomingResult`: channel logo, channel name, program title, **date + local time in large text** (formatted from ISO-8601 `startTime`), optional relative label (`ce soir` / `demain`) alongside the absolute time. Selecting does not start playback; it requests focus/shows details inline (reminder affordance is a no-op stub).
  3. **"Chaînes"** — one row per `ChannelSearchResult` using the same `ChannelListRow` shape from `LiveTvHomeScreen`. Selecting starts the channel normally.
- Empty state: `"Aucun programme trouvé"` when results are empty for a non-empty query; network/API failure shows `"Erreur de recherche"` with a Réessayer button.
- Idle state (empty query): prompt text, no sections.
- Loading spinner (orange, same `LoadingContent` pattern as `LiveTvHomeScreen`).
- Focus: on first results render, D-pad focus goes to the first card of the first non-empty section; focus is restored to the search bar when results are cleared.
- `BackHandler`: navigate back to `LiveTvHome`.

**`apps/android-tv/app/src/test/kotlin/com/iptvflix/androidtv/livetv/LiveSearchViewModelTest.kt`**

Tests (JUnit 4 + MockK + `UnconfinedTestDispatcher`):
- Channel-name query → `Results` with non-empty `channels`, empty `liveNow`/`upcoming`.
- Program-name query with live match → `Results.liveNow` non-empty, `Results.upcoming` empty.
- Program-name query with future match only → `Results.upcoming` non-empty, `Results.liveNow` empty.
- Query returning multiple live matches → `isSingleLiveNowResult == false`.
- Query returning exactly one live match → `isSingleLiveNowResult == true`.
- Voice result text fed through `onVoiceResult` produces same state as `onQueryChanged` with same text.
- Query cleared via `clearQuery()` → state is `Idle`.
- API error → state is `Error`.
- Empty query → state is `Idle`, no API call.
- Focus restoration: after `clearQuery()`, `isSingleLiveNowResult == false`.
- No-EPG behavior: a query that matches only channel names (API returns empty `liveNow`/`upcoming`, non-empty `channels`) still produces `Results` with `channels` populated.

### Modified files

**`apps/android-tv/app/src/main/kotlin/com/iptvflix/androidtv/livetv/ChannelRepository.kt`**
- Add `suspend fun searchLiveTV(query: String): LiveSearchResponse` — calls `api.searchLiveTV(query)`, propagates exceptions (callers handle error state).

**`apps/android-tv/app/src/main/kotlin/com/iptvflix/androidtv/AppNavGraph.kt`**
- Add `LiveTvSearch` to the `Screen` enum.
- In the `LiveTvHome` branch, pass `onOpenSearch = { currentScreen = Screen.LiveTvSearch.name }` to `LiveTvHomeScreen`.
- Add `Screen.LiveTvSearch` branch: render `LiveSearchScreen` with:
  - `onBack = { currentScreen = Screen.LiveTvHome.name }`
  - `onChannelSelected = { ch → commandVm.playLocal(PlaybackCommand(…)); currentScreen = Screen.Player.name }` (same pattern as the existing `LiveTvHome → Player` transition).
  - `onLiveNowSelected = { result → commandVm.playLocal(PlaybackCommand(mediaType = "channel", mediaId = result.channelId, title = result.channelName, posterUrl = result.logoUrl)); currentScreen = Screen.Player.name }`.

**`apps/android-tv/app/src/main/kotlin/com/iptvflix/androidtv/livetv/LiveTvHomeScreen.kt`**
- Add a focusable "Rechercher" button (orange, D-pad reachable) in the header area of `ReadyContent`, invoking a new `onOpenSearch: () -> Unit` callback parameter on `LiveTvHomeScreen`.

### Playback integration

Selecting a live result builds a `PlaybackCommand(mediaType = "channel", mediaId = result.channelId, …)` and calls `commandVm.playLocal()`, navigating to `Screen.Player`. The existing `PlaybackResolver` handles source selection and failover. No change to the player or zapper.

### No backend changes

The API route `GET /channels/search?q=` and `live-search-service.ts` are already implemented (T137). No backend modifications in this ticket.

## Excluded

- Reminder scheduling (`Me prévenir`, calendar integration) — stub only.
- Changes to the EPG backend, search algorithm, or deduplication logic.
- Timed auto-launch countdown affordance — requires one explicit OK press.
- Zapping or channel-overlay changes.
- VOD/movie/series search.
- Always-listening microphone.
- Analytics or telemetry.
- Favorites or watch-history from search results.

## Acceptance criteria

- D-pad navigates from `LiveTvHome` to the Search screen via the "Rechercher" button and back with BACK.
- Typing `TF1` returns the TF1 channel card in the "Chaînes" section.
- Typing `US Open` (when live) returns at least one card in "En direct maintenant" with channel logo, program title, and `EN DIRECT` badge.
- Typing `US Open` (when future) returns cards in "À venir" with date + local time, no EN DIRECT badge, and pressing OK does not start playback.
- When multiple channels broadcast the same live program, all appear as separate cards in "En direct maintenant".
- When exactly one live result exists, it auto-receives D-pad focus so a single OK press launches playback (no timed auto-launch).
- Selecting a live or channel result starts the canonical channel via `PlaybackResolver` and enters the normal Live player with zapping available.
- The microphone button is visible and focusable; spoken query text appears in the search field as editable text; the button is absent on devices without a voice recognizer.
- All focusable elements use the orange (`TvColors.LiveTvAccent`) focus border (3 dp) and the dark background (`TvColors.Background`).
- No `ChannelSource`-level duplicates appear — each canonical channel appears at most once per section.
- Querying a channel name when EPG is unavailable (empty `liveNow`/`upcoming`) still returns a result in "Chaînes".
- Empty query shows no sections and no loading spinner.
- API error shows "Erreur de recherche" with a focusable Réessayer button.
- All test cases in `LiveSearchViewModelTest` pass.
