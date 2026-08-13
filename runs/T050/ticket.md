# T050 — Add secure Web playback flow from selected Availability

**Source**: GitHub Issue #99

## Description

## Objective

Allow a user to start actual Movie/Episode playback from the Web app using the backend-selected Availability while keeping provider-specific playback details and credentials contained as safely as possible.

## Context / Problem

IPTVFlix can now normalize multiple source/language/quality variants and deterministically select the preferred Availability, but actual playback was intentionally deferred. A hosted Web test should support the complete flow from Media detail/recommendation to Play.

Xtream/M3U playback references may contain sensitive source credentials. The implementation must not simply expose stored provider secrets through generic catalog APIs or logs.

## Included

- Add a backend playback-resolution boundary that accepts canonical Movie/Episode identity (and optional explicit availability choice) and revalidates the requested Availability server-side.
- Reuse the existing profile best-availability resolver for default playback selection.
- Resolve provider-specific playback information inside the provider/availability layer for Xtream and any already-supported provider where practical.
- Define an explicit playback descriptor/session contract for clients; avoid adding raw credentials to general Media/Availability DTOs.
- Add a Web player experience with play/resume, basic loading/error states and manual variant selection when alternatives exist.
- Integrate viewing-progress updates with the existing profile progress/Continue Watching model.
- Ensure unavailable/stale/disabled-source variants cannot be launched.
- Avoid logging credential-bearing playback URLs/tokens.
- Design the contract so Android TV/Media3 can consume the same backend playback resolution later.

## Acceptance Criteria

- [ ] Clicking Play on a playable Movie resolves and starts the profile-preferred currently available variant.
- [ ] A playable Episode can be launched from the Series/Episode experience.
- [ ] The user can explicitly choose another valid availability/variant when alternatives exist.
- [ ] Disabled, stale or unavailable variants are rejected server-side even if the client submits their ids.
- [ ] Provider secrets are not added to general catalog/detail responses or logs.
- [ ] Playback progress updates the existing Continue Watching state and resume starts from stored progress where supported.
- [ ] Playback-resolution failures produce a usable UI error rather than exposing provider internals.
- [ ] Tests cover preferred selection, explicit variant, invalid/stale availability, progress and secret redaction.

## Excluded / Out of scope

- DRM-protected commercial streaming providers.
- Adaptive transcoding infrastructure.
- Full Android TV player implementation.
- Live TV.

## Dependencies

Requires the existing Availability resolver and should depend on #95 for a public hosted deployment so playback/source endpoints are not anonymously exposed.
