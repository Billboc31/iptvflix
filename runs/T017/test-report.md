# Test Report — T017: Normalize media availability variants by language, subtitles and quality

**Date**: 2026-08-11  
**Branch**: ticket/T017-normalize-media-availability-variants-by-language  
**Test run**: `pnpm --filter @iptvflix/api test` → **253 tests, 22 suites — all pass**

---

## Acceptance Criteria

### AC1 — Multiple provider entries produce one canonical catalog item with multiple variants
**PASS**

- `GET /movies` groups availability rows by canonical movie: catalog list has one card regardless of variant count. Verified by test `catalog list has one card per canonical movie — deduplication preserved` (catalog.test.ts:393).
- `GET /movies/:id` returns a `variants` array with one entry per availability row. Verified by test `two availability rows produce two variants, one canonical movie` (catalog.test.ts:220).

### AC2 — Raw provider titles preserved
**PASS**

- `rawTitle` column added to all three availability tables (`availabilities.ts:25,50,75`).
- `catalog-sync-service.ts:205` stores `rawTitle: stream.name` on insert and `rawTitle: stream.name` on update.
- `AvailabilityVariantResponse` exposes `rawTitle: string | null` in the API contract (`catalog.ts` in api-contracts).
- `GET /movies/:id` and `GET /series/:id` include `rawTitle` in each variant.

### AC3 — Audio language, subtitle language, and video quality are distinct normalized attributes
**PASS**

- `VariantAttributes` interface has three independent fields: `audioLanguage`, `subtitleLanguage`, `videoQuality` (`variant-extractor.ts:1-5`).
- Each is stored in its own DB column and returned as a separate field in `AvailabilityVariantResponse`.

### AC4 — VOSTFR is not represented as French audio
**PASS**

- `extractVariantAttributes` checks `VOSTFR_RE` first and, when matched, forces `audioLanguage = null` and `subtitleLanguage = 'fr'` (`variant-extractor.ts:18-27`).
- Tests: `VOSTFR does not produce French audio` and `VOSTFR → audioLanguage null, subtitleLanguage fr` (variant-extractor.test.ts:33-43).
- Route-level test: `VOSTFR variant has subtitleLanguage fr and audioLanguage null` (catalog.test.ts:238).
- `normalizeTitle` integration test: `VOSTFR title produces subtitleLanguage fr and audioLanguage null` (title-normalizer.test.ts:71).

### AC5 — MULTI does not assert specific languages
**PASS**

- `MULTI` / `MULTi` match neither `FR_AUDIO_RE` nor `EN_AUDIO_RE` nor `VOSTFR_RE`, so both language fields remain `null`.
- Tests: `MULTI → all null` and `MULTi → all null audio` (variant-extractor.test.ts:45-55).
- Route-level test: `MULTI variant has audioLanguage null` (catalog.test.ts:252).

### AC6 — Unknown/ambiguous data stays null, never guessed
**PASS**

- Tags not in any recognized pattern produce `{ audioLanguage: null, subtitleLanguage: null, videoQuality: null }`.
- Tests: `no recognizable tag → all null` and `ambiguous tags produce null, never guessed value` (variant-extractor.test.ts:131-139).
- `HD` and `SD` map to `videoQuality: null`, not a tier (variant-extractor.test.ts:104-112).

### AC7 — Catalog cards / search results not duplicated by language or quality
**PASS**

- `GET /movies` queries the `movies` table (one row per canonical work) and fetches availability counts/qualities via separate aggregations. A movie with two availability rows still appears once in the list. Verified by `catalog list has one card per canonical movie` (catalog.test.ts:393).
- `GET /search` follows the same pattern (catalog.ts:471-606).

### AC8 — Detail API exposes all usable variants
**PASS**

- `GET /movies/:id`: queries `movieAvailabilities` without status filter (returns all rows including UNAVAILABLE) and returns them as `variants` (catalog.ts:187-198). Variants include `audioLanguage`, `subtitleLanguage`, `videoQuality`, `rawTitle`.
- `GET /series/:id`: same via `seriesAvailabilities` (catalog.ts:356-366).
- `GET /series/:id/seasons/:n/episodes`: each `EpisodeResponse` carries `variants` from `episodeAvailabilities` (catalog.ts:433-462).
- `AvailabilityVariantResponse` and detail types (`MovieDetailResponse`, `SeriesDetailResponse`, `EpisodeResponse`) are typed in the shared contracts package.

### AC9 — Tests cover all required scenarios
**PASS**

- **variant-extractor.test.ts** (25 tests): FRENCH, TRUEFRENCH, VFF, VF, ENG, VOSTFR, MULTI, MULTi, VO, VOST, VOFF, 1080p, 2160p/4K/UHD, 720p, 480p, HD, SD, combinations (TRUEFRENCH+1080p, VOSTFR+4K+HDR, MULTI+2160p), no-tag, ambiguous-tag.
- **title-normalizer.test.ts** (9 tests): all existing cases assert `variantAttributes` is present; VOSTFR integration test added.
- **catalog.test.ts** (18 tests): detail with variants, two-variant movie, VOSTFR variant, MULTI variant, quality derivation on list, deduplication.

---

## Regressions

None detected. All 253 tests across 22 suites pass, including pre-existing suites for movies, series, search, sync, enrichment, and integration.

---

## Issues Found

### Minor — Duplicate migration prefix (non-blocking)
Both `apps/api/migrations/0008_shelves.sql` and `apps/api/migrations/0008_living_sphinx.sql` share the `0008_` prefix. Drizzle Kit uses filenames for ordering but may warn on duplicate numbers. The integration tests (which apply migrations against a real in-process DB) pass without issue, so this does not block the ticket. Recommend renaming `0008_living_sphinx.sql` to `0009_living_sphinx.sql` and updating the Drizzle journal in a follow-up.

### Minor — `catalog-service.ts` standalone helpers not updated (non-blocking)
`getMovie` (line 195) and `getSeries` in `catalog-service.ts` return `quality: null` and omit `variants`. These functions are **not used** by the `GET /movies/:id` or `GET /series/:id` route handlers (which build their response directly in `catalog.ts`), so there is no user-facing impact. However, if these service helpers are ever called directly, they will return stale contracts. Recommend updating them in a follow-up or deleting if unused.

---

## Verdict

**PASS** — All ticket acceptance criteria are satisfied. All 253 tests pass. The two issues found are non-blocking cosmetic/maintenance concerns.
