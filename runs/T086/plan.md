# Plan — T086: Fix shelf card hover state and add focused Netflix-style enlargement/preview

## Objective

Fix per-card hover isolation on desktop shelves (hover state currently leaks to all cards in a
row) and implement a Netflix-style enlargement + lazy preview experience: sustained hover promotes
a single card into a `fixed`-positioned portal pop-out, plays its trailer muted, and collapses
cleanly when focus moves away.

---

## Included

### 1. Hover isolation audit — `ShelfRow.tsx`, `HorizontalRow.tsx`, `PosterCard.tsx`

- Audit every `group` / `group-hover:*` Tailwind class across the shelf stack.
- Remove any `group` class from `ShelfRow` or `HorizontalRow` containers; those classes must live
  only on the root div of `PosterCard` so that `group-hover:*` children resolve against the
  individual card, not the whole shelf.
- Confirm that the Détails button, overlay gradient, and action controls are rendered with
  `group-hover:*` utilities scoped exclusively to the card's own `group` ancestor.
- After the fix, hovering anywhere on `HorizontalRow` must not activate `group-hover` children
  on sibling cards.

### 2. Per-card focused state — `PosterCard.tsx`

- Add `isFocused: boolean` React state (initially `false`).
- Add `focusTimerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>`.
- On `onMouseEnter`:
  - Skip entirely when `isTouch()` returns `true`.
  - Capture card screen rect immediately (`cardRef.current.getBoundingClientRect()`) and store
    in a ref.
  - Increment a `hoverEpoch` counter ref.
  - Start `focusTimerRef` at **400 ms**; on expiry, if epoch still matches, `setIsFocused(true)`.
- On `onMouseLeave` / `onBlur` / component unmount:
  - Clear `focusTimerRef` and the existing 1 500 ms preview timer.
  - `setIsFocused(false)`.
  - Call `PreviewContext.deactivate()`.
- Guard all enlargement/preview paths with `!isTouch()`.

### 3. Portal enlarged card — new `FocusedCardPortal.tsx`

Extract the enlarged card into a dedicated component rendered via `createPortal(…, document.body)`.

**Positioning**:
- Use `position: fixed` with `top` / `left` / `width` / `height` derived from the stored
  `getBoundingClientRect()` snapshot taken on hover start.
- Target width: `Math.round(cardWidth * 1.75)`.
- Center vertically on the card midpoint; clamp so the portal never overflows the viewport top.
- Edge detection (horizontal):
  - `cardRect.left < 160` → expand rightward (left-align portal with card left edge).
  - `cardRect.right > window.innerWidth - 160` → expand leftward (right-align portal with card
    right edge).
  - Otherwise → center on card midpoint.

**Visual style**:
- `z-[35]` — above `HorizontalRow` scroll arrows (`z-10`) and `MediaHero` (`z-20/30`), below
  `TopNav` (`z-40`) and modals (`z-50`).
- Entrance animation: opacity `0 → 1` + `scale-95 → scale-100` over `200 ms` (`transition-all`).
- Drop shadow via `shadow-2xl`; rounded corners consistent with `PosterCard`.
- TMDB backdrop as background cover image (fall back to poster if no backdrop).
- Overlay gradient at bottom for legibility of title/actions.

**Content inside the portal**:
- Media title.
- Play / Resume button — rendered **only** when the media has a playable Xtream/Plex
  availability; uses the normal playback pipeline (`usePlayMedia` or equivalent).
- Détails button — calls `useOpenDetail()` (no change to modal routing).
- My List button — render only when the My List feature is already supported; skip otherwise.
- `<PreviewPlayer>` rendered here (not in the normal card position) — see §4.

The original `PosterCard` DOM node remains at its natural size while the portal is open. The
portal is mounted only when `isFocused === true` and unmounted on leave.

### 4. Preview coordination — `PosterCard.tsx` + `PreviewContext.tsx`

- Preview timer (existing 1 500 ms) fires **only after** `isFocused === true`; start it inside the
  `useEffect` that reacts to `isFocused` becoming `true`.
