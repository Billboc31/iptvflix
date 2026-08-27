All tests pass. Here's a summary of the implementation:

## Files modified

**`livetv/ChannelRepository.kt`** — added `searchLiveTV(query)` delegating to the existing `api.searchLiveTV()`, propagating exceptions so callers own the error state.

**`livetv/LiveTvHomeScreen.kt`** — added `onOpenSearch: () -> Unit = {}` parameter; header row now has a focusable "⌕ Rechercher" button that calls it; propagated through `ReadyContent`.

**`AppNavGraph.kt`** — added `LiveTvSearch` to the `Screen` enum; wired `onOpenSearch` on `LiveTvHome`; added the `LiveTvSearch` branch rendering `LiveSearchScreen` with `onLiveNowSelected` and `onChannelSelected` both building a `PlaybackCommand(mediaType = "channel", …)` and navigating to `Screen.Player`.

## Files created

**`livetv/LiveSearchViewModel.kt`** — sealed state `Idle | Loading | Results | NoResults | Error`; `onQueryChanged` with 400ms debounce via job cancellation; `onVoiceResult` re-enters the same path; `clearQuery` cancels and resets to `Idle`; `isSingleLiveNowResult` computed from current state; companion `factory`.

**`livetv/LiveSearchScreen.kt`** — full-screen composable: search bar with `BasicTextField` + orange underline-on-focus + conditional mic button via `RecognizerIntent`; `TvLazyColumn` result sections "En direct maintenant" / "À venir" / "Chaînes" each with orange 3dp focus border; single-live result auto-focuses and shows "Lancer · EN DIRECT" label; upcoming items are focusable but do not launch playback; empty/loading/error/idle states.

**`test/livetv/LiveSearchViewModelTest.kt`** — 11 JUnit 4 + MockK tests covering all plan scenarios; uses `advanceUntilIdle()` to drain the debounce delay in virtual time.
