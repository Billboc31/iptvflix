# T035 — Extend source availability lifecycle to episode transitions

**Source**: GitHub Issue #64

## Description

## Objective

Record durable source appearance/disappearance events for Episodes now that authoritative episode synchronization exists.

## Context / Problem

Ticket #49 introduced authoritative Xtream/Plex episode synchronization and lifecycle-safe episode availability updates. Ticket #52 then wired `SOURCE_APPEARED` / `SOURCE_DISAPPEARED` into catalog sync, but only for Movies and Series.

This leaves episode arrival/removal invisible to the release lifecycle even though episodes are now first-class availability targets and series detail depends on per-episode source state.

## Included

- Extend the release lifecycle model/API as needed so Episode source transitions can be represented without abusing Movie/Series types.
- Record `SOURCE_APPEARED` on first episode availability and reappearance after `UNAVAILABLE`.
- Record `SOURCE_DISAPPEARED` when an authoritative episode snapshot removes a previously available episode source mapping.
- Preserve source identity and idempotency semantics.
- Keep metadata refreshes from generating false lifecycle events.

## Acceptance Criteria

- [ ] First authoritative episode availability records exactly one source-appearance event.
- [ ] Unchanged re-sync does not duplicate the event.
- [ ] Removal records exactly one source-disappearance event.
- [ ] Reappearance records a new appearance transition.
- [ ] Events preserve the originating source.
- [ ] Lifecycle API/domain types represent Episodes explicitly and safely.
- [ ] Automated tests cover Xtream and Plex episode transitions where practical.

## Dependencies

Builds on #49 and #52. Coordinate with #61 so source-aware idempotency semantics remain consistent.
