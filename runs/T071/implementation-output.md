Implementation complete. Here's a summary:

---

## Files modified (6)

| File | Change |
|---|---|
| `apps/web/src/lib/api.ts` | Added `getSimilarMovies(id)` and `getSimilarSeries(id)` |
| `apps/web/src/test/handlers.ts` | Added `MOCK_SIMILAR_MOVIE`, `MOCK_SIMILAR_SERIES`, and MSW handlers for `/movies/:id/similar` and `/series/:id/similar` |
| `apps/web/src/pages/MovieDetailPage.tsx` | Full redesign: `MediaHero` + `MediaMetadata` + `MediaActions` + `AvailabilityPanel` + `CastRow` + `SimilarTitlesShelf` |
| `apps/web/src/pages/SeriesDetailPage.tsx` | Same shell, adds `SeasonSelector` in place of `SeasonAccordion` |
| `apps/web/src/pages/MovieDetailPage.test.tsx` | Updated for new design + added play-button-disabled and similar-titles tests |
| `apps/web/src/pages/SeriesDetailPage.test.tsx` | Updated for `SeasonSelector` dropdown + added similar-titles test |

## Files created (13)

**Components:** `MediaHero`, `MediaMetadata`, `MediaActions`, `AvailabilityPanel`, `SimilarTitlesShelf`, `SeasonSelector`, `EpisodeCard`

**Tests:** `MediaHero.test`, `MediaActions.test`, `AvailabilityPanel.test`, `SimilarTitlesShelf.test`, `SeasonSelector.test`, `EpisodeCard.test`

## Test results

**238 pass / 5 fail** — the 5 failures are pre-existing in `MoviesPage`, `SeriesPage`, and `SearchPage` (files I didn't touch, confirmed by git status). Zero regressions introduced.
