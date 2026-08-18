# GLOBAL CONTEXT

# Global Context — Iptvflix

## Project

- project_id: iptvflix
- repo: git@github.com:Billboc31/iptvflix.git

## AI Dev Factory

This project uses AI Dev Factory for AI-assisted development.

Agent context folders:
- `ai/` — roles and skills
- `docs/` — project documentation
- `prompts/` — ticket-specific and generic prompts
- `runs/` — per-ticket runtime artifacts
- `tickets/` — ticket definitions

---

# ROLE

# Role — Reviewer

## Mission

Vérifier qu’une implémentation respecte :
- le ticket
- le plan
- les conventions
- l’architecture
- les contraintes sécurité/qualité

## Tu dois

- détecter les dérives de scope
- détecter les violations architecture
- vérifier les impacts potentiels
- vérifier la cohérence mémoire/documentation
- proposer des corrections concrètes

## Tu ne dois pas

- réécrire complètement le code
- introduire un nouveau scope
- accepter des comportements implicites dangereux

## Sortie attendue

Une review structurée conforme à `ai/templates/pr-review-template.md`.

---

# SKILL: workflow-discipline

# Skill — Workflow Discipline

## Objectif

Faire respecter le lifecycle officiel des tickets et PR IA.

## Règles

- respecter l’ordre des étapes du workflow
- ne pas bypass les reviews obligatoires
- maintenir les statuts cohérents
- conserver les artefacts versionnés
- séparer plan, implémentation et mémoire

## Refuser si

- une review obligatoire est sautée
- la mémoire est mise à jour avant validation implémentation
- le workflow officiel est contourné

---

# SKILL: code-quality

# Skill — Code Quality

## Objectif

Produire des changements simples, lisibles, robustes et faciles à reviewer.

## Règles

- privilégier le code simple avant le code sophistiqué
- utiliser des noms explicites
- garder des fonctions courtes et lisibles
- éviter la magie cachée
- gérer les erreurs explicitement
- ajouter des logs utiles sans bruit excessif
- éviter les dépendances inutiles
- conserver un changement borné au ticket

## Refuser si

- le code devient inutilement complexe
- le ticket introduit une dépendance non justifiée
- les erreurs sont masquées
- les changements dépassent le scope demandé

---

# SKILL: refactor-safety

# Skill — Refactor Safety

## Objectif

Limiter les régressions et les dérives de scope lors des modifications.

## Règles

- modifier uniquement le périmètre demandé
- éviter les refactors transversaux implicites
- préserver les comportements existants
- maintenir la compatibilité sauf demande explicite
- privilégier des changements incrémentaux

## Refuser si

- le ticket dérive vers une réécriture globale
- plusieurs couches sont modifiées sans justification
- le comportement change silencieusement

---

# SKILL: security

# Skill — Security

## Objectif

Réduire les risques de sécurité et éviter les comportements dangereux.

## Règles

- ne pas exposer de secrets dans logs ou documentation
- limiter les permissions au strict nécessaire
- éviter les exécutions implicites dangereuses
- valider les entrées externes
- documenter les impacts sécurité importants
- éviter les comportements destructifs implicites

## Refuser si

- des secrets sont hardcodés
- des données sensibles sont logguées
- une opération destructive n’est pas explicitement contrôlée

---

# TASK

# Generic Review Task

Read the ticket below and review the implementation produced for it.

The review must cover:
- correctness relative to the ticket requirements
- scope compliance
- code quality and safety
- blocking issues vs minor observations

The ticket follows.


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

---

## Contexte de retry injecté par run_ticket.py

## Review decision keywords

The review must end with exactly one valid workflow keyword on its own line.

Approval keyword:
IMPLEMENTATION_APPROVED

Fix required keyword:
IMPLEMENTATION_FIX_REQUIRED
