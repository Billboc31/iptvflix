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


# T003 — Define canonical media catalog domain

**Source**: GitHub Issue #4

## Description

## Objective
Define the canonical IPTVFlix media domain independently from Xtream Codes, M3U, or any future provider so all clients and backend features operate on one normalized catalog model.

## Context / Problem
IPTV providers expose inconsistent structures, titles, identifiers, categories, and metadata. If provider-specific models leak into the core domain, the web UI, Android TV client, recommendations, radar, and synchronization logic will become tightly coupled to individual source formats.

## Included
- Define the canonical entities and persistence model needed for the first catalog vertical slice, including at minimum:
  - Movie.
  - Series.
  - Season.
  - Episode.
  - Genre/category representation where relevant.
  - External identifiers/metadata references.
  - Source availability linking canonical media to provider items.
- Availability must support provider/source identity, provider item identity, and lifecycle information including `firstSeenAt` and `lastSeenAt`.
- Model the domain so a canonical media item can later be available from more than one IPTV source.
- Keep provider payloads outside the canonical domain.
- Add migrations and tests for important constraints and relationships.

## Acceptance Criteria
- [ ] Movies, series, seasons, and episodes have clear canonical representations.
- [ ] Provider-specific identifiers are represented through source availability/mapping rather than being the canonical primary identity.
- [ ] Availability records persist `firstSeenAt` and `lastSeenAt` without losing the original first-seen timestamp on later synchronization.
- [ ] The model can represent one canonical item on multiple sources.
- [ ] Database constraints prevent invalid or obviously duplicate source mappings where appropriate.
- [ ] Schema/migrations and representative domain tests are included.
- [ ] No Xtream- or M3U-specific DTO becomes the core catalog model.

## Excluded / Out of scope
- Full metadata enrichment/matching algorithm.
- Recommendation scoring.
- Cinema radar logic.
- Frontend catalog screens.

## Dependencies
Requires #3 for the persistence foundation. The detailed provider adapters can be developed independently against this canonical boundary once its contracts are established.

---

## Contexte de retry injecté par run_ticket.py

## Review decision keywords

The review must end with exactly one valid workflow keyword on its own line.

Approval keyword:
IMPLEMENTATION_APPROVED

Fix required keyword:
IMPLEMENTATION_FIX_REQUIRED
