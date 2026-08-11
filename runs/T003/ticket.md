# T003 — Define canonical media catalog domain

**Source**: GitHub Issue #4

## Description

## Objective
Define the canonical IPTVFlix media domain independently from Xtream Codes, M3U, or any future provider so all clients and backend features operate on one normalized catalog model.

## Context / Problem
IPTV providers expose inconsistent structures, titles, identifiers, categories, and metadata. If provider-specific models leak into the core domain, the web UI, Android TV client, recommendations, radar, and synchronization logic will become tightly coupled to individual source formats.

## Included
- Define the canonical entities and persistence model needed for the first catalog vertical slice, including at minimum:
  - Movie.
  - Series.
  - Season.
  - Episode.
  - Genre/category representation where relevant.
  - External identifiers/metadata references.
  - Source availability linking canonical media to provider items.
- Availability must support provider/source identity, provider item identity, and lifecycle information including `firstSeenAt` and `lastSeenAt`.
- Model the domain so a canonical media item can later be available from more than one IPTV source.
- Keep provider payloads outside the canonical domain.
- Add migrations and tests for important constraints and relationships.

## Acceptance Criteria
- [ ] Movies, series, seasons, and episodes have clear canonical representations.
- [ ] Provider-specific identifiers are represented through source availability/mapping rather than being the canonical primary identity.
- [ ] Availability records persist `firstSeenAt` and `lastSeenAt` without losing the original first-seen timestamp on later synchronization.
- [ ] The model can represent one canonical item on multiple sources.
- [ ] Database constraints prevent invalid or obviously duplicate source mappings where appropriate.
- [ ] Schema/migrations and representative domain tests are included.
- [ ] No Xtream- or M3U-specific DTO becomes the core catalog model.

## Excluded / Out of scope
- Full metadata enrichment/matching algorithm.
- Recommendation scoring.
- Cinema radar logic.
- Frontend catalog screens.

## Dependencies
Requires #3 for the persistence foundation. The detailed provider adapters can be developed independently against this canonical boundary once its contracts are established.
