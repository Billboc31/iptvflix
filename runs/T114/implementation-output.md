## Implementation complete

All 43 target tests pass (37 unit + 6 integration). Here's a summary of every file changed:

### Files modified

| File | Change |
|------|--------|
| `packages/api-contracts/src/taste.ts` | Added `dislikedMediaIds: string[]` and `notInterestedMediaIds: string[]` to `ProfileTaste` |
| `packages/api-contracts/src/recommendations.ts` | Added 5 new fields to `ScoreBreakdown`: `keywordAffinity`, `franchiseAffinity`, `languageAffinity`, `decadeAffinity`, `mediaTypeAffinity` |
| `packages/api-contracts/src/query-plan.ts` | Added 5 new fields to `CompactTasteContext`: `topKeywords`, `topFranchises`, `topLanguages`, `topDecades`, `mediaTypePreference` |
| `apps/api/src/db/schema/profile-taste.ts` | Added `dislikedMediaIds` and `notInterestedMediaIds` text array columns |
| `apps/api/src/services/profile-taste-service.ts` | Separated DISLIKE from NOT_INTERESTED into distinct sets; persists both in upsert and returns both in `ProfileTaste` |
| `apps/recommendation-engine/src/pipeline/stages/llm-planner.ts` | Extended DB select to load all taste dimensions; populates `likedPeople`, `topKeywords`, `topFranchises`, `topLanguages`, `topDecades`, `mediaTypePreference` |
| `apps/recommendation-engine/src/prompts/query-planner-v1.ts` | Updated system prompt with guidance on using all new context fields |
| `apps/recommendation-engine/src/pipeline/stages/hybrid-reranker.ts` | Full rewrite: `SCORE_MODEL_V2` (default), 5 new exported affinity functions, tiered negative penalties (−2.0 DISLIKE / −1.2 NOT_INTERESTED), full `ScoreBreakdown` with all dimensions |
| `apps/api/migrations/0045_t114_profile_taste_disliked_not_interested.sql` | Pre-existing migration file (was already created) |
| `runs/T114/interaction-audit.md` | Pre-existing audit document (was already created) |

### Pre-existing failures (unchanged)
- `hard-filters.test.ts` (18 tests): imports `passesHardFilters` and `HARD_FILTER_UNKNOWN_POLICY` which are not exported — was failing identically before T114.
- `e2e-retrieval-pool.test.ts`: DB connection error unrelated to T114.
