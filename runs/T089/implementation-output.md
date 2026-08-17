All four fixes are in place and verified. Here's a summary of what was implemented:

---

## Changes made

### `apps/web/src/components/player/PlayerControls.tsx`

**Bug 1 — Interaction handlers disabled when controls are hidden:**
- Replaced the `<>…</>` fragment root with `<div className="absolute inset-0">` that always receives pointer events
- Moved `onPointerMove={showControls}` and the click handler to this outer wrapper
- Removed those handlers from the inner overlay div (which keeps `pointer-events-none` when hidden)
- Added `data-testid="controls-overlay"` to the inner overlay div for testability

**Bug 2 — Auto-hide timer fires after video is paused:**
- Inside `startHideTimer()`, the `setTimeout` callback now re-checks `playingRef`, `scrubbingRef`, and `popoverOpenRef` before calling `setVisible(false)` — guards that were previously only checked at call-time

**Bug 3 — Fullscreen transitions leave controls hidden:**
- Added `showControlsRef` (a stable ref updated each render) to hold the latest `showControls`
- Each fullscreen event handler (`onFsChange`, `onWebkitFsBegin`, `onWebkitFsEnd`) now calls `showControlsRef.current()` alongside its state update

**Bug 4 — Stale timer and scrubbing ref survive source/quality switch:**
- Added `clearHideTimer()` and `scrubbingRef.current = false` to the cleanup return of the video event listener effect

### `apps/web/src/components/player/PlayerControls.test.tsx`

Added a new `'PlayerControls controls visibility'` describe block with 4 tests using `vi.useFakeTimers()`:
1. Pointer move on wrapper restores controls after auto-hide
2. Pause keeps controls visible after hide timer would have fired
3. Fullscreen transition shows controls even when previously hidden
4. Source change resets scrubbing state so hide timer works on restart

**Result:** 321/321 tests pass.
