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