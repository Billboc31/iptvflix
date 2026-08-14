# Test Report — T074

**Ticket**: Populate canonical TV seasons and episodes from TMDB independently of sources
**Date**: 2026-08-14
**Verdict**: PASS (with pre-existing regressions noted)

---

## Commands executed

```bash
# TypeScript type-check
cd apps/api && npx tsc --noEmit

# Full test suite
cd apps/api && npx vitest run --reporter=verbose

# T074-specific tests only
cd apps/api && npx vitest run src/services/__tests__/metadata-enrichment-service.test.ts \
  src/services/__tests__/catalog-bootstrap-service.test.ts \
  src/routes/catalog.test.ts

# Regression-suspect tests
cd apps/api && npx vitest run src/__tests__/integration/vertical-slice.test.ts
```

---

## Test results

### T074-specific tests: 67/67 pass

| File | Tests | Status |
|------|-------|--------|
| `metadata-enrichment-service.test.ts` | 45 | ALL PASS |
| `catalog-bootstrap-service.test.ts` | 9 | ALL PASS |
| `catalog.test.ts` | 23 | ALL PASS |

Notable passing tests:
- `enrichSeries() > upserts seasons when series has no existing season rows`
- `enrichSeries() > enrichSeries() called twice produces no duplicate seasons (idempotent upsert)`
- `enrichSeriesSeasons() > enriches source-free series: creates seasons and episodes with no prior DB rows`
- `enrichSeriesSeasons() > upserts episode row via INSERT ... ON CONFLICT for a TMDB episode`
- `GET /series/:id > returns SeriesDetailResponse with selectedVariantId and seasons array`
- `GET /series/:id > returns availableEpisodeCount per season aggregated from episode availabilities`
- `GET /series/:id/seasons/:seasonNumber/episodes > returns episode list with selectedVariantId for a valid season`
- `GET /series/:id/seasons/:seasonNumber/episodes > returns empty array when season has no episodes`
- `GET /series/:id — on-demand hierarchy hydration > sets X-Hierarchy-Hydrating header and calls enrichSeries when seasons empty and tmdbId set`
- `GET /series/:id — on-demand hierarchy hydration > does not set X-Hierarchy-Hydrating when seasons already exist`
- `CatalogBootstrapService — hierarchyPriorityCount config > includes hierarchyPriorityCount in BootstrapConfig`
- `CatalogBootstrapService — enrichmentService wiring > accepts an optional enrichmentService as 4th constructor argument`

### Full suite: 727/731 pass (4 pre-existing failures)

The 4 failing tests are all in `src/__tests__/integration/vertical-slice.test.ts`, in the "source config → sync → catalog query" describe block:

- `happy path: full pipeline produces correctly shaped canonical movies and series`
- `empty catalog sync — GET /movies and GET /series return empty lists`
- `sync error — MSW returns 500, sync run records FAILED status`
- `source disappearance: canonical movie and user-state survive when availability is removed`

**Root cause**: These tests expect `status: 'DONE'` synchronously from `POST /sync-runs`, but the sync has been running asynchronously (background) since commit `4c457ba fix(api): make large Xtream catalog sync async and chunked`. Neither `sync-runs-service.ts` nor `vertical-slice.test.ts` was modified by T074 (confirmed via `git diff origin/main`). These failures are pre-existing and not introduced by T074.

---

## TypeScript

Two pre-existing errors in files unchanged by T074:
- `src/middleware/authenticateDevice.test.ts:84` — type mismatch on `revokedAt`
- `src/services/__tests__/playback-resolver.test.ts:75` — missing `autoplayPreviews` property

No new type errors introduced by T074.

---

## Acceptance criteria

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | A TMDB-imported Series can have seasons and episodes before any source is configured | **PASS** | `enrichSeriesSeasons()` test: "enriches source-free series: creates seasons and episodes with no prior DB rows" |
| 2 | Seasons/episodes use canonical TMDB identity rather than Xtream identity | **PASS** | Seasons upserted with `tmdbId`; conflicts on `(seriesId, seasonNumber)` / `(seasonId, episodeNumber)` — no Xtream identity used |
| 3 | Series with zero playable sources still return their hierarchy through the API | **PASS** | `/series/:id` returns `seasons[]` from `seasons` table; `/series/:id/seasons/:n/episodes` returns episodes with `availabilityStatus: 'UNAVAILABLE'` and `variants: []` when `episodeAvailabilities` empty |
| 4 | Bootstrap populates or schedules hydration of TV hierarchy according to documented scalable strategy | **PASS** | Top-N series (default 200, `CATALOG_BOOTSTRAP_HIERARCHY_PRIORITY_COUNT`) fully hydrated during bootstrap; batched 5 concurrent / 500ms delay; remaining picked up by scheduled refresh |
| 5 | Opening/enriching a missing or stale show can hydrate hierarchy from TMDB without rerunning global bootstrap | **PASS** | `GET /series/:id` triggers fire-and-forget `enrichSeries()` when `seasonRows.length === 0 && tmdbId != null`; returns `X-Hierarchy-Hydrating: true` header |
| 6 | Scheduled refresh discovers new seasons/episodes for ongoing shows | **PASS** | `catalog-refresh-service.ts` calls `enrichSeries()` (which invokes `enrichSeriesSeasons()`) per content bucket: upcoming ≤12h, recent ≤3d, stable ≤30d |
| 7 | Specials/season 0, miniseries, upcoming and partially populated shows handled gracefully | **PASS** | Season 0 treated as normal `seasonNumber`; `getSeasonEpisodes()` returns `[]` on 404 (no-episode seasons); per-season failures are logged and skipped without aborting the batch |
| 8 | Repeated hydration is idempotent and creates no duplicates | **PASS** | `ON CONFLICT (seriesId, seasonNumber) DO UPDATE` for seasons; `ON CONFLICT (seasonId, episodeNumber) DO UPDATE` for episodes; dedicated idempotency test passes |
| 9 | Refresh does not destroy playback progress, watched state or valid source availability | **PASS** | Upserts overwrite metadata fields only; `viewingProgress` and `episodeAvailabilities` tables not touched by enrichment |
| 10 | Xtream/Plex attach variants to canonical episodes instead of defining the hierarchy | **PASS** | `episodeAvailabilities.episodeId` FK references canonical `episodes.id`; source sync not responsible for creating seasons/episodes |
| 11 | TMDB rate limits/retries/concurrency handled safely | **PASS** | `fetchWithRetry()` respects `Retry-After` header on 429; 250ms throttle between per-season calls in `enrichSeriesSeasons()`; 5 concurrent requests with 500ms batch delay in bootstrap |
| 12 | Progress/observability makes large hierarchy hydration diagnosable | **PASS** | `console.log/info/warn` throughout enrichment path; checkpoint-based resumability in bootstrap; `enrichSeriesSeasons()` returns `{ enriched, skipped, failed }` counters |
| 13 | Automated tests cover source-free shows, hierarchy hydration, refresh and idempotency | **PASS** | 67 tests in T074-specific files cover all scenarios |

---

## Regressions observed

None introduced by T074.

The 4 `vertical-slice.test.ts` failures are pre-existing (files unchanged vs `origin/main`). They should be tracked separately and fixed by updating those tests to poll for `DONE` status instead of expecting synchronous completion.

---

## Verdict

**PASS** — All 13 acceptance criteria satisfied. 67/67 T074-specific tests pass. No regressions introduced.
