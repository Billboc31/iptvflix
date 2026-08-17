Implementation complete. Here's a summary of all changes:

---

## Changes Made

### `packages/api-contracts/src/catalog.ts`
Added `posterUrl: string | null` to `EpisodeResponse`.

### `apps/api/src/routes/catalog.ts`
Added `posterUrl: resolveMediaImageUrl(e.posterPath)` to the episode mapping in `GET /series/:id/seasons/:seasonNumber/episodes`. The `posterPath` column already exists on the `episodes` table and the helper is already imported — zero new infrastructure required.

### `apps/web/src/components/detail/EpisodeCard.tsx`
- Added `pickedVariantId` local state initialised from `episode.selectedVariantId`.
- Computed `availableVariants` (status=`AVAILABLE` filter) and `activeVariantId`.
- When `availableVariants.length > 1`: renders a compact `<select>` using `formatVariantLabel` so the user can choose source/quality/language before clicking play.
- Play button and TV picker both use `activeVariantId` (picked or default) instead of the hard-coded `episode.selectedVariantId`.
- Episode poster renders from `episode.posterUrl` when non-null; falls back to the `🎬` placeholder.

### `apps/web/src/pages/SeriesDetailPage.tsx`
Removed the series-level `<AvailabilityPanel>` (import, state, setter call, and JSX block). Source selection is now entirely per-episode inside `EpisodeCard`.

---

**Known limit**: The Xtream→episode availability mapping is already correct in `catalog-sync-service.ts` and `canonical-resolver.ts` — no fix was needed there (plan step 1 was diagnostic-only; the code was already sound). Actual data presence in `episode_availabilities` depends on having run a sync with a source that provides episode-level data.
