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



# T095 — Improve Continue Watching cards with direct resume, details and overflow actions

**Source**: GitHub Issue #195

## Description

## Context
The `Reprendre` / Continue Watching shelf should behave more like the reference UX shown by the user.

Today we already track playback progress and #194 adds the `Reprendre ou Recommencer` choice from normal `Lecture`. Continue Watching is different: being in this shelf already expresses resume intent, so the card should make resuming immediate while still giving access to details and management actions.

## Goal
Give every Continue Watching Movie/Episode card three clear interaction zones:

```text
┌──────────────────────┐
│      artwork         │
│          ▶           │  <- direct resume
│                      │
├──────────────────────┤
│ progress ━━━━━━━     │
│   ⓘ       ⋮          │
└──────────────────────┘
```

- central Play button: resume immediately from saved position;
- `ⓘ`: open the normal Movie/Series/Episode detail UI;
- `⋮`: open contextual actions, including `Supprimer de Reprendre`.

## 1. Direct resume action
The central Play action on a Continue Watching card MUST mean `Reprendre`.

Because the user is explicitly interacting with the Continue Watching shelf, do NOT show the #194 resume-vs-restart prompt for this central Play action.

Behavior:
- Movie -> resume that canonical Movie at saved absolute position;
- Episode -> resume that exact canonical Episode at saved absolute position;
- use selected/best playable availability through the normal playback resolver;
- clamp against true duration/seekable range;
- if the saved position cannot be resumed, provide a recoverable fallback instead of silently seeking to an unrelated position.

Normal `Lecture` from the detail page still follows #194 and can ask `Reprendre` vs `Recommencer`.

## 2. Progress visualization
Each Continue Watching card must show meaningful watch progress using TRUE duration semantics from #190:

`progress = savedPlaybackSeconds / trueMediaDuration`

Do not calculate the progress bar from buffered/loaded duration.

The bar must remain stable when reopening the app and must not grow/shrink simply because more of the stream buffered.

## 3. Details action
Add a clear `ⓘ` / `Détails` action on each Continue Watching card.

Movie:
- open the existing Movie detail modal.

Episode:
- open the relevant Series/detail experience with the correct season/episode context selected or clearly surfaced.

Reuse existing detail components. Do not create a separate Continue Watching detail implementation.

## 4. Overflow `…` menu
Add a three-dot contextual action menu for every Continue Watching item.

At minimum include:
- `Épisodes et infos` / `Détails` as appropriate;
- `Supprimer de Reprendre`.

Where existing product capabilities make sense, the menu may also expose actions such as:
- `Ma liste` / remove from My List;
- like/dislike/rating actions;
- source/availability information if useful.

Do not add unsupported decorative actions merely to imitate Netflix.

## 5. Remove from Continue Watching
`Supprimer de Reprendre` must immediately remove the item from this shelf for the current profile.

This needs an explicit persisted semantic — do NOT merely hide it in React state until refresh.

Choose a clean model such as a profile-level Continue Watching dismissal/suppression state tied to the canonical Movie/Episode and watch-progress record.

Requirements:
- removal persists across refresh/login/device;
- removing an Episode removes that Episode entry, not the whole Series history unless product semantics explicitly require otherwise;
- watch history/progress does not need to be destructively erased merely to hide the card;
- if the user later deliberately watches the title again and creates new meaningful progress, it should be eligible to re-enter Continue Watching;
- define/test the rule that clears a previous dismissal when new playback occurs.

## 6. Completion cleanup
Content effectively completed should naturally leave Continue Watching according to existing completion thresholds.

Do not require the user to manually remove every finished title.

## 7. Episode card identity
For Series entries, make it clear what is being resumed. Show useful context such as:
- Series title;
- `S02:E05` or equivalent;
- episode title where layout permits.

The card Play button must never accidentally resume a different episode from the one represented by the progress record.

## 8. Mobile/touch UX
The screenshots are primarily a mobile interaction reference. Implement this cleanly on touch:
- large central Play target;
- separate info target;
- separate `…` target;
- tapping `…` opens a bottom sheet/action sheet or equivalent touch-friendly menu;
- `Supprimer de Reprendre` is easy to understand and not accidentally triggered;
- sheet is dismissible with close/tap outside/swipe where existing modal primitives support it.

Desktop should provide equivalent actions without relying exclusively on hover.

## 9. Optimistic UI
For `Supprimer de Reprendre`, update the shelf immediately after successful intent, with robust rollback/error feedback if persistence fails.

Avoid a full-page reload.

## 10. Accessibility
- buttons have explicit labels (`Reprendre`, `Voir les détails`, `Plus d'options`);
- overflow menu/sheet has correct dialog/menu semantics;
- keyboard users can access all actions on desktop;
- focus returns sensibly after closing the action menu.

## Interaction with existing tickets
- #190: use true duration/progress semantics.
- #194: normal detail-page `Lecture` asks resume/restart; Continue Watching central Play resumes directly.
- player/progress work: reuse canonical Movie/Episode progress and playback resolver rather than adding a duplicate resume store.

## Acceptance criteria
- [ ] Every Continue Watching card has a central direct-resume Play action.
- [ ] Continue Watching Play resumes immediately without showing the #194 choice dialog.
- [ ] Movie resumes at its correct saved absolute position.
- [ ] Episode resumes the exact episode at its correct saved position.
- [ ] Progress bar uses true total duration, not buffer/load duration.
- [ ] `ⓘ` opens the existing appropriate details experience.
- [ ] `…` opens a contextual action menu/sheet.
- [ ] Menu includes `Supprimer de Reprendre`.
- [ ] Removing an item persists across refresh and other devices for the same profile.
- [ ] Removal does not unnecessarily destroy watch history/progress.
- [ ] New meaningful playback can make a previously dismissed title eligible for Continue Watching again.
- [ ] Completed content leaves Continue Watching according to completion rules.
- [ ] Series cards clearly identify the episode being resumed.
- [ ] Mobile controls are touch-friendly and desktop has equivalent accessible actions.
- [ ] No UUID/provider implementation details are shown to users.
- [ ] Tests cover direct resume, details action, persisted dismissal, re-entry after new playback and episode isolation.

## Completion rule
Manually validate with one partially watched Movie and one partially watched Episode: both appear in Continue Watching with stable progress; central Play resumes each directly at the saved position; info opens the correct detail UI; `… > Supprimer de Reprendre` removes the item and it stays removed after refresh; starting meaningful playback again makes it eligible to return.