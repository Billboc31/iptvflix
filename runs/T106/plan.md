# T106 — Plan: Persist ShelfConcept/ShelfInstance history and item-level feedback

## Objective

Create a durable recommendation-history persistence layer linking ShelfConcept → ShelfInstance → ordered item snapshots → profile interaction outcomes. This enables concept fatigue detection, content exposure memory, per-concept performance recomputation, and Lab diagnostics — without duplicating the existing interaction-event architecture.

## Included

### 1. New DB schemas (Drizzle)

**`apps/api/src/db/schema/shelf-instances.ts`**  
Two tables:

- `shelfInstances`: `id`, `profileId`, `shelfConceptId` (FK shelf_concepts), `title`, `semanticIntentSnapshot`, `generationType`, `generationReasonCodes` (jsonb), `homeSessionId`, `verticalPosition`, `rankerVersion`, `queryPlannerVersion`, `embeddingModelVersion`, `candidateCount`, `finalItemCount`, `latencyMs`, `cacheHit`, `createdAt`, `firstDisplayedAt`, `lastDisplayedAt`, `expiresAt`.  
  Indexes: `(profileId, createdAt)`, `(shelfConceptId, createdAt)`.

- `shelfInstanceItems`: `id`, `shelfInstanceId` (FK shelfInstances), `mediaType`, `mediaId`, `rankPosition`, `semanticScore`, `profileScore`, `finalScore`, `diversityAdjustment`, `availabilityStatus`, `reasonCodes` (jsonb), `wasEligibleAtGeneration`, `wasVisible`, `openedAt`, `playedAt`.  
  Indexes: `(shelfInstanceId, rankPosition)`.

**`apps/api/src/db/schema/recommendation-home-sessions.ts`**  
- `recommendationHomeSessions`: `id`, `profileId`, `startedAt`, `expiresAt`, `modelVersion`, `cursorReference`.  
  Index: `(profileId, startedAt)`.

**`apps/api/src/db/schema/shelf-concept-fatigue.ts`**  
- `shelfConceptFatigue`: `id`, `profileId`, `shelfConceptId` (FK shelf_concepts), `impressionCount`, `visibleImpressionCount`, `zeroInteractionStreakCount`, `lastShownAt`, `cooldownUntil`, `suppressionReason`, `suppressionVersion`, `updatedAt`.  
  Unique index: `(profileId, shelfConceptId)`.

**`apps/api/src/db/schema/profile-media-exposure.ts`**  
- `profileMediaExposure`: `id`, `profileId`, `mediaType`, `mediaId`, `exposureCount`, `firstExposedAt`, `lastExposedAt`, `openCount`, `playCount`, `lastOpenedAt`, `lastPlayedAt`, `shownInConceptIds` (jsonb array of concept IDs).  
  Unique index: `(profileId, mediaType, mediaId)`. Index: `(profileId, lastExposedAt)`.

### 2. Schema modifications

**`apps/api/src/db/schema/profile-interaction-events.ts`**  
Add `shelfInstanceId: uuid('shelf_instance_id')` (nullable, no FK constraint, mirrors existing `shelfId` pattern). Client passes this field in `metadataJson` or as a top-level field.

**`apps/api/src/db/schema/index.ts`**  
Add four new exports:
```ts
export * from './shelf-instances.js'
export * from './recommendation-home-sessions.js'
export * from './shelf-concept-fatigue.js'
export * from './profile-media-exposure.js'
```

### 3. Migration

`apps/api/migrations/0040_t106_shelf_history.sql` — generated via `pnpm db:generate` in `apps/api/`. Contains all five DDL changes above.

### 4. New service: `ShelfInstanceService`

**`apps/api/src/services/shelf-instance-service.ts`**

- `persistShelfInstance(params): Promise<string>` — inserts ShelfInstance + ShelfInstanceItems in a transaction. Params include `profileId`, `shelfConceptId`, `title`, `semanticIntentSnapshot`, `generationType`, `generationReasonCodes`, `homeSessionId?`, `verticalPosition?`, `rankerVersion`, `queryPlannerVersion`, `embeddingModelVersion`, `candidateCount`, `latencyMs?`, `cacheHit`, and `items: ItemInput[]`. Returns `shelfInstanceId`.

- `markFirstDisplayed(shelfInstanceId: string, at?: Date): Promise<void>` — sets `firstDisplayedAt` (no-op if already set); triggers `profileMediaExposure` upsert for all items in the ShelfInstance (batch insert-or-update incrementing `exposureCount`, setting `lastExposedAt`, appending conceptId to `shownInConceptIds`).

