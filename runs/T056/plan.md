## Objective

Turn the existing `apps/android-tv` Kotlin skeleton into a minimal companion player: pair once with an IPTVFlix account, receive remote playback commands over SSE, play Movies/Episodes with Media3 ExoPlayer, and report viewing progress back to the shared Continue Watching state.

## Included

### Build configuration

- **`apps/android-tv/gradle/libs.versions.toml`** — add library versions for: AndroidX Media3 (exoplayer, ui, session) 1.3.x, Jetpack Compose for TV (tv-foundation, tv-material) 1.0.x, Compose runtime/navigation, Kotlin Coroutines 1.8.x, OkHttp 4.12.x, Kotlinx Serialization JSON, AndroidX DataStore (preferences), Security-Crypto (EncryptedSharedPreferences).
- **`apps/android-tv/app/build.gradle.kts`** — enable `buildFeatures { compose = true }`, set `composeOptions.kotlinCompilerExtensionVersion`, add all new catalog aliases as `implementation`/`testImplementation` dependencies.

### Network layer

- **`network/ApiClient.kt`** — singleton OkHttp client; device-token interceptor reads token from `SecureStorage` and injects `Authorization: Bearer <token>` on every request; base URL from `BuildConfig.API_BASE_URL`.
- **`network/SseClient.kt`** — wraps OkHttp streaming response; parses `data:` lines from `/devices/me/commands/stream`; emits parsed JSON strings via `Flow<String>`; reconnects with bounded exponential backoff (1 s → 2 s → 4 s → … cap 60 s) on `IOException`; emits heartbeat pings as keepalive (not surfaced to callers); stops cleanly on cancellation.

### Secure storage

- **`storage/SecureStorage.kt`** — thin wrapper around `EncryptedSharedPreferences` (AES256-GCM key in Android Keystore); exposes `saveDeviceToken(token: String)`, `getDeviceToken(): String?`, `clearDeviceToken()`; never logs or leaks token value.

### Pairing flow

- **`pairing/PairingApi.kt`** — Retrofit-style or raw OkHttp calls to:
  - `POST /pairing/codes` → `PairingCodeResponse(code, expiresAt)` (no auth)
  - `GET /pairing/codes/{code}/status` (long-poll, 30 s timeout) → `PairingStatusResponse(status, deviceToken?)`
- **`pairing/PairingRepository.kt`** — orchestrates pairing state machine: `Idle → Requesting → PollingCode(code, expiresAt) → Approved(deviceToken) | Expired`; saves `deviceToken` to `SecureStorage` on approval; handles code expiry (re-request).
- **`pairing/PairingViewModel.kt`** — `StateFlow<PairingUiState>` (loading / showing code / approved / error); exposes the 8-char code string for display and its raw value for QR rendering.
- **`pairing/PairingScreen.kt`** — Compose for TV screen: large code text, QR code image (encode code string with ZXing-Android-Embedded or draw raw SVG bitmap), countdown timer, retry button on expiry; no pairing in progress if `SecureStorage` already holds a token (skip directly to Home).

### Command reception

- **`command/CommandModels.kt`** — data classes mirroring the SSE payload: `PlaybackCommand(id, mediaType, mediaId, availabilityId?, startPositionMs)` and sealed `CommandState`.
- **`command/CommandParser.kt`** — pure function `parseCommand(json: String): PlaybackCommand?`; ignores unrecognised fields; returns `null` on parse error (logged, not thrown).
- **`command/CommandRepository.kt`** — collects from `SseClient`; deduplicates by `commandId` (in-memory `Set<UUID>` of acknowledged ids, cleared on reconnect only for expired window); calls `POST /devices/me/commands/{id}/ack` immediately after delivering command to caller; polling fallback: `GET /devices/me/commands` polled every 10 s when SSE fails to establish after 3 attempts.
- **`command/CommandViewModel.kt`** — `SharedFlow<PlaybackCommand>` surfaced to the nav graph; triggers navigation to `PlayerScreen`.

### Playback resolution

- **`playback/PlaybackApi.kt`** — calls the secure playback API introduced in #99 (assumed route: `GET /playback/{mediaType}/{mediaId}?availabilityId=…`); sends device token in `Authorization` header; returns a `PlaybackDescriptor` (stream URL, optional DRM config, available audio/subtitle track metadata). **Assumption:** the #99 API contract must be confirmed before implementation; if the route shape differs, only this file changes.
- **`playback/PlaybackResolver.kt`** — translates a `PlaybackCommand` into a `PlaybackDescriptor` via `PlaybackApi`; propagates `startPositionMs` and `availabilityId` from the command.

### Media3 player

- **`player/PlayerViewModel.kt`** — holds `ExoPlayer` instance (created once per composable lifecycle scope); builds `MediaItem` from `PlaybackDescriptor` (URI + optional DRM `MediaItem.DrmConfiguration`); sets `seekTo(startPositionMs)`; exposes `StateFlow<PlayerUiState>` (buffering / playing / paused / error); surfaces available audio/subtitle track groups from `Player.Listener.onTracksChanged`; exposes `selectTrack(group, index)` using `ExoPlayer.trackSelectionParameters`; disposes player in `onCleared`.
- **`player/PlayerScreen.kt`** — `AndroidView` hosting `PlayerView` (or `StyledPlayerView`) with `useController = false`; custom D-pad overlay (Compose): play/pause (OK), seek ±10 s (left/right), back/stop (Back key), track selector panel (triggered by Menu/Up long-press); overlay auto-hides after 3 s of inactivity; error state shows message + retry/back buttons (recoverable, no crash).

