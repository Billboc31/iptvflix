All 21 tests pass (9 new + 12 pre-existing recommendation tests). Implementation complete.

---

## Summary

**Files created:**

| File | Purpose |
|---|---|
| `packages/api-contracts/src/home.ts` | `HomeResponse` type (`coldStart`, `shelves`) |
| `apps/api/src/services/home-service.ts` | `buildHome()` — resolves utility shelves, calls `rankRecommendations`, partitions candidates |
| `apps/api/src/routes/home.ts` | `GET /profiles/:profileId/home` → 200/404 |
| `apps/web/src/hooks/useHome.ts` | React hook wrapping `fetchHome` |
| `apps/api/src/services/__tests__/home-service.test.ts` | 9 tests covering all 5 scenarios |

**Files modified:**

| File | Change |
|---|---|
| `packages/api-contracts/src/index.ts` | `export * from './home.js'` |
| `apps/api/src/index.ts` | Import + register `homeRoutes` |
| `apps/web/src/lib/api.ts` | Added `fetchHome(profileId)` + `HomeResponse` import |
| `apps/web/src/pages/HomePage.tsx` | Replaced `useShelves + useShelf` waterfall with single `useHome(DEFAULT_PROFILE_ID)` call |

**Dedup strategy (documented in `home-service.ts`):** a single `rankRecommendations(limit: 60)` call is partitioned into `sys_rec_for_you` (top 20 available) and `sys_rec_upcoming` (top 10 unavailable, omitted if < 3). In-progress media IDs from Continue Watching are filtered out of rec candidates via a post-filter `Set`. No candidate can appear in both rec shelves.
