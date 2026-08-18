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



# T106 — Persist ShelfConcept/ShelfInstance history and item-level feedback for recommendation learning

**Source**: GitHub Issue #209

## Description

## Context
#203 captures profile interaction events and #208 generates personalized shelf concepts. To improve shelf quality over time we must persist exactly which shelves were generated, which items were actually shown, what scores/models produced them, and how the Profile reacted.

A shelf title string alone is not enough. We need durable recommendation exposure/history so future concept generation and ranking can distinguish:
- bad shelf concept;
- good concept but weak item selection;
- good selection shown too low on Home;
- repeatedly ignored content;
- content opened/played/completed from a specific shelf.

## Goal
Create the durable recommendation-history layer linking concept -> generated shelf instance -> item positions/scores -> real profile feedback.

## 1. Reuse existing event groundwork
Reuse #203 interaction/event architecture. Do not create a second disconnected analytics universe.

The recommendation-history models should provide stable IDs referenced by events such as `SHELF_IMPRESSION`, `SHELF_ITEM_OPENED`, `PLAY_STARTED`, etc.

## 2. ShelfConcept vs ShelfInstance
Keep the semantic concept separate from each concrete rendering/generation.

Example:
```text
ShelfConcept
  "SF qui fait réfléchir"
       ↓
ShelfInstance #A on Aug 18
ShelfInstance #B on Aug 24 with newer ranking/profile
```

A `ShelfInstance` should persist enough context such as:
- id;
- profileId;
- shelfConceptId;
- title rendered;
- semantic/query intent snapshot or query-plan reference/version;
- generationType/exploration class;
- generationReason(s);
- createdAt;
- firstDisplayedAt;
- lastDisplayedAt if reused;
- Home/session/cursor batch identity;
- vertical position when displayed;
- recommendation model/ranker version;
- query planner/prompt/model version;
- embedding model/index version;
- candidate count;
- final item count;
- latency/cache status;
- expiration/staleness metadata.

## 3. Shelf item snapshot
Persist concrete ordered items for every generated/displayed ShelfInstance.

Suggested:
```text
ShelfInstanceItem
- shelfInstanceId
- mediaType
- mediaId
- rankPosition
- semanticScore
- profileScore
- finalScore
- diversityAdjustment
- availabilityScore/status snapshot
- reasonCodes
- wasEligibleAtGeneration
```

Do not copy entire TMDB rows into snapshots.

The purpose is to reconstruct why item X was ranked #3 at that moment even if ranking weights/catalog state later change.

## 4. Exposure / visibility
Distinguish `generated` from `actually presented` and `actually visible`.

Track meaningful visibility semantics:
- shelf returned to client;
- shelf reached/visible past a threshold;
- item rendered;
- item meaningfully visible;
- item opened;
- item played.

Do not emit events for every scroll pixel.

Define sensible thresholds, e.g. shelf/item visible for N ms / percentage of viewport, configurable where needed.

## 5. Outcome attribution
Attribute downstream behavior back to the originating ShelfInstance/Item when possible:
- detail opened;
- trailer preview;
- play started;
- meaningful playback milestone;
- completion;
- My List added;
- like/dislike;
- quick abandon.

If user later accesses the same media through search/details independently, do not incorrectly attribute that later action to the shelf forever. Use session/referrer attribution windows.

## 6. Shelf performance aggregates
Create recomputable aggregate metrics per Profile + Concept and optionally globally:
- impressions;
- reached/visible rate;
- item open rate;
- play-through rate;
- meaningful watch rate;
- completion-after-play rate;
- My List add rate;
- quick-abandon rate;
- average rank position clicked;
- repeated-ignore count;
- freshness/novelty performance.

Keep raw durable history so metrics can be recomputed when definitions change.

## 7. Concept fatigue / suppression
Provide deterministic data for #208 to know that a concept has been overused or ignored.

Examples:
- same/near-identical concept shown 5 times in 2 weeks;
- zero interactions across repeated visible impressions;
- repeated item overlap;
- concept recently performed very well and can be refreshed with new items;
- concept performed poorly and should cool down.

Persist cooldown/suppression decisions with reason/version rather than deleting history.

## 8. Content exposure memory
For each Profile maintain efficient ability to answer:
- which media has been shown recently on Home;
- how many times;
- in which concepts;
- whether ignored/opened/played;
- last exposure time.

This supports #207 `recentExposurePenalty` and prevents the same 20 titles appearing in every shelf.

## 9. Recommendation session / Home session
Introduce a stable session/batch identity for one Home browsing session or cursor chain so global de-duplication can reason across shelves in the same session.

Example:
```text
RecommendationHomeSession
- id
- profileId
- startedAt
- expiresAt
- modelVersion
- seenMediaIds / derived exposure refs
- cursor state/reference
```

Do not store giant unbounded arrays if normalized relations/queries are cleaner.

## 10. Experiment/version readiness
Persist experiment/model versions so future A/B evaluation can compare ranking/query strategies.

At minimum make it possible to answer:
`Did reranker v3 outperform v2 for similar shelf concepts?`

No full experiment platform is required yet.

## 11. Admin/Lab diagnostics
In Recommendation Lab allow inspection of:
- recent shelves for a selected Profile;
- concept + generated items;
- all per-item scores;
- which items were actually visible/opened/played;
- resulting shelf performance;
- concept cooldown/fatigue status;
- model/query/embedding versions.

## 12. Retention
Shelf history is valuable but can grow.

Define retention/compaction:
- keep high-level Concept/Instance/outcome data long-term enough to learn;
- preserve high-value outcomes;
- compact low-value raw visibility telemetry after aggregation when safe;
- indexes for profile/time/concept/media.

Do not delete recent exposure memory needed by ranking.

## Acceptance criteria
- [ ] ShelfConcept and concrete ShelfInstance are distinguishable and linked.
- [ ] Every generated shelf can persist ordered item snapshots + scores/reasons.
- [ ] Generated vs displayed vs visible are distinguishable.
- [ ] Item clicks/plays/outcomes can be attributed to originating shelf within defined rules.
- [ ] Profile-level shelf performance can be recomputed from history.
- [ ] Recent content exposure is efficiently queryable for reranking/deduplication.
- [ ] Concept fatigue/cooldown can be derived and supplied to #208.
- [ ] Recommendation Home/session identity supports cross-shelf deduplication.
- [ ] Model/query/embedding versions are stored for reproducibility.
- [ ] Lab can inspect real shelf history and score/outcome traces.
- [ ] Data growth/retention strategy exists.

## Completion rule
Do not close because tables exist. Generate and display several real shelves for a test Profile, interact with different items, and prove the Lab/history can reconstruct: which concept was shown, item ordering/scores, visibility, which item was opened/played, and the resulting profile-level performance/exposure state.