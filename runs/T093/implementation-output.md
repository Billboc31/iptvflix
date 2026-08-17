All 11 modified + 4 new files are exactly what the plan prescribed. The implementation is complete. Here's a summary of what was done:

---

**Files modified (11):**
- `apps/api/src/db/schema/availabilities.ts` — added `codecName`, `hdrFormat`, `releaseHint`, `audioFormat` to all 3 availability tables
- `apps/api/migrations/meta/_journal.json` — added entry for migration 0034
- `apps/api/src/matching/variant-extractor.ts` — extended `extractVariantAttributes()` with 4 new fields + regex patterns for codec/HDR/release/audio detection
- `apps/api/src/matching/__tests__/variant-extractor.test.ts` — updated existing `toEqual` assertions, added 16 new test cases for new fields + T093 ticket examples
- `apps/api/src/matching/__tests__/title-normalizer.test.ts` — updated 2 `toEqual` assertions to include the new 4 fields
- `apps/api/src/services/catalog-sync-service.ts` — extended the 3 Normalized*Item interfaces and all 6 availability upsert/update call sites (movie/series/episode × create+update)
- `apps/api/src/routes/catalog.ts` — added `sources` join to all 3 availability queries; exposed `sourceDisplayName`, `codecName`, `hdrFormat`, `releaseHint`, `audioFormat`
- `packages/api-contracts/src/catalog.ts` — added 5 new fields to `AvailabilityVariantResponse`
- `apps/web/src/components/detail/AvailabilityPanel.tsx` — replaced inline `variantLabel()` with `formatVariantLabel(v, available)`
- `apps/web/src/components/detail/AvailabilityPanel.test.tsx` — updated test assertions to new label format (`Français • 4K`)
- `apps/web/src/components/player/PlayerControls.tsx` — replaced inline `variantLabel()` with `formatVariantLabel(v, alternatives)`

**Files created (4):**
- `apps/api/migrations/0034_t093_variant_metadata.sql` — SQL migration adding 4 columns to all 3 tables
- `apps/api/scripts/backfill-variant-metadata.ts` — one-shot backfill script re-extracting metadata from existing `rawTitle` rows
- `apps/web/src/lib/variant-label.ts` — shared formatter producing `Français • 4K`, `Multi • 1080p • Blu-ray`, `VOSTFR • 720p` etc.
- `apps/web/src/lib/variant-label.test.ts` — 15 tests covering T093 examples, field combinations, source disambiguation, and fallbacks

**Test results:** 43 variant-extractor tests ✓, 15 variant-label tests ✓, 332 web tests ✓, 49 catalog-sync-service tests ✓, 37 catalog route tests ✓. Pre-existing failures (4 tests needing `DATABASE_URL` env, 4 integration tests with broken MSW mocks, 1 flaky matching test) are all unrelated to T093.
