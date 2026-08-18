I have all the information needed to write the test report now.

---

## T099 — Test Report

**Date**: 2026-08-18  
**Method**: Static code review + test coverage audit (no live runtime available)

---

### Commands / Verifications Performed

Files read and validated:
- `apps/web/src/context/ProfileContext.tsx`
- `apps/web/src/components/ProfileSwitcherPopover.tsx`
- `apps/web/src/components/layout/TopNav.tsx`, `AppShell.tsx`
- `apps/web/src/pages/ProfileChoosePage.tsx`, `ProfileManagePage.tsx`, `ProfileCreatePage.tsx`, `ProfileEditPage.tsx`
- `apps/web/src/hooks/useContinueWatching.ts`, `useWatchlist.ts`, `useHome.ts`
- `apps/web/src/lib/avatars.ts`
- `apps/web/src/App.tsx`
- `apps/web/src/__tests__/ProfileContext.test.tsx`, `ProfileSwitcher.test.tsx`, `ProfileManage.test.tsx`
- `apps/android-tv/.../profiles/WhoIsWatchingScreen.kt`, `ProfileCard.kt`, `ProfileViewModel.kt`
- `apps/android-tv/.../AppNavGraph.kt`, `home/HomeScreen.kt`
- `apps/android-tv/.../profiles/ProfileViewModelTest.kt`
- `apps/api/src/services/profile-service.ts`

---

### Acceptance Criteria — Status

| # | Criterion | Status | Notes |
|---|-----------|--------|-------|
| 1 | Web/Desktop shows current avatar/name and allows profile switching | **PASS** | `ProfileSwitcherPopover` is in `TopNav`. Shows avatar, name (truncated at 100px on desktop), dropdown with all profiles, current highlighted, spinner on switch. |
| 2 | Mobile has a touch-friendly profile panel/sheet | **PARTIAL** | Same `ProfileSwitcherPopover` popover is used on mobile via `TopNav`. No bottom-sheet or dedicated mobile-specific panel. Functional but does not match the "touch-friendly panel/sheet" design intent from the spec (§4). |
| 3 | Android TV shows "Qui regarde ?" before Home on app launch | **PASS** | `AppNavGraph.kt`: if `hasPairedDevice`, initial screen is `Screen.WhoIsWatching`. The screen renders "Qui regarde ?" heading. |
| 4 | Android TV chooser is fully remote/D-pad usable | **PARTIAL — BUG** | `ProfileCard.kt` handles `Key.Enter`/`Key.DirectionCenter` and shows focus animation (scale 1.15, red border). However, `isInitialFocus` parameter is **declared but never consumed** in the Composable body; the last-used profile will scroll into view but **will not receive D-pad focus automatically**. First-time navigation to WhoIsWatching will land focus on whatever Compose assigns by default, not the last-used profile. |
| 5 | Last-used profile can be restored on Web/mobile | **PASS** | `ProfileContext` reads `iptvflix_last_profile_id` from localStorage on init and calls `selectProfile()` automatically. Tested in `ProfileContext.test.tsx` ("loads profiles on mount and auto-selects last-used profile"). |
| 6 | Android TV still requires explicit profile selection per app launch | **PASS** | `WhoIsWatchingScreen` never auto-selects; `ProfileCard.onClick` requires explicit Enter/DirectionCenter. Last-used scrolls into view but user must press select. |
| 7 | Profile switching does not log out the Account | **PASS** | `selectProfile()` issues a new profile-scoped JWT (profile claim only); account token/session is untouched. `clearLastProfileId()` and `logout()` are separate. |
| 8 | Home/Continue Watching/My List/progress/recommendations switch to selected profile | **PASS** | `useHome` depends on `[profileId, profileVersion]`. `useContinueWatching` and `useWatchlist` both depend on `profileVersion`. All clear state and refetch on switch. |
| 9 | No stale cross-profile personalized data is visible after switching | **PASS** | All three data hooks do `setItems([])`/`setEntries([])`/`setData(undefined)` synchronously before refetching when `profileVersion` increments. Token-timing test in `ProfileContext.test.tsx` also validates no cross-profile progress leakage during in-flight switches. |
| 10 | Profiles can be created/edited/deleted within #201 rules | **PASS (Web only)** | Web: full CRUD via `ProfileCreatePage`, `ProfileEditPage`, `ProfileManagePage`. Backend enforces last-profile protection (409), profile limit (account.maxProfiles). Delete confirmation dialog present. Android TV: **no profile management UI** (create/edit/delete), only accessible on web. |
| 11 | Built-in avatar gallery exists with stable avatar keys | **PASS** | 8 SVG avatars (`avatar_01`–`avatar_08`) in `apps/web/public/avatars/`. Keys defined in `@iptvflix/api-contracts`. `getAvatarUrl()` has graceful fallback to `FALLBACK_AVATAR_KEY`. Android TV has matching `avatar_0[1-8].xml` drawables. |
| 12 | Account settings remain distinct from Profile settings | **PASS** | Profile preferences at `/settings/playback`; source credentials at `/sources`; device settings at `/settings/devices`. Profile edit form contains only name/avatar/isKids — no source fields. |
| 13 | Playback/progress is attributed to the correct active profile | **PASS** | `PlayerPage` is outside `AppShell`, so `ProfileSwitcherPopover` is not rendered during playback — concurrent switch+flush is architecturally impossible. Token is only written after `selectProfile` API resolves. Switching from non-player routes navigates to `/` (new profile Home). |
| 14 | Real Web/Mobile and Android TV flows are manually validated | **FAIL** | No documented live validation. The completion rule explicitly requires demonstrating a real account with 3 profiles and different states on both platforms. No artifact (screenshot, log, or report) exists to satisfy this requirement. |

