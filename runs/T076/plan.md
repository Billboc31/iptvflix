## Objective

Replace the existing 65 vh `HeroSection` banner with a full-width cinematic hero that can feature either a Movie or Series, auto-plays a muted preview where available, blends into the recommendation shelves below via gradients, and delegates detail/playback to the shared infrastructure already in place.

## Included

### New hook — `apps/web/src/hooks/useFeaturedMedia.ts`

- Calls `useMovies({ pageSize: 1, sortBy: 'popularity' })` and `useSeries({ pageSize: 1, sortBy: 'popularity' })` in parallel (reuses existing hooks).
- Exports a unified `FeaturedMedia` type:
  ```ts
  type FeaturedMedia = {
    id: string
    mediaType: 'movie' | 'series'
    title: string
    synopsis: string | null
    backdropUrl: string | null
    posterUrl: string | null
    availabilityStatus: AvailabilityStatus
    trailerKey: string | null   // null for Series (not in SeriesResponse base type)
  }
  ```
- Selection logic (in priority order):
  1. Movie candidate if it has a `backdropUrl`.
  2. Series candidate if it has a `backdropUrl` and movie does not.
  3. Any available candidate regardless of artwork.
  4. `null` when both fetches are empty or failed.
- Returns `{ media: FeaturedMedia | null; loading: boolean }`.

### New test — `apps/web/src/hooks/useFeaturedMedia.test.ts`

- Tests: movie with backdrop wins over series without.
- Tests: series with backdrop wins when movie has none.
- Tests: falls back gracefully when both have no backdrop.
- Tests: returns `null` when both fetches return empty lists.
- Tests: `loading` is true until both fetches resolve.

### Modified — `apps/web/src/components/content/HeroSection.tsx`

**Sizing and layout:**
- Height: `h-[60vh] md:h-[85vh]` (was `h-[65vh]` fixed).
- Full-width backdrop is already `w-full h-full object-cover`; keep it.
- On mobile, add `object-position: center top` to the backdrop `<img>` so heads/subjects are not cropped.
- Add `posterUrl` prop; on mobile (`md:hidden`), render `posterUrl` as the background image instead of `backdropUrl` when posterUrl is available, giving a portrait-friendly crop.

**Gradient overlays:**
- Top gradient: add `bg-gradient-to-b from-[#0a0a0f]/60 via-transparent to-transparent h-32` to blend hero top into the sticky nav.
- Bottom gradient: change height coverage from current short strip to `h-2/3` with `from-[#0a0a0f] via-[#0a0a0f]/70 to-transparent` for a stronger shelf-blend.
- Keep existing left gradient unchanged.

**Preview behavior:**
- Remove the `isPointerCoarse()` guard around the 2 s auto-start timer — the hero always auto-starts preview on desktop regardless of hover.
- Add `prefers-reduced-motion` check: if `window.matchMedia('(prefers-reduced-motion: reduce)').matches`, skip auto-start entirely.
- Keep `PreviewPlayer` (YouTube iframe) and existing mute/unmute state unchanged.
- Mute/unmute button: replace text label with `🔇`/`🔊` icons and add visible `aria-label`; keep existing bottom-right positioning.

**Actions:**
- Keep `▶ Lire` conditional on `availabilityStatus === 'AVAILABLE'`.
- Keep `ⓘ Plus d'infos` (always rendered).
- Remove `+ Ma Liste` button — not part of the ticket's hero design.

**Props delta:**
```ts
// Added
posterUrl?: string | null
// Removed
onAddToList?: () => void
```

**Accessibility:**
- Add `role="region" aria-label="Contenu vedette"` to the hero root `<div>`.
- Ensure all buttons have visible focus rings (Tailwind `focus-visible:ring-2`).
- Mute button already has `aria-label`; keep it.

### Modified — `apps/web/src/pages/HomePage.tsx`

- Remove `useMovies` import and call.
- Add `useFeaturedMedia()` call; destructure `{ media: hero, loading: heroLoading }`.
- Update `isLoading = heroLoading || homeLoading`.
- Update `hasContent = hero !== null || shelves.length > 0`.
- Pass new props to `HeroSection`:
  - `posterUrl={hero.posterUrl}`
  - `onPlay`: for `'movie'` → `navigate('/player/movie/${hero.id}')` (existing); for `'series'` → omit if no direct series player route exists (do not fabricate a route).
  - `onDetails`: `openDetail(hero.mediaType, hero.id)` — `useOpenDetail` already accepts `'movie' | 'series'`.
- Remove `onAddToList` prop.
- First shelf: remove `mt-8` from the arrivals/shelves wrapper; reduce or remove top padding so shelves visually start within the hero's bottom gradient. Target: `mt-0` or `mt-2` on the arrivals `<div>`.

### Out-of-scope backend note (documentation only, no backend code change)

- `SeriesResponse` base type does not expose `trailerKey`. The hero will render correctly with artwork only for Series featured titles. This is by design and accepted; trailer support for series featured hero is a future backend addition outside T076 scope.

## Excluded

- Backend changes to `HomeResponse` (no `featured` field added to the API).
- `trailerKey` for Series featured hero (requires backend change to `SeriesResponse`).
- Series playback routing (`/player/series/:id`) — only added if the route already exists; otherwise `onPlay` is omitted for series.
- Any bespoke detail UI in the Hero — `Plus d'infos` always delegates to `useOpenDetail`.
- Watchlist / `+ Ma Liste` button in the hero.
- Play-on-TV button in the hero.
- Hardcoded featured media IDs.
- Changes to `PreviewPlayer.tsx` (used as-is).
- Changes to `TopNav.tsx` or `AppShell.tsx`.
- Changes to `ShelfRow.tsx`, `HorizontalRow.tsx`, or other shelf components.

## Acceptance criteria

- `HeroSection` height is `h-[60vh]` on mobile and `h-[85vh]` on desktop (not the old `h-[65vh]`).
- On desktop, a muted preview auto-starts within ~3 s (2 s timer) without requiring hover interaction.
- On a device matching `prefers-reduced-motion: reduce`, the preview auto-start timer is NOT set.
- Preview failure (iframe error) leaves the backdrop image visible and does not throw; shelves still render.
- `backdropUrl` is used as the primary visual; `posterUrl` is rendered as the mobile background when `backdropUrl` is unavailable or posterUrl is provided.
- `▶ Lire` is absent when `availabilityStatus !== 'AVAILABLE'`.
- `ⓘ Plus d'infos` is always present and calls `openDetail(mediaType, id)`.
- `+ Ma Liste` button is absent from the hero.
- `useFeaturedMedia` returns a movie with `backdropUrl` in preference over a series without one (verified by unit tests).
- `useFeaturedMedia` can return a series as the featured title.
- `HomePage` renders without the `useMovies` import.
- The hero container has `role="region"` and `aria-label="Contenu vedette"`.
- All hero buttons are reachable and activatable by keyboard.
- The visual gap between the hero bottom gradient and the first shelf/arrival row is ≤ 8 px (no large empty strip).
- `useFeaturedMedia.test.ts` passes with all selection-logic scenarios covered.
