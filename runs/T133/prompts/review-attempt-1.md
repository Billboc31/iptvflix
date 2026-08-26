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

---

## Contexte de retry injecté par run_ticket.py

## Review decision keywords

The review must end with exactly one valid workflow keyword on its own line.

Approval keyword:
IMPLEMENTATION_APPROVED

Fix required keyword:
IMPLEMENTATION_FIX_REQUIRED
