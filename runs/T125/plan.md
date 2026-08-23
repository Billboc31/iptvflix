# Plan — T125: Build personalized Home page with production shelf rails

## Objective

Wire the existing semantic/hybrid personalization pipeline into a declarative, ordered set of six named Home shelf rails ("Continuer à regarder", "Pour toi", "Nouveautés pour toi", one dynamic thematic shelf, "Films pour toi", "Séries pour toi"), replacing the current unordered concept-pool delivery with a guaranteed first-render sequence that applies cross-shelf deduplication, media-type constraints, and freshness weighting — without exposing recommendation internals to the consumer UI.

## Included

### Backend

#### 1. `apps/api/src/services/home-pool-service.ts`

Add `buildDeclaredRails(profileId: string, sessionId: string): Promise<ShelfResponse[]>`:

- Maintains a shared `excludedMediaIds: Set<string>` across rails 2–6.
- **Rail 1 — "Continuer à regarder"**: calls existing `getShelf('sys_continue_watching', profileId)`; omitted if empty; its items are **not** added to `excludedMediaIds` (dedup-exempt per ticket spec).
- **Rail 2 — "Pour toi"**: calls `RecommendationEngineClient.queryForShelf({ profileId, text: <profile primary intent> })` with no media-type filter; falls back to `rankRecommendations()`; adds items to `excludedMediaIds`.
- **Rail 3 — "Nouveautés pour toi"**: same engine call but pass `freshnessBoostDays` (new param — see engine client change below); candidates are additionally filtered to those whose catalog `addedAt` / `releaseDate` falls within a configurable recency window (default 90 days, env var `HOME_FRESH_DAYS`); adds items to `excludedMediaIds`.
- **Rail 4 — Dynamic thematic**: selects the single most eligible, non-fatigued profile concept with `generationType IN ('PERSONALIZED', 'EDITORIAL', 'DISCOVERY')` using existing `ShelfFatigueService`; queries engine with that concept's `semanticIntent`; must not be a hardcoded movie list; adds items to `excludedMediaIds`.
- **Rail 5 — "Films pour toi"**: engine call with `mediaTypeFilter: 'MOVIE'`; fallback filters `rankRecommendations()` results to `mediaType === 'MOVIE'`; adds items to `excludedMediaIds`.
- **Rail 6 — "Séries pour toi"**: same with `mediaTypeFilter: 'SERIES'`.

Each rail is independently try/caught; failure produces no entry in the returned array (graceful degradation). Resulting array contains only non-empty rails. Items from each non-exempt rail are persisted via `shelfInstanceService.persistShelfInstance()` with `generationType: 'SYSTEM_DECLARED'` and the appropriate `verticalPosition` (0-based for declared rails, so pool shelves follow without collision).

Implement `NEW_RELEASES` freshness policy in `_fillPoolAsync()`: filter candidates where `addedAt` or `releaseDate` ≤ `HOME_FRESH_DAYS` days ago, with graceful bypass if field is absent.

#### 2. `apps/api/src/client/recommendation-engine-client.ts`

Add optional params to `queryForShelf()`:
- `mediaTypeFilter?: 'MOVIE' | 'SERIES'` — forwarded in the engine request payload; used by fallback `rankRecommendations()` call to filter by `mediaType`.
- `freshnessBoostDays?: number` — forwarded in the engine request payload; if engine does not support it, silently ignored (non-breaking).

#### 3. `apps/api/src/services/home-service.ts`

Replace first-render sequence: call `buildDeclaredRails(profileId, session.id)` instead of `buildFixedShelves(profileId)`. Pool fill (`_fillPoolAsync`) still runs for infinite-scroll positions. Cursor-based pagination is unchanged and continues to serve pool shelves after declared rails. Remove the separate `persistFixedShelvesForSession` call (declared rails persist themselves internally). Handle the case where all declared rails are empty by falling back to the existing `buildFallbackShelf()`.

#### 4. `apps/api/src/config/env.ts`

Add `HOME_FRESH_DAYS` env var (default `90`).

#### 5. `apps/api/src/services/__tests__/home-pool-service.test.ts` (new file)

