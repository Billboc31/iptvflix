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


# T021 — Introduce reusable manual and dynamic Shelves as the primary discovery composition model

**Source**: GitHub Issue #38

## Description

## Objective

Introduce `Shelf` as a reusable ordered grouping of canonical Media so Home and future discovery experiences can be composed consistently from system, manual and rule-driven shelves.

## Context / Problem

IPTVFlix needs a flexible presentation model for rows such as `Continue Watching`, `My List`, `New on IPTV`, `Available in French`, custom collections and future personalized recommendations. These should not each become unrelated bespoke frontend/backend implementations. A Shelf groups canonical Media; it never owns provider items directly.

## Included

- Define a Shelf model/contract with stable identity, title, type/origin, ordering and presentation hints where useful without coupling domain logic to one web layout.
- Support at least:
  - system shelves backed by existing product queries/state;
  - manual shelves whose Media membership/order is user-managed;
  - dynamic rule-based shelves using a constrained/validated filter definition over canonical catalog attributes and availability state.
- Ensure Shelf members reference canonical Media identities only.
- Provide profile-scoped CRUD for user-created shelves and membership where applicable.
- Allow useful dynamic filters supported by current data, such as media type, genre, release period, available-to-me, language/quality when variant data exists, and watch state where appropriate.
- Compose the web Home from the common Shelf rendering model while preserving existing functionality such as Continue Watching/My List.
- Keep shelf evaluation deterministic and backend-controlled; do not accept arbitrary SQL/query expressions from clients.
- Design the model so future recommendation/AI-generated shelves can supply/rank Media without changing the Shelf contract.

## Acceptance Criteria

- [ ] Home can render multiple rows through one reusable Shelf contract/component model.
- [ ] Existing `Continue Watching` and `My List` can be represented through the Shelf composition layer without losing behavior.
- [ ] A user can create a manual Shelf, add/remove canonical Media and control its order.
- [ ] A dynamic Shelf can be defined using validated supported rules and refreshes when matching catalog/availability data changes.
- [ ] Shelf membership never stores Xtream/Plex/provider item IDs as canonical members.
- [ ] Invalid/unsafe dynamic rules are rejected server-side.
- [ ] Shelf presentation hints do not embed provider-specific assumptions.
- [ ] The contract can later support AI/recommendation-generated shelves without schema replacement.
- [ ] Automated tests cover manual ordering, dynamic evaluation, profile isolation and invalid rules.

## Excluded / Out of scope

- LLM natural-language Shelf creation.
- Recommendation/taste scoring.
- Sharing shelves between users.
- Complex visual shelf editor.

## Dependencies

Follows #32. Dynamic availability/language filters can consume #33/#34 when available, but the core Shelf model and manual/system shelves can be developed independently against the existing canonical catalog.

---

## Contexte de retry injecté par run_ticket.py

## Review decision keywords

The review must end with exactly one valid workflow keyword on its own line.

Approval keyword:
IMPLEMENTATION_APPROVED

Fix required keyword:
IMPLEMENTATION_FIX_REQUIRED
