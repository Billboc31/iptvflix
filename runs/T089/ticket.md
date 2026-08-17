# T089 — Stabilize VOD controls overlay so seek/pause UI never disappears unexpectedly

**Source**: GitHub Issue #189

## Description

## Context
The new VOD player sometimes enters a state where the playback controls / seek bar are no longer available even though the video is still playing. This makes the player intermittently unusable.

## Goal
Make the custom VOD controls overlay deterministic and resilient on desktop and mobile.

## Required work
- Reproduce cases where controls disappear permanently or cannot be brought back.
- Audit auto-hide timers, pointer/touch handlers, fullscreen transitions, buffering/seeking state and player rerenders.
- Ensure controls can always be shown again with mouse movement, click/tap, keyboard focus or pause.
- Controls must stay visible while paused, buffering, seeking, menus are open, subtitle/audio menu is open, or the user is interacting with the timeline.
- Cancel stale hide timers when player state changes.
- Avoid multiple timers/race conditions after source changes or React rerenders.
- Verify fullscreen enter/exit does not lose event handlers.
- Verify mobile touch does not trigger sticky hidden state.
- Ensure fatal/temporary playback errors do not leave a playing video with inaccessible controls.

## Acceptance criteria
- [ ] Controls never become permanently inaccessible while video continues playing.
- [ ] Mouse movement shows controls on desktop.
- [ ] Tap shows controls on touch devices.
- [ ] Pause keeps controls visible.
- [ ] Timeline interaction prevents auto-hide until interaction ends.
- [ ] Audio/subtitle/settings menus keep controls visible while open.
- [ ] Fullscreen enter/exit preserves controls behavior.
- [ ] Source/quality switch preserves controls behavior.
- [ ] Relevant interaction/race-condition tests added.
- [ ] Manually validated on a real long-playing movie, not only a mocked media element.

## Completion rule
Do not close based only on component tests. Keep a real movie playing for several minutes, repeatedly show/hide controls, pause, seek, open menus and toggle fullscreen. The controls must remain recoverable every time.
