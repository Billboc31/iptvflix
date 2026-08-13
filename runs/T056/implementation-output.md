All files look correct. Here's a summary of every change made:

---

## Changes applied

**3 blockers fixed:**

| File | Fix |
|---|---|
| `player/PlayerViewModel.kt` | Added `onTracksChanged` in the `Player.Listener` — maps ExoPlayer `Tracks.Group` objects to `TrackInfo` + builds `exoTracksMap` keyed by generated IDs. `_availableTracks` is now populated from the real ExoPlayer event instead of the API descriptor. |
| `player/PlayerViewModel.kt` | Implemented `selectTrack()` — looks up the `ExoTrackRef` from `exoTracksMap` and calls `player.trackSelectionParameters.buildUpon().clearOverrides().addOverride(TrackSelectionOverride(...)).build()`. |
| `player/PlayerViewModel.kt` | Fixed `onCleared()` — replaced `viewModelScope.launch { reportNow() }` (which was dropped when the scope cancelled) with `runBlocking(NonCancellable) { runCatching { withTimeout(2_000L) { reportNow() } } }`. |

**4 minors fixed:**

| File | Fix |
|---|---|
| `storage/SecureStorage.kt` | Migrated from deprecated `MasterKeys.getOrCreate()` to `MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build()`. Updated `EncryptedSharedPreferences.create()` to the new signature. |
| `command/CommandRepository.kt` | Removed the local `private object Collections` wrapper; `acknowledgedIds` now calls `java.util.Collections.synchronizedSet(...)` directly. |
| `command/ReconnectBackoffTest.kt` | Added `after 3 SSE failures repository switches to polling` — mocks SSE to throw `IOException`, verifies `commandStream()` is called exactly 3 times and the resulting command comes from the poll endpoint. |
| `player/MediaItemBuilderTest.kt` | Renamed test #4 from the misleading `startPositionMs is propagated through the command to load call` to `descriptor streamUrl is preserved as spec uri`, which accurately describes what the assertion checks. |
