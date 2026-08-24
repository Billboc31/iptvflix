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



# T125 — Build personalized Home page with production shelf rails

**Source**: GitHub Issue #266

## Description

## Context

The semantic + hybrid personalized shelf pipeline is now good enough to move from diagnostics/benchmarking into the real IPTVFlix product experience.

We want the **Accueil / Home** page to become the main personalized discovery surface, Netflix-style: multiple horizontal rails mixing useful product shelves and recommendation shelves rather than exposing recommendation diagnostics.

This ticket is the first production integration of the shelf/recommendation engine into the Home UI.

## Goal

Build the Home page infrastructure for horizontally scrollable content shelves and populate an initial set of personalized rails using real catalog/user data.

Initial Home order:

1. **Continuer à regarder** — movies/episodes with playback progress, when non-empty.
2. **Pour toi** — strongest general personalized recommendations.
3. **Nouveautés pour toi** — recent/new catalog content reranked for the user.
4. **One dynamic editorial/personalized thematic shelf** — e.g. concepts generated/selected by the existing shelf system such as « Aventures à travers le temps », « Action sans temps mort », « SF qui fait réfléchir ». This must use the generic shelf pipeline, not hardcoded movie lists.
5. **Films pour toi** — personalized movie-only recommendations.
6. **Séries pour toi** — personalized series-only recommendations.

Empty shelves must simply not render.

## UX

- Netflix-like horizontal poster rails suitable for TV and responsive web/mobile.
- Each rail has a clear human-readable title.
- Poster cards reuse existing content/navigation behavior where possible rather than creating a parallel detail flow.
- Horizontal navigation must work correctly with TV remote/focus as well as touch/mouse.
- Keep the Home experience consumer-facing: semantic diagnostics, raw vector scores, reranker tags and internal scoring explanations must not appear in normal Home UI.
- Loading/error states should degrade gracefully and should not block unrelated shelves.

## Recommendation behavior

- Use the existing semantic/hybrid personalization pipeline rather than implementing a second recommendation engine for Home.
- Preserve media-type constraints for movie-only / series-only shelves.
- `Continuer à regarder` is behavioral/product data and should not be reranked as a semantic discovery shelf.
- `Nouveautés pour toi` should combine recency/catalog freshness with personalization rather than simply listing all newest content chronologically.
- The dynamic thematic shelf should be replaceable/rotatable without frontend code changes.

### Cross-shelf diversity

Avoid making Home look like the same 10–20 titles repeated in every rail.

Introduce a generic cross-shelf diversity policy for discovery shelves: titles already shown prominently in an earlier Home shelf should receive an exclusion or strong attenuation in subsequent shelves when enough alternative relevant candidates exist. Do not sacrifice shelf relevance merely to force uniqueness.

`Continuer à regarder` is exempt: a currently watched title may legitimately coexist with discovery/history surfaces where product logic requires it.

## Prepare for upcoming watch/feedback model

Do not require the full watched/like/dislike feature in this ticket, but design the Home shelf/card contracts so they can later consume user-content state without a rewrite:

- unseen
- seen / neutral
- liked
- disliked
- playback progress

Future behavior will generally remove already-seen titles from discovery shelves while allowing liked/seen titles to appear in a dedicated **À revoir** shelf. Do not build `À revoir` yet unless the underlying state already makes it trivial.

## Architecture

- Prefer a reusable shelf/rail component and declarative Home shelf configuration over six bespoke sections.
- Backend/API should expose the data needed by the Home page in a way that does not require the client to understand recommendation internals.
- Avoid N+1 catalog calls and avoid independently recomputing expensive profile/recommendation context for every shelf when context can safely be shared within the request.
- Preserve existing diagnostic/preview tooling for development; this ticket is about consuming the engine in the production UI, not removing the tooling.

## Acceptance criteria

- Home renders the six initial shelf types above when data exists.
- Shelves are horizontal poster rails and usable on Android TV/TV focus navigation and responsive web/mobile.
- `Pour toi`, `Nouveautés pour toi`, the dynamic thematic shelf, `Films pour toi`, and `Séries pour toi` use the current personalization/recommendation architecture.
- Dynamic thematic shelf content is generic/data-driven and not a hardcoded movie list.
- Movie and series constraints are respected.
- Empty/erroring individual shelves do not break the whole Home page.
- Internal recommendation diagnostics are absent from consumer Home.
- Cross-shelf duplication is materially reduced while preserving relevance.
- Existing recommendation diagnostics/preview functionality continues to work.
- Add automated tests for shelf composition/order, media-type constraints, empty/error cases, and cross-shelf diversity.
- No manual production DB changes and no title-specific/shelf-specific recommendation hacks.