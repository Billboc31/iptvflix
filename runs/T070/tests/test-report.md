I have everything needed. Here is the full test report.

---

# T070 — Test Report

**Branch:** `ticket/T070-drive-movies-and-series-discovery-shelves-from-the`
**Date:** 2026-08-13
**Verdict: FAIL — blocking issues detected**

---

## Acceptance Criteria

### AC1 — Movies/Series pages remain rich with zero providers connected
**PASS**

`MoviesPage.tsx` and `SeriesPage.tsx` query the canonical catalog directly via `GET /movies` and `GET /series` with no availability filter applied by default. The hero is sourced from `sortBy=popularity` against the canonical `movies` table, which is populated independently of provider syncs. Shelves (Populaires, Les mieux notés, Sorties récentes, À venir) all query canonical metadata without requiring any `AVAILABLE` availability record.

---

### AC2 — Multiple automatic shelves generated from local canonical metadata
**PASS**

`MoviesPage.tsx` renders five automatic shelves from canonical data:
- Populaires (`sortBy=popularity`)
- Les mieux notés (`sortBy=voteAverage`)
- Sorties récentes (`sortBy=year`)
- À venir (`upcoming=true`)
- Genre shelf (when a genre chip is selected)

`SeriesPage.tsx` mirrors the same set. `buildHome()` in `home-service.ts` additionally builds "Recommandé pour toi" and "À découvrir" from `rankRecommendations()`. All shelves source title, poster, backdrop, and metadata from canonical tables.

---

### AC3 — Upcoming/unavailable titles can appear and be added to My List
**PASS**

The `upcoming=true` filter in `catalog-service.ts` surfaces titles where `theatricalReleaseDate > NOW()` or `status IN ('Rumored', 'Planned', 'In Production', 'Post Production')`. `addToWatchlist()` in `watchlist-service.ts` accepts any canonical or discovery-candidate ID, so any title can be added to My List regardless of availability.

---

### AC4 — Available titles expose playable variants without duplicate cards
**PASS**

`resolveVariant()` in `availability-resolver.ts` picks the best variant from AVAILABLE records, scored by audio/subtitle/source/quality preferences. The canonical model ensures one card per media item regardless of how many providers carry it — the `availabilityCount` aggregation counts providers, not cards.

---

### AC5 — Users can discover/filter content based on availability
**PASS**

`MoviesPage.tsx` and `SeriesPage.tsx` include an availability toggle ("Tout le catalogue" / "Disponible maintenant") that sets `availability=AVAILABLE` on the API query. `GET /movies` and `GET /series` support `availability: 'AVAILABLE' | 'UNAVAILABLE'` as query params and apply an EXISTS subquery filter in `catalog-service.ts`.

---

### AC6 — Hero/cards always use canonical titles/artwork/metadata
**PASS**

`HeroSection` accepts `title`, `synopsis`, `backdropUrl` from the canonical response. `PosterCard` takes `title`, `year`, `posterUrl` from canonical fields. The shelf `ShelfItem` type in `api-contracts/src/shelves.ts` carries `title` and `posterUrl` from canonical tables. No raw Xtream or provider-specific naming reaches user-facing components.

---

### AC7 — Shelf APIs are performant against the large local catalog
**PARTIAL PASS**

Indexes exist on `movies.popularity` and `movies.vote_average` (confirmed in `db/schema/movies.ts` and `series.ts`). However:
- `availabilityCount` is computed via an aggregation JOIN per page with no result caching
- `rankRecommendations()` in `recommendation-ranking-service.ts` fetches all canonical movies and series plus discovery candidates into memory before scoring — no pagination or lazy loading
- `recentAvailability` sort uses `SELECT MAX(last_seen_at) FROM movie_availabilities WHERE movie_id = movies.id` as a correlated subquery, which will degrade at large scale

These are non-blocking performance concerns rather than functional failures. No explicit benchmarks or load-test results were available to validate.

