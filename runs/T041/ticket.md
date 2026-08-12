# T041 — Add deterministic personalized recommendation ranking over local and discovery candidates

**Source**: GitHub Issue #81

## Description

## Objective

Rank candidate Movies/Series for the current profile using the derived taste model while respecting availability and discovery constraints.

## Context / Problem

IPTVFlix now has the building blocks for a meaningful recommender: canonical Media, Availability, user-state signals, a planned taste model and a bounded external discovery pool. The next layer must score candidates deterministically and explainably instead of hard-coding one bespoke Home query.

## Included

- Implement a backend recommendation service that can rank both canonical local Media and external discovery candidates through one provider-independent boundary.
- Use profile taste signals plus reliable media metadata for scoring.
- Support request-level constraints such as media type and `availableToMe` where practical using existing canonical availability semantics.
- Penalize/exclude already disliked or `NOT_INTERESTED` media and avoid repeatedly surfacing completed/seen content unless explicitly requested.
- Return explanation/reason data suitable for UI labels/debugging (for example matched genres/signals) without exposing implementation-sensitive raw internals.
- Keep ranking deterministic for the same profile/candidate snapshot.
- Define cold-start fallback behavior using bounded popularity/trending/discovery data rather than failing.

## Acceptance Criteria

- [ ] The service returns ordered recommendation candidates for a profile.
- [ ] Candidates may include currently unavailable/upcoming Media when the request allows it.
- [ ] `availableToMe=true` uses existing Availability state and returns only currently available candidates.
- [ ] Explicit negative feedback prevents or strongly suppresses affected Media.
- [ ] Already consumed content is handled by documented deterministic rules.
- [ ] Every returned recommendation includes a concise reason/explanation signal.
- [ ] Cold-start profiles receive useful deterministic fallback recommendations.
- [ ] Automated tests cover positive affinity, negative feedback, availability filtering, seen-content handling, local/external candidates and cold start.

## Excluded / Out of scope

- Collaborative filtering across multiple households/users.
- LLM calls as the mandatory ranking engine.
- Natural-language Shelf creation.

## Dependencies

Requires #78 discovery candidate pool and #80 taste profile.
