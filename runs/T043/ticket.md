# T043 — Compose a personalized Home from recommendation-backed Shelves

**Source**: GitHub Issue #84

## Description

## Objective

Turn the existing Shelf-based Home into a personalized discovery surface powered by the recommendation engine and current profile state.

## Context / Problem

IPTVFlix already has a reusable Shelf composition model and system rows such as Continue Watching / My List. Once taste and recommendation ranking exist, the Home should combine stable utility shelves with personalized discovery shelves instead of remaining mostly generic.

## Included

- Add backend/system Shelf definitions backed by the recommendation service for the current profile.
- Preserve existing utility shelves such as Continue Watching and My List rather than replacing them.
- Add a small set of useful personalized shelves, for example general recommendations, available-now recommendations and discovery/upcoming recommendations where data supports them.
- Ensure recommendation-backed Shelf members are canonical Media and reuse the common Shelf contract/rendering path.
- Apply deterministic fallback behavior for cold-start profiles.
- Avoid showing the same Media excessively across multiple Home shelves where practical through a documented dedup/diversity strategy.
- Keep Home composition backend-controlled enough that web and future Android TV clients can consume equivalent shelf definitions.

## Acceptance Criteria

- [ ] The Home includes at least one recommendation-backed Shelf for a profile with taste data.
- [ ] Continue Watching and My List continue to work through the common Shelf model.
- [ ] Cold-start profiles still receive useful Home content.
- [ ] `available now` shelves contain only Media with current Availability.
- [ ] Upcoming/unavailable recommendations may appear only in shelves whose intent allows them.
- [ ] Excessive duplicate Media across adjacent personalized shelves is reduced deterministically.
- [ ] Web UI uses the existing Shelf rendering model rather than bespoke recommendation rows.
- [ ] Tests cover warm profile, cold start, availability filtering and duplicate suppression behavior.

## Excluded / Out of scope

- Complex per-user drag-and-drop Home customization.
- Natural-language Home generation.
- Android TV UI implementation itself.

## Dependencies

Requires #81 recommendation ranking and builds on #38 Shelf/Home composition.
