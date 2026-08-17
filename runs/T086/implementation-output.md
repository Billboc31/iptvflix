All files look correct. Here's a summary of what was implemented:

---

## Summary

**Files changed:**

### `HorizontalRow.tsx` — Hover isolation fix
- Changed `group` → `group/row` on the row container
- Changed `group-hover:opacity-100` → `group-hover/row:opacity-100` on both scroll arrows

This scopes the scroll arrow visibility to the row itself, not the unnamed `group` that PosterCards also use. Previously, hovering any card would activate `group-hover:*` on the parent `HorizontalRow` element, which cascaded back down and triggered all card overlays.

### `FocusedCardPortal.tsx` — New file
A React portal component that renders an enlarged card via `createPortal(…, document.body)`:
- `z-[35]` — above scroll arrows and MediaHero, below TopNav and modals
- Fixed positioning computed from the card's `DOMRect` with left/right edge detection (expands inward near viewport edges)
- Entrance animation (opacity 0→1, scale 0.95→1) via `requestAnimationFrame`
- Shows backdrop/poster image, `<PreviewPlayer>` (when trailerKey + active), gradient overlay, title, and Détails button
- Accepts `DOMRect | null` gracefully

### `PosterCard.tsx` — Focused state + portal integration
- Replaced the old `startPreview`/`cancelPreview` (1500ms flat delay) with a two-stage system:
  - **400ms focus timer** (with `hoverEpoch` race-condition guard) → `isFocused = true`
  - **1500ms preview timer** (started inside `useEffect` once focused) → `activate()`
- `handleEnter`: skips on touch, captures card rect, increments epoch, starts focus timer
- `handleLeave`: clears both timers, increments epoch, resets `isFocused`, calls `deactivate()`
- Portal renders when `isFocused === true`; PreviewPlayer moved from inline to inside the portal
- Existing `group-hover:opacity-100` overlay kept for immediate hover feedback (now correctly isolated to the card's own `group`)

### `PosterCard.test.tsx` — Test updates
- Updated timing assertions: `advanceTimersByTime(1500)` → two steps `(400)` then `(1500)`
- Added 5 new tests covering: portal-not-before-400ms, portal-mounts-at-400ms, portal-unmounts-on-leave, hover-isolation (two cards), deactivate-on-leave, no-preview card
