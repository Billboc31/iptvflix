Both ranking test files pass:
- `recommendation-ranking-service.test.ts` — 23 tests ✓
- `recommendation-ranking-benchmark.test.ts` — **7 tests** ✓ (was 6, now 7 with the new math consistency test)

All pre-existing failures are in unrelated test files (auth, shelves, integration, title-matching) — unchanged from before.

Here's a summary of all changes made:

**`packages/api-contracts/src/recommendations.ts`**
- Added `abandonPenalty: number` and `avoidPenalty: number` to `ScoreBreakdown` interface.

**`apps/api/src/services/recommendation-ranking-service.ts`**
- Added `abandonPenalty` and `avoidPenalty` to the `buildReasons` component parameter.
- Added `"quick abandon penalty"` and `"theme avoid match"` reason strings when those penalties are non-zero.
- Populated `abandonPenalty` and `avoidPenalty` in the debug `scoreBreakdown` object so `final` is now fully reconstructible from the exposed fields.

**`apps/api/src/services/__tests__/recommendation-ranking-benchmark.test.ts`**
- Imported `SCORE_MODEL_V1`.
- Added `"scoreBreakdown.final is mathematically reconstructible from its component fields"` test that verifies `bd.final ≈ weighted_sum - all_penalties` for every result in a debug run.

**`apps/api/src/routes/recommendation-lab.ts`**
- Removed unused `modelVersion?: string` from the body parser (silent no-op removed).
- Added `alreadyShownIds?: string[]` body field with string-array sanitisation, wired into both `rankingOpts` blocks.
