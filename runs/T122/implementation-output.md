The only failing suite is `e2e-retrieval-pool.test.ts` — it fails due to a Postgres authentication error (no vitest DB available), which is a pre-existing infrastructure issue unrelated to T122. 95 tests pass, 13 skipped.

Both TypeScript projects now compile without T122-related errors. Here's the summary of the fix:

---

**Files modified:**

- `packages/api-contracts/src/recommendations.ts` — Made all 16 T122-new fields optional (`?`):
  - 8 contribution fields already in the interface but missing from the V1 legacy path: `semanticContribution`, `profileContribution`, `profileGenreContribution`, `profileThemeContribution`, `peopleContribution`, `languageContribution`, `eraContribution`, `otherPositiveContributions`
  - 8 new T122 fields: `semanticRelevanceNormalized`, `semanticConfidenceFactor`, `profileBoostRaw`, `profileBoostEffective`, `semanticPercentile`, `rawVectorRank`, `finalRank`, `rankDelta`

- `apps/recommendation-engine/src/pipeline/stages/hybrid-reranker.ts` — Added `undefined` guard on `percentile` check at line 823 (now required since `semanticPercentile` is optional).

**Result:** `tsc --noEmit` on `apps/api` no longer reports `ScoreBreakdown`-related errors; `apps/recommendation-engine` compiles cleanly; 95 unit tests pass.
