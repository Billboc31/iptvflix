# T134 — Add Live TV mode to Android TV app with orange visual identity

**Source**: GitHub Issue #286

## Description

## Context

IPTVFlix now has a dedicated Live TV web experience and canonical Live TV channel model. The Android TV app is currently focused on VOD playback and should now gain a first-class **Live TV mode**.

The Android TV Live TV experience must remain deliberately simple and remote-first. It should feel like the same IPTVFlix product, but Live TV uses **orange** as its primary accent instead of the existing red VOD accent.

This ticket establishes the Android TV Live TV shell and navigation foundation. Channel browsing/player overlay/zapping behaviors are handled in follow-up tickets.

## Goal

Add a clear VOD / TV mode to `apps/android-tv` and create the foundational Live TV home/screen using the existing canonical channel APIs rather than raw provider streams.

## Product direction

- VOD mode keeps its current visual identity and behavior.
- TV mode uses a dark background with **orange focus/active accents**.
- Switching modes should be fast and obvious from a remote.
- Do not create a parallel auth/profile system; reuse the current Android TV session/profile model.
- Consume canonical `Channel` identities produced by the Live TV backend/domain layer so duplicated provider streams are never shown as separate channels.

## TV home

Create an initial TV-mode landing surface suitable for remote navigation, with sections such as:

- recently watched channels when available;
- favorite channels when available;
- live channels / all channels;
- channel categories;
- EPG-ready current-program information where the API provides it.

Do not invent fake schedules when EPG is missing.

The screen should be visually lighter and simpler than the Live TV web dashboard: Android TV is primarily a playback surface, not an admin/exploration interface.

## Remote/focus UX

- All TV-mode controls must be navigable with D-pad only.
- Orange focus state must be highly visible from normal TV viewing distance.
- Focus must be deterministic when entering/exiting TV mode and returning from playback.
- Avoid touch/mobile assumptions.
- Back behavior should remain predictable and consistent with the existing Android TV app.

## Architecture

- Reuse existing networking/player infrastructure where possible.
- Reuse canonical Live TV API contracts instead of duplicating channel parsing/deduplication on Android.
- Keep VOD and Live TV feature code separated enough to avoid regressions while sharing primitives where useful.
- No direct database access from Android.

## Acceptance criteria

- [ ] Android TV app exposes a clear VOD / TV mode switch or equivalent remote-friendly entry point.
- [ ] TV mode has a dark + orange visual identity while VOD keeps its existing styling.
- [ ] Canonical channels are loaded from the backend; raw duplicate provider streams are not displayed.
- [ ] Initial TV home supports remote focus/navigation and clean loading/error/empty states.
- [ ] Current-program metadata can render when EPG data exists and degrades cleanly when absent.
- [ ] Existing VOD playback/navigation does not regress.
- [ ] Add tests for mode switching, focus behavior, canonical channel rendering and VOD regression boundaries.
- [ ] No channel-specific hardcoding and no manual production DB changes.
