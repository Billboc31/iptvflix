Java is not available in this environment, so unit tests cannot be executed. I'll note this as a validation limit. Let me now write the test report.

---

# Test Report — T056: Build minimal Android TV companion player with Media3

**Reviewer**: Tester agent  
**Date**: 2026-08-13  
**Branch**: `ticket/T056-build-minimal-android-tv-companion-player-with-med`  
**Scope**: Static code analysis + unit test review (runtime execution not possible — no JVM in environment)

---

## Validation Method

Unit tests reviewed as code (`src/test/`). Behaviour traced through implementation source files for each acceptance criterion. Gradle wrapper present but JVM unavailable — tests could not be executed. Each AC was verified by reading the full call chain from entry point to side effect.

---

## Acceptance Criteria

### AC1 — A fresh install can pair with an IPTVFlix account/device flow
**Status: PASS**

- `PairingApi.requestCode()` POSTs to `/pairing/codes`; `pollStatus()` polls `/pairing/codes/{code}/status` every 3 s.
- `PairingRepository.runPairingFlow()` drives the full state machine: Idle → Requesting → PollingCode → Approved/Expired/Error.
- `PairingScreen` renders a ZXing QR code and the numeric code in monospace.
- On approval, `SecureStorage.saveDeviceToken()` stores the token with AES256-GCM encryption.
- `AppNavGraph` routes to Home once the token is present.
- **Tests**: `PairingStateMachineTest` covers: approval stores token, expiration skips token, code is exposed in `PollingCode` state, first state is `Requesting`.

---

### AC2 — After pairing, the app shows a simple ready/connected state, not a duplicated Web catalog
**Status: PASS**

- `HomeScreen` shows device name, a connection-status badge (green/orange/red), "Waiting for play command…", and optionally the last played title from `/continue-watching`.
- No catalog browsing, shelf, or recommendation UI exists anywhere in the codebase.
- `AppNavGraph` routes to `HomeScreen` (not Player/Pairing) whenever a token is present and no command has arrived.

---

### AC3 — Sending a valid Movie command from the backend starts playback automatically
**Status: PASS**

Full chain: `SseClient.commandStream()` → `CommandParser.parseCommand()` → `CommandRepository.commands()` (deduped) → `CommandViewModel._commands` (SharedFlow, replay=1) → `AppNavGraph` `LaunchedEffect(latestCommand)` navigates to `Screen.Player` → `PlayerScreen` calls `vm.load(command)` → `PlaybackApi.resolvePlayback()` → `buildMediaItem()` → `ExoPlayer.prepare() + playWhenReady = true`.

---

### AC4 — Sending an Episode command starts the correct episode and supports resume position
**Status: PASS**

- `PlaybackCommand` carries `mediaType`, `mediaId`, `availabilityId?`, `startPositionMs`.
- `PlaybackApi.resolvePlayback()` passes `availabilityId` as a query param: `/playback/{mediaType}/{mediaId}?availabilityId=…`.
- `PlayerViewModel.load()`: `player.seekTo(command.startPositionMs)` is called after `prepare()`.
- **Tests**: `CommandParserTest` validates an episode JSON with `resumePositionMs`; `MediaItemBuilderTest` verifies the URL is preserved on the MediaItem.

---

### AC5 — Play/pause/seek/back work with a standard Android TV remote
**Status: PASS**

`PlayerScreen.onKeyEvent` maps:

| Key | Action |
|-----|--------|
| D-Pad Center / MediaPlay / MediaPause | `togglePlayPause()` |
| D-Pad Right | `seekForward()` (+10 s) |
| D-Pad Left | `seekBack()` (-10 s, clamped to 0) |
| D-Pad Up | shows TrackSelectorPanel |
| Back | `stop()` + `onStop()` → back to Home |

On-screen `ControlsOverlay` buttons duplicate all key actions and auto-hide after 3 s.

---

### AC6 — Playback progress is written back to the shared profile/Continue Watching state
**Status: PASS**

- `ProgressReporter.start()` PUT `/progress/{mediaType}/{mediaId}` every 15 s while `player.isPlaying`.
- `togglePlayPause()` when pausing calls `progressReporter?.reportNow()`.
- `stop()` calls `progressReporter?.reportNow()` under `NonCancellable`.
- `PlayerViewModel.onCleared()` does a final `runBlocking(NonCancellable) { withTimeout(2000) { reportNow() } }` to flush before ViewModel destruction.
- Reports are skipped silently when `positionMs <= 0`.
- **Tests**: `ProgressReporterTest` — 4 tests covering: periodic (every 15 s), not called when idle, immediate `reportNow()`, twice over 30 s.

