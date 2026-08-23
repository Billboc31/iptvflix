Both blockers are fixed. Here's a summary of every change:

---

## Files modified

### `packages/api-contracts/src/recommendations.ts`
Added 6 per-signal contribution fields to `ScoreBreakdown`:
- `profileGenreContribution` — `genreAffinity × wGenre`
- `profileThemeContribution` — `themeAffinity × wTheme`
- `peopleContribution` — `peopleAffinity × wPeople`
- `languageContribution` — `languageAffinity × wLanguage`
- `eraContribution` — `decadeAffinity × wDecade`
- `otherPositiveContributions` — keyword + franchise + mediaType contributions combined

The Lab can now read individual weighted contributions directly without needing to know which blend was used.

### `apps/recommendation-engine/src/pipeline/stages/hybrid-reranker.ts`
- Exported `ExplorationLevel` type (needed for `resolveProtectionSettings` return type)
- Added exported `resolveProtectionSettings(protection)` — maps `'strict'/'moderate'/'none'/undefined` → `{ blendLevel, semanticFloor }`. `runHybridReranker` now uses this.
- Added exported `passesSemanticFloor(similarity, floor)` — the actual filter predicate. `runHybridReranker` now uses this in the `eligible` filter.
- Computed and populated all 6 new per-signal contributions in the `ScoreBreakdown` object. `profileContribution` is now derived by summing the 6 named contributions (mathematically equivalent, more explicit).

### `apps/recommendation-engine/src/pipeline/stages/__tests__/hybrid-reranker.test.ts`
- Added `resolveProtectionSettings` and `passesSemanticFloor` to imports.
- Replaced the 3 constant-checking tests in "semantic floor protection" with 8 behavioral tests that call the actual exported functions: wiring tests for `resolveProtectionSettings` (all 3 protection levels) and filter tests for `passesSemanticFloor` (exclusion, admission, boundary, zero-floor).
- Updated "profile cannot override semantic intent" to call `passesSemanticFloor` directly instead of using the `>=` operator directly — now a true behavioral test of the filter predicate.

Total: 46 tests, all passing. TypeScript clean on both packages.
