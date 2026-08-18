# T099 — Plan: Profile Selector and Profile Management UX

## Objective

Deliver the user-facing profile-selection and profile-management UX for Web/Desktop and Android TV, reusing the existing T098/PR #216 profile APIs (JWT two-step, CRUD endpoints, profile-scoped personalization). No new backend data model changes are required; this ticket is purely a client-side UX layer over the already-deployed foundation.

## Included

### 0. Avatar gallery (shared asset layer)

**`packages/api-contracts/src/avatars.ts`** (new)
- Export `AVATAR_KEYS: readonly string[]` — 8 stable string keys (e.g. `avatar_01` … `avatar_08`).
- Export `FALLBACK_AVATAR_KEY = 'avatar_01'`.
- Keys are the canonical contract between backend (persisted in `profiles.avatarKey`) and all clients.

**`apps/web/public/avatars/`** (new directory)
- Add 8 original SVG/PNG avatar images named `avatar_01.svg` … `avatar_08.svg`.
- No copyrighted artwork; use geometric/illustrated characters.

**`apps/web/src/lib/avatars.ts`** (new)
- `getAvatarUrl(avatarKey: string | null): string` — maps key to `/avatars/<key>.svg`; returns fallback URL for unknown/null keys.

**`apps/android-tv/app/src/main/res/drawable/`** (modify)
- Add 8 vector drawables `avatar_01.xml` … `avatar_08.xml` mirroring the same visual set.

**`apps/android-tv/app/src/main/kotlin/com/iptvflix/androidtv/util/AvatarResolver.kt`** (new)
- `fun getAvatarRes(avatarKey: String?): Int` — returns `R.drawable.*` for known keys; fallback to `avatar_01`.

---

### 1. Web — Profile context

**`apps/web/src/context/ProfileContext.tsx`** (new)
- `ProfileContext` wraps the authenticated area and tracks:
  - `currentProfile: ProfileResponse | null`
  - `profiles: ProfileResponse[]`
  - `profileVersion: number` — incremented on every profile switch to bust hooks
  - `selectProfile(profileId: string): Promise<void>` — calls `POST /profiles/:id/select`, stores new token in localStorage, sets new `currentProfile`, increments `profileVersion`
  - `refreshProfiles(): Promise<void>` — reloads profile list
  - `lastUsedProfileId: string | null` — persisted in localStorage key `iptvflix_last_profile_id`
- On mount: load profile list; if `lastUsedProfileId` is valid, auto-select it; otherwise leave profile unselected and redirect to `/profiles/choose`.

**`apps/web/src/App.tsx`** (modify)
- Wrap `ProtectedRoute` subtree in `<ProfileProvider>`.
- Add route `/profiles/choose` (no AppShell — full-screen chooser) under `ProtectedRoute`.
- Add route `/profiles` (with AppShell) — profile management page.
- Add route `/profiles/:profileId/edit` (with AppShell) — edit profile page.
- Add route `/profiles/create` (with AppShell) — create profile page.
- Guard AppShell routes: if `currentProfile === null`, redirect to `/profiles/choose`.

**`apps/web/src/context/AuthContext.tsx`** (modify)
- On `logout()`: clear `iptvflix_last_profile_id` from localStorage in addition to token.

---

### 2. Web — API client additions

**`apps/web/src/lib/api.ts`** (modify)
- Add: `listProfiles(): Promise<ProfileResponse[]>` → `GET /profiles`
- Add: `selectProfile(profileId: string): Promise<SelectProfileResponse>` → `POST /profiles/:id/select`
- Add: `createProfile(body: CreateProfileBody): Promise<ProfileResponse>` → `POST /profiles`
- Add: `updateProfile(profileId: string, body: UpdateProfileBody): Promise<ProfileResponse>` → `PATCH /profiles/:id`
- Add: `deleteProfile(profileId: string): Promise<void>` → `DELETE /profiles/:id`

---

### 3. Web — Profile chooser (first-select / switch)

**`apps/web/src/pages/ProfileChoosePage.tsx`** (new)
- Full-screen page matching the streaming-app pattern: title "Qui regarde ?", grid of profile cards.
- Each card: `<ProfileAvatar>` + display name.
- Clicking a card calls `selectProfile(id)` then navigates to `/`.
- Keyboard: tab-navigable; Enter selects; no escape (not a modal in this route).
- Shown automatically on first login when no last-used profile, and when navigated to explicitly.

