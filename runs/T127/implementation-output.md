Implementation complete. Here's the summary:

## Files modified

| File | Change |
|---|---|
| `apps/api/src/client/recommendation-engine-client.ts` | Added `qualityPrior` and `languageAffinity` to `ShelfCandidateItem`; populated them from `r.scoreBreakdown` in `queryForShelf()` |
| `apps/api/src/config/env.ts` | Added `HERO_POOL_SIZE` (default 15) and `HERO_SCORE_WEIGHTS` (versioned `v1` object with 4 named weights) |
| `apps/api/src/services/hero-selector.ts` | Replaced first-eligible loop with: pool cap → eligibility gate → dislike filter → enrichment → `computeHeroScore` ranking → best winner; exported `computeHeroScore`; added `[HERO_RANKING]` log |
| `apps/api/src/services/home-pool-service.ts` | Added `qualityPrior: 0, languageAffinity: 0` to the fallback candidate mapper (type fix) |
| `apps/api/src/services/__tests__/hero-selector.test.ts` | Updated env mock + `makeCandidate` defaults; added 9 new ranked-selection tests (all 19 tests pass) |

**Results:** 19/19 hero-selector tests pass, 27/27 snapshot/pool tests show no regression, TypeScript build clean.
