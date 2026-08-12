# T044 — Add refresh semantics for generated and recommendation-backed Shelves

**Source**: GitHub Issue #85

## Description

## Objective

Make generated and recommendation-backed Shelves refreshable as taste, availability and discovery candidates change, without replacing the existing Shelf abstraction.

## Context / Problem

A generated Shelf should represent an intent, not only a frozen member list. New Movies/Series can enter the discovery pool, source Availability can change, and the user's taste signals can evolve. IPTVFlix needs deterministic refresh behavior so these Shelves stay relevant over time.

## Included

- Add explicit refresh semantics for recommendation/generated Shelf types while preserving manual Shelf ordering/membership.
- Re-evaluate Shelf members from persisted intent/provenance using the existing recommendation service.
- Define when refresh may happen on demand and what metadata is stored to know when the Shelf was last evaluated.
- Preserve deterministic member ordering for a fixed input snapshot.
- Reuse canonical Media identity and existing external-candidate materialization/deduplication boundaries.
- Avoid destructive churn where possible: document how removed, newly added and still-relevant members are handled.
- Ensure refresh does not silently mutate manual Shelves.

## Acceptance Criteria

- [ ] Generated/recommendation Shelves can be refreshed without recreating the Shelf.
- [ ] Manual Shelves are never automatically recomputed.
- [ ] Refresh uses current taste/candidate/availability state and produces deterministic ordering for the same inputs.
- [ ] Newly relevant candidates can enter the Shelf and no-longer-valid candidates can leave according to documented rules.
- [ ] Duplicate canonical Media are not created during refresh.
- [ ] Last-evaluated/refresh metadata is persisted or exposed sufficiently for diagnostics.
- [ ] Tests cover unchanged refresh, changed candidate pool, changed availability, changed taste and manual-Shelf protection.

## Excluded / Out of scope

- A general background scheduler/cron platform.
- Push notifications.
- Natural-language prompt editing.

## Dependencies

Builds on #81 recommendation ranking, #83 generated Shelves and the existing Shelf model.
