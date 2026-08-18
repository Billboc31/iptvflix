# Conflict Context — T100

Generated at: 2026-08-18T12:24:24Z

## Metadata

- pre_conflict_state: unknown
- conflict_detected_at: unknown
- conflict_pr_number: unknown
- conflicted_files (source): apps/api/migrations/meta/_journal.json
- skipped_runtime_noise: 0 path(s)

---

## ORM / Drizzle migration conflict playbook

When main and this ticket both added a migration at the **same numeric index**
(e.g. `0004_wild_legion.sql` on main + `0004_careless_moon_knight.sql` on the ticket):

1. Keep main's existing `NNNN_*.sql` and its `meta/NNNN_snapshot.json` unchanged.
2. Renumber **this ticket's new** migration(s) to the next free index (`max(main)+1`).
3. Update together: SQL filename, `meta/_journal.json` (`tag` = basename without
   `.sql`, unique `idx`), and `meta/NNNN_snapshot.json` (`prevId` = previous snapshot id).
4. **Never** leave two `NNNN_*.sql` files with the same `NNNN`.
5. **Never** “resolve” by keeping both `0004_*` files and only editing the journal text.
6. Prefer copying the ticket schema SQL into the next free index over line-merging journals.

Fail the resolution if two SQL migrations still share the same numeric prefix.

---

## Ticket

# T100 — Capture and persist comprehensive profile interaction data for future recommendation quality

**Source**: GitHub Issue #203

## Description

