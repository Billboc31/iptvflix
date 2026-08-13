238 pass / 5 fail — same count as before the fixes, confirming the 5 pre-existing failures in `MoviesPage`, `SeriesPage`, and `SearchPage` are untouched. Zero regressions.

---

**Fixes applied:**

| File | Fix |
|---|---|
| `SeasonSelector.tsx:22-23` | Removed `seasons.length === 0 \|\| selectedSeason === 0` guard — replaced with only the cache check. Season 0 (Spéciaux) now loads correctly. |
| `AvailabilityPanel.tsx:14-16` | Added `v.providerId` as the first element of the label, so rows now render `xtream-1 · FR · 4K` as specified in the ticket. |
| `SimilarTitlesShelf.tsx:24-34` | Renamed `fetch` → `fetchPromise` (no shadow of `window.fetch`). Added `stale` flag pattern to prevent race conditions on fast navigation. |

`EpisodeCard.tsx` still shows the `🎬` placeholder — `EpisodeResponse` has no `stillUrl` field in the API contract, so a real still image cannot be rendered until the backend exposes it.
