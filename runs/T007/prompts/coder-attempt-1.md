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


# T007 — Build Netflix-inspired web experience from validated UI reference board

**Source**: GitHub Issue #9

## Description

## Objective

Deliver the first IPTVFlix web experience using the validated UI reference board as the primary visual specification. The implementation must establish the reusable frontend foundation that all future features will build upon.

## Context / Problem

The UI/UX direction has already been validated. AI Dev Factory should not invent the user experience.

The implementation must follow the reference board located at:

`docs/design/iptvflix-ui-reference-board.png`

The board defines the visual hierarchy, navigation, colors, spacing, layout philosophy and the main application screens.

The objective of this ticket is NOT to reproduce every future feature but to build a reusable Netflix-inspired frontend foundation faithful to the approved design.

## UI Reference

The reference board contains the following screens:

- Home
- Movie Catalog
- Series Catalog
- Movie Details
- Cinema Radar
- Search
- IPTV Source Configuration
- Onboarding
- Android TV Home (future reference)

These mockups are the primary visual reference for this ticket.

## Included

- Implement the global application shell.
- Left navigation.
- Top navigation/search area where applicable.
- Dark visual theme.
- Reusable layout system.
- Reusable cards.
- Reusable carousel/rows.
- Buttons, dialogs, forms and loading states.
- Responsive desktop web layout.
- IPTV Source configuration screens.
- Catalog browsing screens for Movies and Series.
- Synchronization status screens.
- Empty, loading and error states.
- Consume only the canonical backend API. Provider DTOs must never leak into the UI.

## Acceptance Criteria

- [ ] The implementation is visually consistent with the validated design board.
- [ ] Global navigation matches the approved UX.
- [ ] Shared UI components are reusable.
- [ ] Movies and Series use reusable poster grids and horizontal rows.
- [ ] IPTV source configuration follows the reference design.
- [ ] Synchronization workflow integrates naturally into the UI.
- [ ] Loading, empty and error states are polished.
- [ ] Frontend consumes only canonical API contracts.
- [ ] No Xtream-specific models appear inside UI components.
- [ ] Frontend tests cover the main user flows.

## Excluded

- Recommendation engine.
- Metadata enrichment.
- Netflix import.
- Cinema radar logic.
- Playback.
- Android TV implementation.

## Dependencies

Requires the canonical catalog synchronization pipeline (#7).

This ticket supersedes the original UI ticket by providing a much more detailed UX specification.