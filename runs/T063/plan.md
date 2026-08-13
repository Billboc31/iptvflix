## Objective

Replace the direct `⚙️ → /settings/playback` link in `TopNav` with a small settings dropdown menu that exposes all existing administration destinations (Sources, Lecture, Appareils), keeping the primary streaming navigation unchanged and covering both desktop and mobile.

## Included

### New component — `apps/web/src/components/layout/SettingsMenu.tsx`

A self-contained toggle dropdown anchored to the gear button:

- **Trigger**: `<button>` with `aria-label="Paramètres"`, `aria-haspopup="true"`, `aria-expanded` toggled on click.
- **Menu items** (only routes that have real page implementations):
  - Sources → `/sources`
  - Lecture → `/settings/playback`
  - Appareils → `/settings/devices`
- **Active state**: use `useLocation` to apply a highlight class on the item whose path matches the current location.
- **Close on outside click**: `useEffect` that attaches a `mousedown` listener on `document`; removes it on cleanup.
- **Close on Escape**: `keydown` listener on `document` that closes the menu.
- **Close on navigation**: each menu item's `onClick` closes the menu before the router navigates.
- **Positioning**: absolute-positioned dropdown panel below-right of the trigger; `z-50` to sit above content.
- **Styling**: consistent with existing TopNav dark theme (`bg-[#0a0a0f]`, `border-white/10`, `hover:bg-white/5`).
- **No new external dependency**: custom implementation using `useState`, `useEffect`, `useRef`, `useLocation`, `NavLink` from react-router-dom.

### Modified — `apps/web/src/components/layout/TopNav.tsx`

- Remove the `NavLink` to `/settings/playback` (the old direct ⚙️ link).
- Import and render `<SettingsMenu />` in its place inside the right-section `div`.
- No other change to layout or primary nav items.

### Modified — `apps/web/src/components/layout/TopNav.test.tsx`

- Remove the two tests that assert the settings icon is a `role="link"` to `/settings/playback` (that link no longer exists).
- Add a test: the gear button renders with `aria-label="Paramètres"`.
- Add a test: clicking the gear button makes the settings menu appear (Sources link is visible).
- Add a test: clicking a menu item closes the menu.

### New — `apps/web/src/components/layout/SettingsMenu.test.tsx`

Tests using Vitest + React Testing Library + MemoryRouter:

| Test | Assertion |
|---|---|
| renders gear button with aria-label | `getByRole('button', { name: 'Paramètres' })` in DOM |
| menu is hidden by default | menu panel not in DOM / `aria-expanded="false"` |
| click opens menu | `getByRole('menuitem', { name: /Sources/ })` visible |
| Sources link points to `/sources` | `href="/sources"` |
| Lecture link points to `/settings/playback` | `href="/settings/playback"` |
| Appareils link points to `/settings/devices` | `href="/settings/devices"` |
| click outside closes menu | simulate `mousedown` on `document.body`; menu disappears |
| Escape key closes menu | `fireEvent.keyDown(document, { key: 'Escape' })`; menu disappears |
| clicking a menu item closes menu | click Sources item; menu disappears |

### Mobile coverage

The gear button in TopNav carries no `md:hidden` class, so `SettingsMenu` renders on all breakpoints. Tapping the button on mobile opens the same dropdown. No change to `BottomNav` is required to satisfy the ticket's mobile requirement.

## Excluded

- Fixing the three dead `BottomNav` routes (`/library`, `/activity`, `/profile`) — pre-existing issue, not in scope.
- Creating a dedicated `/settings` hub page — the dropdown is sufficient per the ticket UX direction.
- Any changes to `SourcesPage`, `ProfileSettingsPage`, or `DeviceSettingsPage` content or layout.
- Adding a "Profile / préférences" menu item — no corresponding route exists; adding a dead link is explicitly forbidden by the ticket.
- Restoring `LeftNav`.
- End-to-end / Playwright tests — the project test stack is Vitest + RTL; browser-level tests are out of scope.

## Acceptance criteria

- `apps/web/src/components/layout/SettingsMenu.tsx` exists and exports a default `SettingsMenu` component.
- `TopNav` no longer contains a `NavLink` or anchor with `href="/settings/playback"` in the gear-icon position.
- `TopNav` renders a `<button aria-label="Paramètres">` that opens the settings menu on click.
- The settings menu contains working links to `/sources`, `/settings/playback`, and `/settings/devices`.
- The menu does **not** contain links to routes that do not exist (no `/profile`, `/library`, `/activity`).
- Clicking outside the open menu closes it.
- Pressing Escape while the menu is open closes it.
- The primary nav items (`Accueil`, `Films`, `Séries`, `Ma Liste`, `Nouveautés`) are unchanged.
- `LeftNav` is not present in the rendered DOM.
- All existing passing tests in `TopNav.test.tsx` continue to pass after the test file is updated.
- All new tests in `SettingsMenu.test.tsx` pass (`vitest run`).
- No TypeScript errors (`tsc --noEmit`).
