Implementation complete. Here's a summary:

---

## Files created / modified

**API Contracts**
- `packages/api-contracts/src/catalog.ts` — Added `EnrichmentStatus`, `MovieDetailResponse`, `SeasonSummary`, `SeriesDetailResponse`, `EpisodeResponse`

**Backend**
- `apps/api/src/routes/catalog.ts` *(new)* — All catalog routes: `GET /movies`, `/movies/:id`, `/series`, `/series/:id`, `/series/:id/seasons/:n/episodes`, `/search`
- `apps/api/src/index.ts` — Registered `catalogRoutes`
- `apps/api/src/routes/catalog.test.ts` *(new)* — 10 tests: movie 404, enrichment status derivation, series seasons, episode list, season 404

**Frontend**
- `apps/web/src/lib/api.ts` — Updated `getMovie`/`getSeries` return types; added `getSeriesSeasonEpisodes`
- `apps/web/src/components/detail/EpisodeRow.tsx` *(new)* — Episode row with number, title, synopsis (2-line clamp), duration, air date, availability badge
- `apps/web/src/components/detail/SeasonAccordion.tsx` *(new)* — Controlled accordion fetching episodes on first expand, caching in local state map
- `apps/web/src/pages/MovieDetailPage.tsx` — `MovieDetailResponse` type, `originalTitle` subtitle, enrichment status badges, skeleton loading, 404 not-found state
- `apps/web/src/pages/SeriesDetailPage.tsx` — `SeriesDetailResponse` type, same enrichment treatment, real seasons via `SeasonAccordion`, 404 state
- `apps/web/src/test/handlers.ts` — `MOCK_MOVIE` → `MovieDetailResponse`, `MOCK_SERIES` → `SeriesDetailResponse` with seasons, added `MOCK_UNMATCHED_MOVIE`, `MOCK_EPISODES`, episode handler
- `apps/web/src/pages/MovieDetailPage.test.tsx` *(new)* — 7 tests
- `apps/web/src/pages/SeriesDetailPage.test.tsx` *(new)* — 6 tests

**Results:** 50 API tests pass (10 new), 39 web tests pass (13 new). The 2 pre-existing DB-dependent test suites still fail for the same `DATABASE_URL` reason as before. TypeScript: clean on all production code.
