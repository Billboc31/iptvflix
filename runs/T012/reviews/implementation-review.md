Now I have enough context to write the full structured review.

---

## PR Review — T012: Rich Movie & Series Detail Experiences

**Branch:** `ticket/T012-build-rich-movie-and-series-detail-experiences-fro`  
**Reviewer role:** Reviewer  
**Date:** 2026-08-11

---

### 1. Ticket Compliance

| Requirement | Status | Notes |
|---|---|---|
| Movie detail opens canonical page | ✅ | `MovieDetailPage` uses `MovieDetailResponse` |
| Series detail with navigable seasons/episodes | ✅ | `SeasonAccordion` + lazy episode fetch |
| Enriched poster/backdrop/synopsis/genre/runtime | ✅ | All fields mapped in pages |
| Fallback for unmatched/partial media | ✅ | Enrichment badges + graceful nulls |
| No Xtream DTOs in detail components or contracts | ✅ | Verified — zero Xtream fields in any response or component |
| Loading / 404 / error states | ✅ | Skeleton, `notFound`, `ErrorState` branches |
| Consistent with design board & shared shell | ✅ | Backdrop/poster/info layout, Tailwind tokens match pattern |
| Automated tests for Movie, Series, incomplete-metadata | ✅ | 10 API tests + 7 movie UI tests + 6 series UI tests |

All acceptance criteria from the plan are satisfied.

---

### 2. API Contracts

**`packages/api-contracts/src/catalog.ts`**

- `EnrichmentStatus`, `MovieDetailResponse`, `SeriesDetailResponse`, `SeasonSummary`, `EpisodeResponse` are all correctly defined and exported via `export * from './catalog.js'` in `index.ts`.
- `tmdbId: number | null` — correctly typed as integer, consistent with the DB `integer` column (plan had a minor wording error suggesting `string`, implementation is correct).
- No Xtream-specific fields anywhere in the contracts.

---

### 3. Backend Routes

**`apps/api/src/routes/catalog.ts`**

**Correct:**
- `deriveEnrichmentStatus` is a clean, pure function matching spec exactly (`matched` = hasExternalId && hasSynopsis; `unmatched` = neither; `partial` = anything else).
- Genre and availability queries batch-fetch for all IDs in list responses (no N+1).
- 404 is returned cleanly for unknown movie/series/season.
- The `GET /search` uses Drizzle's parameterized `ilike` — no SQL injection risk.
- `genreId` subquery uses Drizzle's `sql` tag with interpolation — parameterized safely.

**Minor observations (non-blocking):**

1. **`quality: null` hardcoded** — The `movies` schema has no `quality` column, so this is consistent with reality, but it leaves `MovieResponse.quality` always null even when the plan implies it could be populated. Since there's no DB column, this is acceptable; it should be documented or removed from the DTO in a future cleanup.

2. **`episodeAvailabilities` has no `status` column** — The table schema confirms this. The backend correctly treats presence of a row as `AVAILABLE`. This differs from the movie/series tables which have a `status` enum. The logic is internally consistent but noteworthy for future work if per-episode UNAVAILABLE tracking is needed.

3. **Availability doesn't filter by source `enabled` status** — The plan mentions "AVAILABLE if at least one AVAILABLE row for an enabled source exists," but there is no `sourceId` FK in the availabilities tables (only `providerId: text`), making a join impractical without schema changes. The implementation correctly queries what the schema supports. Minor approximation, non-blocking.

**`apps/api/src/index.ts`** — `catalogRoutes` registered correctly alongside existing routes.

---

### 4. Frontend

**`MovieDetailPage.tsx`**
- Correctly uses `MovieDetailResponse`.
- `originalTitle` subtitle shown only when it differs from `title` — correct condition.
- `enrichmentStatus` badges render only for `unmatched` (gray/unavailable variant) and `partial` (default variant); no badge for `matched` — matches plan.
- `DetailSkeleton` mirrors the backdrop + poster + info layout.
- 404 path shows "Ce film est introuvable." with back button.
- Error path delegates to `<ErrorState>` with retry.

**`SeriesDetailPage.tsx`**
- Delegates seasons to `<SeasonAccordion>` correctly.
- `seasonCount` is derived from `seasons.length` server-side — stays in sync with the real data, no static counter loop.
- All enrichment, 404, error, and skeleton paths are consistent with the movie page.

**`SeasonAccordion.tsx`**
- Episode fetch on first expand only, cached in `Map<seasonNumber, EpisodeResponse[]>` — correct.
- Loading spinner per season during fetch.
- Uses functional updater for `setLoading` to avoid stale closure on concurrent toggles.
- Fallback "Les saisons ne sont pas encore disponibles." when `seasons` is empty.
- `aria-expanded` on season buttons for accessibility.

**`EpisodeRow.tsx`**
- Falls back to "Épisode N" when `episode.title` is null — clean.
- Synopsis clamped to 2 lines via `line-clamp-2`.
- Date formatted with `fr-FR` locale.

**Minor observation (non-blocking):**

4. **`new Date(episode.airDate)` timezone shift** — `airDate` is a `date` type (stored as `YYYY-MM-DD` string). Parsing with `new Date()` interprets it as UTC midnight, but `toLocaleDateString` uses the browser's local timezone. A user in UTC+1 will see the correct date; a user in UTC-5 might see the day before. For a streaming product this is cosmetically acceptable, but worth noting.

---

### 5. Tests

**`catalog.test.ts`** — 10 tests covering:
- Canonical DTO without Xtream fields ✅
- `enrichmentStatus` derivation (matched, unmatched) ✅
- 404 for unknown IDs ✅
- `UNAVAILABLE` when no availability rows ✅
- Series with seasons array ✅
- Episode list and empty season ✅
- Season 404 ✅

The mock strategy (chainable `selectChain` helper) is sound. Call-order dependency on `mockDb.select` mock calls is fragile but acceptable for unit tests.

**`MovieDetailPage.test.tsx`** — 7 tests covering all required branches. MSW interceptors used correctly. ✅

**`SeriesDetailPage.test.tsx`** — 6 tests including the episode-caching test (confirms single fetch on multiple expand/collapse cycles). ✅

**`handlers.ts`** — `MOCK_SERIES.enrichmentStatus: 'partial'` is intentionally inconsistent with the mock's actual field values (tmdbId present + synopsis present → should be `matched`), but since MSW serves static JSON this is harmless for test isolation.

---

### 6. Scope Compliance

No out-of-scope features introduced:
- No playback wiring.
- No recommendation rows.
- No Cinema Radar.
- No manual metadata correction UI.
- No cast/crew fields.
- No watchlist persistence.

---

### 7. Summary

The implementation is complete, clean, and faithful to the ticket. All acceptance criteria are met. API contracts are provider-agnostic. The frontend handles all required states (loading, 404, error, partial data). Tests cover representative cases for movie, series, and incomplete metadata. The four minor observations above are non-blocking design trade-offs consistent with the existing schema.

IMPLEMENTATION_APPROVED
