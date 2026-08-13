# T070 — Test Report

**Date**: 2026-08-13  
**Branch**: ticket/T070-drive-movies-and-series-discovery-shelves-from-the  
**Tester**: Automated (Claude Sonnet 4.6)

---

## Acceptance Criteria

### AC1: Movies/Series pages remain rich with zero providers connected
**PASS**

Both `MoviesPage.tsx` and `SeriesPage.tsx` fetch exclusively from the canonical catalog via `listMovies`/`listSeries`. No provider-connected check gates the page render. Availability filter is opt-in via toggle. All 4 base shelves (Populaires, Les mieux notés, Sorties récentes, À venir) show canonical titles regardless of provider status.

### AC2: Multiple automatic shelves are generated from local canonical metadata
**PASS**

Shelves implemented and verified:
- **Populaires** — `sortBy=popularity`, index `movies_popularity_idx` (migration 0030)
- **Les mieux notés** — `sortBy=voteAverage`, index `movies_vote_average_idx` (migration 0033)
- **Sorties récentes** — `sortBy=year`
- **À venir** — `upcoming=true` filter; hidden when empty
- **Disponibles** (available mode only) — `sortBy=recentAvailability&availability=AVAILABLE`
- **Genre shelf** (genre chip selected) — `genreId=<uuid>`

### AC3: Upcoming/unavailable titles can appear and be added to My List
**PASS**

Upcoming filter implemented in `catalog-service.ts:71-75` (movies) and `:273-277` (series). "À venir" shelf renders in both pages. `MovieDetailPage.tsx` and `SeriesDetailPage.tsx` include `WatchlistButton` which calls `POST /watchlist` with any `mediaId` regardless of `availabilityStatus`. The watchlist API (`routes/watchlist.ts`) does not gate by availability.

### AC4: Available titles expose playable variants without duplicate cards
**PASS**

`AvailabilityVariantResponse[]` is included in `MovieDetailResponse` and `SeriesDetailResponse` (api-contracts). `MovieDetailPage.tsx` renders one card per canonical title with a variant picker below. No duplicate cards: one canonical entry per title, variants listed separately.

### AC5: Users can discover/filter content based on availability when desired
**PASS**

Both pages implement a two-button toggle: "Tout le catalogue" (default) / "Disponible maintenant". When "available" mode is active, all shelf queries receive `availability=AVAILABLE`. The route validates the parameter and the service applies `EXISTS (SELECT 1 FROM movie_availabilities WHERE ... AND status = 'AVAILABLE')`.

### AC6: Hero/cards always use canonical titles/artwork/metadata
**PASS**

Hero uses `movie.title`, `movie.synopsis`, `movie.backdropUrl`, `movie.trailerKey` from `MovieResponse`. `PosterCard` uses `title`, `year`, `posterUrl`. All fields sourced from `movies`/`series` DB tables (canonical). No raw Xtream provider names appear in the response path.

### AC7: Shelf APIs are performant against the large local catalog
**PASS**

- DB indexes on `popularity DESC NULLS LAST` (migration 0030) and `vote_average DESC NULLS LAST` (migration 0033) for both movies and series.
- All shelf queries use `LIMIT pageSize OFFSET (page-1)*pageSize`.
- Post-fetch enrichment (genres, availabilities, qualities, trailers) done via `Promise.all` with `IN (ids)` batch queries — no N+1.
- `recentAvailability` sort uses a correlated subquery (acceptable for paginated 20-item shelf).

---

## Test Execution Results

### API unit tests

```
Test Files  2 failed | 50 passed (52)
Tests       4 failed | 706 passed (710)
```

**Failing tests (pre-existing, not T070-introduced):**
- `vertical-slice.test.ts` — 4 tests fail due to sync status timing (`'RUNNING'` instead of `'DONE'`/`'FAILED'`). Environment-dependent; not related to T070 changes.
- `scheduler-service.test.ts` — Fails with `DATABASE_URL is not configured`. Environment issue.

These failures exist on the branch before T070 commits (confirmed by stash test).