---

### Blocking Issues

#### BUG-1 — `isInitialFocus` unused in `ProfileCard.kt` (Android TV pre-focus broken)

**File**: `apps/android-tv/app/src/main/kotlin/com/iptvflix/androidtv/profiles/ProfileCard.kt:42`

The `isInitialFocus: Boolean` parameter is declared but never referenced in the Composable body. `WhoIsWatchingScreen` computes `isInitialFocus = profile.id == lastUsedProfileId` and passes it to `ProfileCard`, but it has no effect. The `focused` state starts as `false` for every card.

**Impact**: Criterion 4 ("Android TV D-pad usable") is partially broken — the last-used profile won't receive focus on first render; the user must navigate to it manually. This contradicts §7's requirement that "the last-used profile can be pre-focused."

**Fix needed**: Use `FocusRequester` + `LaunchedEffect` in `ProfileCard` when `isInitialFocus == true`:
```kotlin
val focusRequester = remember { FocusRequester() }
LaunchedEffect(isInitialFocus) {
    if (isInitialFocus) focusRequester.requestFocus()
}
// ... add .focusRequester(focusRequester) to the Column modifier
```

#### FAIL-1 — No documented manual validation (Completion Rule violation)

The ticket's completion rule is explicit: *"Do not close because a selector component renders. Demonstrate a real account with multiple profiles on both Web/Mobile and Android TV."* No validation artifact exists in `runs/T099/`.

---

### Non-Blocking Issues

| Issue | Impact | Severity |
|-------|--------|----------|
| Mobile uses desktop popover, not bottom-sheet | §4 spec intent not fully met; UX acceptable but not native-feeling on mobile | Optional |
| Android TV has no "Gérer les profils" / profile CRUD UI | Users on TV cannot create/edit profiles; must use web | Optional |
| `ProfileSwitcherPopover` has no direct Account/Settings link | Spec §4 says "Account/Settings entry points"; Settings exists in separate `SettingsMenu` in TopNav | Minor |
| No `[+ Ajouter]` button on "Qui regarde ?" TV screen | Spec diagram shows it; not in acceptance criteria | Minor |
| Test coverage gap: "switch while progress exists saves outgoing profile" | No integration test; architectural argument provided but not a runtime test | Minor |

---

### Regressions Observed

None detected. Existing routes, data hooks, and auth flow are structurally unchanged; profile features are additive layers.

---

### Validation Summary

**Result: REFUSE — 2 blocking issues**

1. **BUG**: `isInitialFocus` is a dead parameter in `ProfileCard.kt` — Android TV last-used pre-focus does not work.
2. **FAIL**: Mandatory live manual validation with a real multi-profile account has not been performed or documented.

The implementation is architecturally sound and covers the vast majority of requirements. Fix the `isInitialFocus` bug and produce a manual validation artifact (3-profile account on Web + TV cold-start + switch) to satisfy the completion rule.