Test cases:
- Six rails are returned in declaration order when all have data.
- Rail absent when recommendation engine returns no candidates.
- Films rail contains only `mediaType === 'MOVIE'` items.
- Séries rail contains only `mediaType === 'SERIES'` items.
- A title appearing in rail 2 ("Pour toi") does not appear in rails 3–6.
- "Continuer à regarder" items **may** reappear in discovery rails.
- Fatigued thematic concept is skipped; next eligible concept is used.
- Engine failure on one rail does not prevent other rails from rendering.
- Freshness filter: candidates outside `HOME_FRESH_DAYS` window are excluded from "Nouveautés pour toi".

#### 6. `apps/api/src/services/__tests__/home-service.test.ts` (extend existing)

Test cases:
- First response includes declared rails before pool shelves.
- `coldStart` is `false` when at least one declared rail is non-empty.
- Error in `buildDeclaredRails` causes fallback shelf, not 500.

### Frontend

#### 7. `apps/web/src/pages/HomePage.tsx`

Wrap each `<ShelfRow>` in a local error boundary (`ShelfErrorBoundary` — an inline React class component or equivalent) so a thrown render error in one rail does not unmount siblings. The existing `allShelves.filter(shelf => shelf.id !== 'sys_continue_watching')` split can be removed; `ContinueWatchingRow` continues to render independently above the shelf list as it fetches `/continue-watching` directly. Add a per-shelf loading skeleton that renders during `homeLoading` independent of other shelves (reuse existing `ShelfSkeleton`). No internal scores, reason codes, or engine metadata should appear in JSX.

#### 8. `apps/web/src/components/content/ShelfRow.tsx`

Audit: confirm no `semanticScore`, `profileScore`, `finalScore`, `reasonCodes`, or `shelfInstanceId` fields are rendered in the consumer UI. Remove any that are.

#### 9. `apps/web/src/pages/HomePage.test.tsx` (new file)

Test cases (Vitest + React Testing Library + MSW):
- Home page renders six shelf titles when mock API returns all six rail types.
- Rail not rendered when `items` array is empty.
- Error thrown by one `ShelfRow` does not unmount other `ShelfRow` instances.
- "Continuer à regarder" does not appear in the `allShelves` pass-through (it is rendered by `ContinueWatchingRow`).

### No schema migration required

The existing `shelfInstances` table's `generationType` column already accepts arbitrary string values; `'SYSTEM_DECLARED'` is a new enum member that must be added to the TypeScript union and to any DB enum if it is a `pgEnum` (check schema — if it is, add migration; if it is `text`, no migration needed).

## Excluded

- Building a new or second recommendation engine; all rails use the existing semantic/hybrid pipeline.
- `À revoir` shelf (watched/liked items dedicated surface).
- User like / dislike / rating UI or backend state.
- A/B testing infrastructure for shelf ordering.
- Analytics or performance dashboards.
- Removing or changing existing recommendation diagnostic / preview tooling (`ShelfConceptPreviewResponse`, admin routes, etc.).
- Changing the infinite-scroll pool mechanism or session management TTL logic.
- Hardcoding any movie list or title-specific recommendation hack.
- Manual production DB data changes.

## Acceptance criteria

- `GET /profiles/:profileId/home` first response contains shelves in this order (when data exists): "Continuer à regarder", "Pour toi", "Nouveautés pour toi", one dynamically-titled thematic rail, "Films pour toi", "Séries pour toi".
- Shelves with zero items are absent from the response; the remaining rails still render.
- "Films pour toi" items all have `mediaType === 'MOVIE'`; "Séries pour toi" items all have `mediaType === 'SERIES'`.
- "Nouveautés pour toi" candidates are limited to content within `HOME_FRESH_DAYS` of their catalog entry date.
- The dynamic thematic shelf title and content originate from a `shelf_concepts` row (`generationType PERSONALIZED | EDITORIAL | DISCOVERY`), not a hardcoded list.
- A title shown in an earlier discovery rail does not reappear in a subsequent discovery rail when sufficient alternative candidates exist; "Continuer à regarder" is exempt from this exclusion.
- No `semanticScore`, `profileScore`, `finalScore`, `reasonCodes`, or raw engine metadata appear in any `ShelfResponse` or `ShelfItem` field returned by `/home`.
- A render error inside one `ShelfRow` does not remove other shelf rows from the Home page.
- The existing shelf concept diagnostic/preview endpoints (`/shelf-concepts/:id/preview`, etc.) continue to return their full scoring detail unchanged.
- All new test cases in `home-pool-service.test.ts` and `HomePage.test.tsx` pass.
- No manual DB changes and no title-specific recommendation overrides are required to produce the six rails.
