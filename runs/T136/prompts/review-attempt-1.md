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


# T136 — Add Android TV live channel zapping with D-pad and channel +/- remote keys

**Source**: GitHub Issue #288

## Description

## Context

Live TV on Android TV needs instant channel zapping without forcing the user to open the channel browser overlay for every change.

The desired TV-like behavior is:

- while watching Live TV full-screen, **DPAD_UP / DPAD_DOWN** changes channel directly;
- physical/remote **CHANNEL_UP / CHANNEL_DOWN** keys do the same when the device/remote exposes them;
- channel changes follow the current canonical channel ordering/context and use the canonical source-selection/failover flow;
- this must coexist cleanly with the side channel selector overlay from the dedicated overlay ticket.

## Goal

Implement robust remote key handling for fast next/previous Live TV channel changes in `apps/android-tv`.

## Full-screen playback behavior

When the Live player is in normal full-screen playback and no channel-list overlay/menu owns focus:

- `DPAD_UP` => previous/next channel according to the chosen navigation convention;
- `DPAD_DOWN` => the opposite direction;
- Android `KEYCODE_CHANNEL_UP` => next channel;
- Android `KEYCODE_CHANNEL_DOWN` => previous channel.

Choose and document a consistent D-pad mapping. Prefer the convention that feels most natural with the current app/player controls, but do not leave UP/DOWN unimplemented.

Channel +/- keys must work independently of D-pad mapping.

## Overlay interaction

When the channel selector overlay is open:

- DPAD_UP/DOWN navigate the overlay list and **must not immediately zap behind the overlay**;
- OK performs the selected switch while leaving the overlay open as specified in the overlay ticket;
- CHANNEL_UP/DOWN may still perform immediate zapping if this can be made predictable, but must keep overlay state/focus synchronized with the newly playing channel. If that creates ambiguous UX, explicitly scope CHANNEL_UP/DOWN to full-screen mode and document/test it.

Input ownership must be explicit so one key press cannot both move focus and switch channel.

## Channel order / context

Zapping should use canonical channels only.

Prefer this order:

1. current active category/list context when one exists;
2. otherwise the canonical default/all-channels order.

The behavior at list boundaries should be deliberate and consistent (wrap-around is preferred for traditional TV zapping unless existing product conventions strongly argue otherwise).

Skip channels that are known to be unplayable where the API already exposes that state.

## On-screen feedback

After a direct zap, briefly show a lightweight channel-change overlay containing at least:

- channel logo/name;
- current program when EPG exists;
- optional channel number/index if the product has a meaningful stable number.

This transient HUD should use the orange Live TV theme and auto-dismiss after a short interval. It must not require another key press.

Do not show fake EPG information.

## Player behavior / performance

- Switch media in-place where supported rather than recreating the entire Android activity/screen.
- Use canonical channel -> selected `ChannelSource` flow.
- Preserve automatic source fallback behavior.
- Avoid reloading the complete channel list on every zap.
- Debounce/serialize rapid channel switches so holding a key cannot create overlapping player requests or stale playback state.
- The last requested channel should win cleanly.

## Error behavior

If a channel cannot play after available source fallback:

- show a concise non-blocking error;
- keep the app usable;
- do not leave the player stuck in an inconsistent loading state;
- subsequent zapping must continue to work.

## Acceptance criteria

- [ ] Full-screen Live TV supports direct channel changes via DPAD_UP/DOWN.
- [ ] `KEYCODE_CHANNEL_UP` and `KEYCODE_CHANNEL_DOWN` are handled where Android delivers them.
- [ ] Zapping operates on canonical channels, not raw duplicate sources.
- [ ] Channel ordering/context is deterministic and boundary behavior is tested.
- [ ] Overlay-open UP/DOWN navigation does not accidentally trigger direct zapping.
- [ ] Direct zapping displays a brief orange channel/program HUD.
- [ ] Rapid key presses are serialized/debounced safely; no overlapping/stale player state.
- [ ] Source failover remains functional.
- [ ] Failed channel playback does not break later zapping.
- [ ] Existing VOD player remote controls are not regressed.
- [ ] Add Android input/player tests covering D-pad, channel keys, overlay ownership, wrap/boundaries, rapid zapping and playback failure.

---

## Contexte de retry injecté par run_ticket.py

## Review decision keywords

The review must end with exactly one valid workflow keyword on its own line.

Approval keyword:
IMPLEMENTATION_APPROVED

Fix required keyword:
IMPLEMENTATION_FIX_REQUIRED