- `markItemVisible(shelfInstanceId: string, mediaId: string, mediaType: string): Promise<void>` — sets `wasVisible = true` on matching ShelfInstanceItem.

- `markItemOpened(shelfInstanceId: string, mediaId: string, mediaType: string, at: Date): Promise<void>` — sets `openedAt`; increments `profileMediaExposure.openCount` and sets `lastOpenedAt`.

- `markItemPlayed(shelfInstanceId: string, mediaId: string, mediaType: string, at: Date): Promise<void>` — sets `playedAt`; increments `profileMediaExposure.playCount` and sets `lastPlayedAt`.

- `getShelfInstanceWithItems(id: string): Promise<ShelfInstanceDetail | null>` — joins ShelfInstance + ShelfInstanceItems for Lab endpoints.

### 5. New service: `ShelfPerformanceService`

**`apps/api/src/services/shelf-performance-service.ts`**

- `getConceptPerformance(profileId: string, shelfConceptId: string): Promise<ConceptPerformance>` — queries ShelfInstances + ShelfInstanceItems to recompute: `impressionCount`, `visibleRate` (instances with firstDisplayedAt / total), `openRate` (items with openedAt / total visible items), `playRate` (items with playedAt / total opened).

- `getProfileMediaExposureBatch(profileId: string, mediaIds: string[]): Promise<Map<string, ExposureEntry>>` — single query against `profileMediaExposure` for batch lookup by profileId + mediaId array. Used by ranking service.

### 6. New service: `ShelfFatigueService`

**`apps/api/src/services/shelf-fatigue-service.ts`**

- `getFatigueStates(profileId: string, conceptIds: string[]): Promise<Map<string, FatigueState>>` — batch query of `shelfConceptFatigue`; returns `cooldownUntil`, `suppressionReason`, `impressionCount` per conceptId.

- `recordImpression(profileId: string, shelfConceptId: string, wasVisible: boolean): Promise<void>` — upserts fatigue row incrementing `impressionCount` (and `visibleImpressionCount` if wasVisible); if `zeroInteractionStreakCount` exceeds `FATIGUE_MAX_ZERO_INTERACTION_STREAK` (env, default 5) within `FATIGUE_LOOKBACK_DAYS` (env, default 14), writes `cooldownUntil = now + FATIGUE_COOLDOWN_DAYS` (env, default 7) and `suppressionReason = 'zero_interaction_streak'` with `suppressionVersion`.

- `recordInteraction(profileId: string, shelfConceptId: string): Promise<void>` — resets `zeroInteractionStreakCount = 0`.

- `suppressConcept(profileId: string, shelfConceptId: string, reason: string, version: string, cooldownUntil: Date): Promise<void>` — direct suppression with auditable reason/version fields.

### 7. Modified service: `ShelfConceptGeneratorService`

**`apps/api/src/services/shelf-concept-generator-service.ts`**

In `getActivePool()`: after fetching active concepts, call `ShelfFatigueService.getFatigueStates()` for all concept IDs; filter out any concept whose `cooldownUntil > now`. Return the filtered pool.

### 8. Modified service: `RecommendationRankingService`

**`apps/api/src/services/recommendation-ranking-service.ts`**

In `rankHybrid()`: if `opts.alreadyShownIds` is not provided, call `ShelfPerformanceService.getProfileMediaExposureBatch()` for media exposed within the last `EXPOSURE_MEMORY_HOURS` (env, default 72) and use as the implicit shown set for the `shownPenalty` calculation.

### 9. Modified service: `InteractionEventService`

**`apps/api/src/services/interaction-event-service.ts`**

After persisting each event, add side-effect dispatch (non-blocking, errors logged not thrown):

- `SHELF_IMPRESSION`: extract `metadataJson.shelfInstanceId` → call `ShelfInstanceService.markFirstDisplayed()` + `ShelfFatigueService.recordImpression(wasVisible=false)`.
- `SHELF_ITEM_VISIBLE` (new allowed type): extract `shelfInstanceId`, `mediaId`, `mediaType` → call `ShelfInstanceService.markItemVisible()` + `ShelfFatigueService.recordImpression(wasVisible=true)`.
- `SHELF_ITEM_OPENED`: extract `shelfInstanceId` → call `ShelfInstanceService.markItemOpened()` + `ShelfFatigueService.recordInteraction()`.
- `PLAY_STARTED`: if `metadataJson.shelfInstanceId` present → call `ShelfInstanceService.markItemPlayed()`; if absent, resolve via the most recent `SHELF_ITEM_OPENED` event for the same `(profileId, mediaId)` within 30 minutes (attribution fallback query) and call `markItemPlayed()` with that shelfInstanceId if found.

