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


# T086 — Fix shelf card hover state and add focused Netflix-style enlargement/preview

**Source**: GitHub Issue #181

## Description

## Context
On desktop shelves, hovering one movie/series card currently causes the `Détails` action to appear on every card in the row. Hover state is therefore leaking/shared at shelf level instead of belonging only to the focused media card.

We also want a richer desktop hover interaction: the card currently under the mouse should become visually prominent, enlarge smoothly, and — when a preview/trailer is available — that enlarged focused card should be the only shelf card allowed to play the preview.

This should feel similar in principle to premium streaming UIs while remaining IPTVFlix-specific and reusing the existing detail/preview architecture.

## Goal
Implement a true per-card focused hover state for desktop shelves:

```text
Normal shelf
[ A ][ B ][ C ][ D ][ E ]

Mouse over C
[ A ][ B ][   C enlarged   ][ D ][ E ]
             ▶ preview
             title / actions
             Détails
```

Only C is considered hovered/focused. A/B/D/E remain visually unchanged and must NOT show C's hover controls.

## 1. Fix current hover bug
Audit the shelf/card state ownership and CSS selectors.

The following must be scoped to the individual card:
- hover/focus state;
- `Détails` button visibility;
- play/secondary actions;
- overlay/gradient;
- preview activation;
- enlargement/z-index.

Hovering anywhere on the shelf itself must not put every child card into hover mode.

Avoid broad selectors such as parent `:hover` rules that unintentionally target all card descendants.

## 2. Focused card enlargement
After a short intentional hover delay, smoothly enlarge the focused card.

Desired behavior:
- initial poster/backdrop remains stable while pointer passes quickly across cards;
- after roughly 300–500 ms sustained hover, promote that card into focused state;
- enlarge enough to make the focused title clearly dominant without absurd scaling;
- use smooth transition/animation;
- elevated z-index/shadow/overlay as appropriate;
- neighboring cards/shelves must not visually paint over the focused card;
- prevent clipping by shelf containers where practical;
- cards near the left/right viewport edge should expand intelligently inward so content is not cut off;
- vertical expansion must not permanently reflow/jump the whole page.

Prefer an overlay/pop-out approach if normal transform scaling causes clipping/layout problems.

## 3. Preview on the focused card
If a usable preview/trailer exists, ONLY the currently focused card may start it.

Behavior:
1. card artwork appears immediately;
2. sustained hover promotes/enlarges card;
3. preview loading starts lazily;
4. when ready, preview replaces/fades over artwork inside the enlarged card;
5. preview is muted by default;
6. moving to another card stops/cleans up the previous preview;
7. leaving the shelf/card stops preview and restores artwork;
8. preview failure falls back silently to artwork — it must not break the shelf.

There must never be multiple shelf previews playing simultaneously.

Reuse the existing preview/trailer infrastructure where possible. Do not invent a second incompatible preview system solely for shelves.

## 4. No-preview behavior
A movie/series without a preview must still get the enlarged focused experience using its TMDB backdrop/poster.

The absence of preview must not make hover feel broken or show an empty/black player.

## 5. Focused card content/actions
The enlarged card can expose concise useful controls/information such as:
- title;
- play button when playable;
- `Détails` / more-info action;
- My List action if already supported;
- minimal metadata if it fits cleanly.

Do not turn the hover card into the entire detail page.

`Détails` must open the existing common Movie/Series detail modal rather than navigating to a duplicate implementation.

## 6. Playback semantics
Do not confuse trailer preview with actual VOD playback.

- Hover preview = trailer/preview media.
- `Lecture` = actual selected Xtream/Plex availability through the normal playback pipeline.
- A canonical TMDB title with no playable availability may still preview and show details, but must not display a misleading playable action.

## 7. Hover race conditions
Handle rapid pointer movement correctly.

Example:

```text
hover A 100 ms -> B 120 ms -> C stays 800 ms
```

A and B must never launch previews after the pointer has already left. Only C may enter focused/preview state.

Cancel timers, requests, and media playback on hover change/unmount.

## 8. Keyboard accessibility
Desktop keyboard focus should expose equivalent card actions without requiring a mouse. Do not autoplay noisy media on keyboard focus unexpectedly.

Visible focus state must remain clear.

## 9. Touch/mobile
Do NOT apply desktop hover enlargement behavior to touch-only mobile layouts. Mobile keeps its tap-based cards/detail flow.

Avoid sticky `:hover` behavior after touch interactions.

## 10. Performance
Shelves can contain many titles, so:
- do not instantiate a video player for every card eagerly;
- do not fetch all trailers at shelf render time;
- lazy-load only for the active/focused card;
- only one preview/player active globally across shelf cards;
- clean up video resources when focus changes;
- avoid unnecessary whole-shelf rerenders when one card changes hover state.

## Acceptance criteria
- [ ] Hovering one shelf card shows `Détails` only on that card, not every movie in the row.
- [ ] Other hover-only controls/overlays are also scoped to the active card.
- [ ] Sustained desktop hover smoothly enlarges only the focused card.
- [ ] Enlarged card appears above neighboring content without obvious clipping.
- [ ] Edge cards expand/crop gracefully within the viewport.
- [ ] The page/shelf does not permanently jump/reflow when a card enlarges.
- [ ] If a preview exists, it plays only inside the currently focused/enlarged card.
- [ ] Only one shelf preview can play at any time.
- [ ] Preview starts muted.
- [ ] Leaving/changing card stops and cleans up the old preview.
- [ ] Rapid hover changes cannot trigger stale previews.
- [ ] Preview failure/no preview cleanly falls back to artwork.
- [ ] Titles without playable VOD can still preview/show details without a fake `Lecture` action.
- [ ] `Détails` opens the existing shared detail modal.
- [ ] Actual `Lecture` continues to use the normal VOD playback pipeline.
- [ ] Mobile/touch layout is not negatively affected by desktop hover behavior.
- [ ] Keyboard users can reach equivalent actions.
- [ ] Relevant component/interaction tests cover per-card hover isolation and preview cleanup.

## Completion rule
Manually verify a real shelf containing several movies/series: move the mouse quickly across multiple cards, then remain over one card. Only that final card should enlarge, show its actions, and (when available) play its preview. No other card in the shelf may simultaneously display hover actions or run media.

---

## Contexte de retry injecté par run_ticket.py

## Review decision keywords

The review must end with exactly one valid workflow keyword on its own line.

Approval keyword:
IMPLEMENTATION_APPROVED

Fix required keyword:
IMPLEMENTATION_FIX_REQUIRED
