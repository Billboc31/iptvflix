All done. Here's a summary of what was implemented:

---

**Files created/modified:**

| File | Change |
|---|---|
| `apps/web/src/components/layout/SettingsMenu.tsx` | New component — gear button with dropdown menu |
| `apps/web/src/components/layout/TopNav.tsx` | Replaced direct `NavLink` to `/settings/playback` with `<SettingsMenu />` |
| `apps/web/src/components/layout/SettingsMenu.test.tsx` | New — 9 tests covering open/close/links/keyboard/outside-click |
| `apps/web/src/components/layout/TopNav.test.tsx` | Replaced 2 old link tests with 3 new menu-interaction tests |

**What the SettingsMenu does:**
- Gear button with `aria-label="Paramètres"` and `aria-haspopup/aria-expanded` attributes
- Dropdown exposes: **Sources** (`/sources`), **Lecture** (`/settings/playback`), **Appareils** (`/settings/devices`) — all three are real routes
- Closes on outside click, Escape key, navigation, or item click
- Active item highlighted via `useLocation`
- No new dependencies; visible on all breakpoints (desktop + mobile)

**Test results:** 199/199 pass. TypeScript: no errors.
