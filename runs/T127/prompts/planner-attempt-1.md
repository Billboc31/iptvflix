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



# T127 — Build a true must-watch Hero ranker for Home

**Source**: GitHub Issue #270

## Description

## Context

#268 introduced a stable cached Home snapshot and a first hero selector. The cache works, but the hero quality is still poor: the current selector simply takes the **first candidate** that passes basic technical gates (`available`, `finalScore >= HERO_MIN_SCORE`, not disliked, title/backdrop present).

This means an obscure or weak recommendation can become the giant Home hero merely because it happens to be first in the input list and has artwork.

The Home hero should instead answer a stronger product question:

> **What is the one title this user is most likely to want to watch right now — even if they did not know it yet?**

The hero is not just "Pour toi item #1". It is the most prominent recommendation on the whole product and must have a stricter, dedicated ranking policy.

## Goal

Replace the current first-eligible-candidate behavior with a dedicated **must-watch Hero ranker** that evaluates a candidate set and selects the strongest hero-worthy title.

The Home snapshot/stability behavior from #268 must remain intact: once selected, the hero stays stable for the snapshot lifetime. This ticket is about **selection quality**, not refresh/random rotation.

## Current problem in code

The current selector effectively does:

```text
filter available + score threshold + dislike + backdrop
→ iterate candidates in input order
→ return first eligible candidate
```

This is insufficient. Hero selection must rank all eligible candidates using explicit hero-quality signals.

## Hero ranking principles

A good hero candidate should combine:

- **very strong profile fit / personalized score**;
- **strong recommendation confidence**;
- **high semantic/thematic relevance where applicable**;
- **actual availability/playability**;
- **good-quality backdrop/artwork**;
- **usable localized title and metadata**;
- **appropriate preferred language/localization where metadata allows it**;
- **reasonable quality/popularity prior** so catalog noise is not promoted over strong known titles;
- **not disliked / not explicitly rejected**;
- eventually unseen/rewatch policy once watched-state is implemented;
- enough editorial/must-watch value to justify occupying the largest visual slot.

Do not interpret popularity as "always choose blockbuster". Personal relevance remains primary, but popularity/quality/confidence should act as safeguards against obscure low-value noise.

## Dedicated Hero Score

Introduce a versioned/configurable Hero ranking formula or policy, separate from the generic shelf order.

For example, the ranker may consider:

```text
heroScore =
  personalizedRelevance
+ recommendationConfidence
+ semanticRelevance
+ quality/popularity prior
+ freshness/novelty where useful
+ metadata/artwork quality bonuses
- penalties
```

The exact formula is not prescribed, but it must be explicit, testable and observable.

The hero ranker must be allowed to choose candidate #5, #10, etc. from `Pour toi` if that candidate is clearly more hero-worthy than candidate #1.

## Candidate pool

Do not rank only one candidate.

Evaluate a reasonable pool of strong personalized candidates (for example top N from `Pour toi` / eligible Home discovery candidates) and select the best hero according to the dedicated policy.

Avoid duplicate hero + first visible `Pour toi` item when enough alternatives exist, preserving the existing cross-shelf diversity behavior.

## Quality gate

Retain hard eligibility rules before ranking:

- playable/available;
- title present;
- valid hero/backdrop image;
- not disliked;
- minimum recommendation confidence/score;
- media type supported by Home hero.

Then apply the Hero ranker among eligible candidates.

If no candidate is strong enough after ranking, return **no hero**. Do not fill the slot with a mediocre title.

## Language / localization

The current poor hero example highlights the need to consider language/display suitability.

When metadata is available:

- prefer localized/display-ready titles for the user's language;
- penalize candidates whose metadata/language presentation is clearly mismatched when equally strong alternatives exist;
- do not globally exclude foreign-language content — a foreign movie can absolutely be hero if it is a genuinely strong personalized recommendation.

The goal is to avoid accidental prominence caused by catalog ordering, not to hard-filter countries/languages.

## Observability / Recommendation Lab or debug

Expose enough debug information to understand why a hero was selected.

For the evaluated hero candidate pool, make available at least:

```text
mediaId/title
base personalized finalScore
semantic/profile score if available
hero quality/popularity prior
language/localization contribution
artwork/metadata eligibility
penalties
final heroScore
selected=true/false
rejectionReason when ineligible
```

This can be logs/admin/debug output; do not expose internals in normal consumer Home UI.

## Tests

Add tests proving that:

1. The first eligible candidate is **not automatically selected**.
2. A later candidate with materially stronger heroScore wins.
3. A low-quality/obscure candidate with acceptable generic finalScore loses to a stronger personalized/quality candidate.
4. A disliked/unavailable/no-backdrop candidate cannot win.
5. Foreign-language content can still win when it is genuinely the best candidate.
6. No sufficiently strong candidate => `null` / no hero.
7. Snapshot persistence still keeps the selected hero stable across Home refreshes.

## Acceptance criteria

- [ ] Hero selection no longer returns the first eligible recommendation by input order.
- [ ] A dedicated Hero ranking policy/formula exists and is versioned/configurable.
- [ ] Multiple strong candidates are evaluated before selection.
- [ ] Profile relevance remains primary, with quality/confidence/popularity/localization used as safeguards rather than arbitrary dominance.
- [ ] The hero can select a lower-ranked `Pour toi` candidate when it is clearly more must-watch-worthy.
- [ ] Poor catalog noise is materially less likely to occupy the hero.
- [ ] No acceptable candidate => no hero.
- [ ] Existing ~24h Home snapshot stability/cache behavior from #268 is preserved.
- [ ] Debug/observability explains why the chosen hero won.
- [ ] No title-specific/country-specific hardcoding and no manual production DB changes.

## Completion rule

Do not close this ticket because unit tests pass or because the selector technically returns a title.

Validate with a real populated profile/Home candidate pool and show that hero selection is based on comparative hero ranking rather than input order.

The expected product result is simple:

> Opening IPTVFlix should make the hero feel like **"I didn't know I wanted to watch this, but now I do."**