### Web unit tests

```
Test Files  2 failed | 26 passed (28)
Tests       2 failed | 197 passed (199)
```

**Failing tests (T070-introduced regressions):**

1. `MoviesPage.test.tsx:41` — "renders Disponibles and Tous les films shelf rows by default"
   - Expects `'Disponibles'` visible in default ('all') mode — but `MoviesPage.tsx` only renders "Disponibles" shelf in `availabilityMode === 'available'`.
   - Expects `'Tous les films'` heading — this label does not exist in the implementation (actual shelves: "Populaires", "Les mieux notés", etc.).

2. `SeriesPage.test.tsx:49` — "renders Disponibles and Toutes les séries shelf rows by default"
   - Same issue: expects "Disponibles" in default mode and "Toutes les séries" heading which don't exist.

---

## TypeScript Errors

### apps/web (tsc --noEmit)

6 errors in test fixtures — all pre-existing from prior tickets (T065/T067/T069 expanded the response types):
- `apps/web/src/test/handlers.ts` — `MovieDetailResponse`, `SeriesDetailResponse`, `EpisodeResponse` mock objects missing newly added fields (`popularity`, `voteCount`, `originalLanguage`, `spokenLanguages`, `productionCountries`, `tagline`, `status`, `keywords`, `collection`, `externalIds`, `tmdbId`, `posterPath`, `voteAverage`, `voteCount`).
- `apps/web/src/components/detail/EpisodeRow.test.tsx` — same missing fields in episode mock.

### apps/api (tsc --noEmit)

2 errors in test fixtures — pre-existing:
- `authenticateDevice.test.ts` — `revokedAt: Date` not assignable to `null`.
- `playback-resolver.test.ts` — `autoplayPreviews` missing from `ProfilePreferences` mock.

---

## Issues Summary

| # | Severity | Location | Description |
|---|----------|----------|-------------|
| 1 | **BLOCKING** | `MoviesPage.test.tsx:41` | Test expects "Disponibles" always visible and "Tous les films" shelf — both absent in the implemented UI. T070 regression. |
| 2 | **BLOCKING** | `SeriesPage.test.tsx:49` | Test expects "Disponibles" always visible and "Toutes les séries" shelf — same regression. |
| 3 | Minor | `apps/web/src/test/handlers.ts` | Test fixtures missing fields from prior-ticket type expansions. `tsc` errors only; no runtime impact. |
| 4 | Minor | API test fixtures | Pre-existing `tsc` errors in auth and playback resolver tests. |
| 5 | Env | `vertical-slice.test.ts`, `scheduler-service.test.ts` | Pre-existing environment failures (no DATABASE_URL, timing issues). |

---

## Verdict

**FAIL — requires fix before merge.**

All 7 acceptance criteria are logically satisfied by the implementation. However, **2 web tests regressed** because test expectations were written for shelf labels and default-mode behavior that don't match the shipped implementation. These must be corrected to accurately reflect the new shelf structure.

### Required fixes

**Fix 1** — Update `MoviesPage.test.tsx:41`:
```ts
// Replace:
expect(screen.getByText('Disponibles')).toBeInTheDocument()
expect(screen.getByText('Tous les films')).toBeInTheDocument()
// With:
expect(screen.getByText('Populaires')).toBeInTheDocument()
expect(screen.getByText('Les mieux notés')).toBeInTheDocument()
```

**Fix 2** — Update `SeriesPage.test.tsx:49`:
```ts
// Replace:
expect(screen.getByText('Disponibles')).toBeInTheDocument()
expect(screen.getByText('Toutes les séries')).toBeInTheDocument()
// With:
expect(screen.getByText('Populaires')).toBeInTheDocument()
expect(screen.getByText('Les mieux notées')).toBeInTheDocument()
```

**Fix 3** (optional, non-blocking) — Update test fixture files (`apps/web/src/test/handlers.ts`, `EpisodeRow.test.tsx`) and API test fixtures to add missing fields to satisfy `tsc`.
