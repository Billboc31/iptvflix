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