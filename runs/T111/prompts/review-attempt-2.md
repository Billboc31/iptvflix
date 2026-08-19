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

---

## Contexte de retry injecté par run_ticket.py

## Review decision keywords

The review must end with exactly one valid workflow keyword on its own line.

Approval keyword:
IMPLEMENTATION_APPROVED

Fix required keyword:
IMPLEMENTATION_FIX_REQUIRED
