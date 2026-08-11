---

## Test Report — T017

**Result: PASS** — all 253 tests pass across 22 suites.

### Acceptance criteria status

| # | Criterion | Status |
|---|-----------|--------|
| AC1 | Multiple provider entries → one canonical catalog item, multiple variants | **PASS** |
| AC2 | Raw provider titles preserved (`rawTitle` column + API field) | **PASS** |
| AC3 | Audio language, subtitle language, video quality are distinct attributes | **PASS** |
| AC4 | `VOSTFR` → `subtitleLanguage: 'fr'`, `audioLanguage: null` (not French audio) | **PASS** |
| AC5 | `MULTI` → both language fields `null`, no language asserted | **PASS** |
| AC6 | Unknown/ambiguous tags produce `null`, never guessed | **PASS** |
| AC7 | Catalog list / search results deduplicated by canonical movie | **PASS** |
| AC8 | Detail endpoints expose full `variants` array | **PASS** |
| AC9 | Tests cover FR/EN/MULTI/VOSTFR, quality markers, ambiguous tags, duplicates | **PASS** |

### Issues found (non-blocking)

1. **Duplicate migration prefix**: `0008_shelves.sql` and `0008_living_sphinx.sql` share the `0008_` prefix. Integration tests pass, so it's not blocking, but Drizzle Kit may warn. Recommend renaming to `0009_` in a follow-up.

2. **`catalog-service.ts` standalone helpers not updated**: `getMovie` hardcodes `quality: null` and omits `variants`; same for `getSeries`. These helpers are not called by the route handlers (which build responses inline in `catalog.ts`), so there is no user-facing impact. Worth cleaning up if they're ever reused.

The full report is written to `runs/T017/test-report.md`.
