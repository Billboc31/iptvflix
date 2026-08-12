# T027 — Wire source availability lifecycle into idempotent release events

**Source**: GitHub Issue #52

## Description

## Objective

Ensure source appearance/disappearance events are actually recorded when canonical availability changes, so Follow Release can later notify users reliably without duplicating events on every synchronization.

## Context / Problem

The release lifecycle domain defines `SOURCE_APPEARED` and `SOURCE_DISAPPEARED` events, but the current catalog synchronization path updates availability status/firstSeenAt/lastSeenAt without integrating those transitions into the release-event timeline.

As a result, Follow Release can persist the user's intent but lacks durable source-arrival events needed for the core `never miss a movie again` behavior.

## Included

- Connect canonical availability state transitions to the existing release lifecycle event service.
- Record `SOURCE_APPEARED` when a Media becomes available on a configured source for the first time or reappears after being unavailable.
- Record `SOURCE_DISAPPEARED` when a previously AVAILABLE mapping becomes unavailable through an authoritative source synchronization.
- Preserve provider/source identity on the event.
- Make event creation idempotent across repeated identical synchronizations.
- Avoid producing appearance events merely because metadata was refreshed or `lastSeenAt` changed.
- Ensure zero-availability Media can later transition into `available to me` with a corresponding durable event.
- Apply the behavior consistently to Movies and, once authoritative episode synchronization exists, Episodes where the release lifecycle model supports it.

## Acceptance Criteria

- [ ] First transition from no current availability to AVAILABLE records exactly one `SOURCE_APPEARED` event for the source.
- [ ] Re-running an unchanged synchronization does not create duplicate appearance events.
- [ ] Transition from AVAILABLE to UNAVAILABLE records exactly one `SOURCE_DISAPPEARED` event.
- [ ] Reappearance after disappearance records a new `SOURCE_APPEARED` event reflecting the new transition.
- [ ] Metadata refreshes without availability-state change do not create source lifecycle events.
- [ ] Event source identity is preserved and no provider credentials/secret URLs are stored in lifecycle data.
- [ ] Follow Release timeline APIs expose these events correctly.
- [ ] Automated tests cover first appearance, unchanged resync, disappearance and reappearance.

## Excluded / Out of scope

- Sending push/email/browser notifications.
- Predicting future provider availability.
- Commercial streaming availability aggregation.

## Dependencies

Builds on the existing release lifecycle service and canonical availability synchronization. Episode events depend on authoritative episode lifecycle handling.