---

## Blocking Issues

### FAIL 1 — 4 integration tests failing: sync returns `RUNNING` instead of `DONE`

**Files:** `apps/api/src/__tests__/integration/vertical-slice.test.ts` — lines 211, 278, 337, 395

**Root cause:** `triggerSync()` fires the catalog fetch as a detached async IIFE (`void (async () => {…})()`), returning the RUNNING row immediately at line 293. The vertical slice tests POST to `/sync-runs` and synchronously expect `status: 'DONE'` in the response body — a contract the implementation can never satisfy.

This causes 4 of 710 tests to fail. The sync logic itself appears correct; the mismatch is between the test expectation (synchronous completion) and the implementation design (async background job, poll for completion).

```
FAIL src/__tests__/integration/vertical-slice.test.ts
  ✕ happy path: full pipeline — expected 'DONE', received 'RUNNING'
  ✕ empty catalog sync — expected 'DONE', received 'RUNNING'
  ✕ sync error — expected 'FAILED', received 'RUNNING'
  ✕ source disappearance — expected 'DONE', received 'RUNNING'
```

### FAIL 2 — TypeScript typecheck fails on `apps/web`

**Files:** `apps/web/src/test/handlers.ts` and `apps/web/src/components/detail/EpisodeRow.test.tsx`

**Root cause:** New fields were added to `MovieResponse`, `SeriesResponse`, and `EpisodeResponse` in `packages/api-contracts/src/catalog.ts` (`popularity`, `voteCount`, `originalLanguage`, `spokenLanguages`, `tmdbId`, `posterPath`, `voteAverage`, `voteCount`) but the MSW mock fixtures in `handlers.ts` and `EpisodeRow.test.tsx` were not updated to include these fields.

```
error TS2322: Type '{ id: string; title: string; ... certification: string; }' is not assignable to
type 'MovieDetailResponse'. Missing: popularity, voteCount, originalLanguage, spokenLanguages, and 6 more.
```

---

## Regressions

### FAIL 3 — ESLint failures on `apps/web`

6 lint errors found (treated as errors, not warnings):

| File | Error |
|------|-------|
| `src/contexts/PreviewContext.test.tsx:1` | `act` imported but never used |
| `src/hooks/useMovies.ts:22,30` | Rule `react-hooks/exhaustive-deps` not found (missing plugin) |
| `src/hooks/useSeries.ts:28` | Rule `react-hooks/exhaustive-deps` not found (missing plugin) |
| `src/pages/ArrivalsPage.tsx:11` | `_id` defined but never used |
| `src/pages/MyListPage.test.tsx:1` | `act` imported but never used |

The `react-hooks/exhaustive-deps` errors indicate `eslint-plugin-react-hooks` is referenced in the ESLint config but not installed or configured correctly in `apps/web`.

---

## Summary

| Check | Result |
|-------|--------|
| `pnpm typecheck` | **FAIL** — 8 TS errors in `apps/web` test fixtures |
| `pnpm test` | **FAIL** — 4/710 API integration tests failing |
| `pnpm lint` | **FAIL** — 6 ESLint errors in `apps/web` |
| AC1 — Rich pages with zero providers | PASS |
| AC2 — Multiple automatic shelves | PASS |
| AC3 — Upcoming/unavailable + My List | PASS |
| AC4 — Playable variants, no duplicates | PASS |
| AC5 — Availability filter/discovery | PASS |
| AC6 — Canonical titles/artwork on hero/cards | PASS |
| AC7 — API performance | PARTIAL (no caching on aggregations) |

**Verdict: FAIL.** The functional implementation satisfies all 7 acceptance criteria, but the toolchain (typecheck, test, lint) does not pass cleanly. The 4 failing integration tests are a concrete regression — the vertical slice test suite cannot validate the sync pipeline end-to-end in its current state. These must be fixed before the implementation can be accepted.
