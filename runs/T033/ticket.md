# T033 — Add source-priority controls to playback preferences UI

**Source**: GitHub Issue #63

## Description

## Objective

Allow the user to configure ordered preferred media sources from the profile playback settings UI.

## Context / Problem

The playback preference model and backend resolver already support `preferredSourceIds`, but the current profile settings page exposes audio languages, subtitle languages and maximum quality only. Source priority therefore cannot be configured through the product UI even though it affects automatic best-availability selection.

## Included

- Expose configured IPTV/Plex/other sources in profile playback settings.
- Allow the user to order preferred sources deterministically.
- Persist the resulting ordered source ids through the existing profile preferences API.
- Display human-readable source names rather than raw ids.
- Handle deleted/disabled sources without breaking saved preferences.

## Acceptance Criteria

- [ ] Profile settings list configured sources with human-readable names.
- [ ] Sources can be reordered by priority.
- [ ] Saved ordering is persisted in `preferredSourceIds`.
- [ ] The backend resolver uses that ordering without frontend-side ranking logic.
- [ ] Missing/deleted source ids are handled safely.
- [ ] Automated frontend/API tests cover loading, reordering and saving source priorities.

## Dependencies

Builds on #35 playback preferences and the existing source management APIs.
