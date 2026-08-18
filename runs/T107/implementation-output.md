The `servedAt` field is properly handled. The implementation is complete and clean. Let me do a final summary of all files changed:

**Files modified:**
1. `apps/api/src/db/schema/shelf-instances.ts` — Added `servedAt` column
2. `apps/api/src/config/env.ts` — Added `HOME_CURSOR_SECRET`, `HOME_BATCH_SIZE`, `HOME_ITEMS_PER_SHELF`, `HOME_ITEMS_MAX`, `HOME_POOL_MIN`, `HOME_POOL_TARGET`, `HOME_SESSION_TTL_HOURS`
3. `packages/api-contracts/src/home.ts` — Added `HomePageResponse` type
4. `packages/api-contracts/src/shelf-instances.ts` — Added `servedAt` to `PersistShelfInstanceParams`
5. `apps/api/src/services/shelf-instance-service.ts` — Handle `servedAt` in `persistShelfInstance`
6. `apps/api/src/services/home-service.ts` — Full rewrite: cursor-based `buildHome(profileId, cursor?)`
7. `apps/api/src/routes/home.ts` — Accept optional `cursor` query param, return 403 for invalid cursors
8. `apps/web/src/lib/api.ts` — Added `fetchHomePage` + `HomePageResponse` import
9. `apps/web/src/hooks/useHome.ts` — Replaced `useHome` with `useInfiniteHome` (retry, dedup guard, profile reset)
10. `apps/web/src/pages/HomePage.tsx` — IntersectionObserver infinite scroll, `ShelfSkeleton`, end-of-feed indicator
11. `apps/api/vitest.config.ts` — Added `HOME_CURSOR_SECRET` to test env

**Files created:**
1. `apps/api/src/lib/home-cursor.ts` — HMAC-SHA256 opaque cursor (sign/verify, 48h TTL)
2. `apps/api/src/services/home-pool-service.ts` — Pool management: session lifecycle, `serveBatch`, `fillPool`/`fillPoolAsync`, `buildFixedShelves`, `buildFallbackShelf`
3. `apps/api/src/lib/__tests__/home-cursor.test.ts` — 7 cursor tests (round-trip, tamper, expiry, wrong secret)
4. `apps/api/src/services/__tests__/home-service.test.ts` — 12 home-service tests (first request, cursor, 403, fallback, replenishment)

All 19 new tests pass. Both TypeScript typechecks are clean. No regressions introduced beyond the 19 pre-existing failures.
