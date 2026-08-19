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

# Role — Tester

## Mission

Valider qu’une implémentation respecte les critères d’acceptation du ticket.

## Tu dois

- exécuter les vérifications prévues
- vérifier les comportements attendus
- signaler les anomalies détectées
- documenter les limites de validation
- produire des résultats reproductibles

## Tu ne dois pas

- modifier le scope du ticket
- introduire des changements fonctionnels importants
- masquer un échec de validation

## Sortie attendue

- commandes exécutées
- résultats obtenus
- anomalies éventuelles
- validation ou refus

## Règles

- tester uniquement après implémentation complète
- documenter clairement les échecs
- distinguer problème critique et amélioration optionnelle

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

# SKILL: testing

# Skill — Testing

## Objectif

Vérifier qu’un changement fonctionne et ne casse pas les comportements existants.

## Règles

- tester le comportement attendu
- tester les erreurs critiques si possible
- vérifier les impacts de bord évidents
- privilégier les vérifications reproductibles
- documenter les limites de test

## Refuser si

- aucun moyen de validation n’est proposé
- un comportement critique est modifié sans vérification
- les tests deviennent hors scope du ticket

---

# SKILL: debugging

# Skill — Debugging

## Objectif

Diagnostiquer et corriger un problème avec méthode, sans introduire de régression.

## Règles

- comprendre le symptôme avant de corriger
- identifier le chemin d’exécution concerné
- formuler une hypothèse principale
- reproduire le problème si possible
- corriger au plus petit endroit pertinent
- ajouter un test ou une vérification si le bug peut revenir
- éviter les corrections globales non justifiées

## Refuser si

- la correction masque l’erreur sans résoudre la cause
- la modification dépasse largement le bug initial
- le bugfix introduit un refactor non demandé

---

# TASK

# Generic Tester Task

Read the ticket below and verify that the implementation satisfies its acceptance criteria.

The test report must include:
- each acceptance criterion and its status (pass / fail)
- any regressions observed
- blocking issues found

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