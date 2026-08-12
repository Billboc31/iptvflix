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


# T042 — Generate personalized Shelves from seed media and recommendation intent

**Source**: GitHub Issue #83

## Description

## Objective

Allow a user to create a personalized Shelf by selecting a small set of seed Movies/Series, such as three films they like, and let IPTVFlix generate a coherent recommendation-based Shelf from those seeds.

## Context / Problem

The Shelf model already supports reusable manual/dynamic composition, and the new recommendation engine will provide ranked candidates. A key product experience is to let the user say, in effect, “build me a Shelf from these 3 films” without exposing low-level recommendation filters.

The generated Shelf must preserve a durable intent so it can be refreshed as the catalog/discovery pool evolves, rather than becoming only a frozen one-time list.

## Included

- Add a backend/domain operation that accepts a bounded set of canonical seed Media plus optional supported constraints such as media type, availability-to-me and runtime where the current model can enforce them reliably.
- Derive a recommendation intent/profile from the seed Media using existing metadata and recommendation boundaries; do not introduce provider-specific logic.
- Generate an ordered Shelf whose members reference canonical Media identities only.
- Persist enough generation metadata/intent so the Shelf can be refreshed deterministically later.
- Materialize external discovery candidates into canonical zero-Availability Media only when needed for durable Shelf membership, reusing existing identity/deduplication rules.
- Expose a lightweight web flow for selecting seed Media and creating the Shelf.
- Return concise explanation metadata describing why the Shelf was generated, without making an LLM call mandatory for runtime functionality.

## Acceptance Criteria

- [ ] A user can select at least 3 canonical Movies/Series and create a generated Shelf.
- [ ] The Shelf contains ranked recommendations derived from the seeds and current recommendation engine.
- [ ] Seed titles themselves are not duplicated as recommendations unless explicitly allowed by a documented rule.
- [ ] Shelf members are canonical Media, never provider item IDs or raw external candidates.
- [ ] External candidates are safely deduplicated/materialized when durable membership requires it.
- [ ] The generated Shelf stores enough intent/provenance to be refreshed later.
- [ ] Optional constraints are validated server-side and reuse existing availability semantics.
- [ ] Tests cover seed validation, deterministic generation, deduplication, unavailable candidates and persistence.

## Excluded / Out of scope

- Free-form natural-language Shelf prompts.
- Sharing shelves between profiles.
- Mandatory LLM generation of the Shelf.

## Dependencies

Requires #81 recommendation ranking and the existing Shelf model from #38.

---

## Contexte de retry injecté par run_ticket.py

## Review decision keywords

The review must end with exactly one valid workflow keyword on its own line.

Approval keyword:
IMPLEMENTATION_APPROVED

Fix required keyword:
IMPLEMENTATION_FIX_REQUIRED
