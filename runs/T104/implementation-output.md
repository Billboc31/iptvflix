Good. The implementation is complete and correct. Here's a summary of all changes made:

---

**Files modified:**

**`apps/api/src/routes/recommendation-lab.ts`** (bloquant + mineur)
- Added imports: `movies`, `series as seriesTbl`, `mediaCredits`, `viewingProgress`
- `enrichAsHybridCandidates` now accepts `profileId?: string` and runs 4 additional parallel DB queries:
  - `movies` → `durationMinutes`, `originalLanguage`, `collectionId`, `popularity`, `voteAverage`, `keywords`
  - `series` → `originalLanguage`, `popularity`, `voteAverage`, `keywords`
  - `mediaCredits` (role=`'director'`) → `directors[]` for all candidates
  - `viewingProgress` (when profileId present) → `completionRatio` for watched movies
- Both call sites updated to pass `profileId`
- `alreadyShownIds` capped at 500 with `.slice(0, 500)`

**`apps/api/src/services/recommendation-ranking-service.ts`** (mineur)
- `discover` mode `wSemantic` reduced from `0.70` to `0.64` — weights now sum to exactly 1.0

**`packages/api-contracts/src/query-plan.ts`** (optionnel)
- Added `maxMaturityRating?: string` and `kidsOnly?: boolean` to `QueryPlanHardFilters` with a TODO comment marking them as not yet enforced

All 30 existing tests continue to pass.
