# Plan — T071 Immersive responsive Movie & Series detail experience

## Objective

Redesign `MovieDetailPage` and `SeriesDetailPage` into a full-viewport, dark, cinematic detail experience with a shared component architecture. Both pages gain a large visual hero, rich TMDB metadata, primary actions with graceful unavailability handling, an availability/variant panel, a `Titres similaires` horizontal shelf sourced from the canonical catalog, and (for series) a season selector with rich episode cards. Mobile layout is a fully scrollable full-screen experience; desktop is a large cinematic surface. No left sidebar is reintroduced.

## Included

### Architectural decision

Keep the existing route-based approach (`/movies/:id`, `/series/:id`). The "immersive" feel comes from making the page a full-viewport dark surface with a large cinematic hero — no modal/overlay is introduced. This preserves deep links, back navigation, and all existing card click handlers without modification.

---

### New components — `apps/web/src/components/detail/`

**`MediaHero.tsx`**
- Full-width hero section. Priority order: YouTube trailer → TMDB backdrop → poster → neutral dark gradient.
- Reuses existing `PreviewPlayer` for trailer embed.
- Bottom gradient blends into the dark page surface below.
- Falls back silently to the next tier on image or video load error (no broken containers).
- Cleans up video resources on unmount.
- Accepts: `trailerKey?`, `backdropUrl?`, `posterUrl?`, `title`.

**`MediaMetadata.tsx`**
- Renders canonical fields where present, omits empty ones: title, original title, release year/date, runtime, media type, genres (badge chips), certification, TMDB rating, popularity, synopsis, director, creators, main cast, production country, original language, status, collection/franchise.
- No "empty label" anti-pattern — missing fields simply disappear.

**`MediaActions.tsx`**
- Primary action row: **▶ Lecture** (disabled + labelled "Non disponible" when `sources.length === 0`), **+ Ma liste** (reuses `WatchlistButton`), **👍 / 👎 / Pas intéressé** (reuses `FeedbackButtons`).
- When sources exist, play triggers the existing `resolvePlayback` → navigate to player flow.
- All non-play actions remain fully functional regardless of source availability.

**`AvailabilityPanel.tsx`**
- "Disponibilités" section listing source variants: provider / language / quality / codec/HDR where available.
- Shows first 3 variants by default; "Voir toutes les versions" expands the rest.
- Selecting a variant integrates with the existing variant selection flow.
- Hidden (gracefully) when `sources = []`.

**`SimilarTitlesShelf.tsx`**
- "Titres similaires" horizontal shelf.
- Fetches from `getSimilarMovies(id)` or `getSimilarSeries(id)`.
- Wraps existing `HorizontalRow` + `PosterCard` components.
- Results come from the canonical catalog — playable, catalog-only, and upcoming titles all appear.
- Availability badge is shown per card (reuses existing `PosterCard` badge logic).
- Clicking a card navigates to `/movies/:id` or `/series/:id` — works recursively.
- Handles loading skeleton, empty state, and API error gracefully.

**`SeasonSelector.tsx`**
- Replaces `SeasonAccordion` in the series detail context.
- Season dropdown (native `<select>` styled with Tailwind) at the top.
- Below the dropdown: vertical list of `EpisodeCard` for the selected season.
- Loads episodes via existing `getSeriesSeasonEpisodes(seriesId, seasonNumber)` on season change.
- Caches already-loaded season episode lists in local state.
- Handles: normal seasons, specials/season 0, missing episode metadata, upcoming seasons.
- Loading skeleton while episodes fetch.

**`EpisodeCard.tsx`**
- Rich episode row: episode number, lazy still image, title, runtime, synopsis (2-line clamp), air date, availability badge, watch state indicator (Watched ✓ / In Progress ◑).
- Play button: disabled when episode has no availability; enabled otherwise.
- Multiple variants resolve through existing `resolvePlayback` flow — one card per episode, not per stream.
- Touch-friendly tap targets (≥ 48 px).

---

### Modified files

**`apps/web/src/pages/MovieDetailPage.tsx`**
- Full redesign using new shared components: `MediaHero` → `MediaMetadata` + `MediaActions` → `AvailabilityPanel` → `CastRow` (existing, unchanged) → `SimilarTitlesShelf`.
- Desktop: full-viewport dark page, hero fills viewport width, content in `max-w-5xl` centered column, similar titles in horizontal shelf.
- Mobile: hero fills screen width, vertical scrollable layout, no horizontal overflow.
- Tablet: natural breakpoint adaptation via Tailwind `sm`/`md` classes.
- Existing `DetailSkeleton`, error state, and 404 state are preserved.
- Continue-watching progress fetching is preserved.

**`apps/web/src/pages/SeriesDetailPage.tsx`**
- Same redesign shell as Movie, plus `SeasonSelector` + `EpisodeCard` replacing `SeasonAccordion`.
- Episode playback resolves through existing availability/variant model.
- Series-specific fields (season count, status) surface in `MediaMetadata`.

