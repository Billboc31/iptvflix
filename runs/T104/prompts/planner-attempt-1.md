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



# T104 — Implement hybrid recommendation reranking with profile taste, metadata and explainable scores

**Source**: GitHub Issue #207

## Description

## Context
#205 retrieves semantically relevant candidates with embeddings/vector search and #206 can produce a structured QueryPlan from natural language. Vector similarity alone is not enough for high-quality personalized recommendations.

This ticket builds the deterministic/hybrid ranking stage that combines semantic similarity with profile taste, structured metadata, availability and negative signals.

## Goal
Given a QueryPlan + top-N candidate pool, compute a stable, explainable final score and return the best results for a specific Profile.

Desired pipeline:
```text
QueryPlan
   ↓
vector retrieval top 100-500
   ↓
structured eligibility filters
   ↓
profile-aware reranking
   ↓
diversity / repetition penalties
   ↓
final top 24
```

## 1. Candidate eligibility
Apply true hard constraints before ranking where required:
- media type;
- maturity/kids restrictions;
- runtime min/max;
- release year/date;
- required/excluded genres;
- required language/availability when explicit;
- playable-now requirement when shelf semantics require it.

Do not use soft scores to sneak in items that violate explicit hard constraints.

## 2. Profile taste inputs
Reuse #201/#203 derived profile data. Candidate features should support affinity to:
- genres;
- keywords/themes;
- actors/people;
- directors/creators;
- collections/franchises;
- language/country;
- decade/year;
- movie/series/anime preference;
- runtime preference;
- completion/abandon history;
- explicit likes/dislikes;
- recent activity.

Do not require all features to exist for every item; score gracefully with coverage-aware defaults.

## 3. Score model
Implement a versioned configurable score breakdown, e.g.:
```text
finalScore =
  semanticSimilarity * wSemantic
+ profileGenreAffinity * wGenre
+ profileThemeAffinity * wTheme
+ peopleAffinity * wPeople
+ freshness * wFreshness
+ quality/popularity prior * wPrior
+ availabilityQuality * wAvailability
- alreadyWatchedPenalty
- dislikedPenalty
- recentExposurePenalty
- repetitionPenalty
```

Weights must be configuration/model-version controlled, not magic constants scattered through code.

## 4. Negative signals
Strong negative preference should matter:
- explicit dislike;
- repeated quick abandonment;
- query `avoid` terms;
- already completed very recently;
- content hidden/dismissed if relevant.

Do not permanently blacklist everything abandoned once; distinguish weak and strong negative evidence.

## 5. Explore vs exploit
Support an exploration factor so recommendations are not a filter bubble.

Provide a configurable strategy such as:
- high-confidence personalized/exploitation;
- adjacent discovery/exploration;
- broad discovery/trending.

The shelf generator can later request an exploration class, but ranking should expose the primitive now.

## 6. Diversity
Avoid returning 24 near-identical items unless the concept explicitly demands it.

Add diversity controls over:
- repeated franchise/collection;
- same director/person dominance;
- same release period;
- extremely similar embedding cluster;
- already-shown content in current Home session when supplied.

Use MMR or another documented practical strategy if useful; do not reduce relevance excessively.

## 7. Availability awareness
Prefer titles that are actually playable in household sources when shelf semantics are `watch now`.

Catalog-only discovery shelves may intentionally include unavailable/upcoming titles, so availability must be a plan/ranking option rather than globally hard-coded.

## 8. Explainable debug output
For every result in debug mode, expose score components such as:
```json
{
  "semantic": 0.91,
  "genreAffinity": 0.84,
  "themeAffinity": 0.88,
  "peopleAffinity": 0.65,
  "availability": 1.0,
  "alreadySeenPenalty": -0.2,
  "final": 0.87,
  "reasons": ["strong AI theme affinity", "liked Denis Villeneuve"]
}
```

Normal consumer API need not expose all internals.

## 9. Lab controls
Recommendation Lab should support:
- personalization ON/OFF;
- choose profile;
- vector-only vs hybrid ranking comparison;
- weight preset/model version;
- diversity ON/OFF;
- exploration level;
- result score breakdown.

## 10. Evaluation
Create repeatable tests/benchmarks comparing:
- vector-only;
- vector + hard filters;
- full personalized hybrid ranking.

Use at least two profiles with intentionally different tastes from #203 validation data so the same query can produce meaningfully different ordering.

## Acceptance criteria
- [ ] Candidate pool is reranked using profile + semantic + structured features.
- [ ] Explicit hard constraints are respected.
- [ ] Strong dislikes/negative signals reduce ranking appropriately.
- [ ] Already-watched/recently exposed content can be penalized.
- [ ] Exploration level is configurable.
- [ ] Diversity strategy prevents pathological repetition.
- [ ] Availability can be hard/soft/ignored depending on query/shelf semantics.
- [ ] Every debug result has explainable score components/model version.
- [ ] Lab compares vector-only and hybrid output.
- [ ] Two profiles can produce visibly different rankings for the same semantic query.

## Completion rule
Do not close because a scoring function exists. Demonstrate real catalog queries in the Lab where profile A and profile B rank the same candidate set differently for understandable reasons, while all explicit constraints remain satisfied.