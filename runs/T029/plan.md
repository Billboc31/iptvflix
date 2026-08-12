Now I have enough context to write the plan.

## Objective

Replace the single uniqueness constraint on `release_events` — currently `(media_type, media_id, event_type, occurred_at)` — with two partial unique indexes: one that includes `source_id` for source lifecycle events, one that excludes it for non-source events. This allows two distinct sources to record `SOURCE_APPEARED` / `SOURCE_DISAPPEARED` for the same media at the same timestamp without conflict, while preserving existing idempotency semantics for `ANNOUNCED`, `THEATRICAL_RELEASE`, and `DIGITAL_RELEASE`.

## Included

**`apps/api/db/schema/release-lifecycle.ts`**
- Remove the existing `unique().on(t.mediaType, t.mediaId, t.eventType, t.occurredAt)` table-level constraint.
- Add a partial `uniqueIndex` for source events (where `event_type IN ('SOURCE_APPEARED', 'SOURCE_DISAPPEARED')`), covering `(media_type, media_id, event_type, occurred_at, source_id)`.
- Add a partial `uniqueIndex` for non-source events (where `event_type NOT IN ('SOURCE_APPEARED', 'SOURCE_DISAPPEARED')`), covering `(media_type, media_id, event_type, occurred_at)`.

**New migration `apps/api/migrations/0011_release_events_source_aware_idempotency.sql`**
- `ALTER TABLE release_events DROP CONSTRAINT "release_events_media_type_media_id_event_type_occurred_at_unique";`
- `CREATE UNIQUE INDEX "release_events_source_events_unique" ON release_events (media_type, media_id, event_type, occurred_at, source_id) WHERE event_type IN ('SOURCE_APPEARED', 'SOURCE_DISAPPEARED');`
- `CREATE UNIQUE INDEX "release_events_non_source_events_unique" ON release_events (media_type, media_id, event_type, occurred_at) WHERE event_type NOT IN ('SOURCE_APPEARED', 'SOURCE_DISAPPEARED');`

**`apps/api/migrations/meta/` snapshot**
- Regenerate via `drizzle-kit generate` after schema change, or hand-update the snapshot JSON to reflect the new indexes in place of the dropped constraint.

**Tests** (existing release-lifecycle test file, or a new test file alongside it)
- Test: two different `sourceId` values → two `SOURCE_APPEARED` rows for the same `(mediaId, mediaType, occurredAt)` are both persisted (no conflict).
- Test: same `sourceId` re-inserted for `SOURCE_APPEARED` → only one row (idempotent).
- Test: same pattern for `SOURCE_DISAPPEARED`.
- Test: `ANNOUNCED` / `THEATRICAL_RELEASE` / `DIGITAL_RELEASE` with the same `(mediaId, mediaType, eventType, occurredAt)` → only one row persisted (unchanged idempotency).

No changes to `catalog-sync-service.ts` — `.onConflictDoNothing()` without a conflict target catches any uniqueness violation in PostgreSQL and continues to work correctly with partial indexes.

## Excluded

- Changes to event insertion logic in `catalog-sync-service.ts` or `release-lifecycle-service.ts`.
- Adding `sourceId` to non-source event types.
- Any changes to the `ReleaseEventType` enum or its contract.
- Backfilling or deduplicating existing rows in production data.
- Changes to how events are queried or presented.

## Acceptance criteria

- The migration applies cleanly on a fresh database and on a database that already has the old constraint.
- Two rows with distinct `source_id` values and identical `(media_type, media_id, event_type, occurred_at)` where `event_type = 'SOURCE_APPEARED'` can coexist in `release_events`.
- Re-inserting the same `(media_type, media_id, event_type, occurred_at, source_id)` for a source event produces no duplicate (`.onConflictDoNothing()` suppresses it silently).
- Equivalent behavior verified for `SOURCE_DISAPPEARED`.
- Inserting duplicate `ANNOUNCED`, `THEATRICAL_RELEASE`, or `DIGITAL_RELEASE` rows with the same `(media_type, media_id, event_type, occurred_at)` still produces one row.
- The Drizzle schema and migration snapshot are consistent (no drift detectable by `drizzle-kit check` or equivalent).
- All new test cases pass; existing tests remain green.
