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



# T105 — Generate personalized shelf concepts with LLM using profile taste and exploration strategy

**Source**: GitHub Issue #208

## Description

## Context
#203 captures rich profile behavior, #205 provides semantic retrieval, #206 provides LLM intent planning and #207 provides hybrid reranking. We now need the layer that decides WHICH shelves should exist for a Profile.

The LLM should act like an editorial concept generator informed by profile taste/history, not like the final movie selector.

## Goal
Generate a diverse set of personalized shelf concepts from compact profile/taste context, recent activity, previously shown shelf history and product exploration rules.

Example concepts:
- `SF qui fait réfléchir`
- `Quand l'intelligence artificielle nous dépasse`
- `Dans la lignée de Denis Villeneuve`
- `Thrillers en huis clos où personne n'est fiable`
- `Anime à binge-watcher`
- `Nouveautés proches de vos goûts`

Each concept must then flow through #206 -> #205/#207 to produce actual catalog items.

## 1. ShelfConcept model
Create a durable/versioned shelf concept representation, e.g.:
```text
ShelfConcept
- id
- profileId nullable for global/editorial concepts
- title
- rawIntent
- semanticIntent / query seed
- generationType (PERSONALIZED / EXPLORATION / DISCOVERY / FIXED / EDITORIAL)
- reasonCodes / generationReasons
- sourceModel
- promptVersion
- createdAt
- expiresAt / freshness window
- active
```

The exact schema should fit existing #203 groundwork and must not duplicate ShelfInstance history from the dedicated history ticket.

## 2. Compact profile context
Build a bounded context for concept generation from derived taste data, not a giant raw history dump.

Include useful summaries such as:
- top genres/themes;
- actors/directors/creators affinity;
- movie/series/anime balance;
- runtime/language preferences;
- recent completions;
- recent likes/dislikes/abandons;
- current My List themes;
- binge tendencies;
- recent shelf concepts shown and their performance;
- currently available/new catalog signals where useful.

Do not send secrets or raw provider URLs.

## 3. Exploration/exploitation mix
Support configurable generation mix, initially something like:
- ~70% personalized/exploitation;
- ~20% adjacent exploration;
- ~10% broad discovery/trending/editorial.

These ratios must be configuration, not hard-coded product truth.

Avoid filter bubbles while still making Home feel personal.

## 4. Avoid repetitive concepts
Use recent ShelfConcept/ShelfInstance history to penalize:
- identical titles/intents;
- near-duplicate semantic concepts;
- repeatedly ignored concepts;
- repeated use of the same single watched title as anchor;
- endless genre-only shelves.

Concept novelty should be measured semantically where possible, not only by exact title string.

## 5. Performance feedback
Feed aggregated shelf performance back into future concept generation, e.g.:
- shelf reached/visible;
- shelf item open rate;
- play rate;
- meaningful watch/completion after play;
- ignored shelf;
- explicit negative/dismissal signals if available.

The LLM should receive a summarized performance view, while deterministic rules should also enforce suppression of consistently poor concepts.

## 6. Cold-start behavior
For a new/empty Profile, generate useful shelves from:
- popular/trending catalog;
- genres/content-type starter mix;
- household availability;
- explicit profile language/kids settings;
- optional onboarding preferences if added later.

Do not hallucinate a detailed TasteProfile for a new profile.

## 7. LLM output schema
Require strict structured output per proposed shelf including:
- display title;
- raw recommendation intent;
- generation type;
- generation reason;
- optional anchor media/people IDs only when these IDs are supplied in context;
- desired content type;
- optional freshness/availability policy.

LLM must not return final authoritative content IDs from memory.

## 8. Concept validation
Before persisting/using a concept:
- validate schema;
- reject unsafe/empty/nonsensical concepts;
- check it is not semantically too close to recent shelves;
- dry-run retrieval to ensure enough viable candidates exist;
- discard concepts that cannot produce a healthy shelf.

## 9. Batch generation/cache
Generate concepts in batches, e.g. enough for dozens of future shelves, and cache them per Profile.

Do not call the LLM every time the user scrolls one screen.

Refresh when:
- pool is low;
- taste changed materially;
- concepts become stale;
- repeated poor performance warrants regeneration.

## 10. Lab support
Add a Lab page/panel that can:
- choose a Profile;
- inspect compact taste context;
- ask `Generate shelf concepts`;
- show generated concepts + reasons/types;
- preview each concept through the recommendation pipeline;
- flag concepts as good/bad manually for development.

## Acceptance criteria
- [ ] LLM can generate structured personalized shelf concepts from compact profile context.
- [ ] Final content selection remains delegated to retrieval/ranking.
- [ ] Concept generation supports personalized/exploration/discovery modes.
- [ ] Recent shelf history reduces repetitive concepts.
- [ ] Poor-performing/ignored concepts can influence future generation.
- [ ] Cold-start profiles receive sensible non-hallucinated concepts.
- [ ] Concepts are validated against real catalog candidate availability before use.
- [ ] Concepts are batch-generated/cached rather than generated on every scroll.
- [ ] Lab can inspect profile context and preview generated shelves.
- [ ] Model/prompt/version/reason provenance is persisted.

## Completion rule
Do not close because the LLM generated 20 strings. For at least two Profiles with different taste histories, generate materially different concept sets, run multiple concepts through the real retrieval/ranking pipeline, and demonstrate that weak/duplicate concepts are filtered before reaching Home.