**`apps/web/src/lib/api.ts`**
- Add `getSimilarMovies(id: string)` → `GET /movies/:id/similar`.
- Add `getSimilarSeries(id: string)` → `GET /series/:id/similar`.
- Both return an array of canonical movie/series summary objects (same shape as list endpoints).

**`apps/web/src/test/handlers.ts`**
- Add MSW handlers for `GET /movies/:id/similar` and `GET /series/:id/similar` returning fixture arrays including at least one entry with no sources.

---

### New tests

| File | Coverage |
|---|---|
| `MediaHero.test.tsx` | Renders backdrop; falls back to poster on backdrop error; renders neutral fallback on poster error; no broken media container when `trailerKey` is absent; player cleanup on unmount |
| `MediaActions.test.tsx` | Play button present and enabled when sources exist; play button disabled + "Non disponible" label when `sources = []`; watchlist and feedback buttons fire handlers regardless of sources |
| `AvailabilityPanel.test.tsx` | Shows first 3 rows by default; expand shows all; renders provider / language / quality; hidden when sources empty |
| `SimilarTitlesShelf.test.tsx` | Renders tiles from API; shows catalog-only entry without playable badge; clicking navigates to correct route; empty state; loading skeleton |
| `SeasonSelector.test.tsx` | Renders dropdown with all seasons; changing season loads episode list; loading state shown; missing episode metadata shows graceful empty state |
| `EpisodeCard.test.tsx` | Renders number/title/synopsis/runtime; shows Watched/In Progress state; play button disabled when no availability; still image lazy-loaded |
| `MovieDetailPage.test.tsx` (update) | Hero renders, actions visible, similar titles section present, zero-sources disabled-play state, existing playback/watchlist/feedback pass |
| `SeriesDetailPage.test.tsx` (update) | SeasonSelector present, episode cards render, similar titles section present |

---

### Responsive behavior

| Breakpoint | Behavior |
|---|---|
| Mobile (`< sm`) | Hero: full screen width; layout: vertical scroll, single column; actions: full-width touch targets ≥ 48 px; no horizontal overflow |
| Tablet (`sm`–`md`) | Hero: full width; two-column metadata+actions; season/episode list adapts; portrait and landscape tested |
| Desktop (`md+`) | Hero: full-viewport width, large; content in `max-w-5xl` centered; actions horizontal row; similar titles horizontal scrolling shelf |

---

## Excluded

- Backend implementation of `/movies/:id/similar` and `/series/:id/similar` endpoints — assumed to exist; tracked separately if not.
- Left navigation sidebar — explicitly forbidden.
- Pixel-perfect Netflix clone.
- New recommendation algorithm — the `SimilarTitlesShelf` consumes whatever the backend returns.
- Modal/overlay implementation — route-based pages are chosen as the cleaner pattern.
- Changes to `PlayerPage`, `TopNav`, `BottomNav`, `AppShell`, `HeroSection` (home), `ShelfRow`, `PosterCard` click handlers.
- Admin pages (Sources, Devices settings).
- New media types beyond Movie and Series.
- Light mode.
- AI-generated shelf integration for similar titles.

---

## Acceptance criteria

- `MovieDetailPage` renders: hero with backdrop, MediaMetadata with canonical fields, MediaActions with play/watchlist/feedback, AvailabilityPanel, SimilarTitlesShelf.
- `SeriesDetailPage` renders: same shell plus SeasonSelector with EpisodeCard list.
- When `sources = []`: play button is disabled and labelled "Non disponible"; watchlist, feedback, and similar-titles actions remain fully functional.
- `MediaHero` renders TMDB backdrop; falls back to poster on error; falls back to neutral gradient on poster error; renders no broken `<video>` or `<iframe>` when no preview is available.
- `SimilarTitlesShelf` is present on both Movie and Series detail pages; clicking a card navigates to that media's detail route; catalog-only (no-source) entries appear in the shelf.
- `SeasonSelector` changes season without leaving the detail view; EpisodeCard shows number, title, synopsis, runtime, air date, watch state, and play action.
- Desktop: hero is large and fills viewport width; content is dark and centered; no left sidebar; similar titles in a horizontal shelf.
- Mobile: page scrolls vertically; hero fills screen width; no horizontal overflow; tap targets ≥ 48 px.
- All new component tests pass: `MediaHero`, `MediaActions`, `AvailabilityPanel`, `SimilarTitlesShelf`, `SeasonSelector`, `EpisodeCard`.
- Updated `MovieDetailPage.test.tsx` and `SeriesDetailPage.test.tsx` pass without regression.
- Existing tests for playback, watchlist, feedback, top navigation, and deep-link routing pass without modification.
- `npm run test` (Vitest) exits clean with no regressions.
