All three fixes are in place and consistent across the source files:

**Fix 1 (Medium — error state now reachable):**
- `ChannelRepository.kt`: added `allChannelsOrThrow()` that propagates exceptions (existing callers of `allChannels()` are untouched)
- `LiveChannelSelectorViewModel.kt`: calls `allChannelsOrThrow()` so the `runCatching` fold now correctly reaches the `Error` branch on network failure
- `LiveChannelSelectorViewModelTest.kt`: all four test stubs updated to `allChannelsOrThrow()`

**Fix 2 (Minor — empty-list message):**
- `LiveChannelSelectorOverlay.kt`: `Ready` branch now shows "Aucune chaîne disponible" when `channels.isEmpty()`, while keeping `rememberTvLazyListState` / `remember` / `LaunchedEffect` unconditional (Compose rules preserved)

**Fix 3 (Minor — OK-press guard):**
- `PlayerScreen.kt`: `onChannelSelected` now checks `loadingChannelId == null` before starting a switch, preventing d-pad repeat from firing redundant loads while a switch is already in-flight
