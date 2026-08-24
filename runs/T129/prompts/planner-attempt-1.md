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



# T129 — Build personalized Series page with exploitation and discovery shelves

**Source**: GitHub Issue #273

## Description

## Context

Following the personalized Home and the Movies-page personalization work, the **Séries / Series** page should become a recommendation-first discovery surface rather than a generic catalog/category listing.

As with Movies, both the **themes surfaced to the user** and the **series ranked inside those themes** must be personalized.

The page should balance:
- **exploitation** of tastes we already understand;
- **controlled exploration / serendipity** to discover new tastes.

Initial product target: approximately **75% exploitation / 25% exploration**, without requiring a rigid exact quota on every generation.

Series discovery has additional useful signals compared with movies: commitment/episode count, completed vs ongoing status, seasons, continuation behavior and future episode-level watch history. The architecture should remain ready to use those signals as they become available.

## Goal

Build the production **Séries / Series** page as horizontal personalized series-only shelves using the existing semantic/hybrid shelf and profile architecture.

## Shelf composition

Include a useful mix such as:

- **Séries pour toi** — strongest general personalized series recommendations.
- **Nouvelles séries pour toi** — recent/new series personalized for the profile.
- Multiple dynamically selected/generated **personal thematic shelves**.
- At least one **exploration / serendipity shelf** intentionally probing an adjacent or uncertain area of taste.

Do not hardcode theme names or title lists. Theme selection must remain generic and profile-driven.

## Dynamic thematic shelves

- Generate/select themes from user taste signals rather than fixed global genres.
- Themes should rotate over time and should not all represent the same dominant taste cluster.
- Only render themes with enough strong catalog candidates.
- Keep themes stable during the freshness/snapshot period; browser refresh must not reshuffle the entire page.
- Allow different users to receive materially different themes.

## Controlled exploration / serendipity

Exploration is deliberately uncertain, **not random**.

Select themes/candidates outside the strongest known preference clusters while requiring credible positive bridges back to the user's profile, such as semantic adjacency, creator/cast affinity, secondary genres, tone, era, language, quality prior or another existing profile signal.

The intended product feeling is:

> « Ce n'est pas ce qu'on te propose d'habitude, mais on pense que ça peut te plaire. »

Future `seen / neutral / liked / disliked` and episode-completion behavior should be able to turn exploration outcomes into new profile knowledge. Structure the result metadata/contracts so this can be added without rebuilding the page architecture.

## Series-specific considerations

Where data already exists and can be reused cheaply:

- avoid recommending a series as a new discovery when the user is already actively watching it; that belongs in `Continuer à regarder` / continuation surfaces;
- preserve series → season → episode navigation and existing next-episode behavior;
- keep recommendations at **series level** for discovery shelves, not individual episodes;
- leave room for future signals such as completion/drop-off rate, episode progression and series commitment preference.

Do not implement a new watch-history system solely for this ticket if those signals are not available yet.

## Series-only constraint

Every discovery shelf on this page must enforce `series` media type at retrieval/query level where possible. Do not retrieve mixed media and filter movies only in the frontend.

## Cross-shelf diversity

- Reduce duplicate series across rails when alternatives exist.
- Avoid generating multiple themes that are semantic near-duplicates.
- Preserve strong relevance over forced uniqueness.

## Cache / token control

Reuse the snapshot/materialization principles introduced for Home/Movies:

- no LLM/theme regeneration on every page refresh;
- reusable per-profile Series discovery result;
- ~24h initial freshness is acceptable;
- stale-while-revalidate where feasible;
- repeated refreshes inside the freshness period should not repeatedly consume tokens or rerun expensive recommendation work.

Reuse shared infrastructure where sensible without coupling Series freshness unnecessarily to Home or Movies.

## UX

- Reuse the existing production horizontal shelf/rail components.
- Responsive web/mobile behavior.
- No recommendation debug scores or internal explanations in consumer UI.
- Empty rails disappear cleanly.
- A failed rail does not break the page.
- Existing series detail/playback navigation remains intact.

## Acceptance criteria

- Series page is primarily composed of personalized series-only horizontal shelves.
- Both themes and titles are personalized.
- Multiple distinct exploitation themes are generated/selected dynamically.
- At least one controlled exploration/serendipity shelf is present when enough suitable candidates exist.
- Exploration is meaningfully outside dominant known tastes but retains credible positive signals; it is not pure randomness.
- Product composition targets roughly 75% exploitation / 25% exploration.
- No movies leak into series discovery shelves.
- Active/in-progress series are not needlessly presented as fresh discovery where existing state makes that identifiable.
- Cross-shelf duplicate titles and near-duplicate themes are materially reduced.
- Normal refreshes reuse cached/materialized results without repeated expensive/LLM generation.
- Existing Home, Movies and recommendation diagnostic behavior does not regress.
- Add automated tests for series-only constraints, exploitation/exploration composition, theme diversity, cross-shelf deduplication, snapshot/cache reuse and empty/error behavior.
- No series/theme-specific hacks and no manual production DB changes.