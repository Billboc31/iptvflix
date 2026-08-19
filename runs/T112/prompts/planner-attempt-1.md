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



# T112 — Activate production pgvector database and backfill recommendation embeddings safely

**Source**: GitHub Issue #234

## Description

## Context

A new PostgreSQL + pgvector database has now been created in production, but it is still empty. The current IPTVFlix production database remains the source of truth for catalog/profile/application data.

#205 already implemented embedding generation and pgvector-aware retrieval/fallback behavior. #211 expands the TMDB discovery catalog. We now need a safe production activation path so semantic recommendations use the new pgvector-capable database without losing application data or generating duplicate/inconsistent embeddings.

## Goal

Safely migrate/activate the production PostgreSQL + pgvector environment, validate the vector extension/index path, and backfill embeddings for the canonical catalog.

No destructive cutover until data integrity and recommendation retrieval have been proven.

## 1. Inspect both production databases

Before changing any environment variable, collect sanitized diagnostics for:
- current production DB schema/migration version;
- canonical Movie/Series/Profile counts;
- new pgvector DB schema/migration state (currently expected empty);
- PostgreSQL versions;
- pgvector extension availability/version;
- storage/config differences relevant to migration.

Never print DB passwords/connection strings into committed artifacts.

## 2. Decide one-database production topology

Preferred end state for this stage is one primary PostgreSQL + pgvector database containing normal IPTVFlix relational data AND vector columns/indexes, unless current code/infrastructure proves a separate vector DB is intentionally supported.

Do not silently split canonical/application data and embeddings across two databases unless a clear repository abstraction already supports that topology.

Document the selected topology before cutover.

## 3. Safe data migration

If the new pgvector database will replace the current production PostgreSQL:
- take/export a verified backup of the current DB;
- migrate/restore all relational data and migration state to the new pgvector DB;
- preserve IDs/FKs/profile state/watch progress/My List/sources/catalog/history;
- validate row counts and representative relations;
- keep old DB intact during validation/rollback window.

Do not ask application migrations to reconstruct user/catalog data from scratch.

## 4. Enable pgvector schema

Verify/execute:
- `CREATE EXTENSION IF NOT EXISTS vector`;
- intended vector column type/dimension for the configured embedding model;
- vector indexes (HNSW/cosine or current #205 design);
- normal relational indexes remain intact.

If current schema still uses fallback `float8[]`, execute the existing safe conversion/migration path and validate inserts/searches against the physical `vector(...)` column.

## 5. OpenAI embedding configuration

Validate production configuration without exposing secrets:
- embedding provider enabled;
- `OPENAI_API_KEY` present in the service that performs embeddings;
- configured model and expected dimensions match schema/index;
- failures are retryable and do not block ordinary catalog/API availability.

Do not commit keys.

## 6. Incremental/idempotent backfill

Run #205 embedding generation against the real canonical catalog, including #211 discovery titles when present.

Requirements:
- resumable batches;
- only rows missing/stale for current document/model version;
- bounded concurrency/API rate usage;
- progress counters;
- success/failed/skipped counts;
- safe restart after Railway deploy/restart;
- no full regeneration if already-current vectors exist.

## 7. Coverage diagnostics

Report at minimum:
- total eligible Movies;
- total eligible Series;
- embedded count;
- missing/failed count;
- document metadata coverage (overview/genres/keywords/credits where relevant);
- vector index mode actually in use;
- embedding model/version/dimension.

## 8. Real semantic validation

After backfill, execute real queries through the Recommendation Lab/engine, including:
- `SF qui fait réfléchir`;
- `thriller en huis clos où personne n'est fiable`;
- `comédie légère familiale`.

Prove queries are executing via pgvector/vector-distance retrieval rather than the fallback array SQL path.

Capture query/index diagnostics (`EXPLAIN` or equivalent) where useful without leaking data/secrets.

## 9. Cutover / rollback

Only switch production `DATABASE_URL` after:
- restore/migration validated;
- application login/Home/catalog works;
- profile state/progress exists;
- pgvector extension/index works;
- embedding insert + semantic query works.

Keep a documented rollback path to the old DB until the new deployment is stable.

## Acceptance criteria

- [ ] Empty new pgvector DB is never treated as production source of truth before migration.
- [ ] Existing production relational data is backed up and preserved.
- [ ] New production DB has pgvector enabled and correct vector schema/index.
- [ ] Application can read/write normal relational data after migration.
- [ ] OpenAI embedding provider configuration works without secret leakage.
- [ ] Real catalog embedding backfill is resumable/idempotent.
- [ ] Coverage counts are reported.
- [ ] Semantic retrieval uses pgvector path in production.
- [ ] Recommendation Lab returns sensible real results from vectors.
- [ ] Login, profiles, catalog, Continue Watching and playback-related relational state survive migration.
- [ ] Old production DB remains available for rollback until validation is complete.

## Completion rule

Do not close because `CREATE EXTENSION vector` succeeds. Completion requires a migrated real production dataset, a successful embedding backfill, proof that real semantic queries use pgvector, and a production smoke check showing existing IPTVFlix user/catalog state is still intact.