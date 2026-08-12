# T038 — Build a bounded local discovery candidate pool from external metadata

**Source**: GitHub Issue #78

## Description

## Objective

Create a reusable local pool of external Movie/Series candidates so recommendation and Shelf generation can rank a broad catalog without importing all of TMDB or making large live API fan-out requests on every user interaction.

## Context / Problem

IPTVFlix already supports external discovery for individual unavailable/upcoming media (#36), but personalized recommendations need a broader candidate universe than only locally available or explicitly materialized Media.

The target architecture is hybrid: local durable Media for user-relevant works, plus a bounded refreshable discovery pool sourced from external metadata.

## Included

- Add a persisted/cached discovery-candidate representation suitable for Movies and Series returned by the existing external metadata boundary.
- Populate candidates from bounded provider feeds such as popular, trending, upcoming and genre-oriented discovery where supported.
- Preserve external identity/provenance and enough metadata for deterministic filtering/scoring without fabricating Availability.
- Define refresh/expiry semantics so stale candidates can be updated or evicted.
- Deduplicate candidates against canonical Media/external identities already known locally.
- Allow candidates to be materialized/reused as canonical Media when a downstream action requires persistence.
- Keep provider calls bounded, rate-limit aware and retryable.

## Acceptance Criteria

- [ ] IPTVFlix can maintain a local discovery pool substantially broader than configured IPTV/Plex availability without importing the provider's entire catalog.
- [ ] Candidate rows preserve external identity and metadata provenance.
- [ ] Refreshing the pool is idempotent and does not create duplicates.
- [ ] Candidate refresh is bounded and safe under metadata-provider failures/rate limits.
- [ ] Existing canonical Media are reused/deduplicated when identities match.
- [ ] A candidate can later be materialized into canonical Media with zero Availability without creating a duplicate work.
- [ ] Tests cover refresh, expiry, deduplication, provider failure and materialization boundaries.

## Excluded / Out of scope

- Recommendation scoring.
- Taste-profile generation.
- Importing all external provider titles.
- LLM-based recommendations.

## Dependencies

Builds on #36 external catalog discovery and the existing metadata provider abstraction.
