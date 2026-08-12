# T024 — Fix episode availability lifecycle and provider episode synchronization

**Source**: GitHub Issue #49

## Description

## Objective

Prevent catalog synchronization from falsely marking every Episode availability as unavailable, and make episode-level availability lifecycle reflect the actual provider snapshot.

## Context / Problem

The current shared catalog synchronization logic reads all AVAILABLE `episode_availabilities` for a source, but the normalized snapshot contains no episode-level items. It therefore treats the entire prior episode set as missing and marks every Episode availability `UNAVAILABLE` on each sync.

This directly breaks the new canonical Series → Season → Episode experience and makes multi-source episode completeness unreliable.

## Included

- Remove the current behavior that treats an absent episode collection in a provider snapshot as an authoritative empty episode catalog.
- Distinguish between:
  - provider snapshots that do not contain episode data;
  - provider snapshots that intentionally contain a complete episode inventory.
- Extend the common provider ingestion/synchronization boundary to carry episode-level items where the provider supports them.
- For Xtream, use available Season/Episode catalog information to create/update Episode availability mappings where supported by the existing provider client.
- For Plex, ingest the Season/Episode hierarchy and episode provider identities needed for canonical episode availability.
- Track Episode `firstSeenAt`, `lastSeenAt`, disappearance and reappearance using the same idempotent lifecycle principles as Movie/Series availability.
- Do not mark existing Episode availability stale unless the synchronization run has authoritative episode coverage for that source/scope.
- Keep provider-specific payloads inside adapters/ingestion boundaries.

## Acceptance Criteria

- [ ] Synchronizing a source snapshot that contains no episode inventory does not mark existing Episode availabilities `UNAVAILABLE` merely because the episode list is absent.
- [ ] When an authoritative Episode snapshot is available, observed Episodes remain/become `AVAILABLE` and missing Episodes can be marked `UNAVAILABLE` correctly.
- [ ] Repeated synchronization preserves Episode `firstSeenAt` and updates `lastSeenAt` without creating duplicates.
- [ ] A disappeared Episode can become available again without losing useful history.
- [ ] Xtream Episode data is mapped to the canonical Series → Season → Episode hierarchy where provider data supports it.
- [ ] Plex Episode data is mapped through the common ingestion boundary rather than a Plex-specific UI/domain model.
- [ ] Automated tests cover snapshot-without-episodes, complete episode snapshot, disappearance, reappearance and multi-source Episode availability.

## Excluded / Out of scope

- Episode playback.
- Episode release notifications.
- Rebuilding the Series detail UI itself.

## Dependencies

Builds on the existing canonical availability model and the Plex/Xtream provider adapters. The Series multi-source overview should consume the corrected lifecycle.
