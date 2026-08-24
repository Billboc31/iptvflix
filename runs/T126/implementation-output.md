All tests pass. Here's a summary of the changes:

**Files modified (4):**

- **`apps/api/src/services/home-pool-service.ts`** — Moved hero selection before queuing Pour toi. Hero is now selected from the full Pour toi candidates pool, added to `excludedMediaIds`, and then filtered out of Pour toi before the rail is persisted. This eliminates the duplicate title at hero + first Pour toi item positions.

- **`apps/api/src/services/__tests__/home-pool-service.test.ts`** — Added `hero-selector.js` mock, `selectHero` default null in `beforeEach`, `HERO_MIN_SCORE` to env mock, and two new tests: hero mediaId excluded from Pour toi items, and Pour toi omitted entirely when the sole candidate becomes the hero.

- **`apps/api/src/services/__tests__/home-service.test.ts`** — Fixed two partial mock return types for `buildDeclaredRails` that were missing `shelfInstanceIds` and `hero` fields.

- **`apps/api/src/services/__tests__/home-snapshot.test.ts`** — Added test verifying that an explicitly invalidated (not-yet-expired) snapshot falls to the MISS path and triggers full regeneration rather than stale serving.
