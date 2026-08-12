# T039 — Add explicit like, dislike and not-interested feedback signals

**Source**: GitHub Issue #79

## Description

## Objective

Capture explicit user preference signals that can complement watchlist/history/progress when building a reliable taste profile and recommendation engine.

## Context / Problem

IPTVFlix already stores watchlist and viewing-progress/history signals (#23), but those actions do not always mean the user liked the content. The recommendation layer needs an explicit way to distinguish positive preference, negative preference and simple lack of interest.

## Included

- Add profile-scoped explicit feedback for canonical Movies/Series with at least `LIKE`, `DISLIKE` and `NOT_INTERESTED` semantics.
- Ensure only one current explicit preference state exists per profile/media while preserving deterministic updates/removal.
- Expose canonical API operations to set, change and clear feedback.
- Add lightweight web controls on relevant media detail/card surfaces without coupling recommendation logic to the frontend.
- Keep feedback independent from Watchlist, Follow Release and viewing progress.
- Preserve enough timestamps/provenance for downstream taste/recommendation scoring.

## Acceptance Criteria

- [ ] A profile can like, dislike, mark not interested, change or clear feedback for a Movie/Series.
- [ ] Explicit feedback survives restart and references canonical Media identity only.
- [ ] Watchlist/follow/progress are not implicitly modified when feedback changes.
- [ ] Repeated identical updates are idempotent.
- [ ] API validates profile/media references server-side.
- [ ] Web UI reflects current feedback state and supports changing it.
- [ ] Tests cover all feedback transitions, profile isolation and independence from existing user-state features.

## Excluded / Out of scope

- Recommendation scoring itself.
- Star ratings or free-text reviews.
- Importing Netflix ratings/history.

## Dependencies

Builds on the existing profile and canonical Media foundations from #23.
