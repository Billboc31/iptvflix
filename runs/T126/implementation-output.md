All 15 project files changed (9 modified, 6 new). The implementation is complete.

---

Here's a summary of what was implemented:

## Files Created (6)
- **`apps/api/src/db/schema/home-discovery-snapshots.ts`** — DB schema with UNIQUE per-profile snapshot row, TTL, hero fields, invalidation timestamp
- **`apps/api/migrations/0050_t126_home_discovery_snapshots.sql`** — Drizzle migration for the new table
- **`apps/api/src/services/home-snapshot-service.ts`** — `getSnapshot`, `saveSnapshot` (upsert), `invalidateSnapshot`, `isSnapshotValid`, `isStale`
- **`apps/api/src/services/hero-selector.ts`** — Quality-gated hero selection: checks score ≥ 0.55, available, non-null backdropUrl, not disliked; returns `null` if no candidate qualifies
- **`apps/api/src/services/__tests__/home-snapshot.test.ts`** — 12 tests covering HIT/MISS/STALE, per-profile isolation, zero-generation on repeat hits
- **`apps/api/src/services/__tests__/hero-selector.test.ts`** — 9 tests covering all quality gates, fallback to null, series support

## Files Modified (9)
- **`apps/api/src/config/env.ts`** — Added `HOME_SNAPSHOT_TTL_HOURS` (24h) and `HERO_MIN_SCORE` (0.55)
- **`apps/api/src/db/schema/index.ts`** — Added snapshot schema export
- **`packages/api-contracts/src/home.ts`** — Added `HeroItem` type; added `hero: HeroItem | null` to `HomePageResponse`
- **`apps/api/src/services/home-pool-service.ts`** — Hero selection from Pour toi candidates; `buildDeclaredRails` returns `{shelfInstanceIds, hero}`; added `[HOME_GENERATION]` observability logs
- **`apps/api/src/services/home-service.ts`** — Full HIT/MISS/STALE snapshot logic with `[HOME_SNAPSHOT]` logs; CW shelf always live; `reconstructHero` from snapshot on HIT path
- **`apps/api/src/services/__tests__/home-service.test.ts`** — Added snapshot service mocks, updated `buildDeclaredRails` mock return type
- **`apps/web/src/hooks/useHome.ts`** — Extracts `hero` from first page response and exposes it from the hook
- **`apps/web/src/pages/HomePage.tsx`** — Uses hero from hook (no more `useMovies`); renders `<HeroSection>` only when `hero !== null`; correct `onPlay`/`onDetails` routing for movies vs series
