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
