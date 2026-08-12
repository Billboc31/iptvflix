Everything looks correct. Here's a summary of all changes made:

---

**Files modified: 2**

### `apps/api/src/services/availability-resolver.ts`
- **`qualityRank`** — simplified to `(quality: string | null): number`, no longer accepts or applies `maxVideoQuality`
- **`isAboveCap`** — new exported function; returns `true` only when the cap is set, the quality is a known value in `QUALITY_ORDER`, and its rank strictly exceeds the cap rank; null/unknown quality always returns `false`
- **`scoreTuple`** — updated call to `qualityRank` (removed `maxVideoQuality` argument)
- **`resolveVariant`** — added pre-filter step: AVAILABLE variants are further filtered by `isAboveCap` before scoring; if no candidates remain after filtering, returns `no_available_variant`

### `apps/api/src/services/__tests__/availability-resolver.test.ts`
- Imported `isAboveCap`
- Replaced the 2 old clamping tests with 6 `isAboveCap` unit tests (above-cap, at-cap, below-cap, null quality, null cap, unknown quality string) and 7 integration tests for all cap scenarios (4K+1080p→1080p wins, 4K only→null, 4K+unknown→unknown wins, 720p cap, null cap, below-cap ranking, unknown cap string)

All 27 tests pass. Pre-existing TypeScript errors in unrelated test files (`vertical-slice.test.ts`, `sources.test.ts`, `catalog-sync-service.test.ts`) are untouched by this change.
