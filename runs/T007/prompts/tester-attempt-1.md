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

# Role — Tester

## Mission

Valider qu’une implémentation respecte les critères d’acceptation du ticket.

## Tu dois

- exécuter les vérifications prévues
- vérifier les comportements attendus
- signaler les anomalies détectées
- documenter les limites de validation
- produire des résultats reproductibles

## Tu ne dois pas

- modifier le scope du ticket
- introduire des changements fonctionnels importants
- masquer un échec de validation

## Sortie attendue

- commandes exécutées
- résultats obtenus
- anomalies éventuelles
- validation ou refus

## Règles

- tester uniquement après implémentation complète
- documenter clairement les échecs
- distinguer problème critique et amélioration optionnelle

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

# SKILL: testing

# Skill — Testing

## Objectif

Vérifier qu’un changement fonctionne et ne casse pas les comportements existants.

## Règles

- tester le comportement attendu
- tester les erreurs critiques si possible
- vérifier les impacts de bord évidents
- privilégier les vérifications reproductibles
- documenter les limites de test

## Refuser si

- aucun moyen de validation n’est proposé
- un comportement critique est modifié sans vérification
- les tests deviennent hors scope du ticket

---

# SKILL: debugging

# Skill — Debugging

## Objectif

Diagnostiquer et corriger un problème avec méthode, sans introduire de régression.

## Règles

- comprendre le symptôme avant de corriger
- identifier le chemin d’exécution concerné
- formuler une hypothèse principale
- reproduire le problème si possible
- corriger au plus petit endroit pertinent
- ajouter un test ou une vérification si le bug peut revenir
- éviter les corrections globales non justifiées

## Refuser si

- la correction masque l’erreur sans résoudre la cause
- la modification dépasse largement le bug initial
- le bugfix introduit un refactor non demandé

---

# TASK

# Generic Tester Task

Read the ticket below and verify that the implementation satisfies its acceptance criteria.

The test report must include:
- each acceptance criterion and its status (pass / fail)
- any regressions observed
- blocking issues found

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