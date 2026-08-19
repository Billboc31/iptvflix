# T113 — Increase semantic retrieval pool before filtering and personalized reranking

**Source**: GitHub Issue #240

## Description

## Context

The current recommendation-engine semantic search uses the final request limit directly in the pgvector query, then applies hard filters, profile reranking and diversity on that very small set.

This makes personalization weaker than intended and can produce thin shelves after filtering.

Current shape:

`semantic query -> vector LIMIT ~20/30 -> filters -> profile rerank -> final shelf`

Target shape:

`semantic query -> vector TOP ~200 -> hard filters -> profile rerank -> diversity/exposure -> final 20/30`

## Goal

Separate **retrieval depth** from **final result limit**.

## Required work

- Add a configurable semantic retrieval pool size, default around 200 candidates per query.
- Keep the final result limit independent (for example 20-30 items for a shelf).
- Semantic retrieval must use the larger retrieval pool.
- Apply QueryPlan hard filters against the larger pool before final truncation.
- Apply profile-aware reranking, exposure penalties and diversity on the filtered pool.
- Truncate only at the very end to the requested final limit.
- Avoid pathological query sizes if many current-session media IDs are excluded; use a sane cap.
- Preserve text-search fallback behavior.
- Persist/debug both counts: retrieved candidate count and final result count.

## Unknown metadata policy

Define an explicit policy for hard filters when required metadata is missing.

Examples:
- max runtime <= 90 min but runtime unknown;
- min release year but year unknown;
- audio language constraint but language unknown.

Do not silently treat unknown values as automatically passing hard constraints. Implement and document an explicit policy such as `STRICT_EXCLUDE_UNKNOWN` for true hard filters, with any relaxed behavior clearly opt-in.

## Acceptance criteria

- [ ] `retrievalLimit` is separate from final `limit`.
- [ ] Default semantic retrieval pool is approximately 200 candidates and configurable.
- [ ] Hard filters run before final truncation.
- [ ] Profile reranking and diversity operate on the larger pool.
- [ ] Final shelf still returns only the configured 20-30 items.
- [ ] Debug/provenance exposes retrieved vs filtered vs final candidate counts.
- [ ] Unknown metadata handling for hard filters is explicit and tested.
- [ ] Real query `SF qui fait réfléchir` demonstrates that personalization can reorder/select from a pool materially larger than the final shelf.
- [ ] Regression tests cover WATCH_NOW, DISCOVERY and mixed movie/series queries.

## Completion rule

Do not close on unit tests alone. Run at least three real recommendation queries against a populated embedding index and show retrieval pool size, filtered count and final result count.
