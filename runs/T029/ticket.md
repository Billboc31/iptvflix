# T029 — Make release lifecycle event idempotency source-aware

**Source**: GitHub Issue #61

## Description

## Problem

Ticket #52 requires source identity to be preserved for `SOURCE_APPEARED` / `SOURCE_DISAPPEARED` events and event creation to be idempotent.

The current `release_events` uniqueness constraint is:

`(mediaType, mediaId, eventType, occurredAt)`

It does **not** include `sourceId`, while catalog sync inserts source-specific lifecycle events using `.onConflictDoNothing()`.

This means two configured sources can legitimately produce the same lifecycle transition for the same canonical media at the same timestamp, but the second event can be silently dropped by the uniqueness constraint. The stored timeline then loses source identity/transition history.

## Expected fix

Make lifecycle event deduplication source-aware for source events, while retaining sensible idempotency for non-source lifecycle events.

Possible approaches:
- include `sourceId` in the relevant uniqueness constraint/index, with explicit handling for nullable source IDs; or
- use separate partial unique indexes/constraints for source vs non-source event types.

## Acceptance criteria

- [ ] Two different sources may record `SOURCE_APPEARED` for the same media and same `occurredAt` without conflicting.
- [ ] Re-running an identical sync for the same source does not create a duplicate event.
- [ ] Equivalent behavior is covered for `SOURCE_DISAPPEARED`.
- [ ] Non-source events (`ANNOUNCED`, `THEATRICAL_RELEASE`, `DIGITAL_RELEASE`) retain appropriate idempotency semantics.
- [ ] Migration updates the database constraint/index safely.
- [ ] Automated tests cover same-media/same-timestamp events from two distinct sources.

Found during integration review of PR #59 / ticket #52.
