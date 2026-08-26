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


# T133 — Move Live TV primary navigation from left sidebar to bottom bar

**Source**: GitHub Issue #284

## Description

## Context

The standalone IPTVFlix Live TV UI is now taking shape, but the current **left-side primary navigation** feels inconsistent with the existing VOD experience.

We want the Live TV app to share the same overall navigation philosophy as VOD: **persistent primary navigation at the bottom**, with content categories living inside the page rather than inside a permanent left rail.

This is a focused UX correction. Do not redesign the whole Live TV dashboard or alter the orange/black visual language.

## Goal

Replace the current left sidebar used for primary Live TV navigation with a **persistent bottom navigation bar** aligned with the VOD app interaction model.

## Target structure

### Top area

Keep:
- IPTVFlix branding;
- VOD / TV switch;
- profile/user affordance;
- search where appropriate.

### Main content

The main Live TV content should use the full horizontal width previously occupied by the sidebar.

Channel categories such as:
- Généralistes
- Sport
- Cinéma & Séries
- Infos
- Enfants
- Musique
- Documentaires
- International

should appear as **content sections/chips/cards/rails**, not as permanent primary navigation items.

### Bottom navigation

Add a persistent bottom navigation bar inspired by the existing VOD navigation, with an initial Live TV information architecture such as:

- Accueil TV
- Favoris
- Guide TV
- Chaînes
- Recherche

Exact icons/labels can follow existing VOD conventions where reusable.

The currently selected section must have a clear orange active state consistent with the Live TV theme.

## UX requirements

- Navigation should feel like the same IPTVFlix product when switching between VOD and TV.
- Bottom nav must not obscure page content; reserve/pad content appropriately.
- Mobile/tablet behavior should be first-class.
- Desktop should still look intentional and not like a stretched mobile layout.
- Keep the layout compatible with future Android TV / remote-focus navigation.
- Preserve current dashboard sections, channel cards, filters, favorites, EPG-ready states and playback behavior.

## Visual reference

The previous mockup remains useful for the black/orange Live TV visual direction, but **the left sidebar in that mockup is no longer the desired navigation model**.

Reference image:

![IPTVFlix Live TV visual direction](https://raw.githubusercontent.com/Billboc31/iptvflix/main/CFE6ED42-4D93-43D9-AC8A-1DE7B0AF4CFA.png)

Use it for color/density/card treatment only; replace its sidebar with the bottom navigation described above.

## Acceptance criteria

- [ ] Primary Live TV navigation is no longer rendered as a persistent left sidebar.
- [ ] A persistent bottom nav is implemented with Accueil TV / Favoris / Guide TV / Chaînes / Recherche (or equivalent existing-route labels).
- [ ] Active route is clearly highlighted in orange.
- [ ] Main content expands to use the freed horizontal space.
- [ ] Channel categories remain discoverable inside content, not lost with sidebar removal.
- [ ] VOD/TV switch remains functional and visually consistent.
- [ ] Existing Live TV functionality does not regress.
- [ ] Responsive/mobile layout is tested.
- [ ] Add/update component/routing tests for bottom-nav behavior and active states.
- [ ] No manual production DB changes.