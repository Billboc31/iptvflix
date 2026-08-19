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



# T110 — Wire ShelfConcept through QueryPlan, semantic retrieval and hybrid reranking

**Source**: GitHub Issue #232

## Description

## Context

The recommendation stack from #205-#210 is largely implemented, but review of the current integrated code shows the generated Shelf concept/intention is not consistently driving candidate selection for the actual Home shelves.

The key product requirement is that a shelf called `SF qui fait réfléchir` must contain titles retrieved for THAT semantic intent, then personalized/reranked for the current Profile. It must not simply consume the next slice of one generic profile ranking.

## Goal

Make this the real end-to-end shelf generation pipeline:

```text
ShelfConcept
   ↓
LLM Query Planner (#206)
   ↓
RecommendationQueryPlan
   ↓
semantic embedding / vector retrieval (#205)
   ↓
structured hard filters
   ↓
hybrid profile reranking (#207)
   ↓
diversity / recent-exposure penalties (#209)
   ↓
ShelfInstance + ordered items (#209)
   ↓
Home (#210)
```

## Required work

- Audit the current Home/Shelf generation path and identify every place where a `ShelfConcept` or `semanticIntent` is dropped/ignored.
- Ensure every generated recommendation shelf passes its own concept intent into #206.
- Use the resulting `semanticIntent` for semantic retrieval rather than starting from a generic candidate pool unless the shelf type explicitly calls for a generic pool.
- Apply QueryPlan hard filters deterministically before/within ranking.
- Pass the retrieved candidate set into the existing hybrid reranker with the current Profile/TasteProfile.
- Apply recent exposure, same-session duplication and diversity penalties using #209 history/session state.
- Persist QueryPlan/version, semantic retrieval scores, reranker scores/reasons and final positions into the ShelfInstance history.
- Preserve fixed shelves such as Continue Watching/My List; they must not be routed through LLM semantic generation.
- Preserve shelf policies such as WATCH_NOW vs DISCOVERY vs UPCOMING/unavailable.

## Required evidence

Use the real catalog and show that materially different concepts produce materially different candidate pools, for example:

- `SF qui fait réfléchir`
- `Comédies légères familiales`
- `Thrillers en huis clos où personne n'est fiable`

The same generic top-profile ranking must not simply be chunked across these shelves.

## Acceptance criteria

- [ ] Generated ShelfConcept intent reaches the Query Planner.
- [ ] QueryPlan semantic text reaches vector retrieval.
- [ ] QueryPlan hard filters are honored.
- [ ] Retrieved candidates are reranked for the current Profile.
- [ ] Same-session/recent-exposure penalties reduce repeated titles across shelves.
- [ ] ShelfInstance stores enough provenance/scores to reconstruct why an item appeared.
- [ ] WATCH_NOW shelves exclude unavailable items while discovery shelves may include them.
- [ ] Fixed utility shelves remain deterministic and unaffected.
- [ ] Recommendation Lab can display the exact pipeline for a generated ShelfConcept.
- [ ] Real catalog tests demonstrate clearly different results for clearly different shelf concepts.

## Completion rule

Do not close because all individual services exist. Generate at least 10 real shelves for one Profile and prove that each shelf's actual item list is derived from its own semantic intent/QueryPlan rather than from sequential chunks of one generic ranking.