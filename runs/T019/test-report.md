# Test Report — T019: Universal External Catalog Discovery

**Date**: 2026-08-12  
**Branch**: ticket/T019-add-universal-external-catalog-discovery-for-unava  
**State at test time**: IMPLEMENTATION_APPROVED

## Test Suites Run

| Suite | Files | Tests | Result |
|---|---|---|---|
| API unit + route + integration | 27 files | 326 | ✅ All pass |
| Web components | 12 files | 61 | ✅ All pass |

**Commands executed:**
```
cd apps/api && pnpm test                   → 326/326 pass
pnpm --filter '@iptvflix/web' test         → 61/61 pass
```

No failures, no skipped tests, no regressions.

---

## Acceptance Criteria

### AC1 — Searching for a Movie not present on any configured source can return an external discovery result.

**Status: PASS**

- `search.ts:40`: if `localTotal <= LOCAL_RESULTS_THRESHOLD (5)`, `discoverMovies()` + `discoverSeries()` are called in parallel.
- Integration test: *"search with TMDB configured returns externalMovies for title not in local DB"* (`vertical-slice.test.ts:549`).
- When no TMDB key is set, `discoveryService` is `null` and external arrays default to `[]` — graceful no-op.

---

### AC2 — Opening/saving that result creates/reuses one canonical Media record with zero availabilities.

**Status: PASS**

- `POST /discovery/movies` and `POST /discovery/series` call `materializeMovie` / `materializeSeries`.
- `materializeMovie` (`external-discovery-service.ts:90-130`): SELECT existing by `tmdbId` first; INSERT only when absent; no availability rows are ever created.
- Integration test: *"POST /discovery/movies materializes a canonical movie with zero availabilities"* (`vertical-slice.test.ts:600`) — verifies `availabilities` array is empty on the returned detail page.
- Integration test: *"POST /discovery/movies is idempotent — second call returns same id"* (`vertical-slice.test.ts:624`).

---

### AC3 — A future/upcoming title can have a useful detail page even when not yet released or available.

**Status: PASS**

- TMDB client `deriveReleaseStatus` (`tmdb/client.ts:18-21`): maps `release_date` / `first_air_date` to `'Upcoming'` or `'Released'` based on current date.
- `ExternalMovieCandidate` and `ExternalSeriesCandidate` expose `releaseStatus`, `releaseDate`/`firstAirDate`, `year`, `synopsis`, `posterUrl`.
- Unit test: *"maps upcoming title with releaseStatus"* (`external-discovery-service.test.ts`).
- Web test: *"shows external results section with upcoming badge when external movies are returned"* (`SearchPage.test.tsx:86-117`) — renders heading and "À venir" badge.
- Known limitation (non-blocking, pre-documented in review): `releaseStatus` is absent from `MovieDetailResponse`, so the badge disappears after navigating to the detail page. The AC criterion ("useful detail page") is met by the presence of title, synopsis, poster and year.

---

### AC4 — Local and external results for the same canonical work are not displayed as duplicates.

**Status: PASS**

- `search.ts:42-43`: fetches TMDB IDs from all local results via `getMovieTmdbIds` / `getSeriesTmdbIds` and passes them as exclusion sets to the discovery service.
- `external-discovery-service.ts:56, 87`: `.filter((c) => !excludeTmdbIds.has(c.tmdbId))` before returning candidates.
- Integration test: *"external result is deduplicated when same tmdbId exists in local DB"* (`vertical-slice.test.ts:569`).

---

### AC5 — External provider failure still leaves local catalog search usable.

**Status: PASS**

- `external-discovery-service.ts:51-52, 82-83`: provider errors caught in `try/catch`, returns `[]` — does not propagate to caller.
- `search.ts:46-51`: parallel `Promise.allSettled`-style calls; errors inside discovery service never throw to the route handler.
- Integration test: *"GET /search succeeds with local results even when TMDB returns 500"* (`vertical-slice.test.ts:651`) — MSW mocks TMDB 500, local results are still returned correctly.

---

### AC6 — The UI clearly distinguishes `not available to me` from `not found`.

**Status: PASS**

- `SearchPage.tsx:93-103`: `externalMovieBadge` / `externalSeriesBadge` helpers:
  - `releaseStatus !== 'Released'` → `{ label: 'À venir', variant: 'upcoming' }` (amber badge)
  - otherwise → `{ label: 'Non disponible', variant: 'unavailable' }` (grey badge)
- `Badge.tsx`: `upcoming` variant (amber-700) and `unavailable` variant (gray-700) are distinct from each other and from the standard result display.
- When no results at all: `EmptyState` component is shown — clearly distinct from "results exist but not available".
- Web test: *"shows 'Non disponible' badge for released external movies"* (`SearchPage.test.tsx:119-150`).
- Web test: *"shows external results section with upcoming badge"* (`SearchPage.test.tsx:86-117`).

---

### AC7 — Provider API calls are bounded/cached appropriately for interactive search.

**Status: PASS**

- `CACHE_TTL_MS = 60_000` (`external-discovery-service.ts:15`): results cached 60s per query string.
- `MAX_EXTERNAL_RESULTS = 5` (`external-discovery-service.ts:16`): provider result count capped.
- `LOCAL_RESULTS_THRESHOLD = 5` (`search.ts:14`): external discovery only triggered when local results are sparse.
- Unit test: *"cache hit — provider called only once for same query within TTL"* (`external-discovery-service.test.ts`).

---

### AC8 — Automated tests cover local hit, external-only hit, upcoming title, deduplication, zero availability and provider failure.

**Status: PASS**

| Scenario | Test |
|---|---|
| Local hit (no external discovery needed) | `search.test.ts` — local-only results |
| External-only hit | `vertical-slice.test.ts:549` |
| Upcoming title | `external-discovery-service.test.ts` — maps upcoming releaseStatus; `SearchPage.test.tsx:86` |
| Deduplication | `vertical-slice.test.ts:569` |
| Zero availability | `vertical-slice.test.ts:600` |
| Provider failure (TMDB 500) | `vertical-slice.test.ts:651` |
| Provider error in unit | `external-discovery-service.test.ts` — returns `[]` on error |
| Materialize failure (UI) | `SearchPage.test.tsx:152-191` |

Coverage: 16 unit tests (`external-discovery-service`), 6 discovery integration tests (`vertical-slice`), 3 external web tests (`SearchPage`).

---

## Regressions

None detected. Full API suite (326 tests across 27 files) and full web suite (61 tests across 12 files) pass without modification.

---

## Known Limitations (non-blocking, pre-documented)

1. **`releaseStatus` absent from detail page**: Badge disappears after navigating from search to the movie detail page. "Useful detail page" AC is met by title/synopsis/poster/year.
2. **TOCTOU on materialize**: SELECT→INSERT without transaction; UNIQUE constraint prevents duplicate rows but would return HTTP 500 rather than idempotent 200 on rare concurrent requests.
3. **Cache without active eviction**: TTL is lazy-only; the in-memory Map grows unboundedly under high query diversity. Acceptable for expected usage volume.
4. **TMDB v3 key**: If operator configures a v3 key instead of v4 Bearer token, calls fail silently (`externalMovies: []`). Graceful degradation.

---

## Decision

**VALIDATION_APPROVED**

All 8 acceptance criteria are met. Both test suites pass in full with zero regressions. Limitations are minor, pre-documented, and acceptable within the stated scope of T019.
