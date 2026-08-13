## Objective

Add Netflix-style muted autoplay previews to the Home hero and shelf card surfaces, using the `trailerKey` YouTube trailer ID already available from T053. Previews are opt-in via a profile preference, respect `prefers-reduced-motion`, lazy-mount a single player at a time, are desktop-only for card hover, and fall back silently to the static view when autoplay is blocked or `trailerKey` is null.

## Included

### API Contracts (`packages/api-contracts/`)

1. **`catalog.ts`** — add `trailerKey: string | null` to `MovieResponse` (the hero reads the movie list endpoint; `MovieDetailResponse` extends `MovieResponse` so it inherits the field at no extra cost)
2. **`shelves.ts`** — add `trailerKey: string | null` to `ShelfItem`
3. **`profile.ts`** — add `autoplayPreviews: boolean` to `ProfilePreferences`; update `UpdateProfilePreferencesBody` (already `Partial<ProfilePreferences>`, no further change needed)

### Backend (`apps/api/`)

4. **`db/schema/profiles.ts`** — add `autoplayPreviews: boolean('autoplay_previews').notNull().default(true)`
5. **`migrations/0021_autoplay_previews.sql`** — `ALTER TABLE profiles ADD COLUMN autoplay_previews boolean NOT NULL DEFAULT true;`
6. **`services/profile-service.ts`** — include `autoplayPreviews` in `getDefaultProfilePreferences` return value and in the `updateDefaultProfilePreferences` patch/merge/persist logic
7. **`routes/profile.ts`** — add boolean validation for `autoplayPreviews` in the PATCH handler (reject non-boolean with 400); pass through to service
8. **`routes/movies.ts`** — add `trailerKey` to the movie list SELECT projection so `MovieResponse` items carry the field
9. **`services/shelf-service.ts`** — extend every ShelfItem builder to select and map `trailerKey`:
   - `resolveSystemShelf`: add `trailerKey` column to each DB `select()` for continue-watching, my-list, and recently-added paths
   - `evaluateMovies` / `evaluateSeries`: add `trailerKey` to the select projection
   - `resolveManualItems`: include `trailerKey` in the movie and series selects; map into the returned items
10. **`services/home-service.ts`** — after `rankRecommendations` returns its candidates, batch-fetch `trailerKey` by `mediaId` from movies and series tables (two separate `inArray` queries, merged into a `Map<mediaId, trailerKey>`); pass through `candidateToItem`; `RecommendationCandidate` type is **not** modified

### Frontend (`apps/web/src/`)

**New files:**

11. **`contexts/PreviewContext.tsx`** — React context and provider:
    - Initialises `prefers-reduced-motion` via `window.matchMedia('(prefers-reduced-motion: reduce)')` (read once on mount)
    - Calls `getProfile()` once to read `autoplayPreviews` preference
    - State: `activeId: string | null`, `activeKey: string | null`
    - `activate(id: string, key: string): void` — no-op if reduced-motion or `autoplayPreviews === false`; otherwise replaces any existing active preview
    - `deactivate(): void`
    - Exports `usePreview()` hook
    - `PreviewProvider` wraps children with no visual output

12. **`components/content/PreviewPlayer.tsx`** — muted YouTube-nocookie iframe:
    - Props: `trailerKey: string`, `active: boolean`
    - Mounts the iframe only when `active === true`; removes it on `active → false`
    - iframe src: `https://www.youtube-nocookie.com/embed/{key}?autoplay=1&mute=1&controls=0&modestbranding=1&loop=1&playlist={key}`
    - iframe `allow`: `autoplay; encrypted-media`
    - Positioned `absolute inset-0 w-full h-full`; `border-0`; `opacity-0 → opacity-100` transition on load to avoid flash
    - `onError`: hide the iframe (set `visibility: hidden`), parent static view remains visible
    - Exposes an imperative mute-toggle via `window.postMessage` sent to the iframe contentWindow (`{"event":"command","func":"unMute","args":""}` / `"mute"`)

**Modified files:**

13. **`App.tsx`** — wrap the router outlet (or the full JSX tree) with `<PreviewProvider>`

14. **`components/content/HeroSection.tsx`** — add preview behavior:
    - New props: `mediaId?: string`, `trailerKey?: string | null`
    - On mount: if `trailerKey` and not touch device (`!window.matchMedia('(pointer: coarse)').matches`), start a 2 s `setTimeout` → call `activate(mediaId, trailerKey)`
    - On unmount: clear timer, call `deactivate()`
    - Render `<PreviewPlayer trailerKey={trailerKey} active={activeId === mediaId} />` inside the hero container, below the backdrop image, above gradient overlays
    - When `active`: show a small mute/unmute icon button (bottom-right of hero) that sends the postMessage to the iframe; show a "▶ Revoir" replay button (restarts by remounting)
    - All hero text and action buttons remain visible over the preview (existing gradient overlays keep legibility)

