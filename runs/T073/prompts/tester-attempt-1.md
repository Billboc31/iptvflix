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


# T073 — Unify mobile navigation with desktop top navigation and search

**Source**: GitHub Issue #151

## Description

## Goal
Make IPTVFlix mobile navigation use the same information architecture as desktop instead of a separate bottom-tab experience.

The primary destinations must remain consistent across devices:

- Accueil
- Films
- Séries
- Ma Liste
- Nouveautés

Search must also be available from the TOP of the mobile interface.

## Requirements

### Mobile top navigation
Replace the current mobile bottom-navigation-first approach with a responsive top header/navigation derived from the desktop `TopNav` direction introduced by T059.

The mobile header must provide access to all five primary destinations above. Choose the cleanest responsive presentation for narrow screens: horizontally scrollable navigation, compact/expandable navigation, or another polished pattern. Do not silently remove destinations just because the viewport is narrow.

### Search at the top
Search must be clearly accessible in the top header area, not in a bottom navigation bar. Prefer a compact search field or expandable search control appropriate to the viewport. Existing search behavior/results should be reused.

### Remove duplicate bottom navigation
Once the responsive top navigation provides the required destinations, `BottomNav` must no longer be the primary navigation. Avoid duplicate top + bottom navigation competing for the same destinations.

### Desktop consistency
Do not regress the current desktop top navigation. Desktop and mobile should share navigation concepts and, where sensible, shared components/configuration so labels/routes do not drift independently.

### Settings/admin access
Preserve the settings/admin entry point introduced/restored by the new navigation work, including discoverable access to Sources and existing settings routes. It may be represented compactly on mobile but must not disappear.

### Interaction and responsive behavior
- Active destination should be visually identifiable.
- Navigation must remain usable on small phones without horizontal page overflow.
- Touch targets must be appropriate.
- Header/search should not obscure content.
- Handle long labels/localization gracefully.
- Tablet should transition naturally between compact and desktop layouts.
- Keyboard/accessibility behavior must remain correct where relevant.

### Media-detail compatibility
This navigation work must be compatible with the immersive media-detail issue. When a Movie/Series full-screen detail layer is open on mobile, that detail owns the screen and exposes its own `×` close control. Closing it restores the underlying page/header and previous scroll position.

## Acceptance criteria
- [ ] Mobile exposes Accueil, Films, Séries, Ma Liste and Nouveautés through top navigation.
- [ ] Search is accessible from the top mobile header.
- [ ] Mobile no longer relies on a bottom navigation bar as its primary navigation.
- [ ] Duplicate competing top/bottom navigation is removed.
- [ ] Desktop top navigation is not regressed.
- [ ] Desktop and mobile use the same route/information architecture.
- [ ] Active navigation state works.
- [ ] Settings/admin/Sources remain discoverable on mobile.
- [ ] Small-phone layouts do not create page-level horizontal overflow.
- [ ] Tablet layouts adapt cleanly.
- [ ] Existing routes/search behavior continue to work.
- [ ] Relevant responsive/navigation tests are added or updated.

## UX direction
The goal is one coherent IPTVFlix navigation model across desktop and mobile. Mobile may condense the presentation, but it should not feel like a different application with a different bottom-tab information architecture.