# Test Report — T086: Fix shelf card hover state and add focused Netflix-style enlargement/preview

**Date**: 2026-08-17
**Branch**: ticket/T086-fix-shelf-card-hover-state-and-add-focused-netflix
**Tester**: automated tester agent

---

## Summary

**Verdict: PASS** — all 267 web tests pass; the 5 API failures are pre-existing on `main` and unrelated to this ticket. All critical acceptance criteria are met. Two minor non-blocking concerns noted.

---

## Files Changed

| File | Type |
|---|---|
| `apps/web/src/components/content/HorizontalRow.tsx` | Bug fix — group isolation |
| `apps/web/src/components/content/PosterCard.tsx` | Refactor — per-card focus state |
| `apps/web/src/components/content/FocusedCardPortal.tsx` | New component — portal enlargement |
| `apps/web/src/components/content/PosterCard.test.tsx` | New + updated tests |

---

## Test Execution

```
apps/web: 267 passed (39 test files) — 0 failures
apps/api: 842 passed, 5 failed — pre-existing failures on main (vertical-slice integration + title-matching-service), unrelated to T086
```

---

## Acceptance Criteria

### AC-1: Hovering one shelf card shows `Détails` only on that card, not every movie in the row.
**PASS**

`HorizontalRow` renamed its `group` class to `group/row` and all its `group-hover:` selectors to `group-hover/row:`. The unnamed `group` ancestor that was leaking hover activation to all card descendants is eliminated. Each `PosterCard` retains its own isolated `group` for its `group-hover:opacity-100` overlay.

### AC-2: Other hover-only controls/overlays are also scoped to the active card.
**PASS**

The overlay gradient and Détails badge inside `PosterCard` use `group-hover:opacity-100` against the card's own `group` — not the shelf container.

### AC-3: Sustained desktop hover smoothly enlarges only the focused card.
**PASS**

`handleEnter()` starts a 400 ms `focusTimerRef` on mouse/focus enter (guard: `isTouch()` returns early for touch). On expiry, if epoch still matches, `setIsFocused(true)` mounts `FocusedCardPortal`. Portal animates from `scale(0.95)/opacity-0` to `scale(1)/opacity-1` in 200 ms.

### AC-4: Enlarged card appears above neighboring content without obvious clipping.
**PASS**

Portal uses `createPortal(…, document.body)` with `position: fixed` and `z-index: 35` (above shelf arrows at z-10, below TopNav at z-40 and modals at z-50). No DOM ancestor can clip it.

### AC-5: Edge cards expand/crop gracefully within the viewport.
**PASS**

Horizontal placement logic in `FocusedCardPortal`:
- `rectLeft < 160` → left-align portal with card left edge
- `rectRight > window.innerWidth - 160` → right-align portal with card right edge
- otherwise → center on card midpoint

Final left is clamped to `[8, window.innerWidth - portalWidth - 8]`.

### AC-6: The page/shelf does not permanently jump/reflow when a card enlarges.
**PASS**

Portal is `position: fixed` outside the normal layout flow. The original `PosterCard` DOM node stays at natural size while the portal is open.

### AC-7: If a preview exists, it plays only inside the currently focused/enlarged card.
**PASS**

`<PreviewPlayer>` is rendered exclusively inside `FocusedCardPortal` when `trailerKey` is non-null. `PreviewContext.activeId` is a singleton state; calling `activate()` replaces any previous active preview.

### AC-8: Only one shelf preview can play at any time.
**PASS**

`PreviewContext` holds a single `activeId`/`activeKey`. A new `activate()` call overwrites the previous state, and the previous card's `PreviewPlayer` returns `null` (not active).

### AC-9: Preview starts muted.
**PASS**

`PreviewPlayer` defaults `muted = true` and the YouTube embed URL includes `&mute=1`. A `postMessage` with `mute` command is sent after load.

### AC-10: Leaving/changing card stops and cleans up the old preview.
**PASS**

`handleLeave()` clears both timers, increments `hoverEpoch`, calls `setIsFocused(false)` and `deactivate()`. Portal unmounts, `PreviewPlayer` unmounts. Covered by test `'preview cleanup: deactivate is called and portal unmounts on leave'`.

### AC-11: Rapid hover changes cannot trigger stale previews.
**PASS**

