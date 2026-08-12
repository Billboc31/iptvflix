# T031 — Enforce provider item uniqueness for episode availabilities

**Source**: GitHub Issue #66

## Description

## Objective

Prevent one provider episode item from being attached to multiple canonical episodes.

## Context / Problem

Movie and Series availabilities enforce global uniqueness on `(providerId, providerItemId)`, but Episode availabilities currently only enforce `(episodeId, providerId, providerItemId)`.

The sync path resolves an existing episode availability by provider/source + provider item id. Without equivalent database protection, a race, matching bug or future reassignment path can persist the same provider episode item against more than one canonical episode and make subsequent lifecycle updates ambiguous.

## Included

- Add the appropriate database uniqueness/integrity constraint for provider episode identity.
- Define safe migration behavior for any pre-existing duplicates.
- Ensure sync/reconciliation handles uniqueness conflicts deterministically rather than silently producing duplicate mappings.
- Preserve valid multi-source/multi-variant behavior: different provider items may still map to the same canonical episode.

## Acceptance Criteria

- [ ] The same `(providerId, providerItemId)` cannot be attached to two canonical episodes.
- [ ] Multiple distinct provider items may still be attached to the same episode.
- [ ] Existing duplicate data, if any, is handled safely by migration/reconciliation.
- [ ] Concurrent or repeated sync cannot create duplicate provider-episode mappings.
- [ ] Automated DB/service tests cover the constraint and normal multi-variant behavior.

## Dependencies

Builds on #49 episode synchronization.
