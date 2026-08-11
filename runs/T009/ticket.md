# T009 — Document IPTVFlix product vision and technical architecture

**Source**: GitHub Issue #18

## Description

## Objective

Create durable product and engineering reference documents so AI Dev Factory agents can reuse the same product intent, technology choices and architecture constraints across future tickets.

## Context / Problem

IPTVFlix is not intended to be only another IPTV catalog/browser. Its product value is personalized discovery over the content actually available to the user, with future taste profiling, recommendations and cinema-arrival radar. The project also has architectural decisions that should not be re-decided by every Planner.

## Included

Create concise durable documentation under `docs/` covering at least:

- Product vision and value proposition.
- Primary users and initial self-hosted/personal-use assumptions.
- Core product principles: discovery first, canonical catalog, transparent recommendations, cinema radar, provider independence.
- MVP / near-term roadmap boundaries.
- Current monorepo structure and ownership of web/API/Android TV code.
- Technology stack currently established by the repository, documenting rather than replacing working Batch 1 choices.
- Architecture principles:
  - modular monolith backend;
  - provider adapters isolated from canonical domain;
  - REST/API contracts shared through explicit schemas/OpenAPI where appropriate;
  - PostgreSQL + Drizzle persistence;
  - secrets never exposed to clients/logs;
  - background work must be retryable/idempotent where applicable.
- Durable conventions for where future catalog, source, recommendation, profile and client functionality should live.

The documents must reflect the actual implemented repository. Do not introduce a new framework or rewrite Batch 1 merely to match a theoretical preferred stack.

## Acceptance Criteria

- [ ] `docs/product/` contains a concise product vision explaining what differentiates IPTVFlix from ordinary IPTV clients.
- [ ] `docs/architecture/` documents the actual current stack and monorepo structure.
- [ ] Architecture documentation explicitly states that IPTV provider-specific DTOs must not become canonical domain/UI models.
- [ ] The future Web and Android TV clients are documented as consumers of the same backend/canonical API.
- [ ] Recommendation/taste/radar goals are documented without prematurely prescribing an implementation.
- [ ] Documents are short enough to be reusable as project memory/context by AI agents.
- [ ] No documentation contradicts the current repository implementation.

## Excluded / Out of scope

- Refactoring the implementation solely to match the documentation.
- Building recommendation, radar or Android TV product features.
- Detailed ADRs for decisions not yet made.

## Dependencies

None beyond the existing Batch 1 repository state. This can run in parallel with validation work.
