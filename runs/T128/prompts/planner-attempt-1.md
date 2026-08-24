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



# T128 — Build personalized Movies page with exploitation and discovery shelves

**Source**: GitHub Issue #272

## Description

## Context

IPTVFlix now has a personalized Home powered by the semantic/hybrid recommendation and shelf pipeline. The next product step is to replace the Movies page's generic/catalog-first experience with a discovery experience made primarily of **personalized movie shelves**.

The page must not simply reproduce fixed genre categories. Both the **themes chosen for the user** and the **movies ranked inside each theme** should be personalized.

A key product requirement is to balance:
- **exploitation**: themes/content we already have strong reasons to think the user likes;
- **exploration / serendipity**: themes/content outside the user's established habits where we are less certain, but have credible signals that the user could like them.

Initial target balance: roughly **75% exploitation / 25% exploration**, treated as a product policy rather than an exact per-request mathematical quota.

## Goal

Build the production **Films / Movies** page as a set of horizontal personalized movie-only shelves generated from the existing recommendation architecture.

## Shelf composition

The page should include a useful mix such as:

- **Pour toi** — strongest general movie recommendations.
- **Nouveautés pour toi** — recent/new movies personalized for the profile.
- Multiple **personalized thematic shelves** whose themes are selected/generated dynamically from the user's profile and can rotate over time.
- At least one **exploration / serendipity shelf** designed to test potentially interesting tastes outside the strongest known preferences.

Do not hardcode example themes. A user may receive concepts analogous to « Aventures à travers le temps », « SF qui fait réfléchir » or « Action sans temps mort », but theme selection must come from the generic shelf/theme pipeline.

## Dynamic themes

The themes themselves should evolve rather than permanently exposing the same categories.

- Prefer themes strongly supported by the profile for exploitation shelves.
- Maintain diversity between exploitation themes so they do not become minor variations of the same concept.
- Rotate/refresh themes according to the snapshot/freshness policy rather than on every page refresh.
- A theme should only render when the catalog contains enough relevant movie candidates to make a useful rail.

## Exploration / serendipity

Exploration must **not be pure random content**.

Implement a generic controlled-exploration strategy. Candidates/themes should be meaningfully different from the user's strongest established preferences while retaining one or more plausible positive signals (semantic adjacency, cast/director affinity, secondary genres, era/language patterns, quality prior, adjacent taste cluster, etc.).

The goal is:

> « We don't know whether you like this yet, but there is a credible reason you might. »

Avoid both extremes:
- recommending only near-duplicates of known tastes;
- throwing arbitrary unrelated catalog content at the user.

Design this so future `seen / neutral / liked / disliked` feedback can measure exploration outcomes and improve the profile.

## Movie-only constraint

Every discovery shelf on this page must enforce `movie` media type at retrieval/query level where possible. Do not retrieve mixed media and merely hide series in the frontend.

## Cross-shelf diversity

Apply the existing Home-style diversity principle across the Movies page:

- materially reduce duplicate titles across rails when enough alternatives exist;
- do not destroy thematic relevance merely to force uniqueness;
- avoid themes that are effectively duplicates of one another.

## Cache / cost control

Do not regenerate themes or perform LLM-dependent work on every Movies page refresh.

Use/reuse the Home snapshot/materialization principles where architecturally appropriate:
- page-level personalized discovery snapshot or equivalent reusable persisted result;
- reasonable freshness window (~24h initially is acceptable);
- repeated refreshes should not repeatedly consume LLM tokens;
- stale-while-revalidate where feasible;
- cheap live state may remain live.

Do not couple Movies page freshness to Home if that creates unnecessary regeneration or prevents independent evolution; reuse infrastructure, not necessarily the exact same snapshot.

## UX

- Reuse the production horizontal shelf/rail UI from Home where possible.
- Responsive web/mobile behavior.
- Consumer-facing UI only: no recommendation scores/debug explanations.
- Empty shelves disappear cleanly.
- One failing shelf must not break the whole page.
- Preserve existing movie detail/playback navigation.

## Acceptance criteria

- Movies page is primarily composed of personalized movie-only horizontal shelves.
- Both shelf themes and shelf contents are personalized.
- Multiple exploitation themes are dynamically selected/generated and are meaningfully distinct.
- At least one controlled exploration/serendipity shelf exists.
- Exploration is not pure randomness and can explain its candidate selection through existing internal diagnostics/signals.
- Product behavior targets approximately 75% known-taste exploitation / 25% exploration.
- No series leak into movie shelves.
- Cross-shelf duplicate titles and near-duplicate themes are materially reduced.
- Themes/results remain stable across ordinary refreshes and do not trigger repeated expensive/LLM generation within the freshness window.
- Existing Home and recommendation diagnostic tooling do not regress.
- Add automated tests for movie-only constraints, exploitation/exploration composition, theme diversity, cross-shelf deduplication, cache/snapshot reuse, and empty/error behavior.
- No movie/theme-specific hacks and no manual production DB changes.