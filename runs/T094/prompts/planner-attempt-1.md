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



# T094 — Prompt to resume or restart when starting partially watched movies and episodes

**Source**: GitHub Issue #194

## Description

## Context
IPTVFlix already tracks/aims to track watch progress for Movies and Episodes. When the user clicks `Lecture` on content that has meaningful saved progress, playback should not silently start from the beginning or silently resume without asking.

## Goal
Before starting a partially watched Movie or Episode, show a clear choice:

```text
Reprendre la lecture ?

Vous vous êtes arrêté à 42:18.

[ Reprendre à 42:18 ]   [ Recommencer ]
```

The same behavior must work for Movies and individual Series Episodes.

## Trigger rules
Show the resume choice only when saved progress is meaningful.

Suggested semantics:
- no prompt for content never started;
- no prompt for only a few seconds/minimal accidental playback;
- prompt when saved position is above a configurable small threshold (for example ~60–120 seconds or a small %);
- do not offer resume when content is effectively completed / very near the end;
- completed content may default to `Recommencer`, while still respecting existing watched/history semantics.

Use the TRUE media duration/progress semantics from #190. Do not base this on buffered duration or loaded range.

## UX
The choice should appear before normal playback begins, using a lightweight modal/sheet integrated with existing IPTVFlix UI.

Desktop:
- centered modal/dialog;
- keyboard accessible;
- Escape closes/cancels without starting playback.

Mobile:
- touch-friendly modal/bottom-sheet style;
- large actions;
- same two choices.

Primary action should generally be `Reprendre à HH:MM:SS` when valid progress exists.

## Movies
When user clicks `Lecture` on a Movie with saved progress:
- load saved absolute playback seconds;
- display resume timestamp;
- `Reprendre` starts playback and seeks to saved position once media is ready/seekable;
- `Recommencer` starts at 0 and should reset/replace the active resume position appropriately once playback progresses.

## Episodes
Apply the exact same behavior to the selected canonical Episode, not Series-level progress.

Example:

```text
S02E05 — Le titre
Vous vous êtes arrêté à 18:43.

[ Reprendre à 18:43 ]
[ Recommencer l'épisode ]
```

Progress from S02E04 must never trigger the prompt for S02E05.

## Interaction with source/quality selection
Resume progress belongs to the canonical Movie/Episode, not one specific availability/source.

If the user changes source/quality before playback, the selected new availability should still resume at the same canonical saved position when technically seekable.

If resume seek fails on one source, show an explicit recoverable message and allow starting from the beginning rather than silently playing from the wrong location.

## Interaction with Continue Watching
Continue Watching cards may use a direct `Reprendre` action if the intent is already explicit, but normal `Lecture` from Movie/Episode details should show the choice when meaningful progress exists.

Keep behavior consistent across Home, detail modal, Movies, Series and search results.

## Progress integrity
- read latest persisted progress before deciding whether to show prompt;
- avoid stale client-only progress when backend has newer state;
- save progress on pause/close as defined in player work;
- use absolute seconds as source of truth;
- clamp resume position against actual duration/seekable range;
- if duration changes slightly between variants, keep the absolute position when reasonable.

## Accessibility
- proper dialog semantics;
- focus initially placed on primary resume action;
- keyboard navigation between actions;
- screen-reader label includes resume timestamp.

## Acceptance criteria
- [ ] Partially watched Movie prompts `Reprendre` vs `Recommencer` before playback.
- [ ] Partially watched Episode prompts independently at episode level.
- [ ] Never-started content starts normally without unnecessary prompt.
- [ ] Trivial/accidental progress does not trigger the prompt.
- [ ] Effectively completed content does not offer a misleading resume near credits/end.
- [ ] Resume timestamp is based on saved absolute seconds and true duration semantics.
- [ ] `Reprendre` starts at the saved position.
- [ ] `Recommencer` starts at 0.
- [ ] Source/quality changes preserve canonical resume position.
- [ ] Resume from one episode never leaks to another episode.
- [ ] Desktop and mobile UX are both usable.
- [ ] Continue Watching behavior remains coherent.
- [ ] Tests cover movie/episode resume thresholds, completed content, restart and source switching.

## Completion rule
Manually validate with one real Movie and one real Episode: play each for several minutes, close, return to the detail screen, click `Lecture`, confirm the choice appears, then test BOTH `Reprendre` and `Recommencer` paths and verify the resulting playback position.