**`apps/web/src/components/ProfileAvatar.tsx`** (new)
- Renders the avatar image from `getAvatarUrl(avatarKey)` at a configurable size.
- Shows Kids badge when `isKids === true`.
- Accepts optional `isActive` prop for ring highlight.

---

### 4. Web — Navigation profile switcher

**`apps/web/src/components/AppShell.tsx`** (modify — or wherever the top nav lives)
- Add profile affordance in the account/top-right area: `<ProfileAvatar>` + display name, clickable.
- Clicking opens `<ProfileSwitcherPopover>`.

**`apps/web/src/components/ProfileSwitcherPopover.tsx`** (new)
- Popover/dropdown listing all profiles:
  - Current profile with checkmark/ring.
  - Other profiles as clickable rows.
  - Divider then: "Gérer les profils" → `/profiles`; "Paramètres" → existing settings; "Se déconnecter" (account-level logout, clearly distinct).
- Selecting a non-current profile calls `selectProfile(id)` and closes popover.
- Trap focus inside popover; Escape closes; outside-click closes.
- On profile switch: profile context `profileVersion` increments → all hooks refetch.

---

### 5. Web — Hook cache invalidation

All profile-scoped data hooks must depend on `profileVersion` from ProfileContext so they reset and refetch on switch.

**`apps/web/src/hooks/useHome.ts`** (modify)
- Add `profileVersion` to `useEffect` deps; reset state on change.

**`apps/web/src/hooks/useWatchlist.ts`** (modify)
- Same: depend on `profileVersion`; reset list on change.

**`apps/web/src/hooks/useContinueWatching.ts`** (modify)
- Same.

**`apps/web/src/hooks/useShelves.ts`** (modify)
- Same.

Any other hook fetching progress, feedback, arrivals, or preferences must follow the same pattern. Each hook reads `const { profileVersion } = useProfile()` and lists it in `useEffect([..., profileVersion])`.

---

### 6. Web — Profile management pages

**`apps/web/src/pages/ProfileManagePage.tsx`** (new)
- Lists all profiles.
- "Edit" pencil per profile → `/profiles/:id/edit`.
- Trash icon per profile → confirms then calls `deleteProfile`; shows max-profile constraint or last-profile protection error from API (409) in user-friendly message.
- "+ Ajouter un profil" button (disabled when at `maxProfiles` limit) → `/profiles/create`.
- Clicking a non-edit area of a profile card does NOT switch profile (manage mode semantics).

**`apps/web/src/pages/ProfileCreatePage.tsx`** (new)
- Form: name (required), avatar picker grid, Kids toggle.
- On submit: `createProfile()`; on success navigate to `/profiles` (or auto-select new profile per UX decision).
- Validation errors displayed inline.

**`apps/web/src/pages/ProfileEditPage.tsx`** (new)
- Same form pre-populated from profile data.
- On submit: `updateProfile(profileId, patch)`.
- Cannot accidentaly switch profile from this page.
- Show "Profil enfant" / Kids toggle if `isKids` supported by API.

**`apps/web/src/components/AvatarPicker.tsx`** (new)
- Grid of 8 avatar options from `AVATAR_KEYS`; selected one highlighted with ring.
- Emits `onChange(avatarKey: string)`.

---

### 7. Web — Account vs Profile settings boundary

**`apps/web/src/pages/ProfileSettingsPage.tsx`** (modify — existing file)
- Ensure only profile-level preferences are shown here (audio/subtitles/autoplay/maturity).
- Add visible section header distinguishing this as "Préférences du profil — [profile name]".
- Remove any account-level settings if present (sources, credentials).

Existing account/device settings pages remain on their own routes — no change to their content, only verify the nav labels are clear.

---

### 8. Android TV — Profile API client

**`apps/android-tv/app/src/main/kotlin/com/iptvflix/androidtv/network/ProfileApiService.kt`** (new)
- Suspend functions via OkHttp (existing pattern from `ApiClient`):
  - `listProfiles(): List<ProfileResponse>`
  - `selectProfile(profileId: String): SelectProfileResponse`
- `ProfileResponse` and `SelectProfileResponse` data classes mirroring API contracts.

**`apps/android-tv/app/src/main/kotlin/com/iptvflix/androidtv/network/ApiClient.kt`** (modify)
- Expose `profileApiService: ProfileApiService` property.

**`apps/android-tv/app/src/main/kotlin/com/iptvflix/androidtv/storage/TokenStore.kt`** (modify)
- Add `saveProfileToken(token: String)` and `getProfileToken(): String?` (stored separately or the same key, overwriting the account token since the profile JWT is a superset — confirm current token storage semantics and align).
- Add `getLastUsedProfileId(): String?` / `saveLastUsedProfileId(id: String)` in SharedPreferences (not SecureStorage — not auth-sensitive, only a UX convenience hint).

