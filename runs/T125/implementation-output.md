# T125 — Implementation Output

## Summary

Wired the existing semantic/hybrid personalization pipeline into a production Home page with 6 ordered rails, cross-shelf deduplication, freshness weighting, error isolation, and graceful degradation. No production code was missing — all 9 planned files were already implemented. This output documents the final state and the test fixes applied.

## Files Modified

### Tests fixed
- `apps/api/src/services/__tests__/home-pool-service.test.ts`
  - Changed `vi.clearAllMocks()` → `vi.resetAllMocks()` in `beforeEach` to prevent `mockReturnValueOnce` queue leakage between tests
  - Added imports for `ShelfInstanceService` and `ShelfFatigueService`
  - Re-established constructor mock implementations in `beforeEach` (vi.resetAllMocks clears mockImplementation; constructors must return the mock instances again each test)
  - Fixed `setupEngineRails` DB call order: Rail 3 freshness DB calls must precede Rail 4 selectThematic DB calls
  - Fixed freshness filter test DB order: fresh movies mock must be first in queue

### Production files (already implemented, no changes required)
- `apps/api/src/services/home-pool-service.ts` — `buildDeclaredRails`, `getFreshMediaIds`, `selectThematicConcept`, `buildEnrichmentMap`, `buildFallbackShelf`, `persistFixedShelvesForSession`
- `apps/api/src/services/home-service.ts` — uses `buildDeclaredRails` for first render, `fillPool` fire-and-forget for infinite scroll
- `apps/api/src/client/recommendation-engine-client.ts` — `queryForShelf` with `mediaTypeFilter` and `freshnessBoostDays`
- `apps/api/src/config/env.ts` — `HOME_FRESH_DAYS` env var
- `apps/web/src/pages/HomePage.tsx` — `ShelfErrorBoundary`, `ShelfSkeleton`, shelf list with `sys_continue_watching` filter
- `apps/web/src/components/content/ShelfRow.tsx` — consumer-facing, no diagnostic fields
- `apps/web/src/hooks/useHome.ts` — `useInfiniteHome` cursor-based hook
- `apps/api/src/routes/home.ts` — Home API route
- `apps/api/src/services/shelf-fatigue-service.ts` — concept fatigue tracking

## Verifications

- `apps/api/src/services/__tests__/home-pool-service.test.ts`: **12/12 tests pass**
- `apps/api/src/services/__tests__/home-service.test.ts`: **15/15 tests pass** (16 total, 1 skipped)
- `apps/web/src/pages/HomePage.test.tsx`: **5/5 tests pass**
- Pre-existing failures in unrelated test files: 33 tests across 21 files (confirmed pre-existing via git stash)

## Architecture

- `buildDeclaredRails` builds Rails 1–6 sequentially. Each rail is independently try/caught for error isolation.
- Cross-shelf dedup: `excludedMediaIds: Set<string>` accumulated across Rails 2–6 (Rail 1 CW is exempt).
- Freshness: `getFreshMediaIds` queries DB for items within `HOME_FRESH_DAYS` window; items outside window are filtered.
- Dynamic thematic (Rail 4): `selectThematicConcept` uses `ShelfFatigueService` to skip fatigued concepts.
- Batch enrichment: single `buildEnrichmentMap` round-trip for all pending rail items before persistence.
- Frontend: `ShelfErrorBoundary` per shelf, `ContinueWatchingRow` rendered independently, no diagnostic fields in JSX.

## Limits / Assumptions

- No production DB changes needed (`generationType` is `text` column, not pgEnum).
- The 33 pre-existing test failures are in unrelated services and were present before this ticket.
- UI was not manually tested (dev server not started); type checking and unit tests verify correctness.
