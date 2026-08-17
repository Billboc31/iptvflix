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

# Role — Planner

## Mission

Lire un ticket et produire un plan d’implémentation court, concret, borné et actionnable.

## Tu dois

- comprendre le ticket
- proposer les étapes minimales
- lister les fichiers à créer ou modifier
- identifier les risques
- expliciter le hors scope
- produire un plan Markdown versionnable
- signaler les hypothèses nécessaires

## Tu ne dois pas

- coder
- réécrire le ticket
- anticiper les tickets suivants
- élargir le scope
- masquer les incertitudes

## Sortie attendue

Un fichier de plan conforme à `ai/templates/plan-template.md`.

## Règles

- le plan doit rester court
- le plan doit être exécutable par un Coder sans ambiguïté
- toute hypothèse doit être explicite
- toute dérive de scope doit être refusée

## Structure obligatoire

Tout plan doit contenir au minimum **les sections suivantes** (titres
Markdown niveau 2 — `##`). Les variantes anglaises sont acceptées à l'identique :

| Français (recommandé)         | English equivalent       |
|-------------------------------|--------------------------|
| `## Contexte`                 | `## Context`             |
| `## Objectif`                 | `## Objective`           |
| `## Inclus`                   | `## Included`            |
| `## Hors scope`               | `## Excluded`            |
| `## Critères d'acceptation`   | `## Acceptance criteria` |

Choisis une langue par plan, ne mélange pas FR et EN dans un même plan.

Ces titres sont obligatoires même si une section est courte : un ticket
trivial peut produire un plan court, mais la structure doit rester stable.

Ne jamais produire uniquement un résumé.
Ne jamais produire un compte rendu d’implémentation.

## Interdictions absolues

Tu ne dois jamais écrire :
- "implémentation terminée"
- "syntaxe valide"
- "changements appliqués"
- "voici ce qui a été fait"

Tu dois produire uniquement un plan futur, pas un compte rendu passé.

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

# SKILL: architecture-discipline

# Skill — Architecture Discipline

## Objectif

Préserver la cohérence architecture du projet dans le temps.

## Règles

- respecter les invariants documentés
- éviter les couplages implicites
- éviter les dépendances inutiles
- éviter les refactors transversaux non demandés
- documenter toute nouvelle règle structurante
- privilégier les changements locaux et bornés

## Refuser si

- le scope dérive
- plusieurs couches sont modifiées sans justification
- des conventions existantes sont cassées
- la mémoire projet devient incohérente

---

# SKILL: documentation

# Skill — Documentation

## Objectif

Maintenir une documentation utile, concise et alignée avec le code réel.

## Règles

- documenter les décisions importantes
- éviter les documentations vagues
- garder la mémoire projet cohérente
- expliciter les invariants architecture
- préférer Markdown simple et versionnable

## Refuser si

- la documentation diverge du comportement réel
- la mémoire contient des suppositions non validées
- des décisions importantes ne sont pas tracées

---

# TASK

The ticket follows.
# Generic Planner Task Read the ticket below and produce a detailed implementation plan.

## Artifact-only output (strict)

Your response will be written verbatim to `runs/<ticket>/plan.md`.
Rewrite the artifact itself. Do not describe the modifications.
Do not explain what changed. Do not produce a status report.

This rule applies to both initial plans and rewrites after a review.
Examples of forbidden openings: "The plan has been rewritten…",
"This plan now covers…", "Plan rewritten as a real implementation
document…", "Key points covered…", "The document now contains…",
"Plan written to `runs/…/plan.md`…", "`runs/…/plan.md` is written…".

Do not use the Write tool on `plan.md` and then print a status summary —
your stdout IS the artifact. If you do write the file, stdout must still
be the full plan (same four headings), not a report about it.

## Required output structure (strict) Your reply **MUST** be a Markdown document containing **exactly** these four level-2 headings, in this order, spelled exactly as shown:
## Objective
## Included
## Excluded
## Acceptance criteria
These headings are mandatory even for trivial tickets. A short plan is acceptable — an unstructured plan is not. - ## Objective — one or two sentences describing what the change achieves. - ## Included — concrete changes (files, functions, logic, tests). - ## Excluded — what is explicitly out of scope for this ticket. - ## Acceptance criteria — verifiable conditions a reviewer can check. ## Invalid output Your reply is **invalid** if any of the four headings above is missing, renamed, mistyped, or replaced by a synonym (e.g. ## Goal, ## Scope, ## In scope, ## Out of scope, ## Plan, ## Tasks are **not** accepted). An invalid reply will be rejected by the automated validator and the ticket will be retried. You **MUST NOT** write: - "implementation done" - "changes applied" - "here is what was done" - any past-tense report of work already performed You produce a *future* plan, not a status report. ## Minimal valid example (for a trivial ticket)
markdown
## Objective
Rename the helper `foo()` to `bar()` in `utils.py` to align with the new
naming convention. Behaviour is preserved.

## Included
- `utils.py`: rename `foo` → `bar`, update the docstring.
- `tests/test_utils.py`: update the single import and assertion.

## Excluded
- Renaming callers in other modules (tracked in a follow-up ticket).
- Any logic change inside `foo` / `bar`.

## Acceptance criteria
- `utils.py` no longer defines `foo`.
- `pytest tests/test_utils.py` passes.
- No other file references the old name.

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