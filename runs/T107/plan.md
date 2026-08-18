# T107 — Build infinite personalized Home shelves with cursor loading and cross-shelf deduplication

## Objective

Replace the current single-shot `GET /profiles/:profileId/home` endpoint with a cursor-paginated API that delivers personalized `ShelfInstance` batches indefinitely, backed by a pre-generated DB pool, and wire a IntersectionObserver-based infinite-scroll front-end that accumulates shelves without resetting already-loaded content.

## Included

### 1. DB migration — `shelf_instances.served_at`

- Add `served_at timestamptz` column to `shelf_instances`.
- `NULL` = shelf is in the pool but not yet sent to any client.
- Non-null = shelf has been served in a cursor response; used as pool watermark.
- Migration file: `apps/api/src/db/migrations/XXXX_shelf_instances_served_at.ts`.
- Update Drizzle schema `apps/api/src/db/schema/shelf-instances.ts` accordingly.

### 2. Cursor library — `apps/api/src/lib/home-cursor.ts`

Stateless opaque cursor, tamper-proof via HMAC-SHA256:

```
payload = JSON.stringify({ v: 1, sessionId, nextPosition, issuedAt })
token   = base64url(payload) + "." + base64url(hmac(SECRET, payload))
```

Exports:
- `signCursor(sessionId, nextPosition): string`
- `verifyCursor(token): { sessionId: string; nextPosition: number } | null`

`SECRET` comes from env `HOME_CURSOR_SECRET` (required; API startup fails if missing).
Expired cursors (> 48 h `issuedAt`) return `null`.

### 3. API contract — `packages/api-contracts/src/home.ts`

Add new types alongside existing `HomeResponse` (keep old type for backward compat during transition):

```typescript
type HomePageResponse = {
  coldStart: boolean
  sessionId: string
  shelves: ShelfResponse[]  // same ShelfResponse used today
  nextCursor: string | null // null = engine has no more healthy concepts
}
```

The existing `HomeResponse` type is preserved; the route is updated to return `HomePageResponse`.

### 4. Home pool service — `apps/api/src/services/home-pool-service.ts`

Manages the pre-generated shelf pool stored in `shelf_instances` under a given `homeSessionId`.

**Constants** (override via env):
- `HOME_BATCH_SIZE = 6` shelves per cursor response
- `HOME_ITEMS_PER_SHELF = 24` candidates ranked per shelf
- `HOME_ITEMS_MAX = 30` hard cap
- `HOME_POOL_MIN = 10` triggers async replenishment
- `HOME_POOL_TARGET = 25` pool size goal after replenishment

**Functions:**

`getOrCreateSession(profileId): Promise<RecommendationHomeSession>`
- Finds active (non-expired) session for profile, or inserts a new one (`expires_at = now + 24h`).

`countUnserved(sessionId): Promise<number>`
- `SELECT count(*) WHERE home_session_id = ? AND served_at IS NULL`.

`serveBatch(sessionId, nextPosition, batchSize): Promise<{ shelves: ShelfInstance[]; newNextPosition: number; hasMore: boolean }>`
- Fetches `batchSize` shelf_instances WHERE `home_session_id = ? AND served_at IS NULL ORDER BY vertical_position ASC`.
- Sets `served_at = now()` on fetched rows.
- Returns shelves and the next `vertical_position` cursor value.
- `hasMore = false` only when 0 rows remain AND session is marked exhausted.

`fillPool(sessionId, profileId, targetCount): Promise<void>`
- Called async (fire-and-forget after response sent).
- Gets set of all `mediaId`s already in any served shelf for this session (cross-shelf dedup).
- Gets set of `shelfConceptId`s recently used (concept fatigue via `ShelfFatigueService`).
- For each new shelf to generate up to `targetCount`:
  1. Pick a `ShelfConcept` from `shelf_concepts WHERE profileId = ? AND active = true` not in fatigue cooldown, not already in session, ordered by relevance.
  2. Call `rankRecommendations(profileId, { limit: HOME_ITEMS_MAX, ... })` excluding already-exposed `mediaId`s.
  3. Persist via `ShelfInstanceService.persistShelfInstance()` with `homeSessionId`, `verticalPosition` (next available), `servedAt = NULL`.
- If no valid concepts remain, mark session as exhausted (`cursor_reference = 'exhausted'`).
- Errors inside `fillPool` are swallowed and logged; they must never propagate to the client response.

`buildFixedShelves(profileId): Promise<ShelfInstance[]>`
- Fetches `sys_continue_watching` and `sys_my_list` exactly as today (extracted from current `home-service.ts`).
- Returns whichever are non-empty, in product order.

### 5. Home service — `apps/api/src/services/home-service.ts`

Rewrite `buildHome()`:

```
buildHome(profileId, cursor?) → HomePageResponse
```

**First request (no cursor):**
1. `getOrCreateSession(profileId)` → `session`.
2. `buildFixedShelves(profileId)` → fixed shelves (positions 0..K-1).
3. If pool is empty for session: call `fillPool` synchronously (blocking, user waits once).
4. `serveBatch(session.id, 0, HOME_BATCH_SIZE)` → first batch of generated shelves.
5. Merge: fixed shelves + generated batch; assign final `verticalPosition`.
6. Persist fixed shelves as `shelf_instances` with `homeSessionId` if not already (so dedup is coherent).
7. If `countUnserved < HOME_POOL_MIN`: kick off `fillPool(session.id, profileId, HOME_POOL_TARGET)` async.
8. Return `{ coldStart, sessionId: session.id, shelves, nextCursor: signCursor(session.id, nextPosition) }`.

