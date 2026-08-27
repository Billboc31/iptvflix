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


# T134 — Add Live TV mode to Android TV app with orange visual identity

**Source**: GitHub Issue #286

## Description

## Context

IPTVFlix now has a dedicated Live TV web experience and canonical Live TV channel model. The Android TV app is currently focused on VOD playback and should now gain a first-class **Live TV mode**.

The Android TV Live TV experience must remain deliberately simple and remote-first. It should feel like the same IPTVFlix product, but Live TV uses **orange** as its primary accent instead of the existing red VOD accent.

This ticket establishes the Android TV Live TV shell and navigation foundation. Channel browsing/player overlay/zapping behaviors are handled in follow-up tickets.

## Goal

Add a clear VOD / TV mode to `apps/android-tv` and create the foundational Live TV home/screen using the existing canonical channel APIs rather than raw provider streams.

## Product direction

- VOD mode keeps its current visual identity and behavior.
- TV mode uses a dark background with **orange focus/active accents**.
- Switching modes should be fast and obvious from a remote.
- Do not create a parallel auth/profile system; reuse the current Android TV session/profile model.
- Consume canonical `Channel` identities produced by the Live TV backend/domain layer so duplicated provider streams are never shown as separate channels.

## TV home

Create an initial TV-mode landing surface suitable for remote navigation, with sections such as:

- recently watched channels when available;
- favorite channels when available;
- live channels / all channels;
- channel categories;
- EPG-ready current-program information where the API provides it.

Do not invent fake schedules when EPG is missing.

The screen should be visually lighter and simpler than the Live TV web dashboard: Android TV is primarily a playback surface, not an admin/exploration interface.

## Remote/focus UX

- All TV-mode controls must be navigable with D-pad only.
- Orange focus state must be highly visible from normal TV viewing distance.
- Focus must be deterministic when entering/exiting TV mode and returning from playback.
- Avoid touch/mobile assumptions.
- Back behavior should remain predictable and consistent with the existing Android TV app.

## Architecture

- Reuse existing networking/player infrastructure where possible.
- Reuse canonical Live TV API contracts instead of duplicating channel parsing/deduplication on Android.
- Keep VOD and Live TV feature code separated enough to avoid regressions while sharing primitives where useful.
- No direct database access from Android.

## Acceptance criteria

- [ ] Android TV app exposes a clear VOD / TV mode switch or equivalent remote-friendly entry point.
- [ ] TV mode has a dark + orange visual identity while VOD keeps its existing styling.
- [ ] Canonical channels are loaded from the backend; raw duplicate provider streams are not displayed.
- [ ] Initial TV home supports remote focus/navigation and clean loading/error/empty states.
- [ ] Current-program metadata can render when EPG data exists and degrades cleanly when absent.
- [ ] Existing VOD playback/navigation does not regress.
- [ ] Add tests for mode switching, focus behavior, canonical channel rendering and VOD regression boundaries.
- [ ] No channel-specific hardcoding and no manual production DB changes.