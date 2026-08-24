I have everything I need. Here is the plan:

---

## Objective

Replace the current generic Series catalog page with a profile-driven discovery surface composed of horizontal series-only personalized shelves, with controlled exploitation/exploration balance, per-profile snapshot caching, and a dedicated session/pool architecture that mirrors the Home page pattern without coupling to it.

## Included

### 1. Database — new schema files and migration

**`apps/api/src/db/schema/series-discovery-snapshots.ts`** — new table, mirrors `home-discovery-snapshots.ts`:
- columns: `id` (uuid PK), `profileId` (uuid, UNIQUE), `sessionId` (uuid FK), `generatedAt`, `expiresAt`, `declaredShelfInstanceIds` (text[]), `invalidatedAt`

**`apps/api/src/db/schema/recommendation-series-sessions.ts`** — new table, mirrors `recommendation-home-sessions.ts`:
- columns: `id` (uuid PK), `profileId`, `cursorReference`, `expiresAt`, `startedAt`, `modelVersion`

**`apps/api/src/db/schema/index.ts`** — export both new tables

**`drizzle/migrations/XXXX_series_discovery.sql`** — Drizzle migration for the two new tables

---

### 2. Backend config

**`apps/api/src/config/env.ts`** — add env vars with defaults:
- `SERIES_SNAPSHOT_TTL_HOURS` (default: 24)
- `SERIES_SESSION_TTL_HOURS`
- `SERIES_POOL_MIN`, `SERIES_POOL_TARGET`, `SERIES_BATCH_SIZE`
- `SERIES_ITEMS_PER_SHELF`, `SERIES_FRESH_DAYS`

---

### 3. Backend services — three new files

**`apps/api/src/services/series-snapshot-service.ts`** — mirrors `home-snapshot-service.ts`:
- `getSnapshot(profileId)`, `saveSnapshot(...)`, `isSnapshotValid(snapshot)`, `isStale(snapshot)`, `invalidateSnapshot(profileId)`
- reads/writes `seriesDiscoverySnapshots`

**`apps/api/src/services/series-pool-service.ts`** — mirrors `home-pool-service.ts`, all `queryForShelf()` calls pass `mediaTypeFilter: 'SERIES'`:
- `getOrCreateSeriesSession(profileId)` — session lifecycle using `recommendationSeriesSessions`
- `buildSeriesDeclaredRails(profileId, sessionId)` — generates the fixed initial rails in order:
  1. "Séries pour toi" — `generationType: 'PERSONALIZED'`, query intent: strongest general series fit
  2. "Nouvelles séries pour toi" — `generationType: 'PERSONALIZED'`, freshness-filtered (`SERIES_FRESH_DAYS`)
  3. N dynamically selected thematic exploitation shelves — concepts drawn from `shelfConcepts` with `desiredMediaTypes` containing `'SERIES'`, `generationType: 'PERSONALIZED'` or `'DISCOVERY'`, diversity check to suppress near-duplicate themes
  4. ≥1 exploration shelf — `generationType: 'EXPLORATION'`, query intent specifies adjacency outside dominant taste clusters with required credible bridge signal; only rendered when ≥`SERIES_ITEMS_PER_SHELF` candidates exist
- Cross-shelf deduplication: maintain a `Set<string>` of `mediaId`s across rail construction; skip duplicates in lower-priority rails, preserve strong relevance over forced uniqueness
- Skip active in-progress series as "fresh discovery": exclude `mediaId`s that appear in the profile's `watchProgress` (series with meaningful `progressSeconds`) from being ranked top-of-discovery rails
- `fillSeriesPool(sessionId, profileId, target)` — async pool filling from `shelfConcepts`, enforcing `mediaTypeFilter: 'SERIES'` and `desiredMediaTypes` check
- `serveSeries Batch(sessionId, nextPosition, batchSize)` — serve next batch from pool (reuse `serveBatch` pattern or extract to shared utility)

**`apps/api/src/services/series-page-service.ts`** — top-level entry point, mirrors `buildHome()`:
- `buildSeriesPage(profileId, cursor?)` returns `SeriesPageResponse`
- Snapshot HIT → reconstruct shelves from `declaredShelfInstanceIds`, return immediately
- Snapshot STALE → serve stale, trigger async regeneration (`buildSeriesDeclaredRails`)
- Snapshot MISS → call `buildSeriesDeclaredRails`, save snapshot, return
- Cursor path → call `serveSeriesBatch`, trigger `fillSeriesPool` if below `SERIES_POOL_MIN`

---

### 4. API contracts

**`packages/api-contracts/src/catalog.ts`** (or existing home types file) — add:
```typescript
export type SeriesPageResponse = {
  coldStart: boolean
  sessionId: string
  shelves: ShelfResponse[]  // reuse existing ShelfResponse
  nextCursor: string | null
}
```

