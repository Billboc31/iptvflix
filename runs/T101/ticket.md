# T101 — Create standalone Recommendation Lab service and simple Web UI

**Source**: GitHub Issue #204

## Description

## Context
IPTVFlix needs a recommendation system that can be developed, queried and evaluated independently from the main product UI. We explicitly do NOT want recommendation logic buried inside the Home page or coupled to one frontend implementation.

Existing foundations:
- #201 Account -> Profile
- #203 profile-level interaction/taste data

This ticket creates the standalone LAB / SERVICE shell only. Follow-up tickets add embeddings, LLM query planning, reranking, shelf generation and Home integration.

## Goal
Create a separately deployable/queryable `recommendation-engine` plus a very small `recommendation-lab` Web UI so recommendation quality can be tested interactively before connecting it to IPTVFlix Home.

Target shape:

```text
IPTVFlix DB / catalog / profiles
          ↓
recommendation-engine
          ↑
  internal HTTP API
          ↑
recommendation-lab Web UI
```

The service should be runnable locally and deployable as a separate Railway service later.

## 1. Service boundary
Add a standalone application/package under the monorepo, e.g.:
- `apps/recommendation-engine`
- and optionally `apps/recommendation-lab`

Do not mix this into `apps/api` beyond a thin integration client later.

Define clear ownership:
- reads canonical catalog data;
- reads profile/taste/interactions when requested;
- computes/query recommendations;
- never owns playback/source credentials;
- does not become another canonical media database.

## 2. Internal API
Expose versioned internal endpoints suitable for experimentation, for example:

`POST /v1/query`

Request:
```json
{
  "text": "SF qui fait réfléchir, sombre, peu d'action, moins de 2h",
  "profileId": "optional",
  "mediaTypes": ["movie"],
  "limit": 24,
  "debug": true
}
```

Response should be designed to evolve and eventually include:
- interpreted query/plan;
- candidate IDs;
- final result IDs;
- score breakdown;
- applied filters;
- model/version metadata;
- timing metrics.

Do not expose account/provider secrets.

## 3. Recommendation Lab UI
Create a deliberately simple developer/admin Web UI, not a polished consumer UI.

Minimum screen:
- free-text query input;
- optional Profile selector/id;
- content type selector;
- limit selector;
- toggles for pipeline stages as they become available;
- Search button;
- result cards with poster/title;
- diagnostic scores/reasons;
- raw structured query/plan panel;
- timing/latency panel.

Suggested future-compatible toggles:
- LLM query expansion
- vector retrieval
- metadata filtering
- profile personalization
- hybrid reranking

If a stage is not implemented yet, show it disabled rather than faking behavior.

## 4. Comparison mode
Prepare the Lab to compare strategies side-by-side later, e.g.:
- raw text vector search;
- LLM-expanded query;
- vector + structured filters;
- full hybrid personalized ranking.

Persisting experiments is not required in this ticket but API/UI contracts should not prevent it.

## 5. Catalog access
Reuse the existing canonical catalog/database. Do not duplicate all movies/series into a new relational DB just for the Lab.

Use a repository/data-access boundary so the recommendation service can later switch between shared Postgres read access or a dedicated recommendation store without changing callers.

## 6. Profile authorization
The Lab is developer/admin tooling. If it accepts `profileId`, ensure it only reads profiles allowed by the authenticated/admin context. Do not create an insecure endpoint that lets arbitrary users inspect another account's taste/history.

## 7. Observability
Log structured, sanitized diagnostics:
- request ID;
- pipeline stage timings;
- candidate counts;
- final result count;
- failures per stage;
- model/index versions.

No raw account passwords, Xtream credentials or secret-bearing provider URLs.

## 8. Railway readiness
Provide deploy/start configuration suitable for Railway as an independent service:
- health endpoint;
- PORT binding;
- environment configuration;
- database connectivity;
- LLM/embedding provider config placeholders (not secrets committed);
- graceful startup when optional AI providers are not configured.

## Acceptance criteria
- [ ] Standalone recommendation service exists outside the main API runtime.
- [ ] Service has a health endpoint and versioned query API.
- [ ] Simple Recommendation Lab Web UI can call it.
- [ ] User can type a natural-language recommendation query and see the current baseline result path.
- [ ] Debug response can carry stage outputs/scores/version metadata.
- [ ] Pipeline stages are architected as independently switchable components.
- [ ] Catalog access reuses canonical IPTVFlix data.
- [ ] Profile access is authorization-safe.
- [ ] Local run instructions exist.
- [ ] Railway deployment config exists or is documented.
- [ ] Missing optional LLM/vector stages fail gracefully and visibly.

## Completion rule
Do not close because folders/routes exist. Run the engine + lab locally, issue at least one real query against the existing IPTVFlix catalog, render real catalog titles in the Lab, and show the diagnostic request/response path end-to-end.