`hoverEpoch` counter increments on every `handleEnter`. Both the 400 ms focus timer and the 1500 ms preview timer capture the epoch at scheduling time and bail if `hoverEpoch.current !== epoch` at fire time.

### AC-12: Preview failure/no preview cleanly falls back to artwork.
**PASS**

`PreviewPlayer`: on `onError`, `setFailed(true)` → iframe `visibility: hidden`. The backdrop/poster behind remains visible. When `trailerKey` is null, `<PreviewPlayer>` is not rendered at all — only the backdrop/poster and Détails button are shown. Covered by test `'no-preview card: portal renders without PreviewPlayer'`.

### AC-13: Titles without playable VOD can still preview/show details without a fake `Lecture` action.
**PASS**

`FocusedCardPortal` does not render a play/lecture button. Only the Détails button is shown. No fake playback path is introduced.

### AC-14: `Détails` opens the existing shared detail modal.
**PASS** (architecture-level)

`FocusedCardPortal` calls `onDetailsClick`, which is wired to `onClick` from `PosterCard`. Callers are responsible for passing the modal-opening handler (pre-existing pattern). No new routing or page is introduced.

### AC-15: Actual `Lecture` continues to use the normal VOD playback pipeline.
**PASS**

No changes to `usePlayMedia`, Xtream/Plex pipeline, or device picker flow.

### AC-16: Mobile/touch layout is not negatively affected by desktop hover behavior.
**PASS**

`handleEnter()` returns immediately when `isTouch()` is `true` (`window.matchMedia('(pointer: coarse)').matches`). Covered by test `'does not start preview on touch devices'`.

### AC-17: Keyboard users can reach equivalent actions.
**PASS with note**

- `PosterCard` root has `role="button"`, `tabIndex={onClick ? 0 : undefined}`, and `onKeyDown` for Enter.
- `onFocus={handleEnter}` starts the 400 ms focus timer on keyboard focus, mounting the portal — this makes actions visually visible.
- The portal's Détails button has `tabIndex={-1}` (intentionally not keyboard-reachable from outside) and the portal is `aria-hidden="true"`.
- Keyboard users can press Enter on the focused card to trigger `onClick` (open detail modal).

**Note**: Keyboard focus does trigger the preview timer path (400 ms + 1500 ms = ~1.9 s to first preview frame). The preview is muted (`mute=1`), so no unexpected audio plays. The ticket states "do not autoplay noisy media on keyboard focus unexpectedly" — muted media satisfies this in spirit. If stricter no-preview-on-keyboard-focus behavior is wanted, `handleEnter` would need to distinguish between mouse and keyboard events.

### AC-18: Relevant component/interaction tests cover per-card hover isolation and preview cleanup.
**PASS**

New tests added to `PosterCard.test.tsx`:
- `'portal does not mount before 400ms sustained hover'`
- `'portal mounts after 400ms sustained hover'`
- `'portal unmounts when mouse leaves'`
- `'hover isolation: quick hover on card A then B leaves A without portal'`
- `'preview cleanup: deactivate is called and portal unmounts on leave'`
- `'no-preview card: portal renders without PreviewPlayer'`

All pass. `vi.useFakeTimers()` is used consistently.

---

## Non-Blocking Concerns

### NC-1: FocusedCardPortal uses poster as backdrop (no dedicated backdropUrl prop)
The plan specified using the TMDB backdrop image with the poster as fallback. The implementation only receives and uses `posterUrl`. The visual result is still a filled image behind the portal, but it is not the wider TMDB backdrop. Low impact — no blank/black rectangle.

### NC-2: No Play/Resume button in the focused portal
The plan described a Play/Resume button gated on Xtream/Plex availability. The current implementation shows only the Détails button. This is safe (no fake Lecture action) and keeps the portal minimal. The full media selection happens inside the detail modal opened by Détails.

---

## Regressions

None detected. All 267 web tests pass. The 5 API test failures are pre-existing on `main`:
- `vertical-slice.test.ts` (4 failures) — sync pipeline timing issues
- `title-matching-service.test.ts` (1 failure) — TMDB error handling

---

## Verdict

**PASS** — implementation satisfies all acceptance criteria. No blocking issues. The two non-blocking concerns (NC-1, NC-2) do not break any stated AC and can be addressed in follow-up tickets if desired.