---

### 9. Android TV — ProfileViewModel

**`apps/android-tv/app/src/main/kotlin/com/iptvflix/androidtv/ui/profiles/ProfileViewModel.kt`** (new)
- `StateFlow<ProfileUiState>` where `ProfileUiState` holds `profiles: List<ProfileResponse>`, `loading: Boolean`, `error: String?`.
- `fun loadProfiles()` — calls `listProfiles()`, emits state.
- `fun selectProfile(profileId: String, onSuccess: () -> Unit)` — calls API, saves new token via `TokenStore`, saves `lastUsedProfileId`, calls `onSuccess`.

---

### 10. Android TV — "Qui regarde ?" screen

**`apps/android-tv/app/src/main/kotlin/com/iptvflix/androidtv/ui/profiles/WhoIsWatchingScreen.kt`** (new)
- Jetpack Compose for TV screen.
- Layout: centered title "Qui regarde ?", `TvLazyRow` of `ProfileCard` composables.
- Each `ProfileCard`: avatar drawable + display name; D-pad focus enlarges card (scale + focus highlight).
- Last-used profile pre-focused on entry (read `lastUsedProfileId` from `TokenStore`).
- OK/Enter on card → `ProfileViewModel.selectProfile()` → navigate to Home.
- Back: sensible — if arriving from cold start there is no back destination; `BackHandler` suppresses or shows "Quitter l'application" dialog, does NOT log out.
- "+ Ajouter" card at the end (future placeholder — renders but no action for v1 unless profile management on TV is in scope; see Excluded).

**`apps/android-tv/app/src/main/kotlin/com/iptvflix/androidtv/ui/profiles/ProfileCard.kt`** (new)
- Reusable Compose component: avatar image (from `AvatarResolver`), name text, focus/selected state styling.
- TV-distance legible font size ≥ 24sp, touch target ≥ 56dp.
- TalkBack label: profile name + "Profil enfant" suffix when `isKids`.

---

### 11. Android TV — App navigation update

**`apps/android-tv/app/src/main/kotlin/com/iptvflix/androidtv/AppNavGraph.kt`** (modify)
- Insert `WhoIsWatchingScreen` as new mandatory stop after account auth is confirmed and before `HomeScreen`.
- Cold-start flow: `Pairing` (if needed) → `WhoIsWatching` → `Home` → `Player`.
- Condition: show `WhoIsWatching` on every app launch (even if last-used profile exists — per ticket requirement; last-used only pre-focuses).
- Define `"who_is_watching"` route; `"home"` route receives `profileId` argument set after selection.

---

### 12. Android TV — In-app profile switch

**`apps/android-tv/app/src/main/kotlin/com/iptvflix/androidtv/ui/home/HomeScreen.kt`** (modify)
- Add a "Changer de profil" entry in the TV side navigation or account panel.
- Selecting it: if player is active, save/stop playback first (call existing stop/pause path), then navigate back to `WhoIsWatchingScreen` without clearing account token.

---

### 13. Tests

**`apps/api/src/__tests__/profiles.test.ts`** (modify — extend existing)
- Add test: switch profile with valid profileId → new JWT issued, `lastUsedAt` updated.
- Add test: switch to profile not owned by account → 403.
- Add test: switch while at active profile → succeeds and new token valid.
- Add test: create profile at maxProfiles limit → 409.
- Add test: delete last profile → 409.
- Add test: delete currently selected profile → 409.

**`apps/web/src/__tests__/ProfileContext.test.tsx`** (new)
- Unit tests for `ProfileContext`:
  - `selectProfile` stores new token and updates `currentProfile`.
  - `profileVersion` increments on each switch.
  - `lastUsedProfileId` persisted and restored on mount.
  - Failed `selectProfile` leaves previous profile unchanged.

**`apps/web/src/__tests__/ProfileSwitcher.test.tsx`** (new)
- Render `ProfileSwitcherPopover` with mock profiles.
- Clicking current profile does nothing.
- Clicking another profile calls `selectProfile`.
- Keyboard: Escape closes; Tab cycles through options.

**`apps/web/src/__tests__/ProfileManage.test.tsx`** (new)
- 1-profile account: delete disabled.
- Max-profile account: create button disabled.
- Kids indicator rendered.

