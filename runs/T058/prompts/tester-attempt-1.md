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


# T058 — Redesign mobile navigation and Shelf browsing for a true phone-first experience

**Source**: GitHub Issue #119

## Description

## Objective

Make IPTVFlix feel intentionally designed for mobile instead of a compressed desktop layout, with special attention to Home and Shelf browsing where the current permanent left navigation consumes too much screen width.

## Context / Problem

The current responsive Web layout keeps the desktop left navigation visible on phones. This significantly reduces usable width and makes horizontal Shelf browsing feel cramped. Mobile is also a primary control surface for discovery and `Play on TV`, so Home, Shelves, details and handoff actions should be optimized for touch and narrow screens.

## Included

- Replace the permanent left sidebar on narrow/mobile viewports with a mobile-specific navigation pattern.
- Prefer a compact bottom navigation for the highest-frequency destinations (for example Home, Search, My List/Library, Activity and Profile) and provide access to secondary destinations such as Sources, Devices and Settings without crowding the primary nav.
- Preserve the existing desktop/tablet-large left navigation behavior.
- Make Home and Shelf browsing the primary responsive focus:
  - Shelves must use the full available viewport width on mobile;
  - horizontal rows should support natural touch/swipe scrolling;
  - remove desktop-only arrow controls where they reduce usable space or duplicate native touch scrolling;
  - choose mobile-appropriate poster/card widths so enough of the next card remains visible to communicate horizontal scrollability;
  - use consistent horizontal edge padding without wasting screen width;
  - prevent card titles, badges, preview controls or progress indicators from forcing row overflow/layout jumps;
  - maintain smooth scrolling with long recommendation-backed Shelf lists;
  - avoid accidental autoplay preview activation during ordinary touch scrolling.
- Ensure the Home hero scales cleanly on narrow screens: readable title/metadata, sensible image crop, actions that do not overflow, and no desktop sidebar offset.
- Review Movie/Series details for mobile ergonomics, especially Play/Resume, `Play on TV`, My List, Follow, trailers and availability/variant controls.
- Make `Play on TV` practical from a phone: actions must remain reachable without tiny targets or horizontal overflow.
- Ensure Season/Episode browsing is touch-friendly and does not inherit desktop-width assumptions.
- Respect device safe areas (bottom/home indicator and notches) for mobile navigation and fixed controls.
- Keep accessibility basics: minimum practical touch targets, keyboard behavior on larger layouts, visible focus states where applicable, and no content hidden behind fixed navigation.
- Add representative responsive tests for narrow phone widths and a larger mobile/tablet breakpoint.

## Acceptance Criteria

- [ ] On phone-sized viewports the permanent left sidebar is not visible and does not reserve horizontal space.
- [ ] Primary mobile navigation is reachable with one hand and does not cover page content.
- [ ] Desktop/large-screen navigation remains unchanged or equivalently usable.
- [ ] Home Shelves occupy the full mobile content width and scroll horizontally with native touch gestures.
- [ ] Shelf cards have intentional mobile sizing and visible continuation/peek behavior rather than looking like a squeezed desktop row.
- [ ] Scrolling a Shelf does not accidentally trigger autoplay previews.
- [ ] Multiple/long Shelves render without horizontal page overflow or broken spacing.
- [ ] Hero content and actions fit common phone widths without clipping.
- [ ] Movie/Series detail primary actions, including `Play on TV`, remain easy to reach and use on mobile.
- [ ] Season/Episode lists are readable and touch-friendly on narrow screens.
- [ ] Fixed bottom navigation respects safe-area insets and does not hide content.
- [ ] Automated frontend tests cover mobile navigation visibility, Shelf scrolling/layout, hero/action layout and representative detail/device-handoff behavior.

## Excluded / Out of scope

- Native iOS/Android phone apps.
- Redesigning the desktop visual identity.
- Replacing the existing Shelf/recommendation data model.
- New product features unrelated to responsive/mobile UX.

## Dependencies

Builds on the current Home/Shelf, autoplay-preview, rich-detail and `Play on TV` Web features. This is a focused responsive UX improvement and should preserve their existing backend contracts.