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


# T135 — Build Android TV live channel selector overlay with EPG and persistent zapping

**Source**: GitHub Issue #287

## Description

## Context

Once a Live TV channel is playing on Android TV, channel discovery/switching must be possible without leaving playback.

The desired interaction is remote-first:

> While watching a channel, pressing **LEFT** opens a side overlay containing the channel list. Each row shows the channel identity and current program. Selecting another channel switches playback immediately, but the overlay **stays open** so the user can continue zapping/browsing. The user explicitly closes the overlay with BACK/RIGHT/another deliberate action.

This should feel like a modern set-top-box channel browser rather than navigating back to a separate channel page after every switch.

## Goal

Implement a persistent channel selector overlay inside the Android TV Live player.

## Overlay behavior

### Open

- When normal Live playback has focus and no conflicting modal/control owns the key, **DPAD_LEFT** opens a side layer/overlay.
- Playback continues behind the overlay.
- The overlay should occupy only part of the screen, leaving the current channel visibly playing.
- Use the Live TV dark + **orange** visual language.

### Channel list

Each channel row/card should support:

- canonical channel logo;
- canonical channel name;
- current EPG program title when available;
- current program start/end time and/or progress where available;
- favorite state when the existing canonical favorite model supports it;
- clear orange focused state;
- clear indicator for the channel currently being played.

EPG absence must degrade cleanly without fake data.

### Selection / persistent browsing

Critical interaction requirement:

- User moves focus through channels with DPAD_UP / DPAD_DOWN while the overlay is open.
- Pressing OK/ENTER on a channel starts/switches to that channel.
- **The overlay remains open after the channel switch.**
- Focus remains on the newly selected channel (or equivalent deterministic position), allowing the user to immediately select another channel.
- Playback behind the overlay updates to the newly selected stream.
- Do not navigate away/recreate the whole player screen solely to switch channel if the current player architecture supports an in-place media switch.

### Close

- BACK closes the channel overlay first and returns focus to full-screen playback.
- RIGHT may close the side overlay when appropriate, matching a natural left-panel interaction.
- Overlay should not trap focus or make playback controls unreachable.

## Ordering / filtering

Use canonical channel ordering/categories from the backend where available. At minimum the overlay should be able to browse all playable canonical channels.

Prefer preserving the user's current list context/category when feasible.

Do not expose `ChannelSource` duplicates in the overlay.

## Performance

Channel changes should feel fast:

- do not refetch the complete channel catalog on every selection;
- preload/cache lightweight channel + now-playing metadata where appropriate;
- use the canonical source-selection/failover backend flow;
- show a subtle loading state during stream switch without closing the overlay.

## Focus / remote details

- Opening overlay should initially focus the currently playing channel if present in the list.
- Focus position should survive a channel switch while the overlay stays open.
- Long lists should scroll to keep focused row visible.
- D-pad repeat should be handled sanely and not trigger accidental multiple OK selections.

## Acceptance criteria

- [ ] DPAD_LEFT during Live playback opens a side channel overlay.
- [ ] Overlay displays canonical channel logo/name and current EPG program where available.
- [ ] DPAD_UP/DOWN navigates channel rows with visible orange focus.
- [ ] OK changes to the selected channel without closing the overlay.
- [ ] After switching, overlay stays open and focus remains in a deterministic useful position.
- [ ] Current channel is visually identified.
- [ ] BACK closes overlay before exiting playback.
- [ ] EPG/no-EPG cases both render correctly.
- [ ] Raw duplicate sources never appear as separate rows.
- [ ] Channel switch uses existing source-selection/failover path and handles loading/failure gracefully.
- [ ] Add tests for overlay open/close, focus restoration, persistent overlay after selection, EPG rendering, and repeated channel switching.
- [ ] Existing VOD player controls are not regressed.

---

## Contexte de retry injecté par run_ticket.py

## Review decision keywords

The review must end with exactly one valid workflow keyword on its own line.

Approval keyword:
IMPLEMENTATION_APPROVED

Fix required keyword:
IMPLEMENTATION_FIX_REQUIRED
