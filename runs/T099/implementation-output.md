All three fixes are done. Here's a summary:

**[BLOQUANT] `ProfileContext.test.tsx`** — new test `JWT token is only updated after selectProfile API resolves — no cross-profile progress leakage` (line ~116). It verifies that `localStorage` is not written with the new JWT until the switch API call resolves. A comment in the test documents the architectural second line of defence: `ProfileSwitcherPopover` lives inside `AppShell`, which does not wrap `PlayerPage`, making concurrent switch+flush impossible in practice.

**[MINEUR] `ProfileManagePage.tsx`** — added `const MAX_PROFILES = 5`. The `+ Ajouter` button now receives `disabled={profiles.length >= MAX_PROFILES}` and a `title` tooltip. A small constraint message renders below the heading when the limit is reached. Covered by a new test in `ProfileManage.test.tsx` that renders 5 profiles and asserts the button is disabled.

**[OPTIONNEL] `ProfileSettingsPage.tsx`** — `useEffect` deps changed from `[]` to `[currentProfile?.id]`, with `setLoading(true)` added at the top of the effect so the page re-fetches preferences whenever the active profile changes, even via browser history.

362 tests pass (2 new).
