# T111 — Consolidate recommendation logic into the standalone recommendation-engine

**Source**: GitHub Issue #233

## Description

## Context

The repository currently contains two partially overlapping recommendation implementations:

- `apps/recommendation-engine`, intended by #204 to be the standalone/queryable source of truth, but parts of its planner/vector pipeline are still stubbed/incomplete;
- real recommendation logic implemented inside `apps/api` (embedding service, semantic retrieval, LLM query planning, profile-aware ranking, shelf history/Home integration).

This duplication makes the Recommendation Lab misleading and creates a high risk that Home and Lab evaluate different algorithms.

## Goal

Make `apps/recommendation-engine` the single source of truth for recommendation computation, while `apps/api` becomes a thin authenticated/product integration layer.

Target architecture:

```text
IPTVFlix canonical DB / profiles / interaction data
                ↓
      recommendation-engine
      - Query Planner
      - semantic retrieval
      - hybrid reranker
      - shelf concept generation
      - shelf instance generation
                ↑
       internal versioned API
          ↙             ↘
IPTVFlix API/Home     Recommendation Lab
```

## Required work

- Inventory duplicate recommendation services in `apps/api` and `apps/recommendation-engine`.
- Move/extract the working implementations rather than rewriting them from scratch.
- Remove/replace stub semantic-search/query-planner behavior in the standalone engine.
- Define versioned internal contracts for:
  - free-text recommendation query;
  - QueryPlan/debug output;
  - semantic candidate retrieval;
  - personalized reranking;
  - shelf concept preview/generation;
  - final ShelfInstance generation.
- Update the Recommendation Lab to call the standalone engine directly (or through one explicitly thin authenticated proxy), not a separate in-API algorithm.
- Update Home/recommendation integration to consume the same standalone engine outputs.
- Keep authentication/account authorization in the main API where appropriate; do not expose private Profile data publicly from the engine.
- Preserve resilient fallback behavior if recommendation-engine is temporarily unavailable.
- Remove dead/duplicate code only after callers have migrated and tests prove equivalence.

## Observability/versioning

Every recommendation result should expose internally/debug:
- engine version;
- embedding model/index version;
- planner model/prompt/schema version;
- reranker version;
- timings per stage;
- fallback flags.

This allows Home and Lab output to be compared exactly.

## Acceptance criteria

- [ ] Standalone `recommendation-engine` performs real LLM planning, vector retrieval and hybrid ranking; no production stage remains a stub.
- [ ] Recommendation Lab uses that engine as its actual computation source.
- [ ] Personalized Home uses the same engine as the Lab.
- [ ] Main API no longer contains a competing full recommendation implementation.
- [ ] One query with the same Profile/config produces equivalent ordered results in Lab and product integration.
- [ ] Missing recommendation-engine does not break authentication, playback, Continue Watching or basic catalog browsing.
- [ ] Internal Profile access is authorization-safe.
- [ ] Engine/version/timing metadata is observable.

## Completion rule

Do not close because an HTTP client was added. Run `SF qui fait réfléchir` with a real Profile through the Lab and through the product integration and demonstrate both paths invoke the same engine version and return the same ranked recommendation result (allowing only presentation-level differences).
