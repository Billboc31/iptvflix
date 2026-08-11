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


# T012 — Build rich movie and series detail experiences from canonical metadata

**Source**: GitHub Issue #21

## Description

## Objective

Turn the basic catalog into useful streaming-style detail pages for Movies and Series using canonical/enriched metadata and reusable UI components consistent with the validated IPTVFlix design direction.

## Context / Problem

The current web vertical slice proves that catalog browsing works, but IPTVFlix needs rich detail views to make the catalog feel like a real streaming product and to prepare future playback, recommendations and watchlist actions.

## Included

- Add canonical API endpoints/contracts needed to retrieve complete Movie and Series details without exposing provider-specific DTOs.
- Show poster/backdrop, title, original title where relevant, synopsis, release year/date, runtime, genres, selected rating/popularity fields, availability information and external metadata state when available.
- For Series, expose seasons and episodes from the canonical model in a navigable structure.
- Display graceful fallbacks when enrichment/matching is missing or incomplete.
- Keep the detail UI visually aligned with the validated IPTVFlix design board under `docs/design/`.
- Add reusable actions/placeholders for future playback/watchlist integration only where those actions already have backend support; do not fake functionality.
- Ensure mobile/desktop web responsiveness remains acceptable.

## Acceptance Criteria

- [ ] A Movie catalog item opens a rich canonical detail page.
- [ ] A Series catalog item opens a rich detail page with navigable seasons/episodes when available.
- [ ] Enriched poster/backdrop/synopsis/genre/runtime data is displayed when present.
- [ ] Unmatched or partially enriched media still have a usable detail page using available canonical/source data.
- [ ] Provider-specific Xtream DTOs do not leak into detail components or public detail contracts.
- [ ] Loading, missing-item and metadata-error states are handled visibly.
- [ ] Detail UI remains consistent with `docs/design/iptvflix-ui-reference-board.png` and the shared web shell/components.
- [ ] Automated API/frontend tests cover representative Movie, Series and incomplete-metadata cases.

## Excluded / Out of scope

- Actual video playback.
- Recommendation rows.
- Cinema radar.
- Manual metadata correction UI.

## Dependencies

Builds on #19 and #20 for high-quality enriched/matched metadata. Basic fallback detail behavior may be developed against the canonical Batch 1 model in parallel where practical.