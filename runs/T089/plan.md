# Plan — T089: Stabilize VOD controls overlay

## Objective

Fix the VOD player controls overlay so it can always be shown again by user interaction
(pointer move, tap, click, keyboard) and never disappears permanently while the video is
playing. Four concrete bugs are addressed; no scope beyond those four.

---

## Included

### Bug 1 — Interaction handlers disabled when controls are hidden (critical)

**File:** `apps/web/src/components/player/PlayerControls.tsx`

The component currently returns a React fragment. The controls overlay div (line 393) carries
both the visual layer (`opacity-0`) and the interaction handlers (`onPointerMove`, `onClick`).
When the div is hidden its class includes `pointer-events-none`, which silences those handlers —
so no user action can bring controls back.

**Fix:** Replace the fragment root `<>…</>` with a single wrapper div
`<div className="absolute inset-0">` that:

- Always receives pointer events (no `pointer-events-none` on this div ever).
- Owns `onPointerMove={showControls}` and the click-to-close-popover / show-controls logic.

The inner opacity div keeps `pointer-events-none` when hidden (so taps on hidden controls
don't accidentally trigger buttons), but the outer wrapper still receives and forwards pointer
events that reveal the controls.

### Bug 2 — Auto-hide timer fires after video is paused

**File:** `apps/web/src/components/player/PlayerControls.tsx` — `startHideTimer()` (line 98–102)

Refs (`playingRef`, `scrubbingRef`, `popoverOpenRef`) are checked at **call** time but not
re-checked when the 3-second timeout fires. If the user pauses while the timer is pending,
`playingRef.current` becomes `false` but `setVisible(false)` still executes.

**Fix:** Re-check all three guards inside the timeout callback before calling `setVisible(false)`:

```ts
hideTimerRef.current = setTimeout(() => {
  if (playingRef.current && !scrubbingRef.current && !popoverOpenRef.current) {
    setVisible(false)
  }
}, 3000)
```

### Bug 3 — Fullscreen transitions leave controls hidden

**File:** `apps/web/src/components/player/PlayerControls.tsx` — fullscreen effect (lines 199–220)

`onFsChange`, `onWebkitFsBegin`, and `onWebkitFsEnd` only update `isFullscreen` state; they
do not call `showControls()`. If controls were auto-hidden before the transition, they remain
hidden after entering or exiting fullscreen.

**Fix:** Call `showControls()` in each fullscreen event handler. Because `showControls` is a
plain function defined in component scope and the effect captures it at registration time,
add a stable ref to hold the latest version:

```ts
const showControlsRef = useRef(showControls)
showControlsRef.current = showControls          // keep in sync each render

// inside the fullscreen effect:
function onFsChange() {
  setIsFullscreen(!!document.fullscreenElement)
  showControlsRef.current()
}
function onWebkitFsBegin() { setIsFullscreen(true);  showControlsRef.current() }
function onWebkitFsEnd()   { setIsFullscreen(false); showControlsRef.current() }
```

### Bug 4 — Stale timer and scrubbing ref survive source/quality switch

**File:** `apps/web/src/components/player/PlayerControls.tsx` — video event listener effect
(lines 126–197)

When `videoRef` changes or the source changes, the effect's cleanup (lines 183–195) removes
video event listeners but does **not** call `clearHideTimer()` or reset `scrubbingRef`. A
pending timer from the old source may fire and hide controls during the new source's startup.
If the user was scrubbing when the quality switch happened, `scrubbingRef.current` stays
`true` indefinitely — permanently preventing the hide timer from starting.

**Fix:** In the cleanup return of the video event listener effect, add:

```ts
return () => {
  video.removeEventListener(...)   // existing removals
  clearHideTimer()                 // new: kill stale timer
  scrubbingRef.current = false     // new: reset scrubbing state
}
```

### Tests

**File:** `apps/web/src/components/player/PlayerControls.test.tsx`

Add the following cases (fake timers via `vi.useFakeTimers()`):

1. **Controls can be shown after auto-hide via pointer move** — dispatch a `pointermove` on
   the wrapper div after controls have auto-hidden; assert `opacity-100` returns.
2. **Pause prevents hide timer from firing** — start playing, call `startHideTimer` indirectly,
   dispatch `pause`, advance fake timer by 3 s; assert controls remain visible.
3. **Fullscreen transition shows controls** — dispatch `fullscreenchange` while controls are
   hidden; assert controls become visible.
4. **Source change clears scrubbing ref** — simulate `pointerdown` on seek bar, trigger cleanup
   (unmount), verify a new mount's hide timer starts normally.

---

## Excluded

- Keyboard-shortcut global listener isolation (Issue 5 from audit) — separate ticket.
- Popover state not reset on source change (Issue 4 from audit) — UX improvement, not a
  controls-accessibility regression.
- Picture-in-Picture enter/exit show-controls (analogous to fullscreen but not listed in
  ticket acceptance criteria).
- Any changes to `PlayerPage.tsx`.
- Any changes to HLS.js / mpegts player integration.
- Any new UI features or redesign of the controls.

---

## Acceptance criteria

- **Pointer move restores controls on desktop:** after the 3-second auto-hide fires, moving
  the mouse over the player makes controls visible again (verified in test and manually).
- **Tap restores controls on mobile:** a touch tap on the player while controls are hidden
  makes them reappear.
- **Pause keeps controls visible:** dispatching `pause` while the hide timer is pending results
  in controls staying visible after 3 s (vitest assertion).
- **Fullscreen enter/exit shows controls:** `fullscreenchange` event causes controls to reappear
  regardless of their prior visibility state (vitest assertion).
- **Source switch does not leave permanent scrubbing lock:** after unmount/remount of
  PlayerControls (simulating quality switch), the auto-hide timer starts correctly.
- **No regression on existing test suite:** `pnpm test --filter @iptvflix/web` passes green.
- **Manual long-play validation:** keep a real movie playing for ≥ 5 minutes, repeatedly show /
  hide controls, pause, seek, open audio/subtitle menus, toggle fullscreen; controls must be
  recoverable every time, on both desktop and a touch device.
