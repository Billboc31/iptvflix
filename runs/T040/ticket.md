# T040 — Build a durable profile taste model from viewing and feedback signals

**Source**: GitHub Issue #80

## Description

## Objective

Derive a reusable, explainable taste profile for each IPTVFlix profile from durable user signals so recommendation features do not have to reinterpret raw history on every request.

## Context / Problem

IPTVFlix already has watchlist/history/progress and will gain explicit feedback. Recommendations need a stable profile-level representation of preferences across genres, recurring metadata attributes and strongly positive/negative media signals.

The taste model should be deterministic and explainable first; do not introduce an opaque LLM dependency as the core scoring mechanism.

## Included

- Define a profile-scoped taste representation derived from available signals such as completed/started viewing, watchlist, likes/dislikes/not-interested and relevant canonical metadata.
- Weight explicit negative/positive feedback more strongly than weak behavioral signals where appropriate.
- Derive useful preferences from metadata currently available in the canonical/external model (for example genres and other reliable attributes the repository already exposes).
- Store or cache derived taste state with a clear rebuild/update strategy.
- Make derivation idempotent and deterministic for the same source signals.
- Expose a concise API/debug representation explaining the strongest inferred preferences/signals without leaking internal provider DTOs.
- Handle cold-start profiles with little/no history cleanly.

## Acceptance Criteria

- [ ] A taste profile can be generated from existing profile interaction data.
- [ ] Explicit likes/dislikes materially affect derived taste in the expected direction.
- [ ] Weak signals such as watchlist/incomplete viewing do not automatically imply the same strength as a Like.
- [ ] Rebuilding from unchanged inputs produces equivalent taste output.
- [ ] Cold-start profiles return a valid empty/minimal taste state rather than failing.
- [ ] Taste state references canonical/external metadata concepts rather than source-specific items.
- [ ] Tests cover positive, negative, mixed, sparse and repeated rebuild scenarios.

## Excluded / Out of scope

- Final recommendation candidate ranking.
- LLM-generated natural-language taste descriptions as a required runtime dependency.
- Netflix account scraping/import.

## Dependencies

Uses the existing user-state foundation (#23) and explicit feedback from #79.