### Progress reporting

- **`progress/ProgressReporter.kt`** — coroutine launched alongside playback; calls `PUT /progress/{mediaType}/{mediaId}` with `{progressSeconds, durationSeconds}` every 15 s while playing; also reports on player pause, stop, and `PlayerViewModel.onCleared`; uses device token auth; silently retries once on network error, then drops (progress loss is acceptable vs. blocking playback).

### Home / idle screen

- **`home/HomeViewModel.kt`** — `StateFlow<HomeUiState>`: device name (from `devices.name`, fetched via a `GET /devices/me` call added to the API — **Assumption:** this endpoint either exists from #104 or needs a one-line addition to `apps/api/src/routes/devices.ts`), connection status (connected/reconnecting), optional last-played media (title + posterUrl from `GET /continue-watching` first item).
- **`home/HomeScreen.kt`** — Compose for TV: device name, connection indicator, poster + title of most recent media if available; "Waiting for play command…" copy when idle; no catalog grid.

### Navigation

- **`AppNavGraph.kt`** — Compose Navigation: `Pairing` (shown if no stored token) → `Home` (default after pairing) → `Player` (push on incoming command, pop on back/stop); deep-link from `CommandViewModel` to `Player` without going through `Home` again.
- **`MainActivity.kt`** — set Compose `setContent { AppNavGraph() }`; request `INTERNET` permission check (already declared); handle back-press on Player screen to stop and return to Home.

### Tests (unit, no real IPTV account required)

- **`command/CommandParserTest.kt`** — valid Movie command, valid Episode command, missing fields, unknown `mediaType`, malformed JSON all exercised.
- **`pairing/PairingStateMachineTest.kt`** — transitions: Idle→Requesting→PollingCode→Approved and →Expired→re-request; token saved on approval; no token saved on expiry.
- **`command/ReconnectBackoffTest.kt`** — backoff sequence capped at 60 s; deduplication prevents the same `commandId` being emitted twice; SSE reconnect replays only unacknowledged commands.
- **`progress/ProgressReporterTest.kt`** — progress PUT called at 15 s intervals; called on pause; not called when player is idle.
- **`player/MediaItemBuilderTest.kt`** — `PlaybackDescriptor` with plain URI → correct `MediaItem`; descriptor with DRM config → `MediaItem.DrmConfiguration` present; `startPositionMs` threaded through correctly.

## Excluded

- Full Netflix-style TV catalog browsing or content grid.
- TV-native recommendations / shelves.
- Trailer autoplay / browsing previews.
- Live TV / EPG.
- Chromecast receiver.
- Any backend schema changes beyond a possible one-line `GET /devices/me` route addition (and only if that route does not already exist from #104).
- Multi-profile support or profile switching on TV.
- Offline/download playback.
- DRM key server implementation (consumed only, not authored here).
- Play Store / signing / release configuration.

## Acceptance criteria

1. A fresh install with no stored token shows the Pairing screen with the 8-char code and QR value; after web approval the device token is stored and the app transitions to the Home screen without re-entering pairing.
2. The Home screen shows device name and "Waiting for play command…" — no catalog grid.
3. Sending a Movie command from the web (`POST /devices/:id/commands`) starts ExoPlayer playback within 3 s on a local network; the command is acknowledged (`state = acknowledged`) so it is not replayed on reconnect.
4. Sending an Episode command with `startPositionMs = 30000` begins playback at 30 s (verified by `Player.currentPosition` ≥ 28 s after seek).
5. D-pad OK → play/pause toggles; D-pad left/right → ±10 s seek; Back key → stops playback and returns to Home.
6. `PUT /progress/{mediaType}/{mediaId}` is called every 15 s during playback and once on pause/stop; the call appears in Continue Watching (`GET /continue-watching` returns the item).
7. When the stream exposes multiple audio or subtitle tracks, the track selector overlay lists them and `selectTrack` switches the active track.
8. Killing the network connection during SSE and restoring it reconnects within one backoff cycle and does not deliver the same command a second time.
9. After revoking the TV device (`revokedAt` set), subsequent `GET /devices/me/commands/stream` returns 401 and the app shows a "Device revoked — please pair again" screen; stored token is cleared.
10. A stream that fails to load (bad URL or unsupported codec) shows a recoverable error card with "Retry" and "Back" actions; the app does not crash and `ExoPlayer` is released cleanly.
11. All five unit test files (`CommandParserTest`, `PairingStateMachineTest`, `ReconnectBackoffTest`, `ProgressReporterTest`, `MediaItemBuilderTest`) pass with `./gradlew :app:test`.
12. No device token, stream URL, or provider credential appears in `Logcat` output at `DEBUG` level or above.