- When the preview timer fires: call `PreviewContext.activate(mediaId, trailerKey)`.
- `<PreviewPlayer trailerKey={trailerKey} active={activeId === mediaId}>` lives inside
  `FocusedCardPortal`; unmounts when portal unmounts.
- No-preview path: when `trailerKey` is `null` / `undefined`, skip `activate()` and skip
  rendering `<PreviewPlayer>`; the portal shows only the backdrop/poster and actions — no black
  rectangle, no broken player.
- `PreviewContext` already enforces a singleton; no changes needed to `PreviewContext.tsx` itself.

### 5. Race-condition guard — `PosterCard.tsx`

- `hoverEpoch` (`useRef<number>`) increments on every `onMouseEnter`.
- Both the focus timer callback and the preview timer callback capture the epoch at scheduling
  time and no-op if `hoverEpoch.current` has changed by the time they fire.
- This prevents a card that received a 100 ms hover from promoting itself after the pointer has
  moved to another card.

### 6. Tests — `PosterCard.test.tsx`

- **Hover isolation**: mount two `PosterCard`s inside a shared shelf wrapper; hover card A then
  immediately leave and hover card B; assert card A never enters `isFocused`.
- **Timer cancel on quick leave**: hover for 200 ms then leave; assert focused portal never
  mounts.
- **Preview cleanup**: hover until focused, let preview activate, then leave; assert
  `PreviewContext.deactivate` was called and `PreviewPlayer` is unmounted.
- **No-preview card**: card without `trailerKey` enters focused state and shows the portal
  without error; `PreviewPlayer` is not rendered.
- Use `vi.useFakeTimers()` (existing pattern in the test file).

---

## Excluded

- `ArrivalCard.tsx` and `EpisodeCard.tsx` — not displayed in desktop shelves; separate ticket if
  needed.
- Any change to `PreviewContext.tsx` internals, `PreviewPlayer.tsx` internals, or the detail
  modal routing (`useOpenDetail`, `MediaDetailShell`).
- My List feature implementation — button is gated behind an existing feature check; no new
  My List logic in this ticket.
- Keyboard autoplay: keyboard focus exposes card actions but must **not** auto-start preview
  media; no change to existing `onFocus`/`onBlur` audio/video behaviour.
- Mobile / touch layout: all new code is guarded by `!isTouch()`; no change to tap-based flow.
- Shelf scroll, navigation arrows, or pagination logic.
- Any TMDB trailer-fetching changes (existing `trailerKey` prop/hook is used as-is).

---

## Acceptance criteria

- Hovering one shelf card shows Détails only on that card; sibling cards show no hover state.
- All other hover-only controls (overlay, gradient, action buttons) are equally isolated to the
  focused card.
- Sustained desktop hover (≥ 400 ms) smoothly enlarges the focused card via a portal; no
  layout reflow or permanent shelf jump.
- Enlarged card appears above neighboring content; `z-[35]` keeps it below TopNav and modals.
- Cards near the left or right viewport edge expand inward so content is not clipped.
- When a preview/trailer exists, it plays inside the focused enlarged card only, muted, and
  starts only after `isFocused === true`.
- Exactly one preview can be active at any time (enforced by `PreviewContext`).
- Moving to another card stops the previous preview and unmounts the player.
- Rapid pointer movement (hover A 100 ms → B 120 ms → C 800 ms) results in only C entering
  focused/preview state; A and B remain idle.
- A card without a trailer shows the portal with backdrop/poster and actions; no empty player or
  black rectangle is visible.
- A title with no playable VOD availability shows no Play/Resume button in the enlarged card.
- Clicking Détails opens the existing shared detail modal (no new route or page).
- Actual VOD playback continues to use the normal Xtream/Plex pipeline unchanged.
- Mobile/touch devices see no enlargement or auto-preview behavior.
- Keyboard users can reach card actions via focus; no media autoplays on keyboard focus.
- All new per-card hover isolation and preview cleanup paths are covered by tests.