Add `SHELF_ITEM_VISIBLE` to `ALLOWED_EVENT_TYPES`.

### 10. New API route: `shelf-instances`

**`apps/api/src/routes/shelf-instances.ts`** (registered in `apps/api/src/index.ts`)

- `GET /shelf-instances/:id` — returns `ShelfInstanceDetail` (ShelfInstance + ordered items + scores).
- `GET /profiles/:profileId/shelf-instances?limit=20&before=<cursor>` — cursor-paginated list of recent ShelfInstances for the profile.
- `GET /profiles/:profileId/shelf-concepts/:conceptId/performance` — returns `ConceptPerformance` aggregate.

### 11. Extended Lab route

**`apps/api/src/routes/recommendation-lab.ts`**

Add two new Fastify routes:

- `GET /recommendation-lab/profiles/:profileId/shelf-history` — list last N ShelfInstances: concept title, rendered title, itemCount, firstDisplayedAt, impressionCount, visibleRate, openRate, playRate, fatigue state.
- `GET /recommendation-lab/shelf-instances/:id/trace` — full item-level score trace: rankPosition, semanticScore, profileScore, finalScore, diversityAdjustment, reasonCodes, wasVisible, openedAt, playedAt + concept fatigue state at time of display.

### 12. API contracts

**`packages/api-contracts/src/shelf-instances.ts`**

Types: `ShelfInstanceDetail`, `ShelfInstanceItemDetail`, `ConceptPerformance`, `FatigueState`, `ProfileMediaExposureEntry`, `ShelfHistoryEntry` (Lab list item), `ShelfInstanceTrace` (Lab trace).

## Excluded

- Full A/B experiment platform or experiment assignment/bucketing logic (version fields stored; evaluation deferred).
- Automated compaction/retention cron jobs (`expiresAt` column defined on ShelfInstance and RecommendationHomeSession; compaction job is a follow-up ticket).
- Frontend (web/android-tv) Recommendation Lab UI changes — only API endpoints added.
- Backfilling historical `shelfId` references in existing interaction events.
- Changes to the existing `shelves`/`shelfMembers` tables (user-curated shelves, unrelated to recommendation history).
- Scroll-pixel-level visibility tracking (threshold-based `SHELF_ITEM_VISIBLE` event only; threshold defined client-side).
- Removing the existing `shelfId` column from `profileInteractionEvents` (kept for backward compatibility).
- Cross-session attribution beyond the 30-minute window.

## Acceptance criteria

1. `shelf_instances` table exists with non-null `ranker_version`, `query_planner_version`, `embedding_model_version` columns; a ShelfInstance row is created during shelf generation and references a valid `shelf_concepts.id`.
2. `shelf_instance_items` rows exist for each generated ShelfInstance with ordered `rank_position`, `final_score`, non-null `reason_codes`.
3. `first_displayed_at` on a ShelfInstance is null until a `SHELF_IMPRESSION` event with matching `shelfInstanceId` fires; `was_visible` on ShelfInstanceItem is false until a `SHELF_ITEM_VISIBLE` event updates it.
4. A `SHELF_ITEM_OPENED` event with `metadataJson.shelfInstanceId` sets `opened_at` on the matching ShelfInstanceItem row and increments `profile_media_exposure.open_count` for the corresponding media.
5. A `PLAY_STARTED` event with a `shelfInstanceId` (direct or resolved via 30-minute attribution window) sets `played_at` on the matching ShelfInstanceItem row.
6. `ShelfPerformanceService.getConceptPerformance()` returns non-null `impressionCount`, `visibleRate`, `openRate`, `playRate` for a concept that has ShelfInstance history.
7. `getProfileMediaExposureBatch()` resolves via a single indexed query; `rankHybrid()` uses the result as the implicit shown-set when `opts.alreadyShownIds` is not provided.
8. A concept exceeding `FATIGUE_MAX_ZERO_INTERACTION_STREAK` consecutive visible-but-ignored impressions within `FATIGUE_LOOKBACK_DAYS` gets an active `cooldown_until` entry; `getActivePool()` excludes it.
9. `recommendation_home_sessions` table exists; ShelfInstance rows carry a `homeSessionId` when generated within the same session.
10. `GET /recommendation-lab/profiles/:profileId/shelf-history` returns a non-empty list for a test Profile that has generated and displayed shelves.
11. `GET /recommendation-lab/shelf-instances/:id/trace` returns full item-level `semanticScore`, `profileScore`, `finalScore`, `wasVisible`, `openedAt`, `playedAt` for a ShelfInstance tied to real interactions.
12. All new tables have a composite index on `(profile_id, created_at)`; `expires_at` column exists on `shelf_instances` and `recommendation_home_sessions`.
