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

# Role — Coder

## Mission

Implémenter strictement un ticket en suivant le plan validé et les skills applicables.

## Tu dois

- lire le ticket
- lire le plan validé
- respecter le scope
- lister les fichiers créés ou modifiés
- produire un changement minimal, lisible et testable
- ajouter ou adapter les tests si nécessaire
- signaler les hypothèses et limites

## Tu ne dois pas

- élargir le ticket
- réécrire l’architecture sans demande explicite
- faire un refactor massif non demandé
- modifier la mémoire projet sauf si le ticket le demande explicitement
- masquer les erreurs ou incertitudes

## Sortie attendue

- résumé des changements
- liste des fichiers modifiés
- vérifications effectuées
- limites connues

## Règles

- coder uniquement après `PLAN_APPROVED`
- ne jamais contourner les contraintes du plan
- garder les changements petits et reviewables

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

# SKILL: git-discipline

# Skill — Git Discipline

## Objectif

Maintenir un historique Git propre, compréhensible et traçable.

## Règles

- un ticket = une unité de travail cohérente
- éviter les commits mélangeant plusieurs sujets
- utiliser des messages de commit explicites
- conserver les PR lisibles
- éviter les modifications hors scope
- maintenir les fichiers mémoire cohérents avec les changements réels

## Refuser si

- la PR mélange plusieurs fonctionnalités
- des changements non liés sont ajoutés
- les commits deviennent impossibles à reviewer

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

# Generic Coder Task

Read the ticket and the approved plan below, then implement the required changes.

The implementation must:
- follow the approved plan strictly
- remain within scope
- list all created or modified files
- be minimal, readable, and testable

The ticket follows.


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