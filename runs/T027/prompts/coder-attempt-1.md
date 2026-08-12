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


# T027 — Wire source availability lifecycle into idempotent release events

**Source**: GitHub Issue #52

## Description

## Objective

Ensure source appearance/disappearance events are actually recorded when canonical availability changes, so Follow Release can later notify users reliably without duplicating events on every synchronization.

## Context / Problem

The release lifecycle domain defines `SOURCE_APPEARED` and `SOURCE_DISAPPEARED` events, but the current catalog synchronization path updates availability status/firstSeenAt/lastSeenAt without integrating those transitions into the release-event timeline.

As a result, Follow Release can persist the user's intent but lacks durable source-arrival events needed for the core `never miss a movie again` behavior.

## Included

- Connect canonical availability state transitions to the existing release lifecycle event service.
- Record `SOURCE_APPEARED` when a Media becomes available on a configured source for the first time or reappears after being unavailable.
- Record `SOURCE_DISAPPEARED` when a previously AVAILABLE mapping becomes unavailable through an authoritative source synchronization.
- Preserve provider/source identity on the event.
- Make event creation idempotent across repeated identical synchronizations.
- Avoid producing appearance events merely because metadata was refreshed or `lastSeenAt` changed.
- Ensure zero-availability Media can later transition into `available to me` with a corresponding durable event.
- Apply the behavior consistently to Movies and, once authoritative episode synchronization exists, Episodes where the release lifecycle model supports it.

## Acceptance Criteria

- [ ] First transition from no current availability to AVAILABLE records exactly one `SOURCE_APPEARED` event for the source.
- [ ] Re-running an unchanged synchronization does not create duplicate appearance events.
- [ ] Transition from AVAILABLE to UNAVAILABLE records exactly one `SOURCE_DISAPPEARED` event.
- [ ] Reappearance after disappearance records a new `SOURCE_APPEARED` event reflecting the new transition.
- [ ] Metadata refreshes without availability-state change do not create source lifecycle events.
- [ ] Event source identity is preserved and no provider credentials/secret URLs are stored in lifecycle data.
- [ ] Follow Release timeline APIs expose these events correctly.
- [ ] Automated tests cover first appearance, unchanged resync, disappearance and reappearance.

## Excluded / Out of scope

- Sending push/email/browser notifications.
- Predicting future provider availability.
- Commercial streaming availability aggregation.

## Dependencies

Builds on the existing release lifecycle service and canonical availability synchronization. Episode events depend on authoritative episode lifecycle handling.