## Context
IPTVFlix is introducing first-class Account -> Profile support (#201) and wants to build highly personalized, effectively infinite Home shelves later.

To make future recommendation models genuinely good, we should start capturing useful profile-level behavioral signals NOW, even if many of them are not consumed by the recommendation engine immediately.

The principle is:

```text
collect rich, meaningful, privacy-conscious interaction history now
        ↓
keep canonical/profile ownership correct
        ↓
allow future algorithms/LLMs/rankers to recompute taste from history
```

This ticket is DATA COLLECTION + NORMALIZATION + RETENTION. It should not yet attempt to build the final infinite-home recommendation engine.

## Goal
Ensure IPTVFlix persistently captures the useful signals needed to understand each Profile's tastes, behavior, content affinities, playback habits and recommendation interactions over time.

The data must be profile-scoped and reusable by future algorithms without requiring a database redesign.

## 1. Reuse #201 profile interaction architecture
Do not create a competing event model if #201 has already introduced `ProfileInteractionEvent` or an equivalent structure.

Extend/adapt the actual merged schema so all events are owned by `profileId` and can be queried efficiently by profile, time, media and event type.

## 2. Event taxonomy
Define a clear, versioned taxonomy of meaningful events. At minimum support where the product actually has these interactions:

### Discovery / browsing
- `HOME_OPENED`
- `SHELF_IMPRESSION`
- `SHELF_VIEWED`
- `SHELF_ITEM_IMPRESSION`
- `SHELF_ITEM_OPENED`
- `DETAIL_OPENED`
- `TRAILER_PREVIEW_STARTED`
- `TRAILER_PREVIEW_COMPLETED`
- `SEARCH_PERFORMED`
- `SEARCH_RESULT_IMPRESSION`
- `SEARCH_RESULT_OPENED`

### Intent / explicit preference
- `MY_LIST_ADDED`
- `MY_LIST_REMOVED`
- `LIKED`
- `DISLIKED`
- `RATED` if ratings exist later
- `CONTINUE_WATCHING_DISMISSED`
- `REMINDER_ADDED` if reminders exist later

### Playback
- `PLAY_STARTED`
- `PLAY_RESUMED`
- `PLAY_PAUSED`
- `PLAY_STOPPED`
- `PLAY_COMPLETED`
- `PLAY_ABANDONED`
- `SEEK_FORWARD`
- `SEEK_BACKWARD`
- `SKIP_INTRO`
- `SKIP_RECAP`
- `SKIP_OUTRO`
- `NEXT_EPISODE_AUTO`
- `NEXT_EPISODE_MANUAL`
- `SOURCE_SELECTED`
- `AUDIO_TRACK_SELECTED`
- `SUBTITLE_TRACK_SELECTED`
- `PLAYBACK_SPEED_CHANGED`

### Profile/settings
- `PROFILE_SELECTED`
- `PROFILE_PREFERENCE_CHANGED`
- `NEVER_STOP_ENABLED`
- `NEVER_STOP_DISABLED`

Do not emit events that the UI cannot meaningfully produce yet; the taxonomy should be extensible and versioned.

## 3. Store context with each event
Persist enough context to make future ranking explainable and useful, without duplicating entire catalog rows.

Suggested fields where applicable:

```text
ProfileInteractionEvent
- id
- profileId
- eventType
- occurredAt
- mediaType
- mediaId
- seriesId (nullable)
- seasonId / seasonNumber (nullable)
- episodeId (nullable)
- positionMs (nullable)
- durationMs (nullable)
- progressPercent (nullable derived/snapshot)
- shelfInstanceId (nullable)
- shelfConceptId / shelfConcept (nullable)
- shelfPosition (nullable)
- itemPositionInShelf (nullable)
- searchQueryNormalized (nullable)
- sourceId (nullable)
- availabilityId (nullable)
- deviceType (nullable)
- clientType (web/mobile/android-tv)
- appVersion (nullable)
- sessionId (nullable)
- referrerSurface (nullable)
- metadataJson (strictly bounded)
- schemaVersion
```

Avoid copying poster URLs, overviews, full TMDB payloads or provider credentials into interaction rows. Catalog metadata remains canonical elsewhere.

## 4. Playback quality signals
Future recommendations should distinguish "clicked" from "actually enjoyed".

Capture/derive durable playback behavior such as:
- started but abandoned quickly;
- watched 5/25/50/75/90+%;
- completed;
- repeatedly resumed;
- replayed after completion;
- episode binge streaks;
- series abandonment after N episodes;
- manual next episode vs autoplay;
- long pauses / repeated seeks only where useful.

Do NOT emit one event every second. Existing watch progress remains the authoritative continuous position store. Events should represent meaningful boundaries or milestones.

## 5. Milestone events instead of noisy telemetry
Implement deduplicated playback milestones where useful, for example:
- `WATCHED_10_PERCENT`
- `WATCHED_25_PERCENT`
- `WATCHED_50_PERCENT`
- `WATCHED_75_PERCENT`
- `WATCHED_90_PERCENT`
- `PLAY_COMPLETED`

Or store equivalent structured snapshots without exploding event volume.

Each milestone must be emitted at most once per viewing lifecycle/content/profile unless intentional replay semantics require otherwise.

## 6. Session / viewing-session model
Introduce or reuse a lightweight viewing session concept if it improves data quality:

```text
ViewingSession
- id
- profileId
- mediaId / episodeId
- startedAt
- endedAt
- startPositionMs
- endPositionMs
- maxPositionMs
- watchedMsApprox
- completed
- deviceType
- sourceId / availabilityId
```

This can summarize one actual watch session and avoid reconstructing everything only from event logs.

Do not double-store contradictory progress semantics; document source of truth.

## 7. Catalog feature snapshots / joins
Do not duplicate all TMDB metadata into events, but ensure future recommendation jobs can efficiently join an interaction to useful canonical features such as:
- genres;
- keywords/tags;
- cast;
- directors/creators;
- production countries;
- original language;
- release year/decade;
- runtime;
- popularity;
- rating/vote count;
- collection/franchise;
- TV networks;
- anime classification if present;
- certification/maturity;
- canonical TMDB external IDs.

If the current canonical schema is missing important reusable metadata from TMDB, enrich/store it in normalized catalog tables rather than in interaction events.

## 8. People / credits data
Audit whether IPTVFlix currently persists cast/crew sufficiently for recommendation use.

Where licensing/API rules allow and data is available from existing TMDB sync, persist useful normalized relationships such as:
- Actor / Person;
- MoviePerson / SeriesPerson / EpisodePerson where appropriate;
- role/character;
- department/job;
- billing/order;
- director/creator flags.

This is important for future shelves such as:
- `Avec Cillian Murphy`;
- `Films de Denis Villeneuve`;
- `Parce que tu regardes souvent X`.

Do not fetch deep credit detail for every obscure entity if it causes unreasonable API cost; design backfill tiers/priorities.

## 9. Keywords / themes / collections
Persist useful TMDB-derived discovery metadata where not already stored:
- keywords;
- collections/franchises;
- networks;
- production companies;
- countries;
- languages;
- certifications/content ratings;
- watch/provider-independent metadata when useful.

These features are especially valuable for semantic shelf construction.

## 10. Availability-aware features
Keep catalog identity separate from provider availability, but ensure recommendation/ranking can efficiently answer:
- playable now yes/no;
- source count;
- best known quality;
- language variants;
- recently became playable;
- available in user's household sources.

Do not let recommendation logic depend on raw Xtream names or UUIDs.

## 11. Shelf analytics groundwork
Future infinite shelves need feedback on shelf quality.

Persist stable concepts/instances so we can know:
- shelf was rendered;
- which items were shown;
- item positions;
- item clicked/opened/played;
- shelf ignored;
- shelf reached during vertical scroll;
- whether a concept repeatedly performs poorly for a profile.

Avoid an event for every tiny scroll pixel. Emit impression only after a reasonable visibility threshold.

## 12. Search behavior
Persist profile-scoped search behavior carefully:
- normalized query;
- timestamp;
- result opened/played;
- no-result state when useful.

Do not store sensitive free-text indefinitely without policy. Add configurable retention/anonymization capability for raw search strings if needed.

## 13. Derived taste model pipeline
Create or extend a recomputable profile feature store such as `ProfileTasteFeature` / `TasteProfileVersion`.

Potential derived weights:
- genre affinity;
- keyword/theme affinity;
- actor/person affinity;
- director/creator affinity;
- franchise affinity;
- language affinity;
- country affinity;
- decade/year affinity;
- runtime preference;
- movie/series/anime preference;
- completion likelihood;
- novelty vs familiar-content preference;
- popularity/mainstream vs niche preference;
- binge tendency;
- explicit negative signals.

The raw event/history store must remain available so a new algorithm version can recompute taste from scratch.

## 14. Recommendation explainability readiness
Keep enough provenance so a future shelf/item can explain internally why it was selected, e.g.:
- liked genre X;
- completed movies A/B;
- actor affinity Y;
- recently watched series Z;
- trending/currently popular;
- newly available from household source.

This does not require showing explanations to users yet, but the system should not become a black box with no traceable features.

## 15. Backfill existing state
Create migration/backfill from existing profile-scoped data after #201:
- current watch progress;
- completed items;
- My List;
- likes/dislikes if present;
- Continue Watching dismissals;
- existing history.

Do not fabricate historical timestamps/events that are unknown. Create explicit migration-origin snapshots/events where necessary.

## 16. Retention and database growth
This feature intentionally stores a lot, so build sustainable retention/indexing from the beginning.

Requirements:
- indexes by profile/time/event/media;
- bounded metadata JSON;
- no per-second playback spam;
- archive/compact strategy for very old low-value telemetry;
- preserve high-value durable preference/history events longer;
- configurable retention by event class;
- schema supports future partitioning if data grows substantially.

Do not prematurely delete watch history needed to recompute tastes.

## 17. Privacy/account deletion
Although this is a private/personal product today, build clean ownership semantics:
- profile deletion cascades/removes profile interaction/taste data appropriately;
- account deletion removes all profile behavioral data;
- no profile can query another account's events;
- admin diagnostics should not casually expose raw search/history across accounts.

## 18. Event ingestion API/service
Centralize event emission through one server-side validated service/API rather than arbitrary frontend table writes.

Requirements:
- authenticated Account + current Profile enforcement;
- validate event type and media ownership/reference;
- reject oversized metadata;
- idempotency/deduping where needed;
- batch support for safe client telemetry upload where beneficial;
- failure to record non-critical analytics must not break playback.

## 19. Client instrumentation
Wire the existing Web/Mobile and Android TV clients to emit meaningful events for interactions that already exist.

At minimum instrument currently available flows:
- profile select;
- Home/detail open;
- search;
- My List add/remove;
- playback start/resume/pause/complete;
- source selection;
- audio/subtitle selection where available;
- Continue Watching dismissal;
- shelf/item interactions where current Home architecture supports them.

Do not block UI waiting for analytics persistence.

## 20. Admin diagnostics
Provide dev/admin-level visibility:
- events/day;
- events/profile (sanitized/admin appropriate);
- top event types;
- storage growth;
- ingestion failures;
- duplicate/dropped noisy events;
- derived taste recompute status;
- number of profiles with enough signal for personalization.

## Acceptance criteria
- [ ] All behavioral data is owned by `profileId`.
- [ ] Event taxonomy is explicit/versioned/extensible.
- [ ] Current Web/Mobile and Android TV interactions emit meaningful events.
- [ ] No per-second noisy playback telemetry is introduced.
- [ ] Viewing behavior can distinguish start/abandon/partial/complete.
- [ ] Viewing sessions or equivalent summaries exist where useful.
- [ ] Shelf impression/click groundwork exists for future infinite Home ranking.
- [ ] Search behavior can be learned from with appropriate retention safeguards.
- [ ] Canonical metadata can be joined to interactions for genres/people/keywords/languages/etc.
- [ ] Missing useful TMDB metadata is persisted in normalized catalog storage where appropriate.
- [ ] Cast/crew/director relationships are available for recommendation features where feasible.
- [ ] Keywords/collections/themes and key discovery metadata are retained where available.
- [ ] Availability-aware ranking features are queryable without leaking provider internals.
- [ ] Derived taste features can be fully recomputed from durable history.
- [ ] Existing profile state is backfilled without inventing false history.
- [ ] Database retention/indexing prevents unbounded noisy growth.
- [ ] Profile/account deletion correctly removes owned interaction/taste data.
- [ ] Event recording failures do not break primary product flows.
- [ ] Diagnostics show data volume and instrumentation health.

## Completion rule
Do not close because an `events` table exists. Demonstrate with at least two Profiles using the app differently that their persisted interaction histories differ, their derived taste features can be recomputed independently, and the stored data is rich enough to distinguish at minimum: content opened but not played, quickly abandoned, partially watched, completed, explicitly liked/disliked/listed, searched for, and discovered through a shelf.

---

## Plan

# Plan — T100: Capture and persist comprehensive profile interaction data

## Objective

Extend IPTVFlix's existing interaction event infrastructure to capture a comprehensive, profile-scoped behavioral signal history sufficient to drive future personalized recommendations — covering event taxonomy completeness, viewing session summaries, playback milestones, people/keyword enrichment, derived taste model extension, client instrumentation across all three platforms, and admin diagnostics, without building the recommendation engine itself.

## Included

### 1. DB — extend `profile_interaction_events`

**File**: `apps/api/src/db/schema/profile-interaction-events.ts`  
**Migration**: `apps/api/migrations/0039_t100_profile_interaction_events_v2.sql`

Add columns (all nullable unless noted):
- `seriesId` uuid — for episode-level events
- `seasonId` uuid
- `seasonNumber` integer
- `progressPercent` integer — snapshot at event time
- `shelfConceptId` text — logical shelf concept key (e.g. `rec_genre_thriller`)
- `shelfPosition` integer — vertical position of shelf on home page
- `itemPositionInShelf` integer — horizontal position of item within shelf
- `searchQueryNormalized` text — for SEARCH_PERFORMED events
- `availabilityId` uuid
- `clientType` text — `"web"` | `"mobile"` | `"android-tv"`
- `appVersion` text
- `sessionId` uuid — FK to `viewing_sessions`
- `referrerSurface` text — `"home"` | `"detail"` | `"search"` | `"continue_watching"`
- `schemaVersion` integer not-null default 1
- `idempotencyKey` text unique — for client-side deduplication

Add indexes: `(profileId, eventType)`, `(profileId, mediaId)`, `(sessionId)`, `(occurredAt)`.

Extend the allowed event types constraint (see §5).

### 2. DB — new `viewing_sessions` table

**File**: `apps/api/src/db/schema/viewing-sessions.ts` (new)  
**Migration**: same as §1

Fields: `id` (uuid PK), `profileId` (uuid FK profiles CASCADE DELETE), `mediaType` (text), `mediaId` (uuid), `episodeId` (uuid nullable), `startedAt` (timestamp TZ), `endedAt` (timestamp TZ nullable), `startPositionMs` (integer), `endPositionMs` (integer nullable), `maxPositionMs` (integer), `watchedMsApprox` (integer), `completed` (boolean default false), `deviceType` (text nullable), `clientType` (text nullable), `sourceId` (uuid nullable), `availabilityId` (uuid nullable), `createdAt` (timestamp TZ default now).

Indexes: `(profileId, mediaId)`, `(profileId, startedAt DESC)`.

### 3. DB — new `persons` table + extend `media_credits`

**File**: `apps/api/src/db/schema/persons.ts` (new)  
**Migration**: same as §1

`persons` table: `id` (uuid PK), `tmdbPersonId` (integer unique), `name` (text), `profilePath` (text nullable), `fetchedAt` (timestamp TZ).

`media_credits` additions: `personId` (uuid nullable FK `persons`), `department` (text nullable), `job` (text nullable), `isDirector` (boolean default false), `isCreator` (boolean default false).

### 4. DB — extend `profile_taste`

**File**: `apps/api/src/db/schema/profile-taste.ts`  
**Migration**: same as §1

Add columns:
- `personScores` jsonb — `Record<personId, score>`
- `personMeta` jsonb — `Record<personId, {name, role}>`
- `keywordScores` jsonb — `Record<keyword, score>`
- `franchiseScores` jsonb — `Record<collectionId, score>`
- `languageScores` jsonb — `Record<languageCode, score>`
- `countryScores` jsonb — `Record<countryCode, score>`
- `decadeScores` jsonb — `Record<decade, score>` (e.g. `"2000s"`)
- `mediaTypePreferences` jsonb — `{movie: score, series: score, anime: score}`
- `completionRate` numeric nullable
- `avgProgressPercent` integer nullable
- `tasteVersion` integer not-null default 1
- `historyEventCount` integer not-null default 0

### 5. Event type taxonomy — complete constraint

**File**: `apps/api/src/db/schema/profile-interaction-events.ts`  
**File**: `packages/api-contracts/src/interaction-events.ts`

Add all missing types to the allowed list (current 22 → ~47 total):

Discovery: `HOME_OPENED`, `SHELF_VIEWED`, `SHELF_ITEM_IMPRESSION`, `TRAILER_PREVIEW_COMPLETED`, `SEARCH_RESULT_IMPRESSION`

Intent: `CONTINUE_WATCHING_DISMISSED`

Playback: `PLAY_STOPPED`, `SEEK_FORWARD`, `SEEK_BACKWARD`, `SKIP_INTRO`, `SKIP_RECAP`, `SKIP_OUTRO`, `NEXT_EPISODE_AUTO`, `NEXT_EPISODE_MANUAL`, `AUDIO_TRACK_SELECTED`, `SUBTITLE_TRACK_SELECTED`, `PLAYBACK_SPEED_CHANGED`, `WATCHED_10_PERCENT`, `WATCHED_25_PERCENT`, `WATCHED_50_PERCENT`, `WATCHED_75_PERCENT`, `WATCHED_90_PERCENT`

Profile: `PROFILE_SELECTED`, `PROFILE_PREFERENCE_CHANGED`, `NEVER_STOP_ENABLED`, `NEVER_STOP_DISABLED`

Stub (extensible, not yet emitted by clients): `RATED`, `REMINDER_ADDED`

### 6. Playback milestone service (deduplication)

**File**: `apps/api/src/services/playback-milestone-service.ts` (new)

`emitMilestoneIfNew(profileId, mediaId, milestone, sessionId)` — inserts a `WATCHED_{N}_PERCENT` event only if no existing event exists for the same `idempotencyKey = "${profileId}:${mediaId}:${sessionId}:${milestone}"`. Called from the progress-sync route after threshold crossings (10/25/50/75/90%).

### 7. Viewing session service

**File**: `apps/api/src/services/viewing-session-service.ts` (new)

Functions:
- `openSession(profileId, mediaId, mediaType, episodeId, startPositionMs, deviceType, clientType, sourceId)` → `{ sessionId }`
- `updateSession(sessionId, endPositionMs, maxPositionMs, watchedMsApprox)`
- `closeSession(sessionId, completed)`
- `getActiveSession(profileId, mediaId)` — find open (no `endedAt`) session for profile + media

Sessions are opened on `PLAY_STARTED`, updated on `PLAY_PAUSED` / `PLAY_STOPPED`, closed on `PLAY_COMPLETED` / `PLAY_ABANDONED`. The `sessionId` is returned to clients from the `PLAY_STARTED` response so subsequent events can reference it.

### 8. Event ingestion API extension

**File**: `apps/api/src/routes/interaction-events.ts`  
**File**: `apps/api/src/services/interaction-event-service.ts`

- `POST /interaction-events/batch` — accepts array of ≤ 50 events; processes best-effort, swallows failures, never returns 5xx to caller.
- Idempotency: if `idempotencyKey` is present and already exists, silently return 200 without re-inserting.
- Validate all new event types.
- Reject `metadataJson` > 4 KB.
- On `PLAY_STARTED`: call `openSession()`, include returned `sessionId` in response body.
- Event recording failures must not propagate as 5xx; catch and log internally.

### 9. Extended `profile-taste-service.ts`

**File**: `apps/api/src/services/profile-taste-service.ts`

Extend `buildTaste(profileId)` to also compute from signal media (completed/liked/watchlisted):
- `personScores` — join `media_credits` → `persons` through signal `mediaId`s
- `keywordScores` — join `movies.keywords` / `series.keywords`
- `franchiseScores` — join `movies.collectionId`
- `languageScores` — from `originalLanguage`
- `countryScores` — from `productionCountries`
- `decadeScores` — from `year` / `firstAirYear` bucketed to decade
- `mediaTypePreferences` — from media types in signal set
- `completionRate` — `PLAY_COMPLETED` count / `PLAY_STARTED` count from `profile_interaction_events`
- `historyEventCount` — total event count for profile
- Bump `tasteVersion` on rebuild.

### 10. Persons enrichment in metadata sync

**File**: `apps/api/src/services/metadata-enrichment-service.ts`

When upserting credits: upsert into `persons` by TMDB person ID, then set `personId` FK on the `media_credits` row. Add `isDirector = true` for `job = "Director"`, `isCreator = true` for created-by entries. TMDB person IDs are already available in the credits payload — no additional API call needed.

### 11. Client instrumentation — Web

**File**: `apps/web/src/hooks/useInteractionEvents.ts` (new) — shared fire-and-forget emitter  
**File**: `apps/web/src/pages/PlayerPage.tsx`  
**File**: `apps/web/src/pages/HomePage.tsx` (or equivalent)  
**File**: `apps/web/src/pages/DetailPage.tsx`  
**File**: `apps/web/src/pages/SearchPage.tsx`  
**File**: `apps/web/src/components/WatchlistButton.tsx` (or equivalent)

Wire (all fire-and-forget, non-blocking):
- PlayerPage: `PLAY_STARTED` (open session), `PLAY_PAUSED`, `PLAY_RESUMED`, `PLAY_COMPLETED`, `PLAY_ABANDONED`, `SKIP_INTRO`, `SKIP_RECAP`, `SKIP_OUTRO`, `NEXT_EPISODE_AUTO`, `NEXT_EPISODE_MANUAL`, `SOURCE_SELECTED`, `AUDIO_TRACK_SELECTED`, `SUBTITLE_TRACK_SELECTED`
- Progress sync hook: milestone events via batch endpoint at 10/25/50/75/90% thresholds
- DetailPage: `DETAIL_OPENED`, `PREVIEW_STARTED`, `TRAILER_PREVIEW_COMPLETED`
- HomePage: `HOME_OPENED`, `SHELF_IMPRESSION` (intersection observer at 50% visibility), `SHELF_VIEWED`, `SHELF_ITEM_OPENED`, `SHELF_ITEM_IMPRESSION`
- SearchPage: `SEARCH_PERFORMED`, `SEARCH_RESULT_OPENED`, `SEARCH_RESULT_IMPRESSION`
- Watchlist action: `MY_LIST_ADDED`, `MY_LIST_REMOVED`
- Feedback action: `LIKED`, `DISLIKED`
- Continue Watching dismiss: `CONTINUE_WATCHING_DISMISSED`
- Profile switch: `PROFILE_SELECTED`
- NeverStop toggle: `NEVER_STOP_ENABLED`, `NEVER_STOP_DISABLED`

### 12. Client instrumentation — Mobile

**Files**: `apps/mobile/src/` equivalent pages/hooks

Same event set as Web with `clientType: "mobile"`. Reuse same API contract.

### 13. Client instrumentation — AndroidTV

**Files**: `apps/android-tv/app/src/main/kotlin/`

Wire through PlayerViewModel (ExoPlayer listener callbacks) and composable screens:
- `PLAY_STARTED`, `PLAY_PAUSED`, `PLAY_RESUMED`, `PLAY_COMPLETED`, `PLAY_ABANDONED`, `SOURCE_SELECTED`, `AUDIO_TRACK_SELECTED`, `SUBTITLE_TRACK_SELECTED`
- `HOME_OPENED`, `SHELF_ITEM_OPENED`
- `DETAIL_OPENED`
- `PROFILE_SELECTED`

All calls with `clientType: "android-tv"`, fire-and-forget (coroutine scope with catch).

### 14. Backfill script

**File**: `apps/api/src/scripts/backfill-interaction-events.ts` (new, one-shot)

From existing profile data, insert synthetic events tagged `metadataJson = {"origin": "backfill"}` and `schemaVersion = 0`:
- `viewing_progress` with `progressSeconds / durationSeconds >= 0.9` → `PLAY_COMPLETED`, `occurredAt = lastWatchedAt`
- `viewing_progress` with `progressSeconds > 0 and < 0.9 ratio` → `PLAY_STARTED` (approximate), `occurredAt = lastWatchedAt`
- `watchlist` rows → `MY_LIST_ADDED`, `occurredAt = addedAt`
- `explicit_feedback` LIKE → `LIKED`, `occurredAt = createdAt`
- `explicit_feedback` DISLIKE → `DISLIKED`, `occurredAt = createdAt`

Do not fabricate timestamps that are unknown. Skip rows where `occurredAt` cannot be derived.

### 15. Admin diagnostics routes

**File**: `apps/api/src/routes/admin.ts`

Add:
- `GET /admin/interaction-stats` — events/day last 30 days, top 10 event types by count, distinct profiles with at least one event, total event count, ingestion error placeholder (count of events with null mediaId where type requires it)
- `GET /admin/taste-stats` — profiles with computed taste, profiles with `signalCount >= 5` (enough signal), oldest `builtAt`, coverage % of active profiles
- `GET /admin/interaction-health` — duplicate event count (same idempotencyKey rejected), milestone coverage (% of PLAY_STARTED that have at least one WATCHED_N_PERCENT), profiles with zero events

### 16. Retention configuration

**File**: `apps/api/src/config/retention.ts` (new)  
**File**: `apps/api/src/services/retention-service.ts` (new)

Define event retention classes:
- `HIGH_VALUE` (LIKED, DISLIKED, MY_LIST_ADDED, PLAY_COMPLETED, WATCHED_90_PERCENT): retain indefinitely
- `STANDARD` (PLAY_STARTED, PLAY_PAUSED, DETAIL_OPENED, all other playback): retain 730 days
- `ANALYTICS` (SHELF_IMPRESSION, HOME_OPENED, SHELF_ITEM_IMPRESSION): retain 90 days
- `SEARCH` (SEARCH_PERFORMED): null `searchQueryNormalized` after 90 days, retain row

`retentionService.runCompaction()` — callable from a scheduled job or admin endpoint; anonymizes/deletes rows according to class. Add `GET /admin/retention-stats` showing events past retention window not yet compacted.

### 17. Profile/account deletion cascade verification

**Migration**: same as §1

Verify (or add) FK constraints:
- `profile_interaction_events.profileId` → `profiles.id` ON DELETE CASCADE
- `viewing_sessions.profileId` → `profiles.id` ON DELETE CASCADE
- `profile_taste.profileId` → `profiles.id` ON DELETE CASCADE

Add integration test: delete profile → assert zero rows remain in all three tables.

## Excluded

- Building the infinite Home recommendation engine or shelf generation logic (future ticket)
- Real-time or streaming event processing pipeline (Kafka, Kinesis, etc.)
- Per-second playback telemetry; watch position continuity remains in `viewing_progress`
- User-visible recommendation explanations in the UI
- Deep TMDB person enrichment for all historical content at scale (only wire new credit upserts; backfill tiers not executed here)
- Analytics BI dashboard or external platform integration (Mixpanel, Amplitude, etc.)
- GDPR/privacy compliance review beyond cascade deletes and search anonymization
- A/B test framework or feature flags
- Ratings, reminders, or notification features (event types stubbed in taxonomy, features not built)
- Per-episode credits backfill for the entire catalog (future enrichment job)
- Recommendation ranking changes

## Acceptance criteria

- `profile_interaction_events` has all new columns: `seriesId`, `seasonId`, `seasonNumber`, `progressPercent`, `shelfConceptId`, `shelfPosition`, `itemPositionInShelf`, `searchQueryNormalized`, `availabilityId`, `clientType`, `appVersion`, `sessionId`, `referrerSurface`, `schemaVersion`, `idempotencyKey`.
- Event type constraint accepts all ~47 types listed in the ticket taxonomy; unknown types are rejected at ingestion.
- `POST /interaction-events/batch` accepts ≤ 50 events, processes best-effort, and never returns 5xx for analytics failures.
- `viewing_sessions` table exists; `PLAY_STARTED` creates a session; `PLAY_COMPLETED` / `PLAY_ABANDONED` closes it; `sessionId` is referenced in related events.
- `WATCHED_{10|25|50|75|90}_PERCENT` milestones fire at most once per `(profileId, mediaId, sessionId)` — verified by submitting the same milestone twice and observing a single DB row.
- Web client emits at minimum: `PLAY_STARTED`, `PLAY_PAUSED`, `PLAY_COMPLETED`, `DETAIL_OPENED`, `HOME_OPENED`, `SEARCH_PERFORMED`, `MY_LIST_ADDED`, `LIKED`, `DISLIKED`, `PROFILE_SELECTED`.
- Android TV client emits at minimum: `PLAY_STARTED`, `PLAY_PAUSED`, `PLAY_COMPLETED`, `PROFILE_SELECTED`.
- Mobile client emits the same set as Web.
- `profile_taste` record includes `personScores`, `keywordScores`, `franchiseScores`, `languageScores`, `decadeScores` after `POST /taste/rebuild`.
- `persons` table exists; `media_credits` rows have `personId` populated for content enriched after this migration.
- Backfill script creates `PLAY_COMPLETED`, `MY_LIST_ADDED`, `LIKED`, `DISLIKED` events from existing profile data, all tagged `origin: backfill`.
- `GET /admin/interaction-stats` returns events/day for last 30 days, top event types, and distinct profile count.
- `GET /admin/taste-stats` returns taste coverage across active profiles.
- Deleting a profile removes all rows in `profile_interaction_events`, `viewing_sessions`, and `profile_taste` — verified by test.
- Two profiles using the app with different behavioral patterns produce different `profile_taste` records after `POST /taste/rebuild`, with at minimum different `genreScores` and `historyEventCount`.
- All DB changes are additive; no existing column type is altered, no existing constraint is dropped.
- `searchQueryNormalized` is nulled by `retentionService.runCompaction()` for events older than 90 days.

---

## Reviews

### implementation-review.md

I have all the information needed. Writing the review now.

---

# PR Review — T100: Capture and persist comprehensive profile interaction data

## Résumé

L'implémentation couvre l'essentiel du ticket : schéma DB enrichi, taxonomie complète (~50 types), service de session, taste service étendu, backfill idempotent, admin routes, instrumentation Web et Android TV. La qualité globale est bonne. Deux défauts bloquants ont été identifiés sur la déduplication des milestones, et trois observations mineures.

---

## Vérifications effectuées

- Migration SQL `0039_t100_profile_interaction_events_v2.sql` lue intégralement
- Services lus : `interaction-event-service`, `viewing-session-service`, `playback-milestone-service`, `profile-taste-service`, `retention-service`
- Routes lues : `interaction-events.ts`, `admin.ts`
- Clients lus : `PlayerPage.tsx`, `useInteractionEvents.ts`, `useProgressSync.ts`
- Script de backfill lu intégralement
- Arborescence `apps/` vérifiée pour la présence du client mobile

---

## Points validés

- **Schéma DB** : tous les colonnes prévus au plan sont présents (`seriesId`, `seasonId`, `progressPercent`, `idempotencyKey`, `schemaVersion`, etc.) ; contrainte unique conditionnelle sur `idempotencyKey` correcte.
- **Migration** : additive, `IF NOT EXISTS` sur chaque ALTER, cascade DELETE sur `profileId` dans `viewing_sessions`, `ON DELETE SET NULL` sur `sessionId` dans `profile_interaction_events` — correct.
- **Taxonomie** : 50 types définis et validés côté serveur via `ALLOWED_EVENT_TYPES`; inconnus rejetés en 400.
- **Batch endpoint** : best-effort, jamais de 5xx pour analytics, session ouverte sur `PLAY_STARTED` et retourne `sessionId`, session fermée sur `PLAY_COMPLETED`/`PLAY_ABANDONED` — conforme au plan.
- **Idempotency (événements généraux)** : `idempotencyKey` unique en DB + check en service avant insertion — correct.
- **Taste service** : `buildTaste` calcule `personScores`, `keywordScores`, `franchiseScores`, `languageScores`, `countryScores`, `decadeScores`, `completionRate`, `historyEventCount` — couverture complète des colonnes plan.
- **Persons enrichment** : upsert dans `persons` par `tmdbPersonId`, FK dans `media_credits.personId`, flags `isDirector`/`isCreator` — correct.
- **Backfill** : idempotent via `idempotencyKey = backfill:${profileId}:${mediaId}:${eventType}`, `schemaVersion=0`, `origin=backfill` — conforme.
- **Admin routes** : 5 endpoints présents (`interaction-stats`, `taste-stats`, `interaction-health`, `retention-stats`, `retention-compact`).
- **Rétention** : 3 classes distinctes (HIGH_VALUE, STANDARD, ANALYTICS), anonymisation search à 90j, pas de suppression des événements HIGH_VALUE — conforme au plan.
- **Instrumentation Web** : `PlayerPage` émet `PLAY_STARTED`/`RESUMED`/`PAUSED`/`COMPLETED`/`ABANDONED`, source/audio/subtitle/nextEpisode ; `useProgressSync` gère les milestones côté client et le progress keepalive. `DetailPage`, `SearchPage`, `HomePage`, `ProfileChoosePage` instrumentés.
- **Instrumentation Android TV** : `InteractionEventService` + `PlayerViewModel` (lifecycle complet) + `ProfileViewModel` (`PROFILE_SELECTED`) + `HomeViewModel` (`HOME_OPENED`) — conforme au plan.

---

## Problèmes détectés

### 🔴 BLOQUANT 1 — `playback-milestone-service.ts` est du code mort

**Fichier** : `apps/api/src/services/playback-milestone-service.ts`

La fonction `emitMilestoneIfNew` n'est importée nulle part dans la codebase :

```bash
grep -r "emitMilestoneIfNew|playback-milestone" apps/ --include="*.ts" --include="*.tsx" --include="*.kt"
# → une seule ligne : la définition elle-même
```

La déduplication serveur des milestones ne fonctionne pas. Le client Web (`useProgressSync`) émet les events `WATCHED_N_PERCENT` via `emitEvent` → `batchRecordInteractionEvents` **sans `idempotencyKey`**. Résultat : si la page est rechargée pendant la lecture, les milestones déjà atteints sont réémis et insérés en double.

**Critère de plan non satisfait** : *"WATCHED_{10|25|50|75|90}_PERCENT milestones fire at most once per (profileId, mediaId, sessionId) — verified by submitting the same milestone twice and observing a single DB row."*

**Correction minimale** — Option A (sans toucher au service) : dans `useProgressSync`, ajouter `idempotencyKey: \`${profileId}:${mediaId}:${sessionId}:WATCHED_${threshold}_PERCENT\`` à l'event émis (le profileId devra être passé en paramètre ou lu du contexte auth). Option B : wirer `emitMilestoneIfNew` depuis la route `POST /interaction-events/batch` lors du traitement des events `WATCHED_*`.

---

### 🔴 BLOQUANT 2 — `mediaType` hardcodé à `'MOVIE'` dans le service milestone

**Fichier** : `apps/api/src/services/playback-milestone-service.ts:48`

```ts
await db.insert(profileInteractionEvents).values({
  ...
  mediaType: 'MOVIE',   // ← hardcodé
```

Si le service était éventuellement branché, tous les milestones d'épisodes (séries) seraient enregistrés avec `mediaType = 'MOVIE'`, corrompant les données de recommandation. La signature de `emitMilestoneIfNew` doit recevoir `mediaType` en paramètre.

---

### 🟡 OBSERVATION 1 — Client mobile silencieusement absent

**Plan section 12** : *"Files: apps/mobile/src/ equivalent pages/hooks — Same event set as Web."*

L'arborescence `apps/` ne contient pas de client mobile (`android-tv`, `api`, `media-relay`, `web` seulement). Le plan l'a prévu explicitement et le critère de plan dit *"Mobile client emits the same set as Web."* Le coder a silencieusement sauté cette section sans le documenter dans `implementation-output.md`.

**Action attendue** : soit confirmer que le mobile n'existe pas encore dans ce projet (et mettre à jour le plan/output en conséquence), soit implémenter.

---

### 🟡 OBSERVATION 2 — `retention-service.ts` : valeurs de retour opaques et comptage standardOverdue inexact

**Fichier** : `apps/api/src/services/retention-service.ts`

```ts
return { deleted: 'compacted', anonymized: 'compacted' }  // ← chaînes fixes
```

Le retour de `runCompaction()` est inutilisable pour des diagnostics. Il devrait retourner les nombres de lignes supprimées/anonymisées.

Par ailleurs, la requête `standardOverdue` dans `getRetentionStats()` ne filtre **pas** par type d'événement — elle compte tous les événements de plus de 730 jours, y compris les HIGH_VALUE (LIKED, DISLIKED, PLAY_COMPLETED…) qui ne doivent pas être supprimés. Le chiffre affiché à `/admin/retention-stats` sera faux.

---

### 🟡 OBSERVATION 3 — `sessionId` potentiellement nul dans les milestones Web lors du premier chargement

**Fichier** : `apps/web/src/pages/PlayerPage.tsx:106` / `apps/web/src/hooks/useProgressSync.ts`

`sessionIdRef.current` est passé à `useProgressSync` à chaque render. L'effect interne (`useEffect` avec deps `[videoRef, enabled]`) capture la valeur du paramètre `sessionId` au moment de son installation. Si la session n'est pas encore ouverte (réponse `PLAY_STARTED` en transit), les premiers milestones seront émis avec `sessionId = null`, rendant la clé d'idempotence incohérente avec les events suivants. Ce cas est rare mais doit être géré.

---

## Risques éventuels

- Doublons de milestones en base si utilisateur recharge la page pendant la lecture — directement lié au bloquant 1.
- Données de recommandation erronées (`mediaType: 'MOVIE'` pour les épisodes) si le milestone service est branché sans corriger le bloquant 2.
- Compteur `standardOverdue` incorrect dans les diagnostics admin — surcharge des alertes.

---

## Décision

REQUEST_CHANGES — deux défauts bloquants nécessitent correction avant approbation.

**Actions requises :**
1. Fixer `emitMilestoneIfNew` pour qu'il accepte `mediaType` en paramètre (supprimer le hardcode `'MOVIE'`) et brancher ce service depuis le batch handler **ou** ajouter `idempotencyKey` sur les events WATCHED_N_PERCENT dans `useProgressSync`.
2. Corriger `retention-service.ts` : retourner les vrais counts depuis `runCompaction()` et filtrer par types STANDARD uniquement dans la requête `standardOverdue`.
3. Documenter explicitement dans `implementation-output.md` l'absence de client mobile (non-existence dans le repo) afin que le plan reflète la réalité livrée.

IMPLEMENTATION_FIX_REQUIRED

### review-decision-context-IMPLEMENTATION_REVIEW_NEEDED.md

## Review decision keywords

The review must end with exactly one valid workflow keyword on its own line.

Approval keyword:
IMPLEMENTATION_APPROVED

Fix required keyword:
IMPLEMENTATION_FIX_REQUIRED

---

## Fixes

### implementation-fix-1.md

# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T100/reviews/implementation-review.md
- generated at: 2026-08-18T11:55:42Z

---

I have all the information needed. Writing the review now.

---

# PR Review — T100: Capture and persist comprehensive profile interaction data

## Résumé

L'implémentation couvre l'essentiel du ticket : schéma DB enrichi, taxonomie complète (~50 types), service de session, taste service étendu, backfill idempotent, admin routes, instrumentation Web et Android TV. La qualité globale est bonne. Deux défauts bloquants ont été identifiés sur la déduplication des milestones, et trois observations mineures.

---

## Vérifications effectuées

- Migration SQL `0039_t100_profile_interaction_events_v2.sql` lue intégralement
- Services lus : `interaction-event-service`, `viewing-session-service`, `playback-milestone-service`, `profile-taste-service`, `retention-service`
- Routes lues : `interaction-events.ts`, `admin.ts`
- Clients lus : `PlayerPage.tsx`, `useInteractionEvents.ts`, `useProgressSync.ts`
- Script de backfill lu intégralement
- Arborescence `apps/` vérifiée pour la présence du client mobile

---

## Points validés

- **Schéma DB** : tous les colonnes prévus au plan sont présents (`seriesId`, `seasonId`, `progressPercent`, `idempotencyKey`, `schemaVersion`, etc.) ; contrainte unique conditionnelle sur `idempotencyKey` correcte.
- **Migration** : additive, `IF NOT EXISTS` sur chaque ALTER, cascade DELETE sur `profileId` dans `viewing_sessions`, `ON DELETE SET NULL` sur `sessionId` dans `profile_interaction_events` — correct.
- **Taxonomie** : 50 types définis et validés côté serveur via `ALLOWED_EVENT_TYPES`; inconnus rejetés en 400.
- **Batch endpoint** : best-effort, jamais de 5xx pour analytics, session ouverte sur `PLAY_STARTED` et retourne `sessionId`, session fermée sur `PLAY_COMPLETED`/`PLAY_ABANDONED` — conforme au plan.
- **Idempotency (événements généraux)** : `idempotencyKey` unique en DB + check en service avant insertion — correct.
- **Taste service** : `buildTaste` calcule `personScores`, `keywordScores`, `franchiseScores`, `languageScores`, `countryScores`, `decadeScores`, `completionRate`, `historyEventCount` — couverture complète des colonnes plan.
- **Persons enrichment** : upsert dans `persons` par `tmdbPersonId`, FK dans `media_credits.personId`, flags `isDirector`/`isCreator` — correct.
- **Backfill** : idempotent via `idempotencyKey = backfill:${profileId}:${mediaId}:${eventType}`, `schemaVersion=0`, `origin=backfill` — conforme.
- **Admin routes** : 5 endpoints présents (`interaction-stats`, `taste-stats`, `interaction-health`, `retention-stats`, `retention-compact`).
- **Rétention** : 3 classes distinctes (HIGH_VALUE, STANDARD, ANALYTICS), anonymisation search à 90j, pas de suppression des événements HIGH_VALUE — conforme au plan.
- **Instrumentation Web** : `PlayerPage` émet `PLAY_STARTED`/`RESUMED`/`PAUSED`/`COMPLETED`/`ABANDONED`, source/audio/subtitle/nextEpisode ; `useProgressSync` gère les milestones côté client et le progress keepalive. `DetailPage`, `SearchPage`, `HomePage`, `ProfileChoosePage` instrumentés.
- **Instrumentation Android TV** : `InteractionEventService` + `PlayerViewModel` (lifecycle complet) + `ProfileViewModel` (`PROFILE_SELECTED`) + `HomeViewModel` (`HOME_OPENED`) — conforme au plan.

---

## Problèmes détectés

### 🔴 BLOQUANT 1 — `playback-milestone-service.ts` est du code mort

**Fichier** : `apps/api/src/services/playback-milestone-service.ts`

La fonction `emitMilestoneIfNew` n'est importée nulle part dans la codebase :

```bash
grep -r "emitMilestoneIfNew|playback-milestone" apps/ --include="*.ts" --include="*.tsx" --include="*.kt"
# → une seule ligne : la définition elle-même
```

La déduplication serveur des milestones ne fonctionne pas. Le client Web (`useProgressSync`) émet les events `WATCHED_N_PERCENT` via `emitEvent` → `batchRecordInteractionEvents` **sans `idempotencyKey`**. Résultat : si la page est rechargée pendant la lecture, les milestones déjà atteints sont réémis et insérés en double.

**Critère de plan non satisfait** : *"WATCHED_{10|25|50|75|90}_PERCENT milestones fire at most once per (profileId, mediaId, sessionId) — verified by submitting the same milestone twice and observing a single DB row."*

**Correction minimale** — Option A (sans toucher au service) : dans `useProgressSync`, ajouter `idempotencyKey: \`${profileId}:${mediaId}:${sessionId}:WATCHED_${threshold}_PERCENT\`` à l'event émis (le profileId devra être passé en paramètre ou lu du contexte auth). Option B : wirer `emitMilestoneIfNew` depuis la route `POST /interaction-events/batch` lors du traitement des events `WATCHED_*`.

---

### 🔴 BLOQUANT 2 — `mediaType` hardcodé à `'MOVIE'` dans le service milestone

**Fichier** : `apps/api/src/services/playback-milestone-service.ts:48`

```ts
await db.insert(profileInteractionEvents).values({
  ...
  mediaType: 'MOVIE',   // ← hardcodé
```

Si le service était éventuellement branché, tous les milestones d'épisodes (séries) seraient enregistrés avec `mediaType = 'MOVIE'`, corrompant les données de recommandation. La signature de `emitMilestoneIfNew` doit recevoir `mediaType` en paramètre.

---

### 🟡 OBSERVATION 1 — Client mobile silencieusement absent

**Plan section 12** : *"Files: apps/mobile/src/ equivalent pages/hooks — Same event set as Web."*

L'arborescence `apps/` ne contient pas de client mobile (`android-tv`, `api`, `media-relay`, `web` seulement). Le plan l'a prévu explicitement et le critère de plan dit *"Mobile client emits the same set as Web."* Le coder a silencieusement sauté cette section sans le documenter dans `implementation-output.md`.

**Action attendue** : soit confirmer que le mobile n'existe pas encore dans ce projet (et mettre à jour le plan/output en conséquence), soit implémenter.

---

### 🟡 OBSERVATION 2 — `retention-service.ts` : valeurs de retour opaques et comptage standardOverdue inexact

**Fichier** : `apps/api/src/services/retention-service.ts`

```ts
return { deleted: 'compacted', anonymized: 'compacted' }  // ← chaînes fixes
```

Le retour de `runCompaction()` est inutilisable pour des diagnostics. Il devrait retourner les nombres de lignes supprimées/anonymisées.

Par ailleurs, la requête `standardOverdue` dans `getRetentionStats()` ne filtre **pas** par type d'événement — elle compte tous les événements de plus de 730 jours, y compris les HIGH_VALUE (LIKED, DISLIKED, PLAY_COMPLETED…) qui ne doivent pas être supprimés. Le chiffre affiché à `/admin/retention-stats` sera faux.

---

### 🟡 OBSERVATION 3 — `sessionId` potentiellement nul dans les milestones Web lors du premier chargement

**Fichier** : `apps/web/src/pages/PlayerPage.tsx:106` / `apps/web/src/hooks/useProgressSync.ts`

`sessionIdRef.current` est passé à `useProgressSync` à chaque render. L'effect interne (`useEffect` avec deps `[videoRef, enabled]`) capture la valeur du paramètre `sessionId` au moment de son installation. Si la session n'est pas encore ouverte (réponse `PLAY_STARTED` en transit), les premiers milestones seront émis avec `sessionId = null`, rendant la clé d'idempotence incohérente avec les events suivants. Ce cas est rare mais doit être géré.

---

## Risques éventuels

- Doublons de milestones en base si utilisateur recharge la page pendant la lecture — directement lié au bloquant 1.
- Données de recommandation erronées (`mediaType: 'MOVIE'` pour les épisodes) si le milestone service est branché sans corriger le bloquant 2.
- Compteur `standardOverdue` incorrect dans les diagnostics admin — surcharge des alertes.

---

## Décision

REQUEST_CHANGES — deux défauts bloquants nécessitent correction avant approbation.

**Actions requises :**
1. Fixer `emitMilestoneIfNew` pour qu'il accepte `mediaType` en paramètre (supprimer le hardcode `'MOVIE'`) et brancher ce service depuis le batch handler **ou** ajouter `idempotencyKey` sur les events WATCHED_N_PERCENT dans `useProgressSync`.
2. Corriger `retention-service.ts` : retourner les vrais counts depuis `runCompaction()` et filtrer par types STANDARD uniquement dans la requête `standardOverdue`.
3. Documenter explicitement dans `implementation-output.md` l'absence de client mobile (non-existence dans le repo) afin que le plan reflète la réalité livrée.

IMPLEMENTATION_FIX_REQUIRED

---

## Ticket branch diff since merge-base (e9f2b487)

```diff
diff --git a/apps/android-tv/app/src/main/kotlin/com/iptvflix/androidtv/home/HomeViewModel.kt b/apps/android-tv/app/src/main/kotlin/com/iptvflix/androidtv/home/HomeViewModel.kt
index bc21e12..14c4bd4 100644
--- a/apps/android-tv/app/src/main/kotlin/com/iptvflix/androidtv/home/HomeViewModel.kt
+++ b/apps/android-tv/app/src/main/kotlin/com/iptvflix/androidtv/home/HomeViewModel.kt
@@ -6,6 +6,7 @@ import androidx.lifecycle.AndroidViewModel
 import androidx.lifecycle.viewModelScope
 import com.iptvflix.androidtv.App
 import com.iptvflix.androidtv.network.ApiException
+import com.iptvflix.androidtv.network.InteractionEventService
 import kotlinx.coroutines.delay
 import kotlinx.coroutines.flow.MutableStateFlow
 import kotlinx.coroutines.flow.StateFlow
@@ -41,6 +42,8 @@ class HomeViewModel(app: Application) : AndroidViewModel(app) {
 
     private val container get() = getApplication<App>()
     private val json = Json { ignoreUnknownKeys = true }
+    private val interactionEvents by lazy { InteractionEventService(container.apiClient) }
+    private var hasEmittedHomeOpened = false
 
     private val _uiState = MutableStateFlow(HomeUiState())
     val uiState: StateFlow<HomeUiState> = _uiState
@@ -77,6 +80,12 @@ class HomeViewModel(app: Application) : AndroidViewModel(app) {
             try {
                 container.apiClient.get("/devices/me")
                 _uiState.value = _uiState.value.copy(connectionStatus = ConnectionStatus.Connected)
+                if (!hasEmittedHomeOpened) {
+                    hasEmittedHomeOpened = true
+                    runCatching {
+                        interactionEvents.emit(mapOf("eventType" to "HOME_OPENED", "clientType" to "android-tv"))
+                    }
+                }
                 delay(30_000)
             } catch (e: ApiException) {
                 if (e.code == 401) {
diff --git a/apps/android-tv/app/src/main/kotlin/com/iptvflix/androidtv/network/InteractionEventService.kt b/apps/android-tv/app/src/main/kotlin/com/iptvflix/androidtv/network/InteractionEventService.kt
new file mode 100644
index 0000000..b413dd9
--- /dev/null
+++ b/apps/android-tv/app/src/main/kotlin/com/iptvflix/androidtv/network/InteractionEventService.kt
@@ -0,0 +1,48 @@
+package com.iptvflix.androidtv.network
+
+import android.util.Log
+import kotlinx.coroutines.Dispatchers
+import kotlinx.coroutines.withContext
+import org.json.JSONArray
+import org.json.JSONObject
+
+private const val TAG = "InteractionEventService"
+private const val MAX_BATCH = 50
+
+/**
+ * Fire-and-forget interaction event emitter for Android TV.
+ * Failures are silently logged — analytics must never break playback.
+ */
+class InteractionEventService(private val apiClient: ApiClient) {
+
+    suspend fun emit(event: Map<String, Any?>) {
+        emitBatch(listOf(event))
+    }
+
+    suspend fun emitBatch(events: List<Map<String, Any?>>): String? {
+        if (events.isEmpty()) return null
+        return try {
+            withContext(Dispatchers.IO) {
+                val arr = JSONArray()
+                events.take(MAX_BATCH).forEach { event ->
+                    val obj = JSONObject()
+                    event.forEach { (k, v) ->
+                        if (v != null) obj.put(k, v)
+                    }
+                    arr.put(obj)
+                }
+                val body = JSONObject().put("events", arr).toString()
+                val response = apiClient.post("/interaction-events/batch", body)
+                // Extract sessionId from response if present
+                try {
+                    JSONObject(response).optString("sessionId", null)
+                } catch (_: Exception) {
+                    null
+                }
+            }
+        } catch (e: Exception) {
+            Log.w(TAG, "Failed to emit interaction events: ${e.message}")
+            null
+        }
+    }
+}
diff --git a/apps/android-tv/app/src/main/kotlin/com/iptvflix/androidtv/player/PlayerViewModel.kt b/apps/android-tv/app/src/main/kotlin/com/iptvflix/androidtv/player/PlayerViewModel.kt
index d6c203a..a05b7c7 100644
--- a/apps/android-tv/app/src/main/kotlin/com/iptvflix/androidtv/player/PlayerViewModel.kt
+++ b/apps/android-tv/app/src/main/kotlin/com/iptvflix/androidtv/player/PlayerViewModel.kt
@@ -12,6 +12,7 @@ import androidx.media3.common.Tracks
 import androidx.media3.exoplayer.ExoPlayer
 import com.iptvflix.androidtv.App
 import com.iptvflix.androidtv.command.PlaybackCommand
+import com.iptvflix.androidtv.network.InteractionEventService
 import com.iptvflix.androidtv.playback.PlaybackApi
 import com.iptvflix.androidtv.playback.PlaybackResolver
 import com.iptvflix.androidtv.playback.TrackInfo
@@ -58,6 +59,31 @@ class PlayerViewModel(app: Application) : AndroidViewModel(app) {
     private var progressReporter: ProgressReporter? = null
     private var reporterJob: Job? = null
 
+    private val interactionEvents: InteractionEventService by lazy {
+        InteractionEventService(container.apiClient)
+    }
+    private var currentCommand: PlaybackCommand? = null
+    private var sessionId: String? = null
+    private var hasEmittedPlay = false
+
+    private fun emitEvent(eventType: String, extra: Map<String, Any?> = emptyMap()) {
+        val cmd = currentCommand ?: return
+        viewModelScope.launch {
+            runCatching {
+                val params = buildMap<String, Any?> {
+                    put("eventType", eventType)
+                    put("mediaType", cmd.mediaType.uppercase())
+                    put("mediaId", cmd.mediaId)
+                    put("clientType", "android-tv")
+                    sessionId?.let { put("sessionId", it) }
+                    put("positionMs", player.currentPosition)
+                    putAll(extra)
+                }
+                interactionEvents.emit(params)
+            }.onFailure { Log.w(TAG, "emitEvent $eventType failed: ${it.message}") }
+        }
+    }
+
     init {
         player.addListener(object : Player.Listener {
             override fun onPlaybackStateChanged(state: Int) {
@@ -67,11 +93,34 @@ class PlayerViewModel(app: Application) : AndroidViewModel(app) {
                     state == Player.STATE_READY -> PlayerUiState.Paused
                     else -> _uiState.value
                 }
+                if (state == Player.STATE_ENDED) {
+                    emitEvent("PLAY_COMPLETED")
+                }
             }
 
             override fun onIsPlayingChanged(isPlaying: Boolean) {
                 if (player.playbackState == Player.STATE_READY) {
                     _uiState.value = if (isPlaying) PlayerUiState.Playing else PlayerUiState.Paused
+                    if (isPlaying && !hasEmittedPlay) {
+                        hasEmittedPlay = true
+                        viewModelScope.launch {
+                            runCatching {
+                                val cmd = currentCommand ?: return@runCatching
+                                val params = buildMap<String, Any?> {
+                                    put("eventType", "PLAY_STARTED")
+                                    put("mediaType", cmd.mediaType.uppercase())
+                                    put("mediaId", cmd.mediaId)
+                                    put("clientType", "android-tv")
+                                    put("positionMs", cmd.startPositionMs)
+                                }
+                                sessionId = interactionEvents.emitBatch(listOf(params))
+                            }.onFailure { Log.w(TAG, "PLAY_STARTED failed: ${it.message}") }
+                        }
+                    } else if (isPlaying && hasEmittedPlay) {
+                        emitEvent("PLAY_RESUMED")
+                    } else if (!isPlaying) {
+                        emitEvent("PLAY_PAUSED")
+                    }
                 }
             }
 
@@ -104,6 +153,9 @@ class PlayerViewModel(app: Application) : AndroidViewModel(app) {
     }
 
     fun load(command: PlaybackCommand) {
+        currentCommand = command
+        hasEmittedPlay = false
+        sessionId = null
         viewModelScope.launch {
             _uiState.value = PlayerUiState.Buffering
             runCatching {
diff --git a/apps/android-tv/app/src/main/kotlin/com/iptvflix/androidtv/profiles/ProfileViewModel.kt b/apps/android-tv/app/src/main/kotlin/com/iptvflix/androidtv/profiles/ProfileViewModel.kt
index c56f0af..d3b3c55 100644
--- a/apps/android-tv/app/src/main/kotlin/com/iptvflix/androidtv/profiles/ProfileViewModel.kt
+++ b/apps/android-tv/app/src/main/kotlin/com/iptvflix/androidtv/profiles/ProfileViewModel.kt
@@ -5,6 +5,7 @@ import android.util.Log
 import androidx.lifecycle.AndroidViewModel
 import androidx.lifecycle.viewModelScope
 import com.iptvflix.androidtv.App
+import com.iptvflix.androidtv.network.InteractionEventService
 import com.iptvflix.androidtv.network.ProfileResponse
 import kotlinx.coroutines.flow.MutableStateFlow
 import kotlinx.coroutines.flow.StateFlow
@@ -21,6 +22,7 @@ data class ProfileUiState(
 class ProfileViewModel(app: Application) : AndroidViewModel(app) {
 
     private val container get() = getApplication<App>()
+    private val interactionEvents by lazy { InteractionEventService(container.apiClient) }
 
     private val _uiState = MutableStateFlow(ProfileUiState())
     val uiState: StateFlow<ProfileUiState> = _uiState
@@ -51,6 +53,11 @@ class ProfileViewModel(app: Application) : AndroidViewModel(app) {
                 container.secureStorage.saveLastUsedProfileId(profileId)
                 result.profile
             }.onSuccess {
+                viewModelScope.launch {
+                    runCatching {
+                        interactionEvents.emit(mapOf("eventType" to "PROFILE_SELECTED", "clientType" to "android-tv"))
+                    }
+                }
                 onSuccess()
             }.onFailure { err ->
                 Log.e(TAG, "Failed to select profile $profileId", err)
diff --git a/apps/api/migrations/0041_t100_profile_interaction_events_v2.sql b/apps/api/migrations/0041_t100_profile_interaction_events_v2.sql
new file mode 100644
index 0000000..bd8f68a
--- /dev/null
+++ b/apps/api/migrations/0041_t100_profile_interaction_events_v2.sql
@@ -0,0 +1,79 @@
+-- T100: comprehensive profile interaction data capture
+-- Creates viewing_sessions, persons tables; extends profile_interaction_events, media_credits, profile_taste
+
+-- Create persons table for cast/crew recommendation features
+CREATE TABLE IF NOT EXISTS "persons" (
+  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
+  "tmdb_person_id" integer NOT NULL,
+  "name" text NOT NULL,
+  "profile_path" text,
+  "fetched_at" timestamptz NOT NULL DEFAULT now(),
+  CONSTRAINT "persons_tmdb_person_id_unique" UNIQUE ("tmdb_person_id")
+);--> statement-breakpoint
+
+-- Create viewing_sessions table for structured playback session summaries
+CREATE TABLE IF NOT EXISTS "viewing_sessions" (
+  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
+  "profile_id" uuid NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
+  "media_type" text NOT NULL,
+  "media_id" uuid NOT NULL,
+  "episode_id" uuid,
+  "started_at" timestamptz NOT NULL DEFAULT now(),
+  "ended_at" timestamptz,
+  "start_position_ms" integer NOT NULL DEFAULT 0,
+  "end_position_ms" integer,
+  "max_position_ms" integer NOT NULL DEFAULT 0,
+  "watched_ms_approx" integer NOT NULL DEFAULT 0,
+  "completed" boolean NOT NULL DEFAULT false,
+  "device_type" text,
+  "client_type" text,
+  "source_id" uuid,
+  "availability_id" uuid,
+  "created_at" timestamptz NOT NULL DEFAULT now()
+);--> statement-breakpoint
+CREATE INDEX IF NOT EXISTS "viewing_sessions_profile_media_idx" ON "viewing_sessions" ("profile_id", "media_id");--> statement-breakpoint
+CREATE INDEX IF NOT EXISTS "viewing_sessions_profile_started_idx" ON "viewing_sessions" ("profile_id", "started_at" DESC);--> statement-breakpoint
+
+-- Extend profile_interaction_events with new signal columns
+ALTER TABLE "profile_interaction_events" ADD COLUMN IF NOT EXISTS "series_id" uuid;--> statement-breakpoint
+ALTER TABLE "profile_interaction_events" ADD COLUMN IF NOT EXISTS "season_id" uuid;--> statement-breakpoint
+ALTER TABLE "profile_interaction_events" ADD COLUMN IF NOT EXISTS "season_number" integer;--> statement-breakpoint
+ALTER TABLE "profile_interaction_events" ADD COLUMN IF NOT EXISTS "progress_percent" integer;--> statement-breakpoint
+ALTER TABLE "profile_interaction_events" ADD COLUMN IF NOT EXISTS "shelf_concept_id" text;--> statement-breakpoint
+ALTER TABLE "profile_interaction_events" ADD COLUMN IF NOT EXISTS "shelf_position" integer;--> statement-breakpoint
+ALTER TABLE "profile_interaction_events" ADD COLUMN IF NOT EXISTS "item_position_in_shelf" integer;--> statement-breakpoint
+ALTER TABLE "profile_interaction_events" ADD COLUMN IF NOT EXISTS "search_query_normalized" text;--> statement-breakpoint
+ALTER TABLE "profile_interaction_events" ADD COLUMN IF NOT EXISTS "availability_id" uuid;--> statement-breakpoint
+ALTER TABLE "profile_interaction_events" ADD COLUMN IF NOT EXISTS "client_type" text;--> statement-breakpoint
+ALTER TABLE "profile_interaction_events" ADD COLUMN IF NOT EXISTS "app_version" text;--> statement-breakpoint
+ALTER TABLE "profile_interaction_events" ADD COLUMN IF NOT EXISTS "session_id" uuid REFERENCES "viewing_sessions"("id") ON DELETE SET NULL;--> statement-breakpoint
+ALTER TABLE "profile_interaction_events" ADD COLUMN IF NOT EXISTS "referrer_surface" text;--> statement-breakpoint
+ALTER TABLE "profile_interaction_events" ADD COLUMN IF NOT EXISTS "schema_version" integer NOT NULL DEFAULT 1;--> statement-breakpoint
+ALTER TABLE "profile_interaction_events" ADD COLUMN IF NOT EXISTS "idempotency_key" text;--> statement-breakpoint
+CREATE UNIQUE INDEX IF NOT EXISTS "profile_interaction_events_idempotency_key_unique" ON "profile_interaction_events" ("idempotency_key") WHERE "idempotency_key" IS NOT NULL;--> statement-breakpoint
+CREATE INDEX IF NOT EXISTS "profile_interaction_events_profile_event_idx" ON "profile_interaction_events" ("profile_id", "event_type");--> statement-breakpoint
+CREATE INDEX IF NOT EXISTS "profile_interaction_events_profile_media_idx" ON "profile_interaction_events" ("profile_id", "media_id");--> statement-breakpoint
+CREATE INDEX IF NOT EXISTS "profile_interaction_events_session_idx" ON "profile_interaction_events" ("session_id");--> statement-breakpoint
+CREATE INDEX IF NOT EXISTS "profile_interaction_events_occurred_at_idx" ON "profile_interaction_events" ("occurred_at" DESC);--> statement-breakpoint
+
+-- Extend media_credits with person normalization and role detail
+ALTER TABLE "media_credits" ADD COLUMN IF NOT EXISTS "tmdb_person_id" integer;--> statement-breakpoint
+ALTER TABLE "media_credits" ADD COLUMN IF NOT EXISTS "person_id" uuid REFERENCES "persons"("id") ON DELETE SET NULL;--> statement-breakpoint
+ALTER TABLE "media_credits" ADD COLUMN IF NOT EXISTS "department" text;--> statement-breakpoint
+ALTER TABLE "media_credits" ADD COLUMN IF NOT EXISTS "job" text;--> statement-breakpoint
+ALTER TABLE "media_credits" ADD COLUMN IF NOT EXISTS "is_director" boolean NOT NULL DEFAULT false;--> statement-breakpoint
+ALTER TABLE "media_credits" ADD COLUMN IF NOT EXISTS "is_creator" boolean NOT NULL DEFAULT false;--> statement-breakpoint
+
+-- Extend profile_taste with rich feature scores for recommendation models
+ALTER TABLE "profile_taste" ADD COLUMN IF NOT EXISTS "person_scores" jsonb NOT NULL DEFAULT '{}';--> statement-breakpoint
+ALTER TABLE "profile_taste" ADD COLUMN IF NOT EXISTS "person_meta" jsonb NOT NULL DEFAULT '{}';--> statement-breakpoint
+ALTER TABLE "profile_taste" ADD COLUMN IF NOT EXISTS "keyword_scores" jsonb NOT NULL DEFAULT '{}';--> statement-breakpoint
+ALTER TABLE "profile_taste" ADD COLUMN IF NOT EXISTS "franchise_scores" jsonb NOT NULL DEFAULT '{}';--> statement-breakpoint
+ALTER TABLE "profile_taste" ADD COLUMN IF NOT EXISTS "language_scores" jsonb NOT NULL DEFAULT '{}';--> statement-breakpoint
+ALTER TABLE "profile_taste" ADD COLUMN IF NOT EXISTS "country_scores" jsonb NOT NULL DEFAULT '{}';--> statement-breakpoint
+ALTER TABLE "profile_taste" ADD COLUMN IF NOT EXISTS "decade_scores" jsonb NOT NULL DEFAULT '{}';--> statement-breakpoint
+ALTER TABLE "profile_taste" ADD COLUMN IF NOT EXISTS "media_type_preferences" jsonb NOT NULL DEFAULT '{}';--> statement-breakpoint
+ALTER TABLE "profile_taste" ADD COLUMN IF NOT EXISTS "completion_rate" numeric;--> statement-breakpoint
+ALTER TABLE "profile_taste" ADD COLUMN IF NOT EXISTS "avg_progress_percent" integer;--> statement-breakpoint
+ALTER TABLE "profile_taste" ADD COLUMN IF NOT EXISTS "taste_version" integer NOT NULL DEFAULT 1;--> statement-breakpoint
+ALTER TABLE "profile_taste" ADD COLUMN IF NOT EXISTS "history_event_count" integer NOT NULL DEFAULT 0;
diff --git a/apps/api/src/config/retention.ts b/apps/api/src/config/retention.ts
new file mode 100644
index 0000000..f56609a
--- /dev/null
+++ b/apps/api/src/config/retention.ts
@@ -0,0 +1,33 @@
+export type RetentionClass = 'HIGH_VALUE' | 'STANDARD' | 'ANALYTICS' | 'SEARCH'
+
+export const EVENT_RETENTION: Record<string, RetentionClass> = {
+  // HIGH_VALUE — retain indefinitely
+  LIKED: 'HIGH_VALUE',
+  DISLIKED: 'HIGH_VALUE',
+  MY_LIST_ADDED: 'HIGH_VALUE',
+  MY_LIST_REMOVED: 'HIGH_VALUE',
+  PLAY_COMPLETED: 'HIGH_VALUE',
+  WATCHED_90_PERCENT: 'HIGH_VALUE',
+  RATED: 'HIGH_VALUE',
+  // ANALYTICS — retain 90 days
+  SHELF_IMPRESSION: 'ANALYTICS',
+  SHELF_ITEM_IMPRESSION: 'ANALYTICS',
+  HOME_OPENED: 'ANALYTICS',
+  // SEARCH — null query after 90 days, retain row
+  SEARCH_PERFORMED: 'SEARCH',
+  SEARCH_RESULT_IMPRESSION: 'SEARCH',
+  // STANDARD — retain 730 days (default)
+}
+
+export const RETENTION_DAYS: Record<RetentionClass, number | null> = {
+  HIGH_VALUE: null,   // indefinite
+  STANDARD: 730,
+  ANALYTICS: 90,
+  SEARCH: 730,        // row retained but query nulled at 90 days
+}
+
+export const SEARCH_QUERY_ANONYMIZE_DAYS = 90
+
+export function getRetentionClass(eventType: string): RetentionClass {
+  return EVENT_RETENTION[eventType] ?? 'STANDARD'
+}
diff --git a/apps/api/src/db/schema/index.ts b/apps/api/src/db/schema/index.ts
index 64fe3a0..09710d2 100644
--- a/apps/api/src/db/schema/index.ts
+++ b/apps/api/src/db/schema/index.ts
@@ -31,3 +31,5 @@ export * from './media-embeddings.js'
 export * from './media-segments.js'
 export * from './segment-selections.js'
 export * from './shelf-concepts.js'
+export * from './viewing-sessions.js'
+export * from './persons.js'
diff --git a/apps/api/src/db/schema/media-credits.ts b/apps/api/src/db/schema/media-credits.ts
index a2cd823..ff0f000 100644
--- a/apps/api/src/db/schema/media-credits.ts
+++ b/apps/api/src/db/schema/media-credits.ts
@@ -1,4 +1,4 @@
-import { pgTable, text, uuid, integer, timestamp } from 'drizzle-orm/pg-core'
+import { pgTable, text, uuid, integer, timestamp, boolean } from 'drizzle-orm/pg-core'
 
 export const mediaCredits = pgTable('media_credits', {
   id: uuid('id').primaryKey().defaultRandom(),
@@ -10,4 +10,11 @@ export const mediaCredits = pgTable('media_credits', {
   creditOrder: integer('credit_order').notNull(),
   profilePath: text('profile_path'),
   fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
+  // T100 additions
+  tmdbPersonId: integer('tmdb_person_id'),
+  personId: uuid('person_id'),
+  department: text('department'),
+  job: text('job'),
+  isDirector: boolean('is_director').notNull().default(false),
+  isCreator: boolean('is_creator').notNull().default(false),
 })
diff --git a/apps/api/src/db/schema/persons.ts b/apps/api/src/db/schema/persons.ts
new file mode 100644
index 0000000..92c67c2
--- /dev/null
+++ b/apps/api/src/db/schema/persons.ts
@@ -0,0 +1,9 @@
+import { pgTable, uuid, integer, text, timestamp, unique } from 'drizzle-orm/pg-core'
+
+export const persons = pgTable('persons', {
+  id: uuid('id').primaryKey().defaultRandom(),
+  tmdbPersonId: integer('tmdb_person_id').notNull(),
+  name: text('name').notNull(),
+  profilePath: text('profile_path'),
+  fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
+}, (t) => [unique('persons_tmdb_person_id_unique').on(t.tmdbPersonId)])
diff --git a/apps/api/src/db/schema/profile-interaction-events.ts b/apps/api/src/db/schema/profile-interaction-events.ts
index a4e8b27..3b9e614 100644
--- a/apps/api/src/db/schema/profile-interaction-events.ts
+++ b/apps/api/src/db/schema/profile-interaction-events.ts
@@ -1,4 +1,5 @@
-import { pgTable, uuid, text, timestamp, integer, jsonb, index } from 'drizzle-orm/pg-core'
+import { pgTable, uuid, text, timestamp, integer, jsonb, index, uniqueIndex } from 'drizzle-orm/pg-core'
+import { sql } from 'drizzle-orm'
 import { profiles } from './profiles.js'
 
 export const profileInteractionEvents = pgTable(
@@ -17,6 +18,31 @@ export const profileInteractionEvents = pgTable(
     deviceType: text('device_type'),
     sourceId: uuid('source_id'),
     metadataJson: jsonb('metadata_json'),
+    // T100 additions
+    seriesId: uuid('series_id'),
+    seasonId: uuid('season_id'),
+    seasonNumber: integer('season_number'),
+    progressPercent: integer('progress_percent'),
+    shelfConceptId: text('shelf_concept_id'),
+    shelfPosition: integer('shelf_position'),
+    itemPositionInShelf: integer('item_position_in_shelf'),
+    searchQueryNormalized: text('search_query_normalized'),
+    availabilityId: uuid('availability_id'),
+    clientType: text('client_type'),
+    appVersion: text('app_version'),
+    sessionId: uuid('session_id'),
+    referrerSurface: text('referrer_surface'),
+    schemaVersion: integer('schema_version').notNull().default(1),
+    idempotencyKey: text('idempotency_key'),
   },
-  (t) => [index('profile_interaction_events_profile_occurred_idx').on(t.profileId, t.occurredAt)],
+  (t) => [
+    index('profile_interaction_events_profile_occurred_idx').on(t.profileId, t.occurredAt),
+    index('profile_interaction_events_profile_event_idx').on(t.profileId, t.eventType),
+    index('profile_interaction_events_profile_media_idx').on(t.profileId, t.mediaId),
+    index('profile_interaction_events_session_idx').on(t.sessionId),
+    index('profile_interaction_events_occurred_at_idx').on(t.occurredAt),
+    uniqueIndex('profile_interaction_events_idempotency_key_unique')
+      .on(t.idempotencyKey)
+      .where(sql`${t.idempotencyKey} IS NOT NULL`),
+  ],
 )
diff --git a/apps/api/src/db/schema/profile-taste.ts b/apps/api/src/db/schema/profile-taste.ts
index ef881f0..a44dad1 100644
--- a/apps/api/src/db/schema/profile-taste.ts
+++ b/apps/api/src/db/schema/profile-taste.ts
@@ -1,4 +1,4 @@
-import { pgTable, uuid, jsonb, text, integer, timestamp } from 'drizzle-orm/pg-core'
+import { pgTable, uuid, jsonb, text, integer, numeric, timestamp } from 'drizzle-orm/pg-core'
 import { sql } from 'drizzle-orm'
 import { profiles } from './profiles.js'
 
@@ -12,4 +12,17 @@ export const profileTaste = pgTable('profile_taste', {
   negativeMediaIds: text('negative_media_ids').array().notNull().default(sql`'{}'`),
   signalCount: integer('signal_count').notNull().default(0),
   builtAt: timestamp('built_at', { withTimezone: true }).notNull(),
+  // T100 additions
+  personScores: jsonb('person_scores').notNull().default({}),
+  personMeta: jsonb('person_meta').notNull().default({}),
+  keywordScores: jsonb('keyword_scores').notNull().default({}),
+  franchiseScores: jsonb('franchise_scores').notNull().default({}),
+  languageScores: jsonb('language_scores').notNull().default({}),
+  countryScores: jsonb('country_scores').notNull().default({}),
+  decadeScores: jsonb('decade_scores').notNull().default({}),
+  mediaTypePreferences: jsonb('media_type_preferences').notNull().default({}),
+  completionRate: numeric('completion_rate'),
+  avgProgressPercent: integer('avg_progress_percent'),
+  tasteVersion: integer('taste_version').notNull().default(1),
+  historyEventCount: integer('history_event_count').notNull().default(0),
 })
diff --git a/apps/api/src/db/schema/viewing-sessions.ts b/apps/api/src/db/schema/viewing-sessions.ts
new file mode 100644
index 0000000..0265507
--- /dev/null
+++ b/apps/api/src/db/schema/viewing-sessions.ts
@@ -0,0 +1,29 @@
+import { pgTable, uuid, text, timestamp, integer, boolean, index } from 'drizzle-orm/pg-core'
+import { profiles } from './profiles.js'
+
+export const viewingSessions = pgTable(
+  'viewing_sessions',
+  {
+    id: uuid('id').primaryKey().defaultRandom(),
+    profileId: uuid('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
+    mediaType: text('media_type').notNull(),
+    mediaId: uuid('media_id').notNull(),
+    episodeId: uuid('episode_id'),
+    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
+    endedAt: timestamp('ended_at', { withTimezone: true }),
+    startPositionMs: integer('start_position_ms').notNull().default(0),
+    endPositionMs: integer('end_position_ms'),
+    maxPositionMs: integer('max_position_ms').notNull().default(0),
+    watchedMsApprox: integer('watched_ms_approx').notNull().default(0),
+    completed: boolean('completed').notNull().default(false),
+    deviceType: text('device_type'),
+    clientType: text('client_type'),
+    sourceId: uuid('source_id'),
+    availabilityId: uuid('availability_id'),
+    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
+  },
+  (t) => [
+    index('viewing_sessions_profile_media_idx').on(t.profileId, t.mediaId),
+    index('viewing_sessions_profile_started_idx').on(t.profileId, t.startedAt),
+  ],
+)
diff --git a/apps/api/src/index.ts b/apps/api/src/index.ts
index 3c1a69e..5047cd3 100644
--- a/apps/api/src/index.ts
+++ b/apps/api/src/index.ts
@@ -48,6 +48,7 @@ import { shelfConceptsRoutes } from './routes/shelf-concepts.js'
 import { failRunningJobsRoutes } from './routes/fail-running-jobs.js'
 import { episodeSegmentsRoutes } from './routes/episodes.js'
 import { segmentAdminRoutes } from './routes/segment-admin.js'
+import { adminRoutes } from './routes/admin.js'
 import { authenticate, requireProfile } from './plugins/auth.js'
 import { failInterruptedRuns } from './services/fail-interrupted-runs.js'
 import { runSeed } from './db/seed.js'
@@ -219,6 +220,7 @@ await app.register(async function protectedScope(protectedApp) {
   await protectedApp.register(recommendationLabRoutes)
   await protectedApp.register(shelfConceptsRoutes)
   await protectedApp.register(segmentAdminRoutes)
+  await protectedApp.register(adminRoutes)
 
   // Profile-scoped routes — also require a profileId in the session JWT
   await protectedApp.register(async function profileScope(profileApp) {
diff --git a/apps/api/src/providers/metadata/tmdb/client.ts b/apps/api/src/providers/metadata/tmdb/client.ts
index 2ee9c83..f4d9db1 100644
--- a/apps/api/src/providers/metadata/tmdb/client.ts
+++ b/apps/api/src/providers/metadata/tmdb/client.ts
@@ -274,6 +274,9 @@ export class TmdbClient implements MetadataProvider {
           role: 'cast' as const,
           order: c.order,
           profilePath: c.profile_path,
+          tmdbPersonId: c.id ?? null,
+          department: 'Acting',
+          job: null,
         }))
       const directors: ExternalCreditPerson[] = (raw.crew ?? [])
         .filter((c) => c.job === 'Director')
@@ -283,6 +286,9 @@ export class TmdbClient implements MetadataProvider {
           role: 'director' as const,
           order: i,
           profilePath: c.profile_path,
+          tmdbPersonId: c.id ?? null,
+          department: 'Directing',
+          job: 'Director',
         }))
       return [...cast, ...directors]
     } catch {
@@ -303,6 +309,9 @@ export class TmdbClient implements MetadataProvider {
           role: 'cast' as const,
           order: c.order,
           profilePath: c.profile_path,
+          tmdbPersonId: c.id ?? null,
+          department: 'Acting',
+          job: null,
         }))
       const creators: ExternalCreditPerson[] = (raw.crew ?? [])
         .filter((c) => c.job === 'Creator' || c.job === 'Executive Producer')
@@ -310,9 +319,12 @@ export class TmdbClient implements MetadataProvider {
         .map((c, i) => ({
           name: c.name,
           character: null,
-          role: 'director' as const,
+          role: 'creator' as const,
           order: i,
           profilePath: c.profile_path,
+          tmdbPersonId: c.id ?? null,
+          department: 'Writing',
+          job: c.job ?? null,
         }))
       return [...cast, ...creators]
     } catch {
diff --git a/apps/api/src/providers/metadata/tmdb/types.ts b/apps/api/src/providers/metadata/tmdb/types.ts
index a9dc081..b2b9a6b 100644
--- a/apps/api/src/providers/metadata/tmdb/types.ts
+++ b/apps/api/src/providers/metadata/tmdb/types.ts
@@ -138,6 +138,7 @@ export interface TmdbVideosResponse {
 }
 
 export interface TmdbCastMember {
+  id?: number
   name: string
   character: string
   order: number
@@ -145,6 +146,7 @@ export interface TmdbCastMember {
 }
 
 export interface TmdbCrewMember {
+  id?: number
   name: string
   job: string
   profile_path: string | null
@@ -156,6 +158,7 @@ export interface TmdbCreditsResponse {
 }
 
 export interface TmdbAggregateCastMember {
+  id?: number
   name: string
   roles: { character: string; episode_count: number }[]
   order: number
diff --git a/apps/api/src/providers/metadata/types.ts b/apps/api/src/providers/metadata/types.ts
index 7a6b839..652fc7b 100644
--- a/apps/api/src/providers/metadata/types.ts
+++ b/apps/api/src/providers/metadata/types.ts
@@ -79,9 +79,12 @@ export interface ExternalVideo {
 export interface ExternalCreditPerson {
   name: string
   character: string | null
-  role: 'cast' | 'director'
+  role: 'cast' | 'director' | 'creator'
   order: number
   profilePath: string | null
+  tmdbPersonId?: number | null
+  department?: string | null
+  job?: string | null
 }
 
 export interface ExternalSeasonEpisode {
diff --git a/apps/api/src/routes/admin.ts b/apps/api/src/routes/admin.ts
new file mode 100644
index 0000000..255ec5f
--- /dev/null
+++ b/apps/api/src/routes/admin.ts
@@ -0,0 +1,125 @@
+import type { FastifyInstance } from 'fastify'
+import { and, count, countDistinct, desc, gte, inArray, isNotNull, lt, sql } from 'drizzle-orm'
+import { db } from '../db/client.js'
+import { profileInteractionEvents, profileTaste, profiles } from '../db/schema/index.js'
+import { runCompaction, getRetentionStats } from '../services/retention-service.js'
+
+export async function adminRoutes(app: FastifyInstance): Promise<void> {
+  // Events per day (last 30 days), top event types, distinct profile count, total count
+  app.get('/admin/interaction-stats', async (_request, reply) => {
+    const since = new Date(Date.now() - 30 * 86_400_000)
+
+    const [dailyRows, topTypeRows, profileCountRow, totalRow] = await Promise.all([
+      db
+        .select({
+          day: sql<string>`date_trunc('day', ${profileInteractionEvents.occurredAt})::date::text`,
+          count: count(),
+        })
+        .from(profileInteractionEvents)
+        .where(gte(profileInteractionEvents.occurredAt, since))
+        .groupBy(sql`date_trunc('day', ${profileInteractionEvents.occurredAt})`)
+        .orderBy(sql`date_trunc('day', ${profileInteractionEvents.occurredAt}) DESC`),
+      db
+        .select({ eventType: profileInteractionEvents.eventType, count: count() })
+        .from(profileInteractionEvents)
+        .groupBy(profileInteractionEvents.eventType)
+        .orderBy(desc(count()))
+        .limit(10),
+      db
+        .select({ c: countDistinct(profileInteractionEvents.profileId) })
+        .from(profileInteractionEvents),
+      db.select({ c: count() }).from(profileInteractionEvents),
+    ])
+
+    return reply.send({
+      eventsPerDay: dailyRows,
+      topEventTypes: topTypeRows,
+      distinctProfiles: Number(profileCountRow[0]?.c ?? 0),
+      totalEvents: Number(totalRow[0]?.c ?? 0),
+    })
+  })
+
+  // Taste coverage: profiles with computed taste, those with enough signal, oldest builtAt
+  app.get('/admin/taste-stats', async (_request, reply) => {
+    const [tasteRows, activeProfileRow] = await Promise.all([
+      db
+        .select({
+          profileId: profileTaste.profileId,
+          signalCount: profileTaste.signalCount,
+          builtAt: profileTaste.builtAt,
+          historyEventCount: profileTaste.historyEventCount,
+        })
+        .from(profileTaste),
+      db.select({ c: count() }).from(profiles),
+    ])
+
+    const totalActive = Number(activeProfileRow[0]?.c ?? 0)
+    const withTaste = tasteRows.length
+    const withEnoughSignal = tasteRows.filter((r) => r.signalCount >= 5).length
+    const oldest = tasteRows.reduce(
+      (acc, r) => (!acc || r.builtAt < acc ? r.builtAt : acc),
+      null as Date | null,
+    )
+
+    return reply.send({
+      profilesWithTaste: withTaste,
+      profilesWithEnoughSignal: withEnoughSignal,
+      totalActiveProfiles: totalActive,
+      coveragePercent: totalActive > 0 ? Math.round((withTaste / totalActive) * 100) : 0,
+      oldestTasteBuiltAt: oldest?.toISOString() ?? null,
+    })
+  })
+
+  // Health: duplicate idempotency rejections, milestone coverage, zero-event profiles
+  app.get('/admin/interaction-health', async (_request, reply) => {
+    const [milestoneRows, startedRows, zeroEventRows, totalProfileRow] = await Promise.all([
+      db
+        .select({ profileId: profileInteractionEvents.profileId })
+        .from(profileInteractionEvents)
+        .where(
+          inArray(profileInteractionEvents.eventType, [
+            'WATCHED_10_PERCENT', 'WATCHED_25_PERCENT', 'WATCHED_50_PERCENT',
+            'WATCHED_75_PERCENT', 'WATCHED_90_PERCENT',
+          ]),
+        )
+        .groupBy(profileInteractionEvents.profileId),
+      db
+        .select({ profileId: profileInteractionEvents.profileId })
+        .from(profileInteractionEvents)
+        .where(sql`${profileInteractionEvents.eventType} = 'PLAY_STARTED'`)
+        .groupBy(profileInteractionEvents.profileId),
+      db
+        .select({ profileId: profiles.id })
+        .from(profiles)
+        .leftJoin(profileInteractionEvents, sql`${profiles.id} = ${profileInteractionEvents.profileId}`)
+        .groupBy(profiles.id)
+        .having(sql`count(${profileInteractionEvents.id}) = 0`),
+      db.select({ c: count() }).from(profiles),
+    ])
+
+    const startedSet = new Set(startedRows.map((r) => r.profileId))
+    const milestoneSet = new Set(milestoneRows.map((r) => r.profileId))
+    const profilesWithStartedAndMilestone = [...startedSet].filter((id) => milestoneSet.has(id)).length
+
+    return reply.send({
+      profilesWithZeroEvents: zeroEventRows.length,
+      totalProfiles: Number(totalProfileRow[0]?.c ?? 0),
+      milestoneCoveragePercent:
+        startedSet.size > 0
+          ? Math.round((profilesWithStartedAndMilestone / startedSet.size) * 100)
+          : 0,
+    })
+  })
+
+  // Retention stats: events past retention window not yet compacted
+  app.get('/admin/retention-stats', async (_request, reply) => {
+    const stats = await getRetentionStats()
+    return reply.send(stats)
+  })
+
+  // Trigger compaction manually
+  app.post('/admin/retention-compact', async (_request, reply) => {
+    const result = await runCompaction()
+    return reply.send(result)
+  })
+}
diff --git a/apps/api/src/routes/interaction-events.ts b/apps/api/src/routes/interaction-events.ts
index 9487104..80bbb05 100644
--- a/apps/api/src/routes/interaction-events.ts
+++ b/apps/api/src/routes/interaction-events.ts
@@ -1,6 +1,7 @@
 import type { FastifyInstance } from 'fastify'
-import type { InteractionEventBody } from '@iptvflix/api-contracts'
-import { recordEvent, ALLOWED_EVENT_TYPES } from '../services/interaction-event-service.js'
+import type { InteractionEventBody, InteractionEventBatch } from '@iptvflix/api-contracts'
+import { recordEvent, recordEventBatch, ALLOWED_EVENT_TYPES } from '../services/interaction-event-service.js'
+import { openSession, closeSession } from '../services/viewing-session-service.js'
 
 export async function interactionEventsRoutes(app: FastifyInstance): Promise<void> {
   app.post<{ Body: InteractionEventBody }>('/interaction-events', async (request, reply) => {
@@ -20,4 +21,54 @@ export async function interactionEventsRoutes(app: FastifyInstance): Promise<voi
     await recordEvent(request.profileId!, body)
     return reply.status(204).send()
   })
+
+  // Batch endpoint — processes up to 50 events best-effort, never returns 5xx for analytics failures.
+  // On PLAY_STARTED, opens a viewing session and returns sessionId.
+  app.post<{ Body: InteractionEventBatch }>('/interaction-events/batch', async (request, reply) => {
+    const body = request.body ?? {}
+    const events: InteractionEventBody[] = Array.isArray(body.events) ? body.events.slice(0, 50) : []
+
+    let sessionId: string | null = null
+
+    for (const event of events) {
+      try {
+        if (!event.eventType || !ALLOWED_EVENT_TYPES.has(event.eventType)) continue
+
+        // Auto-open viewing session on PLAY_STARTED
+        if (event.eventType === 'PLAY_STARTED' && event.mediaId && event.mediaType) {
+          try {
+            sessionId = await openSession({
+              profileId: request.profileId!,
+              mediaType: event.mediaType,
+              mediaId: event.mediaId,
+              episodeId: event.episodeId ?? null,
+              startPositionMs: event.positionMs ?? 0,
+              deviceType: event.deviceType ?? null,
+              clientType: event.clientType ?? null,
+              sourceId: event.sourceId ?? null,
+              availabilityId: event.availabilityId ?? null,
+            })
+            event.sessionId = sessionId
+          } catch (err) {
+            console.warn('[interaction-events] openSession failed:', err)
+          }
+        }
+
+        // Auto-close viewing session on PLAY_COMPLETED or PLAY_ABANDONED
+        if ((event.eventType === 'PLAY_COMPLETED' || event.eventType === 'PLAY_ABANDONED') && event.sessionId) {
+          try {
+            await closeSession(event.sessionId, event.eventType === 'PLAY_COMPLETED')
+          } catch (err) {
+            console.warn('[interaction-events] closeSession failed:', err)
+          }
+        }
+
+        await recordEvent(request.profileId!, event)
+      } catch (err) {
+        console.warn('[interaction-events] batch item error:', event.eventType, err)
+      }
+    }
+
+    return reply.status(200).send({ sessionId })
+  })
 }
diff --git a/apps/api/src/scripts/backfill-interaction-events.ts b/apps/api/src/scripts/backfill-interaction-events.ts
new file mode 100644
index 0000000..0ca830e
--- /dev/null
+++ b/apps/api/src/scripts/backfill-interaction-events.ts
@@ -0,0 +1,112 @@
+/**
+ * One-shot backfill: creates synthetic interaction events from existing profile behavioral data.
+ * All rows are tagged with schemaVersion=0 and metadataJson={origin:"backfill"}.
+ * Run with: npx tsx src/scripts/backfill-interaction-events.ts
+ */
+import 'dotenv/config'
+import { db } from '../db/client.js'
+import { profileInteractionEvents, viewingProgress, watchlist, explicitFeedback } from '../db/schema/index.js'
+import { sql } from 'drizzle-orm'
+
+const BACKFILL_META = { origin: 'backfill' }
+const SCHEMA_VERSION = 0
+
+async function run(): Promise<void> {
+  console.log('[backfill] starting interaction event backfill')
+
+  // --- viewing_progress → PLAY_COMPLETED or PLAY_STARTED ---
+  const progressRows = await db.select().from(viewingProgress)
+  let progressInserted = 0
+  for (const vp of progressRows) {
+    if (vp.durationSeconds <= 0) continue
+    const ratio = vp.progressSeconds / vp.durationSeconds
+    if (ratio < 0.05) continue
+
+    const eventType = ratio >= 0.9 ? 'PLAY_COMPLETED' : 'PLAY_STARTED'
+    const mediaType = vp.mediaType === 'MOVIE' ? 'MOVIE' : 'EPISODE'
+    const idempotencyKey = `backfill:${vp.profileId}:${vp.mediaId}:${eventType}`
+
+    try {
+      await db
+        .insert(profileInteractionEvents)
+        .values({
+          profileId: vp.profileId,
+          mediaType,
+          mediaId: vp.mediaId,
+          eventType,
+          occurredAt: vp.lastWatchedAt,
+          progressPercent: Math.round(ratio * 100),
+          schemaVersion: SCHEMA_VERSION,
+          metadataJson: BACKFILL_META,
+          idempotencyKey,
+        })
+        .onConflictDoNothing()
+      progressInserted++
+    } catch (err) {
+      console.warn(`[backfill] skip progress ${vp.id}:`, err)
+    }
+  }
+  console.log(`[backfill] viewing_progress: ${progressInserted}/${progressRows.length} inserted`)
+
+  // --- watchlist → MY_LIST_ADDED ---
+  const watchlistRows = await db.select().from(watchlist)
+  let watchlistInserted = 0
+  for (const wl of watchlistRows) {
+    const idempotencyKey = `backfill:${wl.profileId}:${wl.mediaId}:MY_LIST_ADDED`
+    try {
+      await db
+        .insert(profileInteractionEvents)
+        .values({
+          profileId: wl.profileId,
+          mediaType: wl.mediaType,
+          mediaId: wl.mediaId,
+          eventType: 'MY_LIST_ADDED',
+          occurredAt: wl.addedAt,
+          schemaVersion: SCHEMA_VERSION,
+          metadataJson: BACKFILL_META,
+          idempotencyKey,
+        })
+        .onConflictDoNothing()
+      watchlistInserted++
+    } catch (err) {
+      console.warn(`[backfill] skip watchlist ${wl.id}:`, err)
+    }
+  }
+  console.log(`[backfill] watchlist: ${watchlistInserted}/${watchlistRows.length} inserted`)
+
+  // --- explicit_feedback → LIKED | DISLIKED ---
+  const feedbackRows = await db.select().from(explicitFeedback)
+  let feedbackInserted = 0
+  for (const fb of feedbackRows) {
+    if (fb.feedback !== 'LIKE' && fb.feedback !== 'DISLIKE') continue
+    const eventType = fb.feedback === 'LIKE' ? 'LIKED' : 'DISLIKED'
+    const idempotencyKey = `backfill:${fb.profileId}:${fb.mediaId}:${eventType}`
+    try {
+      await db
+        .insert(profileInteractionEvents)
+        .values({
+          profileId: fb.profileId,
+          mediaType: fb.mediaType,
+          mediaId: fb.mediaId,
+          eventType,
+          occurredAt: fb.createdAt,
+          schemaVersion: SCHEMA_VERSION,
+          metadataJson: BACKFILL_META,
+          idempotencyKey,
+        })
+        .onConflictDoNothing()
+      feedbackInserted++
+    } catch (err) {
+      console.warn(`[backfill] skip feedback ${fb.id}:`, err)
+    }
+  }
+  console.log(`[backfill] explicit_feedback: ${feedbackInserted}/${feedbackRows.length} inserted`)
+
+  console.log('[backfill] done')
+  process.exit(0)
+}
+
+run().catch((err) => {
+  console.error('[backfill] fatal error:', err)
+  process.exit(1)
+})
diff --git a/apps/api/src/services/interaction-event-service.ts b/apps/api/src/services/interaction-event-service.ts
index 3f47d9c..2229c5c 100644
--- a/apps/api/src/services/interaction-event-service.ts
+++ b/apps/api/src/services/interaction-event-service.ts
@@ -1,30 +1,85 @@
+import { eq, sql } from 'drizzle-orm'
 import { db } from '../db/client.js'
 import { profileInteractionEvents } from '../db/schema/index.js'
 import type { InteractionEventBody } from '@iptvflix/api-contracts'
 
 export const ALLOWED_EVENT_TYPES = new Set([
+  // Discovery / browsing
+  'HOME_OPENED',
+  'SHELF_IMPRESSION',
+  'SHELF_VIEWED',
+  'SHELF_ITEM_IMPRESSION',
+  'SHELF_ITEM_OPENED',
   'DETAIL_OPENED',
+  'TRAILER_PREVIEW_STARTED',
+  'TRAILER_PREVIEW_COMPLETED',
+  'PREVIEW_STARTED',
+  'SEARCH_PERFORMED',
+  'SEARCH_RESULT_IMPRESSION',
+  'SEARCH_RESULT_OPENED',
+  // Intent / explicit preference
+  'MY_LIST_ADDED',
+  'MY_LIST_REMOVED',
+  'LIKED',
+  'DISLIKED',
+  'RATED',
+  'CONTINUE_WATCHING_DISMISSED',
+  'REMINDER_ADDED',
+  // Playback
   'PLAY_STARTED',
   'PLAY_RESUMED',
   'PLAY_PAUSED',
+  'PLAY_STOPPED',
   'PLAY_COMPLETED',
   'PLAY_ABANDONED',
-  'MY_LIST_ADDED',
-  'MY_LIST_REMOVED',
-  'LIKED',
-  'DISLIKED',
-  'SEARCH_PERFORMED',
-  'SEARCH_RESULT_OPENED',
-  'SHELF_IMPRESSION',
-  'SHELF_ITEM_OPENED',
-  'PREVIEW_STARTED',
+  'SEEK_FORWARD',
+  'SEEK_BACKWARD',
+  'SKIP_INTRO',
+  'SKIP_RECAP',
+  'SKIP_OUTRO',
+  'NEXT_EPISODE_AUTO',
+  'NEXT_EPISODE_MANUAL',
   'SOURCE_SELECTED',
+  'AUDIO_TRACK_SELECTED',
+  'SUBTITLE_TRACK_SELECTED',
+  'PLAYBACK_SPEED_CHANGED',
+  'WATCHED_10_PERCENT',
+  'WATCHED_25_PERCENT',
+  'WATCHED_50_PERCENT',
+  'WATCHED_75_PERCENT',
+  'WATCHED_90_PERCENT',
+  // Profile / settings
+  'PROFILE_SELECTED',
+  'PROFILE_PREFERENCE_CHANGED',
+  'NEVER_STOP_ENABLED',
+  'NEVER_STOP_DISABLED',
 ])
 
+const MAX_METADATA_BYTES = 4096
+
+function validateMetadata(meta: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
+  if (!meta) return null
+  const json = JSON.stringify(meta)
+  if (json.length > MAX_METADATA_BYTES) {
+    console.warn('[interaction-events] metadataJson exceeds 4KB, truncating to null')
+    return null
+  }
+  return meta
+}
+
 export async function recordEvent(
   profileId: string,
   event: Omit<InteractionEventBody, 'profileId'>,
 ): Promise<void> {
+  const key = event.idempotencyKey ?? null
+  if (key) {
+    const [existing] = await db
+      .select({ id: profileInteractionEvents.id })
+      .from(profileInteractionEvents)
+      .where(eq(profileInteractionEvents.idempotencyKey, key))
+    if (existing) return
+  }
+
   await db.insert(profileInteractionEvents).values({
     profileId,
     mediaType: event.mediaType ?? null,
@@ -37,6 +92,35 @@ export async function recordEvent(
     shelfId: event.shelfId ?? null,
     deviceType: event.deviceType ?? null,
     sourceId: event.sourceId ?? null,
-    metadataJson: event.metadataJson ?? null,
+    metadataJson: validateMetadata(event.metadataJson),
+    seriesId: event.seriesId ?? null,
+    seasonId: event.seasonId ?? null,
+    seasonNumber: event.seasonNumber ?? null,
+    progressPercent: event.progressPercent ?? null,
+    shelfConceptId: event.shelfConceptId ?? null,
+    shelfPosition: event.shelfPosition ?? null,
+    itemPositionInShelf: event.itemPositionInShelf ?? null,
+    searchQueryNormalized: event.searchQueryNormalized ?? null,
+    availabilityId: event.availabilityId ?? null,
+    clientType: event.clientType ?? null,
+    appVersion: event.appVersion ?? null,
+    sessionId: event.sessionId ?? null,
+    referrerSurface: event.referrerSurface ?? null,
+    schemaVersion: event.schemaVersion ?? 1,
+    idempotencyKey: key,
   })
 }
+
+export async function recordEventBatch(
+  profileId: string,
+  events: Omit<InteractionEventBody, 'profileId'>[],
+): Promise<void> {
+  for (const event of events) {
+    try {
+      if (!event.eventType || !ALLOWED_EVENT_TYPES.has(event.eventType)) continue
+      await recordEvent(profileId, event)
+    } catch (err) {
+      console.warn('[interaction-events] batch item failed:', event.eventType, err)
+    }
+  }
+}
diff --git a/apps/api/src/services/metadata-enrichment-service.ts b/apps/api/src/services/metadata-enrichment-service.ts
index de0e9b4..1c98c30 100644
--- a/apps/api/src/services/metadata-enrichment-service.ts
+++ b/apps/api/src/services/metadata-enrichment-service.ts
@@ -9,6 +9,7 @@ import { genres } from '../db/schema/genres.js'
 import { collections } from '../db/schema/collections.js'
 import { mediaVideos } from '../db/schema/media-videos.js'
 import { mediaCredits } from '../db/schema/media-credits.js'
+import { persons } from '../db/schema/persons.js'
 import type { MetadataProvider, ExternalVideo, ExternalCreditPerson, ExternalSeasonEpisode, ExternalMovieMetadata, ExternalSeriesMetadata } from '../providers/metadata/types.js'
 
 type Db = PostgresJsDatabase<typeof schema>
@@ -530,8 +531,32 @@ export class MetadataEnrichmentService {
 
     if (credits.length === 0) return
 
+    // Upsert persons for any credit that carries a TMDB person ID
+    const personIdByTmdbId = new Map<number, string>()
+    const creditsWithPersonId = await Promise.all(
+      credits.map(async (c) => {
+        if (!c.tmdbPersonId) return { ...c, resolvedPersonId: null }
+        const cached = personIdByTmdbId.get(c.tmdbPersonId)
+        if (cached) return { ...c, resolvedPersonId: cached }
+        const [row] = await this.db
+          .insert(persons)
+          .values({
+            tmdbPersonId: c.tmdbPersonId,
+            name: c.name,
+            profilePath: c.profilePath ?? null,
+          })
+          .onConflictDoUpdate({
+            target: persons.tmdbPersonId,
+            set: { name: c.name, profilePath: c.profilePath ?? null },
+          })
+          .returning({ id: persons.id })
+        if (row) personIdByTmdbId.set(c.tmdbPersonId, row.id)
+        return { ...c, resolvedPersonId: row?.id ?? null }
+      }),
+    )
+
     await this.db.insert(mediaCredits).values(
-      credits.map((c) => ({
+      creditsWithPersonId.map((c) => ({
         mediaType,
         mediaId,
         role: c.role,
@@ -539,6 +564,12 @@ export class MetadataEnrichmentService {
         character: c.character,
         creditOrder: c.order,
         profilePath: c.profilePath,
+        tmdbPersonId: c.tmdbPersonId ?? null,
+        personId: c.resolvedPersonId ?? null,
+        department: c.department ?? null,
+        job: c.job ?? null,
+        isDirector: c.role === 'director',
+        isCreator: c.role === 'creator',
       })),
     )
   }
diff --git a/apps/api/src/services/playback-milestone-service.ts b/apps/api/src/services/playback-milestone-service.ts
new file mode 100644
index 0000000..af85022
--- /dev/null
+++ b/apps/api/src/services/playback-milestone-service.ts
@@ -0,0 +1,57 @@
+import { eq } from 'drizzle-orm'
+import { db } from '../db/client.js'
+import { profileInteractionEvents } from '../db/schema/index.js'
+
+export type PlaybackMilestone =
+  | 'WATCHED_10_PERCENT'
+  | 'WATCHED_25_PERCENT'
+  | 'WATCHED_50_PERCENT'
+  | 'WATCHED_75_PERCENT'
+  | 'WATCHED_90_PERCENT'
+
+export const MILESTONE_THRESHOLDS: Record<PlaybackMilestone, number> = {
+  WATCHED_10_PERCENT: 10,
+  WATCHED_25_PERCENT: 25,
+  WATCHED_50_PERCENT: 50,
+  WATCHED_75_PERCENT: 75,
+  WATCHED_90_PERCENT: 90,
+}
+
+export function milestoneForPercent(percent: number): PlaybackMilestone | null {
+  if (percent >= 90) return 'WATCHED_90_PERCENT'
+  if (percent >= 75) return 'WATCHED_75_PERCENT'
+  if (percent >= 50) return 'WATCHED_50_PERCENT'
+  if (percent >= 25) return 'WATCHED_25_PERCENT'
+  if (percent >= 10) return 'WATCHED_10_PERCENT'
+  return null
+}
+
+export async function emitMilestoneIfNew(
+  profileId: string,
+  mediaId: string,
+  sessionId: string,
+  milestone: PlaybackMilestone,
+  positionMs?: number,
+): Promise<void> {
+  const idempotencyKey = `${profileId}:${mediaId}:${sessionId}:${milestone}`
+
+  const [existing] = await db
+    .select({ id: profileInteractionEvents.id })
+    .from(profileInteractionEvents)
+    .where(eq(profileInteractionEvents.idempotencyKey, idempotencyKey))
+
+  if (existing) return
+
+  await db.insert(profileInteractionEvents).values({
+    profileId,
+    mediaId,
+    mediaType: 'MOVIE',
+    eventType: milestone,
+    occurredAt: new Date(),
+    sessionId,
+    positionMs: positionMs ?? null,
+    progressPercent: MILESTONE_THRESHOLDS[milestone],
+    schemaVersion: 1,
+    idempotencyKey,
+  })
+}
diff --git a/apps/api/src/services/profile-taste-service.ts b/apps/api/src/services/profile-taste-service.ts
index 367c7ed..8e47c22 100644
--- a/apps/api/src/services/profile-taste-service.ts
+++ b/apps/api/src/services/profile-taste-service.ts
@@ -1,4 +1,4 @@
-import { eq } from 'drizzle-orm'
+import { count, eq, sql } from 'drizzle-orm'
 import { db } from '../db/client.js'
 import {
   profileTaste,
@@ -9,6 +9,10 @@ import {
   movieGenres,
   seriesGenres,
   genres,
+  movies,
+  series,
+  mediaCredits,
+  profileInteractionEvents,
 } from '../db/schema/index.js'
 import type { ProfileTaste, GenreScore } from '@iptvflix/api-contracts'
 
@@ -47,6 +51,19 @@ function buildOutput(
   negativeMediaIds: string[],
   signalCount: number,
   builtAt: Date,
+  extra: {
+    personScores: Record<string, number>
+    personMeta: Record<string, { name: string; role: string }>
+    keywordScores: Record<string, number>
+    franchiseScores: Record<string, number>
+    languageScores: Record<string, number>
+    countryScores: Record<string, number>
+    decadeScores: Record<string, number>
+    mediaTypePreferences: Record<string, number>
+    completionRate: number | null
+    historyEventCount: number
+    tasteVersion: number
+  },
 ): ProfileTaste {
   const genreScores: GenreScore[] = Object.entries(genreScoresMap)
     .filter(([, score]) => score !== 0)
@@ -68,6 +85,11 @@ function buildOutput(
   }
 }
 
+function decadeKey(year: number | null): string | null {
+  if (!year) return null
+  return `${Math.floor(year / 10) * 10}s`
+}
+
 export async function buildTaste(profileId: string): Promise<ProfileTaste> {
   const now = new Date()
 
@@ -81,6 +103,14 @@ export async function buildTaste(profileId: string): Promise<ProfileTaste> {
   const genreMetaMap: Record<string, { slug: string; name: string }> = {}
   const positiveSet = new Set<string>()
   const negativeSet = new Set<string>()
+  const personScores: Record<string, number> = {}
+  const personMeta: Record<string, { name: string; role: string }> = {}
+  const keywordScores: Record<string, number> = {}
+  const franchiseScores: Record<string, number> = {}
+  const languageScores: Record<string, number> = {}
+  const countryScores: Record<string, number> = {}
+  const decadeScores: Record<string, number> = {}
+  const mediaTypeCounts: Record<string, number> = {}
   let signalCount = 0
 
   function accumulate(genreRows: Array<{ id: string; slug: string; name: string }>, weight: number): void {
@@ -90,10 +120,102 @@ export async function buildTaste(profileId: string): Promise<ProfileTaste> {
     }
   }
 
+  async function accumulateMediaFeatures(
+    mediaType: 'MOVIE' | 'SERIES',
+    mediaId: string,
+    weight: number,
+  ): Promise<void> {
+    // genre
+    accumulate(await loadGenres(mediaType, mediaId), weight)
+
+    // media type preference
+    mediaTypeCounts[mediaType] = (mediaTypeCounts[mediaType] ?? 0) + weight
+
+    if (mediaType === 'MOVIE') {
+      const [movie] = await db
+        .select({
+          keywords: movies.keywords,
+          originalLanguage: movies.originalLanguage,
+          productionCountries: movies.productionCountries,
+          year: movies.year,
+          collectionId: movies.collectionId,
+        })
+        .from(movies)
+        .where(eq(movies.id, mediaId))
+      if (movie) {
+        // keywords
+        if (Array.isArray(movie.keywords)) {
+          for (const kw of movie.keywords as string[]) {
+            keywordScores[kw] = (keywordScores[kw] ?? 0) + weight
+          }
+        }
+        // language
+        if (movie.originalLanguage) {
+          languageScores[movie.originalLanguage] = (languageScores[movie.originalLanguage] ?? 0) + weight
+        }
+        // countries
+        if (Array.isArray(movie.productionCountries)) {
+          for (const c of movie.productionCountries as string[]) {
+            countryScores[c] = (countryScores[c] ?? 0) + weight
+          }
+        }
+        // decade
+        const dk = decadeKey(movie.year)
+        if (dk) decadeScores[dk] = (decadeScores[dk] ?? 0) + weight
+        // franchise
+        if (movie.collectionId) {
+          franchiseScores[movie.collectionId] = (franchiseScores[movie.collectionId] ?? 0) + weight
+        }
+      }
+    } else {
+      const [s] = await db
+        .select({
+          keywords: series.keywords,
+          originalLanguage: series.originalLanguage,
+          productionCountries: series.productionCountries,
+          firstAirYear: series.firstAirYear,
+        })
+        .from(series)
+        .where(eq(series.id, mediaId))
+      if (s) {
+        if (Array.isArray(s.keywords)) {
+          for (const kw of s.keywords as string[]) {
+            keywordScores[kw] = (keywordScores[kw] ?? 0) + weight
+          }
+        }
+        if (s.originalLanguage) {
+          languageScores[s.originalLanguage] = (languageScores[s.originalLanguage] ?? 0) + weight
+        }
+        if (Array.isArray(s.productionCountries)) {
+          for (const c of s.productionCountries as string[]) {
+            countryScores[c] = (countryScores[c] ?? 0) + weight
+          }
+        }
+        const dk = decadeKey(s.firstAirYear)
+        if (dk) decadeScores[dk] = (decadeScores[dk] ?? 0) + weight
+      }
+    }
+
+    // credits — persons
+    const credits = await db
+      .select({
+        personId: mediaCredits.personId,
+        name: mediaCredits.name,
+        role: mediaCredits.role,
+      })
+      .from(mediaCredits)
+      .where(eq(mediaCredits.mediaId, mediaId))
+    for (const c of credits) {
+      if (!c.personId) continue
+      personScores[c.personId] = (personScores[c.personId] ?? 0) + weight
+      personMeta[c.personId] = { name: c.name, role: c.role }
+    }
+  }
+
   for (const fb of feedbackRows) {
     const weight = SIGNAL_WEIGHTS[fb.feedback as keyof typeof SIGNAL_WEIGHTS]
     const mediaType = fb.mediaType as 'MOVIE' | 'SERIES'
-    accumulate(await loadGenres(mediaType, fb.mediaId), weight)
+    await accumulateMediaFeatures(mediaType, fb.mediaId, weight)
     if (fb.feedback === 'LIKE') {
       positiveSet.add(fb.mediaId)
     } else {
@@ -126,17 +248,46 @@ export async function buildTaste(profileId: string): Promise<ProfileTaste> {
       resolvedId = ep.seriesId
     }
 
-    accumulate(await loadGenres(resolvedType, resolvedId), weight)
+    await accumulateMediaFeatures(resolvedType, resolvedId, weight)
     if (isCompleted) positiveSet.add(resolvedId)
     signalCount++
   }
 
   for (const wl of watchlistRows) {
     const mediaType = wl.mediaType as 'MOVIE' | 'SERIES'
-    accumulate(await loadGenres(mediaType, wl.mediaId), SIGNAL_WEIGHTS.WATCHLIST)
+    await accumulateMediaFeatures(mediaType, wl.mediaId, SIGNAL_WEIGHTS.WATCHLIST)
     signalCount++
   }
 
+  // compute completionRate from event history
+  const [[startedRow], [completedRow], [eventCountRow]] = await Promise.all([
+    db
+      .select({ c: count() })
+      .from(profileInteractionEvents)
+      .where(
+        sql`${profileInteractionEvents.profileId} = ${profileId} AND ${profileInteractionEvents.eventType} = 'PLAY_STARTED'`,
+      ),
+    db
+      .select({ c: count() })
+      .from(profileInteractionEvents)
+      .where(
+        sql`${profileInteractionEvents.profileId} = ${profileId} AND ${profileInteractionEvents.eventType} = 'PLAY_COMPLETED'`,
+      ),
+    db
+      .select({ c: count() })
+      .from(profileInteractionEvents)
+      .where(eq(profileInteractionEvents.profileId, profileId)),
+  ])
+  const startedCount = Number(startedRow?.c ?? 0)
+  const completedCount = Number(completedRow?.c ?? 0)
+  const historyEventCount = Number(eventCountRow?.c ?? 0)
+  const completionRate = startedCount > 0 ? completedCount / startedCount : null
+
+  const mediaTypePreferences: Record<string, number> = {}
+  for (const [mt, w] of Object.entries(mediaTypeCounts)) {
+    mediaTypePreferences[mt.toLowerCase()] = w
+  }
+
   const sortedPositive = [...positiveSet].sort()
   const sortedNegative = [...negativeSet].sort()
 
@@ -150,6 +301,17 @@ export async function buildTaste(profileId: string): Promise<ProfileTaste> {
       negativeMediaIds: sortedNegative,
       signalCount,
       builtAt: now,
+      personScores,
+      personMeta,
+      keywordScores,
+      franchiseScores,
+      languageScores,
+      countryScores,
+      decadeScores,
+      mediaTypePreferences,
+      completionRate: completionRate !== null ? String(completionRate) : null,
+      historyEventCount,
+      tasteVersion: 1,
     })
     .onConflictDoUpdate({
       target: profileTaste.profileId,
@@ -160,10 +322,33 @@ export async function buildTaste(profileId: string): Promise<ProfileTaste> {
         negativeMediaIds: sortedNegative,
         signalCount,
         builtAt: now,
+        personScores,
+        personMeta,
+        keywordScores,
+        franchiseScores,
+        languageScores,
+        countryScores,
+        decadeScores,
+        mediaTypePreferences,
+        completionRate: completionRate !== null ? String(completionRate) : null,
+        historyEventCount,
+        tasteVersion: sql`${profileTaste.tasteVersion} + 1`,
       },
     })
 
-  return buildOutput(profileId, genreScoresMap, genreMetaMap, sortedPositive, sortedNegative, signalCount, now)
+  return buildOutput(profileId, genreScoresMap, genreMetaMap, sortedPositive, sortedNegative, signalCount, now, {
+    personScores,
+    personMeta,
+    keywordScores,
+    franchiseScores,
+    languageScores,
+    countryScores,
+    decadeScores,
+    mediaTypePreferences,
+    completionRate,
+    historyEventCount,
+    tasteVersion: 1,
+  })
 }
 
 export async function getTaste(profileId: string): Promise<ProfileTaste> {
@@ -184,5 +369,18 @@ export async function getTaste(profileId: string): Promise<ProfileTaste> {
     row.negativeMediaIds,
     row.signalCount,
     row.builtAt,
+    {
+      personScores: (row.personScores as Record<string, number>) ?? {},
+      personMeta: (row.personMeta as Record<string, { name: string; role: string }>) ?? {},
+      keywordScores: (row.keywordScores as Record<string, number>) ?? {},
+      franchiseScores: (row.franchiseScores as Record<string, number>) ?? {},
+      languageScores: (row.languageScores as Record<string, number>) ?? {},
+      countryScores: (row.countryScores as Record<string, number>) ?? {},
+      decadeScores: (row.decadeScores as Record<string, number>) ?? {},
+      mediaTypePreferences: (row.mediaTypePreferences as Record<string, number>) ?? {},
+      completionRate: row.completionRate ? Number(row.completionRate) : null,
+      historyEventCount: row.historyEventCount,
+      tasteVersion: row.tasteVersion,
+    },
   )
 }
diff --git a/apps/api/src/services/retention-service.ts b/apps/api/src/services/retention-service.ts
new file mode 100644
index 0000000..91b745b
--- /dev/null
+++ b/apps/api/src/services/retention-service.ts
@@ -0,0 +1,102 @@
+import { and, eq, inArray, isNotNull, lt, sql } from 'drizzle-orm'
+import { db } from '../db/client.js'
+import { profileInteractionEvents } from '../db/schema/index.js'
+import { RETENTION_DAYS, SEARCH_QUERY_ANONYMIZE_DAYS, getRetentionClass } from '../config/retention.js'
+
+export async function runCompaction(): Promise<{ deleted: string; anonymized: string }> {
+  const now = Date.now()
+
+  // Anonymize search queries older than 90 days
+  const searchCutoff = new Date(now - SEARCH_QUERY_ANONYMIZE_DAYS * 86_400_000)
+  await db
+    .update(profileInteractionEvents)
+    .set({ searchQueryNormalized: null })
+    .where(
+      and(
+        inArray(profileInteractionEvents.eventType, ['SEARCH_PERFORMED', 'SEARCH_RESULT_IMPRESSION']),
+        isNotNull(profileInteractionEvents.searchQueryNormalized),
+        lt(profileInteractionEvents.occurredAt, searchCutoff),
+      ),
+    )
+
+  // Delete ANALYTICS events older than 90 days
+  const analyticsCutoff = new Date(now - 90 * 86_400_000)
+  await db
+    .delete(profileInteractionEvents)
+    .where(
+      and(
+        inArray(profileInteractionEvents.eventType, [
+          'SHELF_IMPRESSION',
+          'SHELF_ITEM_IMPRESSION',
+          'HOME_OPENED',
+        ]),
+        lt(profileInteractionEvents.occurredAt, analyticsCutoff),
+      ),
+    )
+
+  // Delete STANDARD events older than 730 days
+  const standardCutoff = new Date(now - 730 * 86_400_000)
+  const standardTypes = [
+    'PLAY_STARTED', 'PLAY_PAUSED', 'PLAY_STOPPED', 'PLAY_RESUMED', 'PLAY_ABANDONED',
+    'DETAIL_OPENED', 'SEEK_FORWARD', 'SEEK_BACKWARD', 'SKIP_INTRO', 'SKIP_RECAP',
+    'SKIP_OUTRO', 'NEXT_EPISODE_AUTO', 'NEXT_EPISODE_MANUAL', 'SOURCE_SELECTED',
+    'AUDIO_TRACK_SELECTED', 'SUBTITLE_TRACK_SELECTED', 'PLAYBACK_SPEED_CHANGED',
+    'SHELF_VIEWED', 'SHELF_ITEM_OPENED', 'TRAILER_PREVIEW_STARTED', 'TRAILER_PREVIEW_COMPLETED',
+    'PREVIEW_STARTED', 'SEARCH_RESULT_OPENED', 'CONTINUE_WATCHING_DISMISSED',
+    'PROFILE_SELECTED', 'PROFILE_PREFERENCE_CHANGED', 'NEVER_STOP_ENABLED', 'NEVER_STOP_DISABLED',
+    'WATCHED_10_PERCENT', 'WATCHED_25_PERCENT', 'WATCHED_50_PERCENT', 'WATCHED_75_PERCENT',
+  ]
+  await db
+    .delete(profileInteractionEvents)
+    .where(
+      and(
+        inArray(profileInteractionEvents.eventType, standardTypes),
+        lt(profileInteractionEvents.occurredAt, standardCutoff),
+      ),
+    )
+
+  return { deleted: 'compacted', anonymized: 'compacted' }
+}
+
+export async function getRetentionStats(): Promise<{
+  analyticsOverdue: number
+  standardOverdue: number
+  searchQueryOverdue: number
+}> {
+  const now = Date.now()
+  const analyticsCutoff = new Date(now - 90 * 86_400_000)
+  const standardCutoff = new Date(now - 730 * 86_400_000)
+  const searchCutoff = new Date(now - SEARCH_QUERY_ANONYMIZE_DAYS * 86_400_000)
+
+  const [[analyticsRow], [standardRow], [searchRow]] = await Promise.all([
+    db
+      .select({ c: sql<number>`count(*)` })
+      .from(profileInteractionEvents)
+      .where(
+        and(
+          inArray(profileInteractionEvents.eventType, ['SHELF_IMPRESSION', 'SHELF_ITEM_IMPRESSION', 'HOME_OPENED']),
+          lt(profileInteractionEvents.occurredAt, analyticsCutoff),
+        ),
+      ),
+    db
+      .select({ c: sql<number>`count(*)` })
+      .from(profileInteractionEvents)
+      .where(lt(profileInteractionEvents.occurredAt, standardCutoff)),
+    db
+      .select({ c: sql<number>`count(*)` })
+      .from(profileInteractionEvents)
+      .where(
+        and(
+          inArray(profileInteractionEvents.eventType, ['SEARCH_PERFORMED', 'SEARCH_RESULT_IMPRESSION']),
+          isNotNull(profileInteractionEvents.searchQueryNormalized),
+          lt(profileInteractionEvents.occurredAt, searchCutoff),
+        ),
+      ),
+  ])
+
+  return {
+    analyticsOverdue: Number(analyticsRow?.c ?? 0),
+    standardOverdue: Number(standardRow?.c ?? 0),
+    searchQueryOverdue: Number(searchRow?.c ?? 0),
+  }
+}
diff --git a/apps/api/src/services/viewing-session-service.ts b/apps/api/src/services/viewing-session-service.ts
new file mode 100644
index 0000000..9efb950
--- /dev/null
+++ b/apps/api/src/services/viewing-session-service.ts
@@ -0,0 +1,74 @@
+import { and, eq, isNull } from 'drizzle-orm'
+import { db } from '../db/client.js'
+import { viewingSessions } from '../db/schema/index.js'
+
+export async function openSession(opts: {
+  profileId: string
+  mediaType: string
+  mediaId: string
+  episodeId?: string | null
+  startPositionMs?: number
+  deviceType?: string | null
+  clientType?: string | null
+  sourceId?: string | null
+  availabilityId?: string | null
+}): Promise<string> {
+  const [session] = await db
+    .insert(viewingSessions)
+    .values({
+      profileId: opts.profileId,
+      mediaType: opts.mediaType,
+      mediaId: opts.mediaId,
+      episodeId: opts.episodeId ?? null,
+      startPositionMs: opts.startPositionMs ?? 0,
+      maxPositionMs: opts.startPositionMs ?? 0,
+      deviceType: opts.deviceType ?? null,
+      clientType: opts.clientType ?? null,
+      sourceId: opts.sourceId ?? null,
+      availabilityId: opts.availabilityId ?? null,
+    })
+    .returning({ id: viewingSessions.id })
+  return session.id
+}
+
+export async function updateSession(
+  sessionId: string,
+  opts: {
+    endPositionMs?: number
+    maxPositionMs?: number
+    watchedMsApprox?: number
+  },
+): Promise<void> {
+  await db
+    .update(viewingSessions)
+    .set({
+      endPositionMs: opts.endPositionMs ?? undefined,
+      maxPositionMs: opts.maxPositionMs ?? undefined,
+      watchedMsApprox: opts.watchedMsApprox ?? undefined,
+    })
+    .where(eq(viewingSessions.id, sessionId))
+}
+
+export async function closeSession(sessionId: string, completed: boolean): Promise<void> {
+  await db
+    .update(viewingSessions)
+    .set({ endedAt: new Date(), completed })
+    .where(eq(viewingSessions.id, sessionId))
+}
+
+export async function getActiveSession(
+  profileId: string,
+  mediaId: string,
+): Promise<{ id: string } | null> {
+  const [row] = await db
+    .select({ id: viewingSessions.id })
+    .from(viewingSessions)
+    .where(
+      and(
+        eq(viewingSessions.profileId, profileId),
+        eq(viewingSessions.mediaId, mediaId),
+        isNull(viewingSessions.endedAt),
+      ),
+    )
+  return row ?? null
+}
diff --git a/apps/web/src/hooks/useFeedback.ts b/apps/web/src/hooks/useFeedback.ts
index ce6e729..25e25d7 100644
--- a/apps/web/src/hooks/useFeedback.ts
+++ b/apps/web/src/hooks/useFeedback.ts
@@ -1,5 +1,6 @@
 import { useState, useEffect, useCallback } from 'react'
 import { fetchFeedback, setFeedback, clearFeedback } from '../lib/api.js'
+import { useInteractionEvents } from './useInteractionEvents.js'
 import type { FeedbackItem, FeedbackType, WatchlistMediaType } from '@iptvflix/api-contracts'
 
 export type UseFeedbackResult = {
@@ -13,6 +14,7 @@ export type UseFeedbackResult = {
 export function useFeedback(): UseFeedbackResult {
   const [entries, setEntries] = useState<FeedbackItem[]>([])
   const [loading, setLoading] = useState(true)
+  const { emit: emitEvent } = useInteractionEvents()
 
   useEffect(() => {
     fetchFeedback()
@@ -29,10 +31,15 @@ export function useFeedback(): UseFeedbackResult {
     try {
       const updated = await setFeedback(mediaType, mediaId, { feedback })
       setEntries((prev) => prev.map((e) => (e.mediaType === mediaType && e.mediaId === mediaId ? updated : e)))
+      if (feedback === 'LIKE') {
+        emitEvent({ eventType: 'LIKED', mediaType, mediaId, clientType: 'web' })
+      } else if (feedback === 'DISLIKE') {
+        emitEvent({ eventType: 'DISLIKED', mediaType, mediaId, clientType: 'web' })
+      }
     } catch {
       fetchFeedback().then(setEntries).catch(() => {})
     }
-  }, [])
+  }, [emitEvent])
 
   const clear = useCallback(async (mediaType: WatchlistMediaType, mediaId: string) => {
     setEntries((prev) => prev.filter((e) => !(e.mediaType === mediaType && e.mediaId === mediaId)))
diff --git a/apps/web/src/hooks/useInteractionEvents.ts b/apps/web/src/hooks/useInteractionEvents.ts
new file mode 100644
index 0000000..7be04e5
--- /dev/null
+++ b/apps/web/src/hooks/useInteractionEvents.ts
@@ -0,0 +1,19 @@
+import { useCallback } from 'react'
+import type { InteractionEventBody } from '@iptvflix/api-contracts'
+import { batchRecordInteractionEvents } from '../lib/api.js'
+
+// Fire-and-forget interaction event emission. Never throws, never blocks the caller.
+export function useInteractionEvents() {
+  const emit = useCallback((event: InteractionEventBody): void => {
+    batchRecordInteractionEvents([{ ...event, occurredAt: event.occurredAt ?? new Date().toISOString() }]).catch(
+      () => undefined,
+    )
+  }, [])
+
+  const emitBatch = useCallback((events: InteractionEventBody[]): Promise<{ sessionId?: string | null }> => {
+    const withTimestamp = events.map((e) => ({ ...e, occurredAt: e.occurredAt ?? new Date().toISOString() }))
+    return batchRecordInteractionEvents(withTimestamp).catch(() => ({}))
+  }, [])
+
+  return { emit, emitBatch }
+}
diff --git a/apps/web/src/hooks/useProgressSync.ts b/apps/web/src/hooks/useProgressSync.ts
index a2fda44..2432c7e 100644
--- a/apps/web/src/hooks/useProgressSync.ts
+++ b/apps/web/src/hooks/useProgressSync.ts
@@ -2,9 +2,11 @@ import { useEffect, useRef, useCallback } from 'react'
 import type { RefObject } from 'react'
 import type { ProgressMediaType } from '@iptvflix/api-contracts'
 import { upsertProgress, getStoredAuthToken } from '../lib/api.js'
+import { useInteractionEvents } from './useInteractionEvents.js'
 
 const DEBOUNCE_MS = 10_000
 const API_BASE = import.meta.env.VITE_API_BASE ?? '/api'
+const MILESTONES = [10, 25, 50, 75, 90] as const
 
 export function useProgressSync(
   videoRef: RefObject<HTMLVideoElement | null>,
@@ -12,6 +14,7 @@ export function useProgressSync(
   mediaId: string,
   enabled: boolean,
   stableDurationSeconds: number | null,
+  sessionId?: string | null,
 ): { flushProgress: () => void } {
   const lastSentRef = useRef<number>(0)
   const mediaTypeRef = useRef(mediaType)
@@ -22,6 +25,34 @@ export function useProgressSync(
   const stableDurationRef = useRef<number | null>(stableDurationSeconds)
   stableDurationRef.current = stableDurationSeconds
 
+  const { emit: emitEvent } = useInteractionEvents()
+  const emittedMilestonesRef = useRef<Set<number>>(new Set())
+
+  // Reset milestones when media changes
+  useEffect(() => {
+    emittedMilestonesRef.current = new Set()
+  }, [mediaId])
+
+  function checkMilestones(video: HTMLVideoElement) {
+    const duration = stableDurationRef.current ?? (isFinite(video.duration) ? video.duration : 0)
+    if (!duration || duration <= 0) return
+    const percent = Math.floor((video.currentTime / duration) * 100)
+    for (const threshold of MILESTONES) {
+      if (percent >= threshold && !emittedMilestonesRef.current.has(threshold)) {
+        emittedMilestonesRef.current.add(threshold)
+        emitEvent({
+          eventType: `WATCHED_${threshold}_PERCENT`,
+          mediaType: mediaTypeRef.current,
+          mediaId: mediaIdRef.current,
+          sessionId: sessionId ?? undefined,
+          progressPercent: threshold,
+          positionMs: Math.floor(video.currentTime * 1000),
+          clientType: 'web',
+        })
+      }
+    }
+  }
+
   const flushProgress = useCallback(() => {
     const video = videoRef.current
     if (!video) return
@@ -43,6 +74,7 @@ export function useProgressSync(
       if (!video) return
       const effectiveDuration = stableDurationRef.current ?? Math.floor(video.duration)
       if (!effectiveDuration || !isFinite(effectiveDuration)) return
+      checkMilestones(video)
       const now = Date.now()
       if (now - lastSentRef.current < DEBOUNCE_MS) return
       lastSentRef.current = now
diff --git a/apps/web/src/hooks/useWatchlist.ts b/apps/web/src/hooks/useWatchlist.ts
index 01ac04b..2389281 100644
--- a/apps/web/src/hooks/useWatchlist.ts
+++ b/apps/web/src/hooks/useWatchlist.ts
@@ -1,6 +1,7 @@
 import { useState, useEffect, useCallback } from 'react'
 import { fetchWatchlist, addToWatchlist, removeFromWatchlist } from '../lib/api.js'
 import { useProfile } from '../context/ProfileContext.js'
+import { useInteractionEvents } from './useInteractionEvents.js'
 import type { WatchlistEntry, WatchlistMediaType } from '@iptvflix/api-contracts'
 
 export type UseWatchlistResult = {
@@ -14,6 +15,7 @@ export function useWatchlist(): UseWatchlistResult {
   const { profileVersion } = useProfile()
   const [entries, setEntries] = useState<WatchlistEntry[]>([])
   const [loading, setLoading] = useState(true)
+  const { emit: emitEvent } = useInteractionEvents()
 
   useEffect(() => {
     setEntries([])
@@ -38,19 +40,21 @@ export function useWatchlist(): UseWatchlistResult {
     try {
       const created = await addToWatchlist({ mediaType, mediaId })
       setEntries((prev) => prev.map((e) => (e.id === optimistic.id ? created : e)))
+      emitEvent({ eventType: 'MY_LIST_ADDED', mediaType, mediaId, clientType: 'web' })
     } catch {
       setEntries((prev) => prev.filter((e) => e.id !== optimistic.id))
     }
-  }, [])
+  }, [emitEvent])
 
   const remove = useCallback(async (mediaType: WatchlistMediaType, mediaId: string) => {
     setEntries((prev) => prev.filter((e) => !(e.mediaType === mediaType && e.mediaId === mediaId)))
     try {
       await removeFromWatchlist(mediaType, mediaId)
+      emitEvent({ eventType: 'MY_LIST_REMOVED', mediaType, mediaId, clientType: 'web' })
     } catch {
       fetchWatchlist().then(setEntries).catch(() => {})
     }
-  }, [])
+  }, [emitEvent])
 
   return { entries, loading, add, remove }
 }
diff --git a/apps/web/src/lib/api.ts b/apps/web/src/lib/api.ts
index 8993a96..b1361bd 100644
--- a/apps/web/src/lib/api.ts
+++ b/apps/web/src/lib/api.ts
@@ -1,4 +1,6 @@
 import type {
+  InteractionEventBody,
+  BatchEventResponse,
   ArrivalItem,
   MovieResponse,
   MovieDetailResponse,
@@ -407,3 +409,11 @@ export function sendShelfConceptFeedback(
 ): Promise<void> {
   return request(`/shelf-concepts/${id}/feedback`, { method: 'POST', body: JSON.stringify(body) })
 }
+
+export function recordInteractionEvent(event: InteractionEventBody): Promise<void> {
+  return request('/interaction-events', { method: 'POST', body: JSON.stringify(event) })
+}
+
+export function batchRecordInteractionEvents(events: InteractionEventBody[]): Promise<BatchEventResponse> {
+  return request('/interaction-events/batch', { method: 'POST', body: JSON.stringify({ events }) })
+}
diff --git a/apps/web/src/pages/HomePage.tsx b/apps/web/src/pages/HomePage.tsx
index 98321dd..cb727da 100644
--- a/apps/web/src/pages/HomePage.tsx
+++ b/apps/web/src/pages/HomePage.tsx
@@ -1,4 +1,4 @@
-import { useState } from 'react'
+import { useState, useEffect } from 'react'
 import { useNavigate } from 'react-router-dom'
 import HeroSection from '../components/content/HeroSection.js'
 import ShelfRow from '../components/content/ShelfRow.js'
@@ -13,6 +13,7 @@ import { useHome } from '../hooks/useHome.js'
 import { useArrivals } from '../hooks/useArrivals.js'
 import { useOpenDetail } from '../hooks/useOpenDetail.js'
 import { useProfile } from '../context/ProfileContext.js'
+import { useInteractionEvents } from '../hooks/useInteractionEvents.js'
 
 export default function HomePage() {
   const navigate = useNavigate()
@@ -21,8 +22,14 @@ export default function HomePage() {
   const { data: movies, loading: moviesLoading } = useMovies({ pageSize: 1 })
   const { data: homeData, isLoading: homeLoading } = useHome(currentProfile?.id ?? '', profileVersion)
   const { arrivals, refresh: refreshArrivals } = useArrivals('unread')
+  const { emit: emitEvent } = useInteractionEvents()
   const [generateDialogOpen, setGenerateDialogOpen] = useState(false)
 
+  useEffect(() => {
+    emitEvent({ eventType: 'HOME_OPENED', clientType: 'web' })
+    // eslint-disable-next-line react-hooks/exhaustive-deps
+  }, [profileVersion])
+
   const shelves = homeData?.shelves ?? []
   const isLoading = moviesLoading || homeLoading
   const hasContent = (movies?.items.length ?? 0) > 0 || shelves.length > 0
diff --git a/apps/web/src/pages/MovieDetailPage.tsx b/apps/web/src/pages/MovieDetailPage.tsx
index 40998e1..fc033c1 100644
--- a/apps/web/src/pages/MovieDetailPage.tsx
+++ b/apps/web/src/pages/MovieDetailPage.tsx
@@ -3,6 +3,7 @@ import { useParams, useNavigate, useLocation } from 'react-router-dom'
 import type { Location } from 'react-router-dom'
 import type { MovieDetailResponse } from '@iptvflix/api-contracts'
 import { getMovie, fetchContinueWatching, ApiError } from '../lib/api.js'
+import { useInteractionEvents } from '../hooks/useInteractionEvents.js'
 import { useDevices } from '../hooks/useDevices.js'
 import { useToast } from '../components/ui/Toast.js'
 import Badge from '../components/ui/Badge.js'
@@ -50,6 +51,7 @@ export default function MovieDetailPage() {
   const location = useLocation()
   const toast = useToast()
   const { devices } = useDevices()
+  const { emit: emitEvent } = useInteractionEvents()
   const [movie, setMovie] = useState<MovieDetailResponse | null>(null)
   const [loading, setLoading] = useState(true)
   const [error, setError] = useState<Error | null>(null)
@@ -87,6 +89,7 @@ export default function MovieDetailPage() {
       if (cancelled) return m
       setMovie(m)
       setSelectedVariantId(m.selectedVariantId)
+      emitEvent({ eventType: 'DETAIL_OPENED', mediaType: 'MOVIE', mediaId: id!, clientType: 'web' })
       return m
     }
 
diff --git a/apps/web/src/pages/PlayerPage.tsx b/apps/web/src/pages/PlayerPage.tsx
index 82a3ca8..6fdcd96 100644
--- a/apps/web/src/pages/PlayerPage.tsx
+++ b/apps/web/src/pages/PlayerPage.tsx
@@ -4,6 +4,7 @@ import type { ProgressMediaType } from '@iptvflix/api-contracts'
 import { usePlayback } from '../hooks/usePlayback.js'
 import { useProgressSync } from '../hooks/useProgressSync.js'
 import { useEpisodeNavigation } from '../hooks/useEpisodeNavigation.js'
+import { useInteractionEvents } from '../hooks/useInteractionEvents.js'
 import PlayerControls from '../components/player/PlayerControls.js'
 import type { AudioTrack, SubtitleTrack } from '../components/player/PlayerControls.js'
 import ErrorState from '../components/ui/ErrorState.js'
@@ -96,7 +97,113 @@ export default function PlayerPage() {
   }, [])
 
   const progressMediaType: ProgressMediaType = mediaType === 'movie' ? 'MOVIE' : 'EPISODE'
-  const { flushProgress } = useProgressSync(videoRef, progressMediaType, mediaId!, status === 'ready', stableDurationSeconds)
+  const interactionMediaType = mediaType === 'movie' ? 'MOVIE' : 'EPISODE'
+
+  // Track viewing session and first-play state per media load (declared early for useProgressSync)
+  const sessionIdRef = useRef<string | null>(null)
+  const hasPlayedRef = useRef(false)
+
+  const { flushProgress } = useProgressSync(videoRef, progressMediaType, mediaId!, status === 'ready', stableDurationSeconds, sessionIdRef.current)
+  const { emit: emitEvent, emitBatch } = useInteractionEvents()
+
+  // Reset play tracking when media changes
+  useEffect(() => {
+    sessionIdRef.current = null
+    hasPlayedRef.current = false
+  }, [mediaId])
+
+  // Emit PLAY_STARTED on first play, PLAY_RESUMED on subsequent plays
+  useEffect(() => {
+    if (status !== 'ready') return
+    const video = videoRef.current
+    if (!video) return
+
+    function onPlay() {
+      if (!mediaId) return
+      if (!hasPlayedRef.current) {
+        hasPlayedRef.current = true
+        emitBatch([{
+          eventType: 'PLAY_STARTED',
+          mediaType: interactionMediaType,
+          mediaId,
+          episodeId: resolvedMediaType === 'episode' ? mediaId : null,
+          seriesId: seriesId ?? null,
+          positionMs: Math.floor((video?.currentTime ?? 0) * 1000),
+          durationMs: stableDurationRef.current ? Math.floor(stableDurationRef.current * 1000) : null,
+          availabilityId: availabilityId ?? null,
+          clientType: 'web',
+        }]).then((res) => {
+          if (res.sessionId) sessionIdRef.current = res.sessionId
+        }).catch(() => undefined)
+      } else {
+        emitEvent({
+          eventType: 'PLAY_RESUMED',
+          mediaType: interactionMediaType,
+          mediaId,
+          sessionId: sessionIdRef.current ?? undefined,
+          positionMs: Math.floor((video?.currentTime ?? 0) * 1000),
+          clientType: 'web',
+        })
+      }
+    }
+
+    function onPause() {
+      if (!mediaId || video?.ended) return
+      emitEvent({
+        eventType: 'PLAY_PAUSED',
+        mediaType: interactionMediaType,
+        mediaId,
+        sessionId: sessionIdRef.current ?? undefined,
+        positionMs: Math.floor((video?.currentTime ?? 0) * 1000),
+        clientType: 'web',
+      })
+    }
+
+    function onEnded() {
+      if (!mediaId) return
+      emitEvent({
+        eventType: 'PLAY_COMPLETED',
+        mediaType: interactionMediaType,
+        mediaId,
+        sessionId: sessionIdRef.current ?? undefined,
+        positionMs: Math.floor((video?.currentTime ?? 0) * 1000),
+        durationMs: stableDurationRef.current ? Math.floor(stableDurationRef.current * 1000) : null,
+        clientType: 'web',
+      })
+    }
+
+    video.addEventListener('play', onPlay)
+    video.addEventListener('pause', onPause)
+    video.addEventListener('ended', onEnded)
+    return () => {
+      video.removeEventListener('play', onPlay)
+      video.removeEventListener('pause', onPause)
+      video.removeEventListener('ended', onEnded)
+    }
+    // eslint-disable-next-line react-hooks/exhaustive-deps
+  }, [status, mediaId])
+
+  // Emit PLAY_ABANDONED on unmount if player was active
+  useEffect(() => {
+    return () => {
+      const video = videoRef.current
+      if (!video || !mediaId || !hasPlayedRef.current || video.ended) return
+      const progress = stableDurationRef.current && stableDurationRef.current > 0
+        ? video.currentTime / stableDurationRef.current
+        : 0
+      if (progress >= 0.05) {
+        emitEvent({
+          eventType: 'PLAY_ABANDONED',
+          mediaType: interactionMediaType,
+          mediaId,
+          sessionId: sessionIdRef.current ?? undefined,
+          positionMs: Math.floor(video.currentTime * 1000),
+          clientType: 'web',
+        })
+      }
+    }
+    // eslint-disable-next-line react-hooks/exhaustive-deps
+  }, [mediaId])
 
   // Episode navigation
   const { episodeLabel, nextEpisode } = useEpisodeNavigation(
@@ -107,6 +214,13 @@ export default function PlayerPage() {
 
   function handleNextEpisode() {
     if (!nextEpisode) return
+    emitEvent({
+      eventType: 'NEXT_EPISODE_MANUAL',
+      mediaType: interactionMediaType,
+      mediaId: mediaId ?? undefined,
+      sessionId: sessionIdRef.current ?? undefined,
+      clientType: 'web',
+    })
     flushProgress()
     const params = new URLSearchParams()
     if (nextEpisode.selectedVariantId) params.set('availabilityId', nextEpisode.selectedVariantId)
@@ -117,17 +231,32 @@ export default function PlayerPage() {
   }
 
   const handleVariantSwitch = useCallback((id: string) => {
+    emitEvent({
+      eventType: 'SOURCE_SELECTED',
+      mediaType: interactionMediaType,
+      mediaId: mediaId ?? undefined,
+      sessionId: sessionIdRef.current ?? undefined,
+      availabilityId: id,
+      clientType: 'web',
+    })
     flushProgress()
     switchVariant(id)
-  }, [flushProgress, switchVariant])
+  }, [flushProgress, switchVariant, mediaId, interactionMediaType, emitEvent])
 
   // Audio track change handler
   function handleAudioTrack(id: number) {
     const hls = hlsRef.current
     if (hls) hls.audioTrack = id
     setCurrentAudioTrack(id)
-    // Persist language preference
     const track = audioTracks.find((t) => t.id === id)
+    emitEvent({
+      eventType: 'AUDIO_TRACK_SELECTED',
+      mediaType: interactionMediaType,
+      mediaId: mediaId ?? undefined,
+      sessionId: sessionIdRef.current ?? undefined,
+      metadataJson: track ? { lang: track.lang } : null,
+      clientType: 'web',
+    })
     if (track?.lang) {
       updateProfilePreferences({ preferredAudioLanguages: [track.lang] }).catch(() => undefined)
     }
@@ -141,12 +270,17 @@ export default function PlayerPage() {
       hls.subtitleDisplay = id !== null
     }
     setCurrentSubtitleTrack(id)
-    // Persist language preference
-    if (id !== null) {
-      const track = subtitleTracks.find((t) => t.id === id)
-      if (track?.lang) {
-        updateProfilePreferences({ preferredSubtitleLanguages: [track.lang] }).catch(() => undefined)
-      }
+    const track = id !== null ? subtitleTracks.find((t) => t.id === id) : null
+    emitEvent({
+      eventType: 'SUBTITLE_TRACK_SELECTED',
+      mediaType: interactionMediaType,
+      mediaId: mediaId ?? undefined,
+      sessionId: sessionIdRef.current ?? undefined,
+      metadataJson: track ? { lang: track.lang } : { disabled: true },
+      clientType: 'web',
+    })
+    if (id !== null && track?.lang) {
+      updateProfilePreferences({ preferredSubtitleLanguages: [track.lang] }).catch(() => undefined)
     }
   }
 
diff --git a/apps/web/src/pages/ProfileChoosePage.tsx b/apps/web/src/pages/ProfileChoosePage.tsx
index 174b331..12652a8 100644
--- a/apps/web/src/pages/ProfileChoosePage.tsx
+++ b/apps/web/src/pages/ProfileChoosePage.tsx
@@ -1,6 +1,7 @@
 import { useState } from 'react'
 import { useNavigate } from 'react-router-dom'
 import { useProfile } from '../context/ProfileContext.js'
+import { useInteractionEvents } from '../hooks/useInteractionEvents.js'
 import ProfileAvatar from '../components/ProfileAvatar.js'
 import Spinner from '../components/ui/Spinner.js'
 
@@ -9,12 +10,14 @@ export default function ProfileChoosePage() {
   const [selecting, setSelecting] = useState<string | null>(null)
   const [error, setError] = useState<string | null>(null)
   const navigate = useNavigate()
+  const { emit: emitEvent } = useInteractionEvents()
 
   async function handleSelect(profileId: string) {
     setSelecting(profileId)
     setError(null)
     try {
       await selectProfile(profileId)
+      emitEvent({ eventType: 'PROFILE_SELECTED', clientType: 'web' })
       navigate('/', { replace: true })
     } catch {
       setError('Impossible de sélectionner ce profil. Veuillez réessayer.')
diff --git a/apps/web/src/pages/SearchPage.tsx b/apps/web/src/pages/SearchPage.tsx
index 5877dda..dd99d11 100644
--- a/apps/web/src/pages/SearchPage.tsx
+++ b/apps/web/src/pages/SearchPage.tsx
@@ -7,6 +7,7 @@ import type {
   ExternalSeriesCandidate,
 } from '@iptvflix/api-contracts'
 import { searchContent, searchDiscover, materializeMovie, materializeSeries } from '../lib/api.js'
+import { useInteractionEvents } from '../hooks/useInteractionEvents.js'
 import PosterCard from '../components/content/PosterCard.js'
 import Spinner from '../components/ui/Spinner.js'
 import EmptyState from '../components/ui/EmptyState.js'
@@ -18,6 +19,7 @@ export default function SearchPage() {
   const [searchParams, setSearchParams] = useSearchParams()
   const navigate = useNavigate()
   const openDetail = useOpenDetail()
+  const { emit: emitEvent } = useInteractionEvents()
   const initial = searchParams.get('q') ?? ''
 
   const [query, setQuery] = useState(initial)
@@ -49,6 +51,12 @@ export default function SearchPage() {
     setError(null)
     setExternalError(null)
 
+    emitEvent({
+      eventType: 'SEARCH_PERFORMED',
+      searchQueryNormalized: debouncedQuery.trim().toLowerCase(),
+      clientType: 'web',
+    })
+
     searchContent(debouncedQuery)
       .then(({ movies: m, series: s }) => {
         setMovies(m)
@@ -166,7 +174,10 @@ export default function SearchPage() {
                 year={m.year}
                 posterUrl={m.posterUrl}
                 quality={m.quality}
-                onClick={() => openDetail('movie', m.id)}
+                onClick={() => {
+                  emitEvent({ eventType: 'SEARCH_RESULT_OPENED', mediaType: 'MOVIE', mediaId: m.id, searchQueryNormalized: debouncedQuery.trim().toLowerCase(), clientType: 'web' })
+                  openDetail('movie', m.id)
+                }}
               />
             ))}
           </div>
@@ -185,7 +196,10 @@ export default function SearchPage() {
                 title={s.title}
                 year={s.year}
                 posterUrl={s.posterUrl}
-                onClick={() => openDetail('series', s.id)}
+                onClick={() => {
+                  emitEvent({ eventType: 'SEARCH_RESULT_OPENED', mediaType: 'SERIES', mediaId: s.id, searchQueryNormalized: debouncedQuery.trim().toLowerCase(), clientType: 'web' })
+                  openDetail('series', s.id)
+                }}
               />
             ))}
           </div>
diff --git a/apps/web/src/pages/SeriesDetailPage.tsx b/apps/web/src/pages/SeriesDetailPage.tsx
index d946ef9..1231f2a 100644
--- a/apps/web/src/pages/SeriesDetailPage.tsx
+++ b/apps/web/src/pages/SeriesDetailPage.tsx
@@ -3,6 +3,7 @@ import { useParams, useNavigate, useLocation } from 'react-router-dom'
 import type { Location } from 'react-router-dom'
 import type { SeriesDetailResponse } from '@iptvflix/api-contracts'
 import { getSeries, getProfile, fetchContinueWatching, ApiError } from '../lib/api.js'
+import { useInteractionEvents } from '../hooks/useInteractionEvents.js'
 import { useDevices } from '../hooks/useDevices.js'
 import Badge from '../components/ui/Badge.js'
 import Button from '../components/ui/Button.js'
@@ -46,6 +47,7 @@ export default function SeriesDetailPage() {
   const navigate = useNavigate()
   const location = useLocation()
   const { devices } = useDevices()
+  const { emit: emitEvent } = useInteractionEvents()
   const [series, setSeries] = useState<SeriesDetailResponse | null>(null)
 
   const modalState = location.state as { background?: Location; scrollY?: number } | null
@@ -102,7 +104,10 @@ export default function SeriesDetailPage() {
         const s = await getSeries(id!)
         if (cancelled) return
         setSeries(s)
-        if (initial) setLoading(false)
+        if (initial) {
+          setLoading(false)
+          emitEvent({ eventType: 'DETAIL_OPENED', mediaType: 'SERIES', mediaId: id!, clientType: 'web' })
+        }
         return s
       } catch (err) {
         if (cancelled) return
diff --git a/packages/api-contracts/src/interaction-events.ts b/packages/api-contracts/src/interaction-events.ts
index 3f7759f..7e253dd 100644
--- a/packages/api-contracts/src/interaction-events.ts
+++ b/packages/api-contracts/src/interaction-events.ts
@@ -1,20 +1,53 @@
 export type InteractionEventType =
+  // Discovery / browsing
+  | 'HOME_OPENED'
+  | 'SHELF_IMPRESSION'
+  | 'SHELF_VIEWED'
+  | 'SHELF_ITEM_IMPRESSION'
+  | 'SHELF_ITEM_OPENED'
   | 'DETAIL_OPENED'
+  | 'TRAILER_PREVIEW_STARTED'
+  | 'TRAILER_PREVIEW_COMPLETED'
+  | 'PREVIEW_STARTED'
+  | 'SEARCH_PERFORMED'
+  | 'SEARCH_RESULT_IMPRESSION'
+  | 'SEARCH_RESULT_OPENED'
+  // Intent / explicit preference
+  | 'MY_LIST_ADDED'
+  | 'MY_LIST_REMOVED'
+  | 'LIKED'
+  | 'DISLIKED'
+  | 'RATED'
+  | 'CONTINUE_WATCHING_DISMISSED'
+  | 'REMINDER_ADDED'
+  // Playback
   | 'PLAY_STARTED'
   | 'PLAY_RESUMED'
   | 'PLAY_PAUSED'
+  | 'PLAY_STOPPED'
   | 'PLAY_COMPLETED'
   | 'PLAY_ABANDONED'
-  | 'MY_LIST_ADDED'
-  | 'MY_LIST_REMOVED'
-  | 'LIKED'
-  | 'DISLIKED'
-  | 'SEARCH_PERFORMED'
-  | 'SEARCH_RESULT_OPENED'
-  | 'SHELF_IMPRESSION'
-  | 'SHELF_ITEM_OPENED'
-  | 'PREVIEW_STARTED'
+  | 'SEEK_FORWARD'
+  | 'SEEK_BACKWARD'
+  | 'SKIP_INTRO'
+  | 'SKIP_RECAP'
+  | 'SKIP_OUTRO'
+  | 'NEXT_EPISODE_AUTO'
+  | 'NEXT_EPISODE_MANUAL'
   | 'SOURCE_SELECTED'
+  | 'AUDIO_TRACK_SELECTED'
+  | 'SUBTITLE_TRACK_SELECTED'
+  | 'PLAYBACK_SPEED_CHANGED'
+  | 'WATCHED_10_PERCENT'
+  | 'WATCHED_25_PERCENT'
+  | 'WATCHED_50_PERCENT'
+  | 'WATCHED_75_PERCENT'
+  | 'WATCHED_90_PERCENT'
+  // Profile / settings
+  | 'PROFILE_SELECTED'
+  | 'PROFILE_PREFERENCE_CHANGED'
+  | 'NEVER_STOP_ENABLED'
+  | 'NEVER_STOP_DISABLED'
 
 export type InteractionEventBody = {
   eventType: string
@@ -28,4 +61,28 @@ export type InteractionEventBody = {
   deviceType?: string | null
   sourceId?: string | null
   metadataJson?: Record<string, unknown> | null
+  // T100 additions
+  seriesId?: string | null
+  seasonId?: string | null
+  seasonNumber?: number | null
+  progressPercent?: number | null
+  shelfConceptId?: string | null
+  shelfPosition?: number | null
+  itemPositionInShelf?: number | null
+  searchQueryNormalized?: string | null
+  availabilityId?: string | null
+  clientType?: string | null
+  appVersion?: string | null
+  sessionId?: string | null
+  referrerSurface?: string | null
+  schemaVersion?: number | null
+  idempotencyKey?: string | null
+}
+
+export type InteractionEventBatch = {
+  events: InteractionEventBody[]
+}
+
+export type BatchEventResponse = {
+  sessionId?: string | null
 }
```

---

## Conflicted Files

### apps/api/migrations/meta/_journal.json

```
{
    "version": "7",
    "dialect": "postgresql",
    "entries": [
        {
            "idx": 0,
            "version": "7",
            "when": 1786398620976,
            "tag": "0000_talented_shiva",
            "breakpoints": true
        },
        {
            "idx": 1,
            "version": "7",
            "when": 1786398630976,
            "tag": "0001_sweet_stingray",
            "breakpoints": true
        },
        {
            "idx": 2,
            "version": "7",
            "when": 1786398640976,
            "tag": "0002_real_leper_queen",
            "breakpoints": true
        },
        {
            "idx": 3,
            "version": "7",
            "when": 1786398650976,
            "tag": "0003_gifted_johnny_blaze",
            "breakpoints": true
        },
        {
            "idx": 4,
            "version": "7",
            "when": 1786398660976,
            "tag": "0004_wild_legion",
            "breakpoints": true
        },
        {
            "idx": 5,
            "version": "7",
            "when": 1786398670976,
            "tag": "0005_careless_moon_knight",
            "breakpoints": true
        },
        {
            "idx": 6,
            "version": "7",
            "when": 1786398680976,
            "tag": "0006_open_shatterstar",
            "breakpoints": true
        },
        {
            "idx": 7,
            "version": "7",
            "when": 1786398690976,
            "tag": "0007_episode_availability_status",
            "breakpoints": true
        },
        {
            "idx": 8,
            "version": "7",
            "when": 1786398700976,
            "tag": "0008_shelves",
            "breakpoints": true
        },
        {
            "idx": 9,
            "version": "7",
            "when": 1786398710976,
            "tag": "0009_living_sphinx",
            "breakpoints": true
        },
        {
            "idx": 10,
            "version": "7",
            "when": 1786398720976,
            "tag": "0010_release_lifecycle",
            "breakpoints": true
        },
        {
            "idx": 11,
            "version": "7",
            "when": 1786398730976,
            "tag": "0011_add_plex_source_type",
            "breakpoints": true
        },
        {
            "idx": 12,
            "version": "7",
            "when": 1786398740976,
            "tag": "0012_profile_playback_preferences",
            "breakpoints": true
        },
        {
            "idx": 13,
            "version": "7",
            "when": 1786398750976,
            "tag": "0013_release_events_source_aware_idempotency",
            "breakpoints": true
        },
        {
            "idx": 14,
            "version": "7",
            "when": 1786398760976,
            "tag": "0014_episode_availability_provider_uniqueness",
            "breakpoints": true
        },
        {
            "idx": 15,
            "version": "7",
            "when": 1786398770976,
            "tag": "0015_episode_release_events",
            "breakpoints": true
        },
        {
            "idx": 16,
            "version": "7",
            "when": 1786398780976,
            "tag": "0016_silent_lucky_pierre",
            "breakpoints": true
        },
        {
            "idx": 17,
            "version": "7",
            "when": 1786398790976,
            "tag": "0017_profile_taste",
            "breakpoints": true
        },
        {
            "idx": 18,
            "version": "7",
            "when": 1786398800976,
            "tag": "0018_discovery_candidates",
            "breakpoints": true
        },
        {
            "idx": 19,
            "version": "7",
            "when": 1786398810976,
            "tag": "0019_generated_shelf",
            "breakpoints": true
        },
        {
            "idx": 20,
            "version": "7",
            "when": 1786398820976,
            "tag": "0020_media_videos_credits",
            "breakpoints": true
        },
        {
            "idx": 21,
            "version": "7",
            "when": 1786398830976,
            "tag": "0021_tv_pairing_commands",
            "breakpoints": true
        },
        {
            "idx": 22,
            "version": "7",
            "when": 1786398840976,
            "tag": "0022_autoplay_previews",
            "breakpoints": true
        },
        {
            "idx": 23,
            "version": "7",
            "when": 1786398850976,
            "tag": "0023_media_arrivals",
            "breakpoints": true
        },
        {
            "idx": 24,
            "version": "7",
            "when": 1786398860976,
            "tag": "0024_fuzzy_starbolt",
            "breakpoints": true
        },
        {
            "idx": 25,
            "version": "7",
            "when": 1786398870976,
            "tag": "0025_reconciliation_runs",
            "breakpoints": true
        },
        {
            "idx": 26,
            "version": "7",
            "when": 1786398880976,
            "tag": "0026_episode_availability_container_extension",
            "breakpoints": true
        },
        {
            "idx": 27,
            "version": "7",
            "when": 1786398890976,
            "tag": "0027_heal_media_metadata_columns",
            "breakpoints": true
        },
        {
            "idx": 28,
            "version": "7",
            "when": 1786398900976,
            "tag": "0028_title_match_media_type_unique",
            "breakpoints": true
        },
        {
            "idx": 29,
            "version": "7",
            "when": 1786398910976,
            "tag": "0029_tmdb_first_catalog",
            "breakpoints": true
        },
        {
            "idx": 30,
            "version": "7",
            "when": 1786398920976,
            "tag": "0030_catalog_bootstrap",
            "breakpoints": true
        },
        {
            "idx": 31,
            "version": "7",
            "when": 1786398930976,
            "tag": "0031_t067_availability_variants",
            "breakpoints": true
        },
        {
            "idx": 32,
            "version": "7",
            "when": 1786398940976,
            "tag": "0032_catalog_refresh",
            "breakpoints": true
        },
        {
            "idx": 33,
            "version": "7",
            "when": 1786398950976,
            "tag": "0033_t070_discovery_indexes",
            "breakpoints": true
        },
        {
            "idx": 34,
            "version": "7",
            "when": 1786399000000,
            "tag": "0034_t093_variant_metadata",
            "breakpoints": true
        },
        {
            "idx": 35,
            "version": "7",
            "when": 1786399100000,
            "tag": "0035_t098_account_profile_foundation",
            "breakpoints": true
        },
        {
            "idx": 36,
            "version": "7",
            "when": 0,
            "tag": "0036_t102_media_embeddings",
            "breakpoints": true
        },
        {
            "idx": 37,
            "version": "7",
            "when": 1786399200000,
            "tag": "0037_t096_media_segments",
            "breakpoints": true
        },
        {
            "idx": 38,
            "version": "7",
            "when": 1786399300000,
            "tag": "0038_t097_segment_selections",
            "breakpoints": true
        },
        {
            "idx": 39,
            "version": "7",
            "when": 1786399400000,
            "tag": "0039_t105_shelf_concepts",
            "breakpoints": true
        },
        {
            "idx": 40,
            "version": "7",
            "when": 1786399500000,
            "tag": "0040_t102_pgvector_hnsw",
            "breakpoints": true
        }
    ]
}
```