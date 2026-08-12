# T026 — Fix dynamic Shelf availability filtering and unsupported rule semantics

**Source**: GitHub Issue #51

## Description

## Objective

Make dynamic Shelf rules deterministic for both positive and negative availability filters, and prevent explicitly requested rules from being silently ignored.

## Context / Problem

The current Shelf evaluator only applies the availability predicate when `availableToMe` is truthy. Therefore a dynamic Shelf configured with `availableToMe: false` behaves as if no availability filter was supplied, mixing available and unavailable Media.

The Series evaluator also silently ignores `watchState`, even though the rule validator accepts it. A user-defined rule must either be implemented with documented semantics or rejected explicitly; silently ignoring it makes Shelves misleading.

## Included

- Treat `availableToMe` as a tri-state rule:
  - undefined = no availability filter;
  - true = at least one current AVAILABLE availability;
  - false = no current AVAILABLE availability.
- Apply the same semantics consistently to Movies and Series.
- Ensure zero-availability/upcoming canonical Media can participate in `availableToMe=false` Shelves.
- Review accepted dynamic Shelf rules so every validated rule has deterministic behavior for the selected media type.
- For `watchState` on Series, either implement a well-defined Series-level derivation from Episode progress or reject the unsupported combination server-side; do not silently ignore it.
- Keep all rule evaluation backend-controlled and parameterized through the existing constrained rule model.

## Acceptance Criteria

- [ ] `availableToMe=true` returns only Media with at least one current AVAILABLE availability.
- [ ] `availableToMe=false` returns only Media with no current AVAILABLE availability, including zero-availability Media.
- [ ] Omitting `availableToMe` leaves availability unrestricted.
- [ ] Movie and Series rules use consistent availability semantics.
- [ ] An explicitly supplied `watchState` for Series is either correctly evaluated or rejected with a clear validation error; it is never silently ignored.
- [ ] Dynamic Shelf results refresh correctly when availability changes.
- [ ] Automated tests cover true/false/undefined availability filters for Movies and Series plus Series `watchState` behavior.

## Excluded / Out of scope

- Natural-language Shelf creation.
- Recommendation ranking.
- New complex Shelf rule types.

## Dependencies

Builds on the existing Shelf and canonical Availability implementations.
