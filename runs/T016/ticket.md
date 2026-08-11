# T016 — Evolve the canonical catalog to support media with zero or many availabilities

**Source**: GitHub Issue #33

## Description

## Objective

Evolve the existing canonical catalog so a Movie, Series, Season or Episode has an identity and lifecycle independent from configured content sources, while retaining zero, one or many source availabilities.

## Context / Problem

Batch 1/2 established canonical Movies/Series and source availability mappings. IPTVFlix now needs to become a universal library: an upcoming movie may be discoverable and tracked before it exists on IPTV, while an existing work may simultaneously be available on Xtream and Plex. Source disappearance must not delete the canonical work.

## Included

- Review and evolve the existing canonical persistence/API model rather than replacing it blindly.
- Ensure canonical Movies and Series can exist without any configured-source availability.
- Preserve the Series → Season → Episode hierarchy and allow episode-level availability where appropriate.
- Ensure availability records remain source/provider mappings and do not define canonical identity.
- Support multiple concurrent availabilities for the same canonical work/episode.
- Preserve existing Batch 1/2 canonical IDs and user-state references where reasonably possible through safe migrations.
- Expose explicit availability state/count information through canonical API contracts without provider DTO leakage.
- Ensure source disappearance/removal can leave useful canonical metadata, watchlist/history and release tracking intact.

## Acceptance Criteria

- [ ] A canonical Movie can exist and be returned by the canonical API with zero availabilities.
- [ ] A canonical Series and its known Season/Episode hierarchy can exist with zero availabilities.
- [ ] One canonical Movie/Episode can reference multiple availabilities from different sources.
- [ ] Removing or losing an availability does not delete canonical metadata or user tracking for the work.
- [ ] Existing canonical references used by watchlist/history remain valid or are migrated deterministically.
- [ ] Provider-specific identifiers remain confined to source/availability mappings.
- [ ] Database constraints prevent obvious duplicate mappings while permitting legitimate variants.
- [ ] Automated migration/domain/API tests cover zero, one and multiple availability cases plus disappearance.

## Excluded / Out of scope

- Importing the entire external movie database.
- Plex ingestion itself.
- Language/quality preference resolution.
- Release notifications.

## Dependencies

Must follow the universal-domain invariants documented by #32. Builds on the existing canonical catalog and metadata/matching implementation.
