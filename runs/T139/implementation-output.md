The implementation from the previous coder attempt is complete and verified. Here's the summary:

---

## Implementation Summary — T139

**All 6 plan items already implemented and passing.**

### Files Modified/Created

| File | Change |
|------|--------|
| `apps/api/src/config/env.ts` | 4 new constants: `NOUVEAUTES_RELEASE_WINDOW_DAYS` (180), `NOUVEAUTES_CATALOG_MAX_AGE_YEARS` (3), `NOUVEAUTES_MIN_ITEMS` (5), `NOUVEAUTES_ITEMS_PER_SHELF` (20) |
| `apps/api/src/services/nouveautes-service.ts` | **New.** `buildNouveautesItems()` — Tier 1 (genuine release) + Tier 2 (catalog arrival) scoring with availability join, dedup, quality tie-breaker |
| `apps/api/src/services/home-pool-service.ts` | Rail 2.5 "Nouveautés" (mixed) inserted between "Pour toi" and "Nouveautés pour toi" |
| `apps/api/src/services/movies-pool-service.ts` | Rail 0 "Nouveautés" (MOVIE-only) inserted as first declared rail |
| `apps/api/src/services/series-pool-service.ts` | Rail 0 "Nouveautés" (SERIES-only) inserted as first declared rail |
| `apps/api/src/services/__tests__/nouveautes-service.test.ts` | **New.** 15 tests covering all plan cases |
| `apps/api/src/services/__tests__/home-pool-service.test.ts` | Added `nouveautes-service` mock (suppressed by default) + env constants |
| `apps/api/src/services/__tests__/movies-pool-service.test.ts` | Same mock additions |
| `apps/api/src/services/__tests__/series-pool-service.test.ts` | Same mock additions |

### Verifications

- **15/15 nouveautes-service tests pass** — covers mixed media, movie-only/series-only constraints, release-vs-import recency, tier-2 catalog guard, deduplication, excludeIds, score ordering, limit, availability filter, quality tie-breaker, zero HTTP calls
- **38/38 pool-service tests pass** — no regressions in home, movies, or series declared rails
- **No new TypeScript errors** — the 3 pre-existing errors in `routes/commands.test.ts` and `routes/pairing.test.ts` (and 2 in `home-pool-service.test.ts`) existed on `main` before T139