---

### 5. API route

**`apps/api/src/routes/series.ts`** — add before the existing `/:id` parameterized route:
- `GET /series/personalized` — reads `profileId` from auth context, passes optional `cursor` query param, calls `buildSeriesPage(profileId, cursor)`
- Requires authenticated profile (same auth middleware as `/home`)

---

### 6. Frontend — hook and page rewrite

**`apps/web/src/hooks/useSeriesPage.ts`** — new hook, mirrors `useInfiniteHome`:
- `useInfiniteSeriesPage(profileId, profileVersion)` — cursor-based infinite-scroll fetching from `/series/personalized`
- Resets on `profileId` / `profileVersion` change

**`apps/web/src/pages/SeriesPage.tsx`** — rewrite:
- Remove existing genre chips, availability toggle, and `useSeries()` catalog hook calls
- Call `useInfiniteSeriesPage()`
- Render each shelf as `<ShelfRow shelf={shelf} />` inside a fragment — empty `shelf.items` arrays render nothing (clean disappearance)
- Infinite scroll sentinel (reuse `IntersectionObserver` from `HomePage.tsx`)
- Preserve existing series detail navigation: `openDetail('SERIES', mediaId)` on card click
- No debug score or internal recommendation data exposed in UI
- Responsive: inherit existing Tailwind utility classes from `HorizontalRow`/`ShelfRow` (no new layout code)
- Per-shelf error isolation: error in one shelf's item rendering does not propagate to the page

---

### 7. Tests

**`apps/api/src/services/__tests__/series-pool-service.test.ts`**:
- Series-only constraint: assert every `RecommendationEngineClient.queryForShelf` call passes `mediaTypeFilter === 'SERIES'`
- Exploitation/exploration composition: `buildSeriesDeclaredRails` produces ≥1 `EXPLORATION` rail when candidates exist, remaining rails are `PERSONALIZED` or `DISCOVERY`
- Theme diversity: near-duplicate concept labels are suppressed before entering pool
- Cross-shelf deduplication: same `mediaId` does not appear in more than one shelf
- Snapshot reuse: second call within TTL hits snapshot, does not re-invoke LLM or `buildSeriesDeclaredRails`
- Empty rail behavior: if engine returns 0 candidates, that rail is excluded from `declaredShelfInstanceIds`

**`apps/api/src/routes/__tests__/series-personalized.test.ts`**:
- `GET /series/personalized` returns 200 with `shelves`, `sessionId`, `nextCursor`
- `GET /series/personalized?cursor=<token>` returns next batch
- Returns 403 on invalid cursor

---

## Excluded

- Hero section on the Series page (ticket specifies shelves only; no Hero mentioned)
- Continue-watching shelf on the Series page (belongs to the `Continuer à regarder` surface already on Home)
- Episode-level watch history signals, completion/drop-off rates, episode progression (explicitly deferred in ticket)
- Series commitment preference signals (deferred)
- Modifying Home or Movies page snapshot infrastructure or any shared pool service (must not regress)
- Genre filter chips and availability toggle (removed with the catalog view; the personalized page replaces them)
- Any new watch-history ingestion system
- Manual production DB changes or series/theme-specific hardcoded hacks

---

## Acceptance criteria

- `GET /series/personalized` returns shelves where every `ShelfItem.mediaType === 'SERIES'` — no movie leaks.
- Declared rails include at minimum: "Séries pour toi", "Nouvelles séries pour toi", ≥2 distinct thematic exploitation shelves, and ≥1 exploration shelf (when ≥`SERIES_ITEMS_PER_SHELF` exploration candidates exist).
- The exploration shelf's concept `generationType` is `'EXPLORATION'`; exploitation shelves use `'PERSONALIZED'` or `'DISCOVERY'`.
- No `mediaId` appears in more than one shelf in the same page response.
- No two thematic concepts in the pool are near-semantic duplicates.
- A series with meaningful watch progress is not surfaced as a top fresh-discovery recommendation.
- A second call within `SERIES_SNAPSHOT_TTL_HOURS` returns the same `sessionId` and does not trigger a new LLM/concept generation call (verified by mock call count in tests).
- Shelves with zero items do not render in the frontend; a shelf-level error does not break the page.
- `SeriesPage.tsx` renders all shelves via `ShelfRow` and supports infinite scroll identical to `HomePage.tsx`.
- Existing Home, Movies, and recommendation diagnostic routes return unchanged responses (no regression).
- All tests in `series-pool-service.test.ts` and `series-personalized.test.ts` pass.
- No hardcoded theme names, title lists, or media IDs in any new service file.
