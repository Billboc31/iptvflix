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


# T050 — Add secure Web playback flow from selected Availability

**Source**: GitHub Issue #99

## Description

## Objective

Allow a user to start actual Movie/Episode playback from the Web app using the backend-selected Availability while keeping provider-specific playback details and credentials contained as safely as possible.

## Context / Problem

IPTVFlix can now normalize multiple source/language/quality variants and deterministically select the preferred Availability, but actual playback was intentionally deferred. A hosted Web test should support the complete flow from Media detail/recommendation to Play.

Xtream/M3U playback references may contain sensitive source credentials. The implementation must not simply expose stored provider secrets through generic catalog APIs or logs.

## Included

- Add a backend playback-resolution boundary that accepts canonical Movie/Episode identity (and optional explicit availability choice) and revalidates the requested Availability server-side.
- Reuse the existing profile best-availability resolver for default playback selection.
- Resolve provider-specific playback information inside the provider/availability layer for Xtream and any already-supported provider where practical.
- Define an explicit playback descriptor/session contract for clients; avoid adding raw credentials to general Media/Availability DTOs.
- Add a Web player experience with play/resume, basic loading/error states and manual variant selection when alternatives exist.
- Integrate viewing-progress updates with the existing profile progress/Continue Watching model.
- Ensure unavailable/stale/disabled-source variants cannot be launched.
- Avoid logging credential-bearing playback URLs/tokens.
- Design the contract so Android TV/Media3 can consume the same backend playback resolution later.

## Acceptance Criteria

- [ ] Clicking Play on a playable Movie resolves and starts the profile-preferred currently available variant.
- [ ] A playable Episode can be launched from the Series/Episode experience.
- [ ] The user can explicitly choose another valid availability/variant when alternatives exist.
- [ ] Disabled, stale or unavailable variants are rejected server-side even if the client submits their ids.
- [ ] Provider secrets are not added to general catalog/detail responses or logs.
- [ ] Playback progress updates the existing Continue Watching state and resume starts from stored progress where supported.
- [ ] Playback-resolution failures produce a usable UI error rather than exposing provider internals.
- [ ] Tests cover preferred selection, explicit variant, invalid/stale availability, progress and secret redaction.

## Excluded / Out of scope

- DRM-protected commercial streaming providers.
- Adaptive transcoding infrastructure.
- Full Android TV player implementation.
- Live TV.

## Dependencies

Requires the existing Availability resolver and should depend on #95 for a public hosted deployment so playback/source endpoints are not anonymously exposed.