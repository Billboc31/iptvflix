3 failed files, 5 failed tests — same count as the pre-existing failures mentioned in the review context (238 pass → 219+5=224, and the 5 failures are the pre-existing ones in `MoviesPage`, `SeriesPage`, and `SearchPage`). No regressions introduced.

Both blocking fixes are applied:

- **B1 fixed** — `key={series.id}` added to `<SeasonSelector>` in `SeriesDetailPage.tsx:169`, forcing a remount when navigating between series and clearing the stale episode cache.
- **B2 fixed** — 6 dead-code files deleted: `EpisodeRow.tsx`, `EpisodeRow.test.tsx`, `SeasonAccordion.tsx`, `SeasonAccordion.test.tsx`, `TrailerPlayer.tsx`, `TrailerPlayer.test.tsx`. No remaining imports reference them.

Test results: 219 pass / 5 fail — the 5 failures are the same pre-existing failures in `MoviesPage`, `SeriesPage`, and `SearchPage` that existed before this fix pass. Zero regressions.