15. **`pages/HomePage.tsx`** — pass `mediaId` and `trailerKey` from the hero movie to `HeroSection`:
    - `hero.id` → `mediaId`
    - `hero.trailerKey` → `trailerKey` (now available after change #8)

16. **`components/content/PosterCard.tsx`** — add card preview:
    - New prop: `trailerKey?: string | null`
    - Touch guard: check `window.matchMedia('(pointer: coarse)').matches` on first pointer interaction; skip preview on touch devices
    - `onMouseEnter`: if non-touch and `trailerKey`, start 1.5 s delay → `activate(mediaId, trailerKey)`
    - `onMouseLeave` / `onBlur`: clear timer; if `activeId === mediaId`, call `deactivate()`
    - `onFocus` (keyboard): same 1.5 s delay as hover
    - When `activeId === mediaId`: overlay `<PreviewPlayer>` inside the card container; card must have `position: relative; overflow: hidden` (already true from current styles)
    - Card click and keyboard Enter remain fully functional while preview is active

17. **`components/content/ShelfRow.tsx`** — pass `item.trailerKey` down to each `<PosterCard>` (no logic change, just prop threading)

18. **`pages/ProfileSettingsPage.tsx`** — add "Aperçus automatiques" section:
    - Load `autoplayPreviews` from `getProfile()`
    - Render a toggle (checkbox or switch) labelled "Activer les aperçus automatiques"
    - On change: call `updateProfilePreferences({ autoplayPreviews: newValue })`
    - Optimistic update with rollback on error

**Test files:**

19. **`components/content/PreviewPlayer.test.tsx`** (new) — covers: null-key renders nothing; iframe mounted when `active=true`; iframe removed when `active=false`; error path hides iframe without crashing
20. **`contexts/PreviewContext.test.tsx`** (new) — covers: `activate` replaces previous active; `activate` is no-op when `autoplayPreviews=false`; `activate` is no-op when `prefers-reduced-motion`; `deactivate` clears state
21. **`components/content/PosterCard.test.tsx`** (update) — add: hover starts delay and eventually calls `activate`; mouse-leave before delay fires cancels it; no preview when `trailerKey` is null; context with `autoplayPreviews=false` prevents preview; focus/blur path mirrors hover
22. **`components/content/HeroSection.test.tsx`** (new) — covers: preview mounts after delay with valid key; preview does not mount without `trailerKey`; unmount cleans up timer and calls `deactivate`

## Excluded

- Generating or hosting custom preview clips from IPTV streams
- Android TV-specific preview implementation
- Volume/progress-bar overlay controls (beyond mute/unmute)
- Per-shelf or per-card preview settings
- Changes to the detail-page `TrailerPlayer` component
- Modifying `RecommendationCandidate` in api-contracts (trailerKey fetched separately in home-service)
- Support for preview sources other than YouTube

## Acceptance criteria

1. `ShelfItem.trailerKey` and `MovieResponse.trailerKey` are present in all relevant API responses; `null` when no trailer is available
2. `ProfilePreferences.autoplayPreviews` persists via `PATCH /profile/preferences`; defaults to `true` for existing profiles after migration
3. Home hero mounts a muted YouTube preview after a ~2 s delay when `trailerKey` is non-null; no iframe is mounted when `trailerKey` is null
4. A PosterCard starts a muted preview after a ~1.5 s hover or focus delay (non-touch only); leaving before the delay cancels it without mounting the player
5. At most one preview player is active at any time; activating a new one stops the previous one
6. When `autoplayPreviews === false` in the profile, no previews start anywhere (context gate)
7. When `prefers-reduced-motion: reduce` is in effect, no previews start (context gate)
8. Devices with `pointer: coarse` (touch) never trigger card previews automatically
9. If the YouTube iframe fails or autoplay is denied, the static backdrop/poster remains visible; no broken or blank element
10. Rendering a full shelf does not instantiate any video player for items that are not the active preview
11. The "Aperçus automatiques" toggle in Profile Settings saves the preference and the change is reflected in the `PreviewContext` on next load
12. All new/modified components have test coverage for: preview availability, delay/cancel, single-active constraint, autoplay-disabled gate, and no-preview fallback
