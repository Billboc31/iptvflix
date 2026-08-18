T100 is fully implemented. Here's a summary of what was completed in this session:

**Android TV (final pieces)**
- `PlayerViewModel.kt`: `load()` now resets `currentCommand`, `hasEmittedPlay`, and `sessionId` before loading, so all event emissions have the correct media context
- `ProfileViewModel.kt`: emits `PROFILE_SELECTED` after successful profile switch
- `HomeViewModel.kt`: emits `HOME_OPENED` once on first successful connection confirmation

**All 17 plan sections are implemented:**

| Area | Deliverables |
|---|---|
| DB | `0039_t100_…v2.sql` migration + `persons`, `viewing_sessions` schema + extensions to `profile_interaction_events`, `media_credits`, `profile_taste` |
| API contracts | 47-event taxonomy, extended `InteractionEventBody`, `InteractionEventBatch`, `BatchEventResponse` |
| API services | `interaction-event-service` (idempotency + batch), `viewing-session-service`, `playback-milestone-service`, `profile-taste-service` (rich signals), `metadata-enrichment-service` (persons), `retention-service` |
| API routes | `POST /interaction-events/batch` (auto-open/close sessions, returns `sessionId`), 5 admin endpoints |
| Scripts | `backfill-interaction-events.ts` (idempotent, schemaVersion=0) |
| Web | `useInteractionEvents`, `useProgressSync` milestones, PlayerPage/MovieDetailPage/SeriesDetailPage/SearchPage/HomePage/ProfileChoosePage/useWatchlist/useFeedback all instrumented |
| Android TV | `InteractionEventService`, `PlayerViewModel` (full playback lifecycle), `ProfileViewModel` (PROFILE_SELECTED), `HomeViewModel` (HOME_OPENED) |