**Cursor request:**
1. `verifyCursor(cursor)` → `{ sessionId, nextPosition }` or 403 if null/tampered.
2. Verify `session.profileId === profileId` (DB lookup); 403 if mismatch.
3. `serveBatch(session.id, nextPosition, HOME_BATCH_SIZE)`.
4. If `countUnserved < HOME_POOL_MIN`: `fillPool` async.
5. Return `{ coldStart: false, sessionId, shelves, nextCursor: hasMore ? signCursor(...) : null }`.

**Fallback (rec service / DB pool unavailable):**
- If `rankRecommendations` throws or returns 0 candidates: fall back to a deterministic catalog query (top popularity by `vote_average DESC, available_from DESC, limit 24`) to fill shelf.
- Fixed shelves (Continue Watching, My List) always work independently.

### 6. Home route — `apps/api/src/routes/home.ts`

- Accept optional `cursor` query param (string, validated with Zod: max length 512, no spaces).
- Pass `cursor` to `buildHome(profileId, cursor)`.
- Return `HomePageResponse`.
- Profile ownership check unchanged.

### 7. Web API client — `apps/web/src/lib/api.ts`

Add:
```typescript
fetchHomePage(profileId: string, cursor?: string): Promise<HomePageResponse>
```
Calls `GET /profiles/:profileId/home?cursor=<cursor>` when cursor is provided.

### 8. Web hook — `apps/web/src/hooks/useHome.ts`

Replace current hook with `useInfiniteHome(profileId, profileVersion)`:

State:
```typescript
{
  allShelves: ShelfResponse[]
  sessionId: string | null
  nextCursor: string | null
  isLoading: boolean       // initial load
  isFetchingMore: boolean  // subsequent fetches
  hasMore: boolean
  error: Error | null
}
```

Behavior:
- On mount / `profileId` or `profileVersion` change: reset all state, call `fetchHomePage(profileId)` (no cursor).
- `loadMore()`: guarded by `isFetchingMore` flag (no concurrent duplicate requests); calls `fetchHomePage(profileId, nextCursor)` and appends returned shelves to `allShelves`.
- On profile switch: state reset clears cursor — no old shelf state leaks.
- Retry on transient failure (max 3 retries with exponential backoff), then set `error`.

### 9. Web page — `apps/web/src/pages/HomePage.tsx`

- Consume `useInfiniteHome`.
- Add IntersectionObserver on a sentinel `<div>` at the bottom of the shelf list; when sentinel enters viewport, call `loadMore()`.
- Show `ShelfSkeleton` (3 placeholder rows) while `isFetchingMore`.
- When `hasMore === false` and no error: render a subtle end-of-list indicator (no infinite spinner).
- No full page re-render on cursor load; new shelves appended via React state accumulation.

### 10. Tests

- `apps/api/src/lib/home-cursor.test.ts`:
  - Valid cursor round-trips.
  - Tampered cursor returns null.
  - Expired cursor (> 48 h) returns null.
  - Different secret returns null.

- `apps/api/src/services/home-service.test.ts`:
  - First request creates session, returns batch with fixed + generated shelves.
  - Second cursor request continues same session; no content duplication with first batch.
  - Near-identical concept titles suppressed (fatigue service integration).
  - Shelf item count bounded ≤ HOME_ITEMS_MAX.
  - Profile mismatch on cursor → 403.
  - Invalid/garbage cursor → 403.
  - Rec service outage → fallback catalog shelves returned, fixed shelves intact.
  - Rapid duplicate cursor calls: second call blocked by `isFetchingMore` guard (hook unit test).
  - Profile switch resets cursor state (hook unit test).

## Excluded

- Unbounded horizontal item fetching per shelf (all shelves capped at HOME_ITEMS_MAX).
- DOM virtualization / windowing (measure first, implement later).
- A dedicated `/profiles/:profileId/home-session` DELETE endpoint for explicit session invalidation (profile switch invalidation is client-side cursor reset only).
- New LLM concept generation logic (reuses existing `ShelfConceptGeneratorService` and `shelf_concepts` pool).
- Changes to Continue Watching or My List business logic.
- Mobile-specific gesture handling (IntersectionObserver works cross-platform; native mobile scroll optimization is a follow-up).
- Metrics / performance budget instrumentation dashboards (exposure events reuse existing `ShelfInstanceService.markFirstDisplayed` pattern; a dedicated perf dashboard is out of scope).

## Acceptance criteria

- `GET /profiles/:profileId/home` (no cursor) returns `HomePageResponse` with `coldStart`, `sessionId`, `shelves` (≥1), and `nextCursor` (non-null when more shelves exist).
- `GET /profiles/:profileId/home?cursor=<token>` returns the next batch under the same `sessionId`.
- Each shelf contains ≤ 30 items (HOME_ITEMS_MAX).
- No `mediaId` appears in two shelves within the same session's first two cursor pages.
- No two adjacent shelves share a near-identical concept title (concept fatigue suppression active).
- Fixed shelves (Continue Watching, My List) appear before generated shelves when non-empty.
- A tampered or expired cursor returns HTTP 403.
- A cursor issued for profile A used on profile B returns HTTP 403.
- When rec service is unavailable, `GET /home` still returns ≥1 usable shelf (deterministic fallback).
- Calling `loadMore()` concurrently does not send duplicate cursor requests.
- Profile switch in the web app resets `allShelves` to the new profile's first batch.
- All tests listed in §10 pass.
