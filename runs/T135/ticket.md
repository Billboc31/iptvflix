# T135 — Build Android TV live channel selector overlay with EPG and persistent zapping

**Source**: GitHub Issue #287

## Description

## Context

Once a Live TV channel is playing on Android TV, channel discovery/switching must be possible without leaving playback.

The desired interaction is remote-first:

> While watching a channel, pressing **LEFT** opens a side overlay containing the channel list. Each row shows the channel identity and current program. Selecting another channel switches playback immediately, but the overlay **stays open** so the user can continue zapping/browsing. The user explicitly closes the overlay with BACK/RIGHT/another deliberate action.

This should feel like a modern set-top-box channel browser rather than navigating back to a separate channel page after every switch.

## Goal

Implement a persistent channel selector overlay inside the Android TV Live player.

## Overlay behavior

### Open

- When normal Live playback has focus and no conflicting modal/control owns the key, **DPAD_LEFT** opens a side layer/overlay.
- Playback continues behind the overlay.
- The overlay should occupy only part of the screen, leaving the current channel visibly playing.
- Use the Live TV dark + **orange** visual language.

### Channel list

Each channel row/card should support:

- canonical channel logo;
- canonical channel name;
- current EPG program title when available;
- current program start/end time and/or progress where available;
- favorite state when the existing canonical favorite model supports it;
- clear orange focused state;
- clear indicator for the channel currently being played.

EPG absence must degrade cleanly without fake data.

### Selection / persistent browsing

Critical interaction requirement:

- User moves focus through channels with DPAD_UP / DPAD_DOWN while the overlay is open.
- Pressing OK/ENTER on a channel starts/switches to that channel.
- **The overlay remains open after the channel switch.**
- Focus remains on the newly selected channel (or equivalent deterministic position), allowing the user to immediately select another channel.
- Playback behind the overlay updates to the newly selected stream.
- Do not navigate away/recreate the whole player screen solely to switch channel if the current player architecture supports an in-place media switch.

### Close

- BACK closes the channel overlay first and returns focus to full-screen playback.
- RIGHT may close the side overlay when appropriate, matching a natural left-panel interaction.
- Overlay should not trap focus or make playback controls unreachable.

## Ordering / filtering

Use canonical channel ordering/categories from the backend where available. At minimum the overlay should be able to browse all playable canonical channels.

Prefer preserving the user's current list context/category when feasible.

Do not expose `ChannelSource` duplicates in the overlay.

## Performance

Channel changes should feel fast:

- do not refetch the complete channel catalog on every selection;
- preload/cache lightweight channel + now-playing metadata where appropriate;
- use the canonical source-selection/failover backend flow;
- show a subtle loading state during stream switch without closing the overlay.

## Focus / remote details

- Opening overlay should initially focus the currently playing channel if present in the list.
- Focus position should survive a channel switch while the overlay stays open.
- Long lists should scroll to keep focused row visible.
- D-pad repeat should be handled sanely and not trigger accidental multiple OK selections.

## Acceptance criteria

- [ ] DPAD_LEFT during Live playback opens a side channel overlay.
- [ ] Overlay displays canonical channel logo/name and current EPG program where available.
- [ ] DPAD_UP/DOWN navigates channel rows with visible orange focus.
- [ ] OK changes to the selected channel without closing the overlay.
- [ ] After switching, overlay stays open and focus remains in a deterministic useful position.
- [ ] Current channel is visually identified.
- [ ] BACK closes overlay before exiting playback.
- [ ] EPG/no-EPG cases both render correctly.
- [ ] Raw duplicate sources never appear as separate rows.
- [ ] Channel switch uses existing source-selection/failover path and handles loading/failure gracefully.
- [ ] Add tests for overlay open/close, focus restoration, persistent overlay after selection, EPG rendering, and repeated channel switching.
- [ ] Existing VOD player controls are not regressed.
