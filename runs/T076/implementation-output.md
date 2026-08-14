All 20 tests pass and TypeScript is clean. Here's a summary of all changes:

---

## Files created / modified

### Created
- **`apps/web/src/hooks/useFeaturedMedia.ts`** — New hook fetching top-1 movie and series by popularity in parallel, selecting the best candidate (movie with backdrop > series with backdrop > movie fallback > series fallback > null). Returns `{ media: FeaturedMedia | null; loading: boolean }`.
- **`apps/web/src/hooks/useFeaturedMedia.test.ts`** — 6 unit tests covering all selection-logic scenarios (backdrop preference, empty results, loading state, trailerKey=null for series).

### Modified
- **`apps/web/src/components/content/HeroSection.tsx`**
  - Height changed from `h-[65vh]` → `h-[60vh] md:h-[85vh]`
  - Added `posterUrl` prop; mobile shows poster (or backdrop fallback) with `object-top`; desktop shows backdrop
  - Added top gradient blending into nav
  - Strengthened bottom gradient to `h-2/3` for shelf blend
  - Removed `isPointerCoarse()` guard; added `prefers-reduced-motion` check instead
  - Mute button: text labels → `🔇`/`🔊` icons (aria-label unchanged)
  - Removed `onAddToList` prop
  - Added `role="region" aria-label="Contenu vedette"` and `focus-visible:ring-2` on buttons

- **`apps/web/src/components/content/HeroSection.test.tsx`**
  - Replaced touch-device test with `prefers-reduced-motion` test
  - Updated mute button text checks to use emoji icons
  - Added `role="region"` accessibility test
  - Added "Ma Liste button absent" assertion

- **`apps/web/src/pages/HomePage.tsx`**
  - Replaced `useMovies` with `useFeaturedMedia`
  - Hero now features movies or series; `onPlay` only set for movies with AVAILABLE status
  - `onDetails` delegates to `openDetail(hero.mediaType, hero.id)` supporting both types
  - Arrivals shelf padding reduced from `mt-8` → `mt-2`
  - Removed `onAddToList` prop
