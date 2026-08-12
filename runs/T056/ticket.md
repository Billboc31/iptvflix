# T056 — Build minimal Android TV companion player with Media3 and remote-command support

**Source**: GitHub Issue #105

## Description

## Objective

Turn the existing Android TV project skeleton into a deliberately simple IPTVFlix playback companion: pair once, stay connected to IPTVFlix, receive remote play commands, and play Movies/Episodes reliably with Media3.

## Product intent

Do not duplicate the full Web application on TV in this phase. The primary interaction is: choose content on phone/desktop Web → tap `Play on TV` → the Android TV app launches playback. The TV app should also remain usable with a remote for basic playback and status.

## Included

- Build on the existing `apps/android-tv` project using Kotlin + Jetpack Compose for TV and AndroidX Media3.
- Add first-run pairing UI showing the pairing code and/or QR value from the backend device-pairing flow (#104).
- Persist the paired device credential securely on-device.
- Maintain the backend command connection and reconnect with bounded backoff after network/app interruptions.
- On a valid remote playback command:
  - resolve the canonical Movie/Episode through the secure playback API from #99;
  - start playback with Media3;
  - honor requested/resume position;
  - acknowledge command state so it is not replayed accidentally.
- Provide a minimal TV home/idle screen showing device name/status and, when available, current/recent media artwork/title.
- Add TV-remote controls for play/pause, seek, back/stop and track selection where Media3 exposes it safely.
- Support audio/subtitle tracks and surface the selected Availability/variant semantics from the backend rather than inventing TV-side ranking.
- Report viewing progress periodically and on pause/stop to the existing IPTVFlix progress model.
- Handle unsupported codecs/stream errors with a usable TV error state instead of crashing.
- Keep source credentials out of general app state/logging; use only the dedicated playback descriptor/session contract.
- Add enough instrumentation/tests to validate command parsing, pairing state, reconnect behavior, progress updates and Media3 item construction without requiring a real IPTV account.

## Acceptance Criteria

- [ ] A fresh install can pair with an IPTVFlix account/device flow.
- [ ] After pairing, opening the app shows a simple ready/connected state rather than a duplicated Web catalog.
- [ ] Sending a valid Movie command from the backend starts playback automatically.
- [ ] Sending an Episode command starts the correct episode and supports resume position.
- [ ] Play/pause/seek/back work with a standard Android TV remote.
- [ ] Playback progress is written back to the shared profile/Continue Watching state.
- [ ] Audio/subtitle selection is available when the stream exposes tracks.
- [ ] Network reconnect does not duplicate playback commands.
- [ ] Revoking the TV device stops future authenticated command delivery.
- [ ] Playback failures show a clear recoverable error state.

## Excluded / Out of scope

- Full Netflix-style TV browsing/catalog UI.
- TV-native recommendations/shelves.
- Trailer autoplay browsing previews.
- Live TV/EPG.
- Chromecast receiver implementation.

## Dependencies

Depends on #104 for device pairing/commands and #99 for secure playback resolution. Must remain compatible with #95 authentication.
