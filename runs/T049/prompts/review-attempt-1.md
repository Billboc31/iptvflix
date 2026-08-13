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


# T049 — Implement M3U catalog ingestion through the common provider boundary

**Source**: GitHub Issue #98

## Description

## Objective

Add real M3U source ingestion so IPTVFlix can consume M3U playlists without introducing provider-specific models into the canonical Media/Availability domain.

## Context / Problem

The source model already represents `M3U`, but actual M3U parsing/ingestion was intentionally deferred. Xtream and Plex now prove the provider-independent synchronization boundary; M3U should enter through that same boundary.

## Included

- Implement an M3U provider adapter for user-configured playlist URLs/credentials where applicable.
- Parse representative extended M3U metadata such as title, group/category, logo and useful provider attributes when present.
- Separate Movies, Series/Episodes and unsupported/live entries conservatively; do not invent canonical metadata from unreliable filename patterns.
- Reuse existing title normalization, matching, metadata enrichment and Availability lifecycle rather than creating an M3U-specific catalog path.
- Preserve provider item identity and raw source title for diagnostics/reprocessing.
- Handle malformed playlists, redirects, authentication/network failures, large playlists and partial metadata robustly.
- Keep secrets and credential-bearing URLs out of logs and public API payloads.
- Integrate M3U with existing source connection-test/synchronization UI where appropriate.

## Acceptance Criteria

- [ ] A configured M3U source can be connection-tested and synchronized.
- [ ] M3U Movies/Series that can be identified safely enter the existing canonical matching/enrichment flow.
- [ ] M3U items matched to existing canonical Media become additional availabilities rather than duplicate cards.
- [ ] Raw titles/provider identifiers remain available within the ingestion/availability boundary.
- [ ] Live-TV or ambiguous entries are not incorrectly persisted as Movies/Series merely to increase coverage.
- [ ] Repeated synchronization is idempotent and disappearance/reappearance follows the common lifecycle rules.
- [ ] Large/malformed playlists fail gracefully without exposing secrets.
- [ ] Tests use fixtures and cover common extended-M3U formats, malformed entries, duplicate works and failure paths.

## Excluded / Out of scope

- Live TV browsing/player UX.
- EPG ingestion.
- Rewriting the canonical matching algorithm.
- Android TV playback.

## Dependencies

Builds on the existing provider-independent Source/Media/Availability architecture. Can run in parallel with hosted deployment work.

---

## Contexte de retry injecté par run_ticket.py

## Review decision keywords

The review must end with exactly one valid workflow keyword on its own line.

Approval keyword:
IMPLEMENTATION_APPROVED

Fix required keyword:
IMPLEMENTATION_FIX_REQUIRED