**`apps/android-tv/.../ProfileViewModelTest.kt`** (new)
- `loadProfiles()` emits correct state.
- `selectProfile()` on success stores token and emits navigation event.
- `selectProfile()` on API failure leaves previous profile state.

---

## Excluded

- **Backend changes**: All profile API endpoints, JWT auth, and personalization schema are already implemented in T098/PR #216. No new migrations, routes, or backend services are in scope.
- **Custom/uploaded avatar photos**: `avatarKey` architecture supports this later; v1 ships with bundled gallery only.
- **Mobile native app**: No React Native or Expo app exists in the repo. The web app (responsive) covers the "Web/Mobile" surface.
- **Android TV profile create/edit/delete UX**: Management screens on TV are deferred. The TV shows chooser and in-app switch only; management is done on web.
- **Send-to-TV profile-context enforcement** (ticket §13, Android TV deep-link): No new work needed if `CommandViewModel` already uses the current session token which embeds `profileId` after selection. Verify at implementation; no extra changes planned.
- **Recommendations / taste UI wiring**: `useHome` re-keyed on `profileVersion` covers the personalized shelf refresh. No changes to the ML pipeline itself.
- **Accessibility beyond stated minimums**: Full WCAG audit is out of scope; the plan covers keyboard support, focus management, and TalkBack labels as stated in the ticket.
- **Offline profile caching**: If the profile list fails to load the app shows an error/retry state; no local profile store is introduced.

---

## Acceptance criteria

All criteria are verifiable by a reviewer against the running app with a test account owning three profiles (A with movie + list, B with different state, C empty).

1. **Web profile chooser**: Navigating to the app after login with no last-used profile shows `/profiles/choose` full-screen with all account profiles; clicking any profile enters that profile's Home without logout.

2. **Web last-used restore**: On subsequent visits `iptvflix_last_profile_id` is read and profile is auto-selected; `/profiles/choose` is not shown unless the stored ID is invalid.

3. **Web profile switcher in nav**: Top nav shows current profile avatar + name; clicking opens a popover listing all profiles + "Gérer les profils" + logout; selecting a different profile triggers immediate switch without logout.

4. **Web cache invalidation**: After switching A → B, Home shelves / Continue Watching / My List all reload and show B's data; no A content remains visible. Same verified for B → C.

5. **Web profile management**: `/profiles` lists all profiles in manage mode (normal click ≠ switch); edit form updates name/avatar/kids; delete with confirmation removes profile (protected by API constraints); create form creates new profile up to `maxProfiles` limit.

6. **Web account/profile separation**: Profile settings page shows only profile-scoped prefs; account-level settings (sources, credentials, logout) are on separate pages and not reachable from profile edit.

7. **Avatar gallery**: Avatar picker grid shows 8 distinct choices; selected avatarKey is persisted via API and rendered consistently across chooser, nav, and management pages; unknown key falls back to `avatar_01`.

8. **Android TV cold-start**: Launching the app with a valid account session shows `WhoIsWatchingScreen` ("Qui regarde ?") before Home every time; D-pad navigates between profile cards; OK/Enter selects and enters that profile's Home.

9. **Android TV last-used pre-focus**: If a last-used profile ID is stored, that card is focused by default on `WhoIsWatchingScreen`; user must still press OK to confirm selection (no auto-enter).

10. **Android TV in-app switch**: "Changer de profil" accessible from TV navigation returns to `WhoIsWatchingScreen` without destroying account authentication; selecting a profile loads that profile's data.

11. **Android TV Back on chooser**: Pressing Back on `WhoIsWatchingScreen` during cold-start does not trigger account logout; behavior is either a quit-app dialog or Back is suppressed.

12. **No cross-profile data leakage**: With Profile A in Continue Watching and My List, switching to Profile C (empty) shows no A content; switching back to A restores A's data correctly.

13. **Profile switching preserves account session**: At no point does a profile switch invalidate the account JWT or require re-entering credentials.

14. **API failure resilience**: If `POST /profiles/:id/select` fails, the current profile remains active and a recoverable error message is shown; no blank/stale screen.

15. **Kids profile indicator**: Profiles with `isKids: true` display a Kids badge in chooser, switcher, and management list.

16. **`profileVersion` hook invalidation**: `useHome`, `useWatchlist`, `useContinueWatching`, `useShelves` all list `profileVersion` in their effect deps and refetch on switch — verifiable by code review and the cache-invalidation manual test.

17. **All new tests pass**: `apps/api` profile test suite, `apps/web` ProfileContext + ProfileSwitcher + ProfileManage tests, Android TV ProfileViewModelTest — all green.
