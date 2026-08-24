All four fixes are applied and correct. Here's the summary:

**Files modified:**

1. `apps/api/migrations/0051_t128_movies_tables.sql` (line 5) — Added `NOT NULL` to `expires_at` so the DB constraint matches the Drizzle schema declaration.

2. `apps/api/src/services/__tests__/movies-snapshot-service.test.ts` (lines 319-323) — Replaced the `expect(true).toBe(true)` no-op with a real unit test: loads the actual `isMoviesSnapshotValid` via `vi.importActual` and asserts it returns `true` for a future `expiresAt`, following the same pattern as the `isMoviesSnapshotStale` block below it.

3. `apps/web/src/pages/MoviesPage.tsx` (line 20) — Added `console.error('[ShelfErrorBoundary]', error)` in `componentDidCatch` so shelf render failures are visible in dev and prod logs.

4. `apps/api/src/services/movies-pool-service.ts` (line 460) — Replaced `sql\`... IN ('EXPLORATION', 'DISCOVERY')\`` with `inArray(shelfConcepts.generationType, ['EXPLORATION', 'DISCOVERY'])`, consistent with the rest of the codebase (`inArray` was already imported).