---

### AC7 — Audio/subtitle selection is available when the stream exposes tracks
**Status: PASS**

- `PlayerViewModel.onTracksChanged()` iterates `Tracks.groups`, collects `C.TRACK_TYPE_AUDIO` and `C.TRACK_TYPE_TEXT` groups into `_availableTracks`.
- `TrackSelectorPanel` renders when `tracks.isNotEmpty()` (opened by D-Pad Up).
- `selectTrack(id)` applies `TrackSelectionOverride` via `trackSelectionParameters`.
- Track labels use `format.label ?: format.language ?: "$type $trackIdx"` — no TV-side ranking invented.

**Minor observation** (non-blocking): `PlaybackDescriptor.tracks` from the backend API is deserialized but not displayed in the track panel — only tracks detected by Media3 from the live stream appear. This is the correct behavior for a companion player (the stream's actual tracks take precedence), but the backend metadata field is unused.

---

### AC8 — Network reconnect does not duplicate playback commands
**Status: PASS**

- `CommandRepository.acknowledgedIds` is a `Collections.synchronizedSet<String>`.
- Before emitting a command the ID is checked; if absent it is added and the command is emitted; if present it is silently dropped.
- `acknowledgeCommand()` also POSTs `/devices/me/commands/{id}/ack` so the server will not re-queue it.
- `SseClient` exponential backoff: 1 s → 2 → 4 → 8 → 16 → 32 → 60 s cap; resets `attempt = 0` on successful connection.
- **Tests**: `ReconnectBackoffTest` — validates backoff sequence (all 6 steps + cap), deduplication (same JSON emitted twice → only one command emitted), and 401 → `onRevoked()` callback.

**Note**: `acknowledgedIds` is in-memory only. A process-kill + restart would reset it; however, the server-side `ack` prevents re-delivery at the source, so this is acceptable.

---

### AC9 — Revoking the TV device stops future authenticated command delivery
**Status: PASS**

Revocation is handled by two independent paths:

1. **SSE path**: `SseClient` 401 → throws `UnauthorizedException` → `CommandRepository` catches it → `onRevoked()` → `CommandViewModel` clears token (`secureStorage.clearDeviceToken()`) + sets `_isRevoked = true` → `AppNavGraph` `LaunchedEffect(isRevoked)` navigates to Pairing.
2. **Polling path**: `HomeViewModel.monitorConnection()` catches `ApiException(code=401)` on `/devices/me` → sets `ConnectionStatus.Revoked` → `HomeScreen.onRevoked()` → Pairing.

Token is cleared from `EncryptedSharedPreferences` on path 1; path 2 navigates to Pairing without clearing (would fail again on next app start and navigate to Pairing via HomeViewModel). Both paths prevent further command delivery.

---

### AC10 — Playback failures show a clear recoverable error state
**Status: PASS**

- `Player.Listener.onPlayerError()` → `PlayerUiState.Error(error.message ?: "Playback failed")`.
- `PlayerViewModel.load()` wraps `runCatching`; on failure → `PlayerUiState.Error(e.message ?: "Failed to load media")`.
- `PlayerScreen` shows `ErrorOverlay`: "Playback error" header, error message text, **Retry** button (calls `vm.load(command)` again), **Back** button (stops and returns to Home).
- App does not crash on `PlaybackException` — error code is logged, not rethrown.

---

## Regressions

No regressions observed. The Android TV module is self-contained under `apps/android-tv/` and has no shared code with the web front-end or other modules. No existing tests were modified.

---

## Security Checks

| Concern | Verdict |
|---------|---------|
| Device token storage | AES256-GCM via EncryptedSharedPreferences — secure |
| Token in logs | Only `Log.w` on revocation (`"Device revoked — clearing token"`), no token value logged |
| Stream URL / DRM license URL | Not persisted, not logged |
| Authorization header injection | Applied by `ApiClient` interceptor from SecureStorage at request time |
| Credentials in general app state | Not present — `PlaybackDescriptor` is transient in ViewModel |

---

## Blocking Issues

**None.**

---

## Summary

All 10 acceptance criteria are implemented and verified through static analysis and test code review. Unit tests could not be executed (no JVM in environment) but the 5 test files cover the five highest-risk areas: pairing state machine, progress reporter timing, reconnect backoff, command deduplication/revocation, and MediaItem construction. The implementation is minimal and focused — no catalog UI, no catalog browsing, no live TV — consistent with the out-of-scope exclusions.

**Verdict: PASS** — implementation satisfies T056 acceptance criteria.
