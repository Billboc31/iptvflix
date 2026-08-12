Now I have everything I need. Here is the implementation plan:

---

## Objective

Extend the release lifecycle event system to record `SOURCE_APPEARED` and `SOURCE_DISAPPEARED` events for Episodes during catalog sync, on par with the existing Movie and Series handling. This requires widening the `release_events.media_type` column to accept `'EPISODE'`, updating the service and route layers, and wiring event recording into the episode sync block.

## Included

### 1. DB migration — `apps/api/migrations/0014_episode_release_events.sql`
- Create new PostgreSQL enum `release_event_media_type` with values `('MOVIE', 'SERIES', 'EPISODE')`.
- Alter `release_events.media_type` column to use `release_event_media_type` via `USING media_type::text::release_event_media_type`.
- Leave `watchlist_media_type` enum and its consumers (`watchlist`, `follow_release`) untouched.

### 2. DB schema — `apps/api/src/db/schema/release-lifecycle.ts`
- Export a new `releaseEventMediaTypeEnum = pgEnum('release_event_media_type', ['MOVIE', 'SERIES', 'EPISODE'])`.
- Change `releaseEvents` table to use `releaseEventMediaTypeEnum` instead of `watchlistMediaTypeEnum` for the `mediaType` column.
- Remove the import of `watchlistMediaTypeEnum` from this file.

### 3. Service — `apps/api/src/services/release-lifecycle-service.ts`
- Widen `recordReleaseEvent` signature: `mediaType: 'MOVIE' | 'SERIES' | 'EPISODE'`.
- Widen `getTimeline` signature: `mediaType: 'MOVIE' | 'SERIES' | 'EPISODE'`.
- In `getTimeline`, add an `else` branch for `EPISODE`: skip the release-date query (episodes have no `announcedAt` / `theatricalReleaseDate` / `digitalReleaseDate`), return `null` for all three date fields and the filtered timeline events.

### 4. Route — `apps/api/src/routes/release-lifecycle.ts`
- Accept `'EPISODE'` as a valid `mediaType` in the guard condition (line 9).
- Update the type cast passed to `getTimeline` accordingly.

### 5. Catalog sync — `apps/api/src/services/catalog-sync-service.ts`, episode block (lines 519–606)
- In the per-episode loop, extend the `existing` row select to also fetch `status` (`episodeAvailabilities.status`) — mirrors the pattern used for movies/series.
- On **first insert** (the `!existing` branch): after inserting the episode availability row, insert a `SOURCE_APPEARED` event with `mediaType: 'EPISODE'`, `mediaId: episodeId`, `sourceId`, `.onConflictDoNothing()`.
- On **reappearance** (the `else` branch, `wasUnavailable`): after updating the availability row, insert a `SOURCE_APPEARED` event in the same pattern.
- On **disappearance** (the missing-episodes batch update): add `.returning({ episodeId: episodeAvailabilities.episodeId })` to the existing batch `UPDATE`, then loop over returned rows to insert a `SOURCE_DISAPPEARED` event per episode.

### 6. Tests — `apps/api/src/services/__tests__/catalog-sync-service.test.ts`
Add test cases (within the existing episode-sync test group or a new sub-describe) covering:
- **First appearance**: syncing a new episode availability records exactly one `SOURCE_APPEARED` event for that episode.
- **Idempotent re-sync**: a second identical sync produces no additional event.
- **Reappearance**: marking an episode unavailable then re-syncing it records a new `SOURCE_APPEARED`.
- **Disappearance**: an episode absent from the authoritative snapshot records exactly one `SOURCE_DISAPPEARED`.
- **Source identity**: events carry the correct `sourceId`.
- Cover both Xtream and Plex episode sync paths where the test fixtures permit.

## Excluded

- Adding `'EPISODE'` to the `watchlist_media_type` enum or the `watchlist` / `follow_release` tables.
- Exposing a separate episode-lifecycle API endpoint (the existing `/release-lifecycle/:mediaType/:mediaId` route extended with `EPISODE` is sufficient).
- Backfilling historical episode events for availability rows that pre-date this ticket.
- Any UI change to surface episode lifecycle timelines.
- Changes to `upsertReleaseFields` (episodes have no release-date metadata).
- Changes to the `follow_release` feature or its domain types.

## Acceptance criteria

- `release_events.media_type` column accepts the value `'EPISODE'`; existing `MOVIE` and `SERIES` rows are unaffected.
- Syncing a new episode availability inserts exactly one `SOURCE_APPEARED` row; re-syncing the same snapshot inserts none (idempotent via `.onConflictDoNothing()`).
- An episode absent from a subsequent authoritative snapshot receives exactly one `SOURCE_DISAPPEARED` row.
- An episode that reappears after being `UNAVAILABLE` receives a new `SOURCE_APPEARED` row.
- All inserted events carry the correct `sourceId` (source-aware idempotency index remains valid).
- `GET /release-lifecycle/EPISODE/:episodeId` returns HTTP 200 with a `ReleaseLifecycle` whose `announcedAt`, `theatricalReleaseDate`, and `digitalReleaseDate` are `null` and whose `timeline` contains the recorded events.
- `recordReleaseEvent` and `getTimeline` TypeScript signatures accept `'EPISODE'` without type errors.
- The new migration (`0014_…`) runs cleanly on a fresh DB and on a DB that already has `MOVIE`/`SERIES` rows in `release_events`.
- Automated tests added in step 6 all pass.
