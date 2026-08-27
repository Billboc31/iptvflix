# T136 — Add Android TV live channel zapping with D-pad and channel +/- remote keys

**Source**: GitHub Issue #288

## Description

## Context

Live TV on Android TV needs instant channel zapping without forcing the user to open the channel browser overlay for every change.

The desired TV-like behavior is:

- while watching Live TV full-screen, **DPAD_UP / DPAD_DOWN** changes channel directly;
- physical/remote **CHANNEL_UP / CHANNEL_DOWN** keys do the same when the device/remote exposes them;
- channel changes follow the current canonical channel ordering/context and use the canonical source-selection/failover flow;
- this must coexist cleanly with the side channel selector overlay from the dedicated overlay ticket.

## Goal

Implement robust remote key handling for fast next/previous Live TV channel changes in `apps/android-tv`.

## Full-screen playback behavior

When the Live player is in normal full-screen playback and no channel-list overlay/menu owns focus:

- `DPAD_UP` => previous/next channel according to the chosen navigation convention;
- `DPAD_DOWN` => the opposite direction;
- Android `KEYCODE_CHANNEL_UP` => next channel;
- Android `KEYCODE_CHANNEL_DOWN` => previous channel.

Choose and document a consistent D-pad mapping. Prefer the convention that feels most natural with the current app/player controls, but do not leave UP/DOWN unimplemented.

Channel +/- keys must work independently of D-pad mapping.

## Overlay interaction

When the channel selector overlay is open:

- DPAD_UP/DOWN navigate the overlay list and **must not immediately zap behind the overlay**;
- OK performs the selected switch while leaving the overlay open as specified in the overlay ticket;
- CHANNEL_UP/DOWN may still perform immediate zapping if this can be made predictable, but must keep overlay state/focus synchronized with the newly playing channel. If that creates ambiguous UX, explicitly scope CHANNEL_UP/DOWN to full-screen mode and document/test it.

Input ownership must be explicit so one key press cannot both move focus and switch channel.

## Channel order / context

Zapping should use canonical channels only.

Prefer this order:

1. current active category/list context when one exists;
2. otherwise the canonical default/all-channels order.

The behavior at list boundaries should be deliberate and consistent (wrap-around is preferred for traditional TV zapping unless existing product conventions strongly argue otherwise).

Skip channels that are known to be unplayable where the API already exposes that state.

## On-screen feedback

After a direct zap, briefly show a lightweight channel-change overlay containing at least:

- channel logo/name;
- current program when EPG exists;
- optional channel number/index if the product has a meaningful stable number.

This transient HUD should use the orange Live TV theme and auto-dismiss after a short interval. It must not require another key press.

Do not show fake EPG information.

## Player behavior / performance

- Switch media in-place where supported rather than recreating the entire Android activity/screen.
- Use canonical channel -> selected `ChannelSource` flow.
- Preserve automatic source fallback behavior.
- Avoid reloading the complete channel list on every zap.
- Debounce/serialize rapid channel switches so holding a key cannot create overlapping player requests or stale playback state.
- The last requested channel should win cleanly.

## Error behavior

If a channel cannot play after available source fallback:

- show a concise non-blocking error;
- keep the app usable;
- do not leave the player stuck in an inconsistent loading state;
- subsequent zapping must continue to work.

## Acceptance criteria

- [ ] Full-screen Live TV supports direct channel changes via DPAD_UP/DOWN.
- [ ] `KEYCODE_CHANNEL_UP` and `KEYCODE_CHANNEL_DOWN` are handled where Android delivers them.
- [ ] Zapping operates on canonical channels, not raw duplicate sources.
- [ ] Channel ordering/context is deterministic and boundary behavior is tested.
- [ ] Overlay-open UP/DOWN navigation does not accidentally trigger direct zapping.
- [ ] Direct zapping displays a brief orange channel/program HUD.
- [ ] Rapid key presses are serialized/debounced safely; no overlapping/stale player state.
- [ ] Source failover remains functional.
- [ ] Failed channel playback does not break later zapping.
- [ ] Existing VOD player remote controls are not regressed.
- [ ] Add Android input/player tests covering D-pad, channel keys, overlay ownership, wrap/boundaries, rapid zapping and playback failure.
