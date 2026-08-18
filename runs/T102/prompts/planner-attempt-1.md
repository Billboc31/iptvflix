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



# T102 — Build catalog embeddings and vector retrieval for recommendation queries

**Source**: GitHub Issue #205

## Description

## Context
#204 creates the standalone Recommendation Lab/service. We now need the semantic retrieval layer that can answer natural-language intents such as `SF qui fait réfléchir` against the real IPTVFlix catalog.

This ticket implements catalog representation + embedding generation + vector search. It does NOT yet own LLM query planning or final personalized reranking.

## Goal
Create a reproducible semantic index of canonical Movies/Series (and optionally Anime classification through canonical Series metadata) so Recommendation Engine can retrieve strong candidates from free-text intents.

## 1. Canonical embedding document
For each canonical title, build a rich deterministic textual representation from stored catalog metadata rather than embedding only the title or synopsis.

Example:
```text
Title: Arrival
Type: Movie
Genres: Science Fiction, Drama
Overview: ...
Keywords/Themes: first contact, linguistics, nonlinear time, grief
Tone/attributes: cerebral, emotional, contemplative
Director: Denis Villeneuve
Cast: Amy Adams, Jeremy Renner
Original language: English
Release year: 2016
Runtime: 116 minutes
Collection: none
Popularity/rating metadata: ...
```

Only include fields actually available/legally retained in canonical catalog. Reuse/enrich #203 catalog metadata rather than scraping arbitrary sources.

## 2. Structured + semantic separation
Do NOT encode every hard filter into vector text and expect cosine similarity to enforce it.

Persist/query structured fields separately for later filters/ranking:
- media type;
- runtime;
- release date/year;
- genres;
- languages;
- maturity/certification;
- popularity/rating;
- availability/playable state;
- source/language/quality capabilities where useful.

Embedding is for semantic similarity; structured constraints remain queryable.

## 3. Embedding provider abstraction
Create a provider abstraction so the project can benchmark/change embedding models later without schema redesign.

Store at minimum:
- mediaId;
- mediaType;
- embedding vector;
- embedding model/provider;
- embedding dimension;
- document/version hash;
- generatedAt.

Do not assume one model forever.

## 4. Vector storage
Use the simplest viable Railway/Postgres-friendly vector storage/search path, preferably pgvector if supported by the actual deployed Postgres environment.

If pgvector is unavailable, document and implement the best practical alternative without forcing an external vector SaaS prematurely.

Provide appropriate vector indexes for expected catalog size and benchmark exact vs approximate search tradeoffs.

## 5. Bootstrap/backfill
Create idempotent/resumable embedding backfill for existing catalog:
- batch processing;
- bounded concurrency;
- retry/backoff;
- progress counters;
- only re-embed when embedding document/model/version changed;
- skip invalid/incomplete items safely.

Do not regenerate every embedding on each deployment.

## 6. Incremental updates
When canonical title metadata changes materially or a new title is added, enqueue/recompute its embedding asynchronously.

Do not block normal TMDB sync or source ingestion waiting for embedding calls.

## 7. Retrieval API/stage
Add a Recommendation Engine stage callable from #204 that accepts semantic text and returns top-K candidates with:
- media ID/type;
- cosine/distance similarity;
- embedding model/index version;
- useful debug metadata.

Example:
`SF cérébrale, philosophique, sérieuse, peu orientée action`

## 8. Lab comparison
Expose in Recommendation Lab:
- raw semantic query;
- top N vector results;
- similarity score;
- embedding model/version;
- optional compare of two query phrasings.

## 9. Quality benchmark set
Create a small human-readable benchmark suite of representative intents, including at least:
- `SF qui fait réfléchir`;
- `thriller en huis clos où personne n'est fiable`;
- `anime à binge-watcher`;
- `comédie légère familiale`;
- `film sombre sur l'intelligence artificielle`.

For each benchmark, capture manually expected/reasonable titles from the actual catalog where possible and provide a repeatable evaluation command/report (precision-style qualitative metrics are fine for v1).

## 10. Data quality
If themes/keywords/people data are missing for much of the catalog, surface coverage metrics. Do not silently claim embeddings are rich when most documents only contain title + overview.

## Acceptance criteria
- [ ] Canonical embedding document builder exists and is deterministic/versioned.
- [ ] Existing catalog can be embedded idempotently.
- [ ] Vector storage/index works in the chosen Railway/Postgres-compatible setup.
- [ ] Embedding provider/model can be changed without replacing canonical catalog schema.
- [ ] New/changed titles can be incrementally re-embedded.
- [ ] Recommendation Engine retrieves top-K real titles by semantic query.
- [ ] Lab displays similarity scores/model/version.
- [ ] Structured metadata remains separate/queryable for later filtering.
- [ ] Benchmark queries demonstrate useful semantic retrieval against real catalog.
- [ ] Coverage/quality diagnostics show how rich embedding documents actually are.

## Completion rule
Do not close because vectors were inserted. Run real queries in the Lab against the actual IPTVFlix catalog and demonstrate that semantically appropriate titles rank near the top for multiple benchmark intents.