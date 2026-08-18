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

# Role — Coder

## Mission

Implémenter strictement un ticket en suivant le plan validé et les skills applicables.

## Tu dois

- lire le ticket
- lire le plan validé
- respecter le scope
- lister les fichiers créés ou modifiés
- produire un changement minimal, lisible et testable
- ajouter ou adapter les tests si nécessaire
- signaler les hypothèses et limites

## Tu ne dois pas

- élargir le ticket
- réécrire l’architecture sans demande explicite
- faire un refactor massif non demandé
- modifier la mémoire projet sauf si le ticket le demande explicitement
- masquer les erreurs ou incertitudes

## Sortie attendue

- résumé des changements
- liste des fichiers modifiés
- vérifications effectuées
- limites connues

## Règles

- coder uniquement après `PLAN_APPROVED`
- ne jamais contourner les contraintes du plan
- garder les changements petits et reviewables

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

# SKILL: git-discipline

# Skill — Git Discipline

## Objectif

Maintenir un historique Git propre, compréhensible et traçable.

## Règles

- un ticket = une unité de travail cohérente
- éviter les commits mélangeant plusieurs sujets
- utiliser des messages de commit explicites
- conserver les PR lisibles
- éviter les modifications hors scope
- maintenir les fichiers mémoire cohérents avec les changements réels

## Refuser si

- la PR mélange plusieurs fonctionnalités
- des changements non liés sont ajoutés
- les commits deviennent impossibles à reviewer

---

# SKILL: code-quality

# Skill — Code Quality

## Objectif

Produire des changements simples, lisibles, robustes et faciles à reviewer.

## Règles

- privilégier le code simple avant le code sophistiqué
- utiliser des noms explicites
- garder des fonctions courtes et lisibles
- éviter la magie cachée
- gérer les erreurs explicitement
- ajouter des logs utiles sans bruit excessif
- éviter les dépendances inutiles
- conserver un changement borné au ticket

## Refuser si

- le code devient inutilement complexe
- le ticket introduit une dépendance non justifiée
- les erreurs sont masquées
- les changements dépassent le scope demandé

---

# SKILL: refactor-safety

# Skill — Refactor Safety

## Objectif

Limiter les régressions et les dérives de scope lors des modifications.

## Règles

- modifier uniquement le périmètre demandé
- éviter les refactors transversaux implicites
- préserver les comportements existants
- maintenir la compatibilité sauf demande explicite
- privilégier des changements incrémentaux

## Refuser si

- le ticket dérive vers une réécriture globale
- plusieurs couches sont modifiées sans justification
- le comportement change silencieusement

---

# SKILL: security

# Skill — Security

## Objectif

Réduire les risques de sécurité et éviter les comportements dangereux.

## Règles

- ne pas exposer de secrets dans logs ou documentation
- limiter les permissions au strict nécessaire
- éviter les exécutions implicites dangereuses
- valider les entrées externes
- documenter les impacts sécurité importants
- éviter les comportements destructifs implicites

## Refuser si

- des secrets sont hardcodés
- des données sensibles sont logguées
- une opération destructive n’est pas explicitement contrôlée

---

# TASK

# Generic Coder Task

Read the ticket and the approved plan below, then implement the required changes.

The implementation must:
- follow the approved plan strictly
- remain within scope
- list all created or modified files
- be minimal, readable, and testable

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

---

## Contexte de retry injecté par run_ticket.py

## Output précédent

**18/18 tests pass** across 4 test files. All implementation is complete. Here's a summary of what was built:

---

## Files created

| File | Purpose |
|---|---|
| `apps/api/migrations/0036_t102_media_embeddings.sql` | Enables pgvector extension + creates `media_embeddings` table with HNSW index |
| `apps/api/src/db/schema/media-embeddings.ts` | Drizzle schema with `customType` vector column |
| `apps/api/src/services/embedding-document-builder.ts` | Deterministic embedding text builder + SHA-256 hash + coverage metrics |
| `apps/api/src/services/embedding-provider.ts` | `EmbeddingProvider` interface + `OpenAIEmbeddingProvider` (`text-embedding-3-small`, 1536d) |
| `apps/api/src/services/embedding-service.ts` | `upsertEmbedding` (skip-if-hash-unchanged) + `semanticSearch` (cosine distance via pgvector `<=>`) |
| `apps/api/src/services/embedding-backfill-service.ts` | Idempotent batch backfill — paginated cursor, bounded concurrency, exponential retry |
| `apps/api/src/services/semantic-retrieval-service.ts` | Top-K retrieval enriched with title/year/poster metadata |
| `apps/api/src/routes/recommendation-lab.ts` | `POST /recommendation-lab/semantic-query` with optional side-by-side comparison |
| `apps/api/src/benchmarks/embedding-benchmarks.ts` | 5-query benchmark suite with precision@5/10 scoring |
| `packages/api-contracts/src/embeddings.ts` | `SemanticQueryRequest/Response/Candidate` types |
| `apps/web/src/pages/RecommendationLabPage.tsx` | Lab UI with benchmark quick-picks, comparison mode, similarity badges |
| 3 test files | 18 unit tests covering document builder, embedding service, and backfill service |

## Files modified

- `apps/api/src/db/schema/index.ts` — exports `media-embeddings`
- `apps/api/src/config/env.ts` — adds `OPENAI_API_KEY`
- `apps/api/package.json` — adds `openai` dependency + `benchmark:embeddings` script
- `apps/api/src/services/metadata-enrichment-service.ts` — optional `onEnriched` callback for fire-and-forget embedding after enrichment
- `apps/api/src/routes/embedding-backfill.ts` — replaces 501 stub with real backfill + coverage endpoints
- `apps/api/src/routes/__tests__/embedding-backfill.test.ts` — updates for new behavior
- `apps/api/src/index.ts` — wires embedding service + lab route in protected scope
- `packages/api-contracts/src/index.ts` — exports embeddings types
- `apps/web/src/App.tsx` — adds `/lab` route
- `apps/web/src/lib/api.ts` — adds `semanticQuery()` function
- `apps/web/src/components/layout/TopNav.tsx` — adds "Lab" nav item

---

## Review

Now I have everything needed for a complete review. Let me write it.

---

# PR Review — T102: Build catalog embeddings and vector retrieval

## Résumé

L'implémentation couvre l'ensemble du scope du ticket : document builder déterministe, abstraction du provider, stockage pgvector, backfill idempotent, hook d'enrichissement, retrieval API, Lab UI et suite de benchmarks. La structure générale est solide et les 18 tests passent. Cependant, deux bugs de correction bloquants ont été identifiés qui compromettent le fonctionnement sur un catalogue réel.

---

## Vérifications effectuées

- Lecture complète des fichiers de services (`embedding-document-builder.ts`, `embedding-provider.ts`, `embedding-service.ts`, `embedding-backfill-service.ts`, `semantic-retrieval-service.ts`)
- Lecture des routes (`embedding-backfill.ts`, `recommendation-lab.ts`)
- Lecture de la migration SQL et du schéma Drizzle
- Lecture du benchmark suite
- Lecture des tests (backfill, embedding service)
- Vérification de la cohérence du plan vs implémentation
- Vérification des valeurs stockées dans `media_credits.mediaType` (lowercase `'movie'`/`'series'` — correctement utilisées dans l'implémentation)

---

## Points validés

- **Document builder** : déterministe, versionné (`DOCUMENT_VERSION`), champs manquants omis (pas de "N/A"), hash SHA-256 canonique incluant la version. Correct.
- **Provider abstraction** : interface propre, seul OpenAI text-embedding-3-small implémenté, extension possible sans changer le schéma.
- **Migration** : idempotente (`IF NOT EXISTS`), extension pgvector, index HNSW avec fallback documenté vers IVFFlat.
- **Upsert idempotent** : skip-if-hash-unchanged correct, conflict resolution sur `(media_id, media_type, model_provider, model_name)`.
- **Retry logic** : backoff exponentiel borné (max 16s), 3 tentatives max, erreurs loggées.
- **Semaphore de concurrence** : implémentation correcte sans dépendance externe.
- **Hook d'enrichissement** : fire-and-forget dans `onEnriched`, erreurs ne propagent pas vers l'enrichissement. Correct.
- **Lab route** : validation de `query`, clamp de `topK` entre 1 et 50, support `compareQuery`. Correct.
- **Benchmark suite** : 5 requêtes du ticket, precision@5/10, pass-rate ≥ 20%, fuzzy matching. Correct.
- **Séparation structured/semantic** : les genres, runtime, langue restent dans les tables `movies`/`series` ; l'embedding ne les encode pas comme critères filtrables. Conforme au ticket §2.
- **Coverage endpoint** : overview, keywords, language exposés avec fractions correctes.
- **Tests** : couverture des cas nominaux (embed, skip, retry). Les mocks sont propres.

---

## Problèmes détectés

### 🔴 BLOQUANT 1 — Cursor de pagination du backfill inversé

**Fichier** : `apps/api/src/services/embedding-backfill-service.ts`, lignes 122-133

```ts
or(
  lt(table.createdAt, cursor.createdAt),   // ← BUG: devrait être gt
  and(eq(table.createdAt, cursor.createdAt), sql`${table.id} > ${cursor.id}`),
)
```

Avec `ORDER BY createdAt ASC, id ASC`, le curseur de pagination forward doit avancer vers des dates **supérieures** à la dernière ligne traitée. L'opérateur `lt` (inférieur) fait l'inverse : la requête suivante récupère les lignes antérieures au curseur, soit des éléments déjà traités.

**Effet concret** : Pour un catalogue avec plus de `batchSize` (50) items enrichis :
1. Batch 1 : lignes 1–50 correctement traitées.
2. Cursor = dernière ligne du batch (ligne 50).
3. Batch 2 : `WHERE createdAt < ligne50.createdAt` → retourne les lignes 1–49 (déjà traitées, toutes `skipped`).
4. Le curseur recule à chaque itération jusqu'à ce que la fenêtre soit vide.
5. Les lignes 51–N ne sont **jamais** traitées.

**Raison pour laquelle les tests ne l'ont pas détecté** : tous les tests utilisent ≤ 2 items, donc le chemin de pagination n'est jamais exercé.

**Fix** :
```ts
// apps/api/src/services/embedding-backfill-service.ts, ligne 1
import { isNotNull, asc, and, gt, or, eq, sql } from 'drizzle-orm'

// ligne 122-126
or(
  gt(table.createdAt, cursor.createdAt),   // ← gt, pas lt
  and(eq(table.createdAt, cursor.createdAt), sql`${table.id} > ${cursor.id}`),
)
```

Un test de pagination avec `batchSize: 2` et 3+ items doit être ajouté pour protéger cette logique.

---

### 🔴 BLOQUANT 2 — Full table scan dans `SemanticRetrievalService.enrichWithMetadata`

**Fichier** : `apps/api/src/services/semantic-retrieval-service.ts`, lignes 34–49

```ts
movieIds.length > 0
  ? this.db
      .select({ id: movies.id, title: movies.title, year: movies.year, posterPath: movies.posterPath })
      .from(movies)
      // ← Pas de WHERE clause : charge toute la table movies
  : Promise.resolve([])
```

Les tableaux `movieIds` et `seriesIds` sont construits mais jamais utilisés dans la requête. Chaque appel à `retrieve()` dump la totalité des tables `movies` et `series` en mémoire.

**Effet concret** : Avec un catalogue de 5 000 films, une requête sémantique charge ~5 000 lignes pour en utiliser 10. La recherche vectorielle est O(log n) grâce à HNSW ; l'enrichissement est O(n). Cela rend le Lab inutilisable en pratique sur un vrai catalogue.

**Fix** :
```ts
import { eq, inArray } from 'drizzle-orm'

// Pour les films :
? this.db
    .select({ id: movies.id, title: movies.title, year: movies.year, posterPath: movies.posterPath })
    .from(movies)
    .where(inArray(movies.id, movieIds))

// Pour les séries :
? this.db
    .select({ id: series.id, title: series.title, year: series.firstAirYear, posterPath: series.posterPath })
    .from(series)
    .where(inArray(series.id, seriesIds))
```

---

## Risques éventuels (non bloquants)

### 🟡 `sql.raw()` avec le vecteur dans `semanticSearch`

**Fichier** : `apps/api/src/services/embedding-service.ts`, lignes 98-117

```ts
const vectorLiteral = `[${queryVector.join(',')}]`
sql.raw(`'${vectorLiteral}'::vector`)
```

Le vecteur est interpolé via `sql.raw()`, bypassing la parameterisation de Drizzle. En pratique le risque d'injection est nul (la source est un `number[]` retourné par l'API OpenAI), mais le pattern est mauvais. Acceptable pour v1 si documenté, mais à adresser lors d'un refactor pgvector/Drizzle.

### 🟡 Coverage endpoint ne remonte pas les crédits

**Fichier** : `apps/api/src/routes/embedding-backfill.ts`

Le plan (§13) et le ticket (§10) mentionnent explicitement `credits` dans les métriques de coverage. L'endpoint retourne `overview`, `keywords`, `language` mais pas `credits`. Mineur car les autres champs sont présents, mais incomplet vis-à-vis des critères d'acceptation.

### 🟡 Concurrence effective 2× le paramètre documenté

`runBackfill` lance `MOVIE` et `SERIES` en `Promise.all`. Avec `concurrency: 5`, le maximum effectif d'appels OpenAI simultanés est 10. À surveiller pour les rate limits.

### 🟡 Backfill synchrone (timeout HTTP)

Le `POST /admin/embedding-backfill` est synchrone. Pour un catalogue de 2 000+ items avec rate limiting OpenAI, la requête peut prendre plusieurs minutes. Documenté dans le plan comme "for now", mais à opérer avec précaution.

### 🟡 Pas de validation de longueur maximale sur `query`

**Fichier** : `apps/api/src/routes/recommendation-lab.ts`

Une requête très longue sera transmise à l'API OpenAI qui retournera une erreur de token limit, résultant en un 500 côté client. Un clamp à 2000 caractères suffirait.

---

## Décision

Deux bugs bloquants doivent être corrigés avant validation :

1. **Cursor `lt` → `gt`** dans le backfill + test de pagination multi-batch.
2. **`inArray` WHERE clause manquant** dans `enrichWithMetadata`.

Sans ces corrections, le backfill ne peut pas traiter un catalogue réel (>50 items) et le Lab charge la table entière à chaque requête. Les critères d'acceptation "catalog can be embedded idempotently" et "Recommendation Engine retrieves top-K real titles" ne sont pas satisfaits en conditions réelles.

## Actions demandées

1. `embedding-backfill-service.ts` : remplacer `lt` par `gt` (importer `gt` depuis drizzle-orm) ; ajouter un test avec `batchSize: 2` et 3 items vérifiant que tous sont traités.
2. `semantic-retrieval-service.ts` : ajouter `.where(inArray(movies.id, movieIds))` et `.where(inArray(series.id, seriesIds))`.
3. (Optionnel, non bloquant) `embedding-backfill.ts` : ajouter le champ `credits` dans la réponse de coverage.

IMPLEMENTATION_FIX_REQUIRED

---

## Instructions de fix

# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T102/reviews/implementation-review.md
- generated at: 2026-08-18T09:06:29Z

---

Now I have everything needed for a complete review. Let me write it.

---

# PR Review — T102: Build catalog embeddings and vector retrieval

## Résumé

L'implémentation couvre l'ensemble du scope du ticket : document builder déterministe, abstraction du provider, stockage pgvector, backfill idempotent, hook d'enrichissement, retrieval API, Lab UI et suite de benchmarks. La structure générale est solide et les 18 tests passent. Cependant, deux bugs de correction bloquants ont été identifiés qui compromettent le fonctionnement sur un catalogue réel.

---

## Vérifications effectuées

- Lecture complète des fichiers de services (`embedding-document-builder.ts`, `embedding-provider.ts`, `embedding-service.ts`, `embedding-backfill-service.ts`, `semantic-retrieval-service.ts`)
- Lecture des routes (`embedding-backfill.ts`, `recommendation-lab.ts`)
- Lecture de la migration SQL et du schéma Drizzle
- Lecture du benchmark suite
- Lecture des tests (backfill, embedding service)
- Vérification de la cohérence du plan vs implémentation
- Vérification des valeurs stockées dans `media_credits.mediaType` (lowercase `'movie'`/`'series'` — correctement utilisées dans l'implémentation)

---

## Points validés

- **Document builder** : déterministe, versionné (`DOCUMENT_VERSION`), champs manquants omis (pas de "N/A"), hash SHA-256 canonique incluant la version. Correct.
- **Provider abstraction** : interface propre, seul OpenAI text-embedding-3-small implémenté, extension possible sans changer le schéma.
- **Migration** : idempotente (`IF NOT EXISTS`), extension pgvector, index HNSW avec fallback documenté vers IVFFlat.
- **Upsert idempotent** : skip-if-hash-unchanged correct, conflict resolution sur `(media_id, media_type, model_provider, model_name)`.
- **Retry logic** : backoff exponentiel borné (max 16s), 3 tentatives max, erreurs loggées.
- **Semaphore de concurrence** : implémentation correcte sans dépendance externe.
- **Hook d'enrichissement** : fire-and-forget dans `onEnriched`, erreurs ne propagent pas vers l'enrichissement. Correct.
- **Lab route** : validation de `query`, clamp de `topK` entre 1 et 50, support `compareQuery`. Correct.
- **Benchmark suite** : 5 requêtes du ticket, precision@5/10, pass-rate ≥ 20%, fuzzy matching. Correct.
- **Séparation structured/semantic** : les genres, runtime, langue restent dans les tables `movies`/`series` ; l'embedding ne les encode pas comme critères filtrables. Conforme au ticket §2.
- **Coverage endpoint** : overview, keywords, language exposés avec fractions correctes.
- **Tests** : couverture des cas nominaux (embed, skip, retry). Les mocks sont propres.

---

## Problèmes détectés

### 🔴 BLOQUANT 1 — Cursor de pagination du backfill inversé

**Fichier** : `apps/api/src/services/embedding-backfill-service.ts`, lignes 122-133

```ts
or(
  lt(table.createdAt, cursor.createdAt),   // ← BUG: devrait être gt
  and(eq(table.createdAt, cursor.createdAt), sql`${table.id} > ${cursor.id}`),
)
```

Avec `ORDER BY createdAt ASC, id ASC`, le curseur de pagination forward doit avancer vers des dates **supérieures** à la dernière ligne traitée. L'opérateur `lt` (inférieur) fait l'inverse : la requête suivante récupère les lignes antérieures au curseur, soit des éléments déjà traités.

**Effet concret** : Pour un catalogue avec plus de `batchSize` (50) items enrichis :
1. Batch 1 : lignes 1–50 correctement traitées.
2. Cursor = dernière ligne du batch (ligne 50).
3. Batch 2 : `WHERE createdAt < ligne50.createdAt` → retourne les lignes 1–49 (déjà traitées, toutes `skipped`).
4. Le curseur recule à chaque itération jusqu'à ce que la fenêtre soit vide.
5. Les lignes 51–N ne sont **jamais** traitées.

**Raison pour laquelle les tests ne l'ont pas détecté** : tous les tests utilisent ≤ 2 items, donc le chemin de pagination n'est jamais exercé.

**Fix** :
```ts
// apps/api/src/services/embedding-backfill-service.ts, ligne 1
import { isNotNull, asc, and, gt, or, eq, sql } from 'drizzle-orm'

// ligne 122-126
or(
  gt(table.createdAt, cursor.createdAt),   // ← gt, pas lt
  and(eq(table.createdAt, cursor.createdAt), sql`${table.id} > ${cursor.id}`),
)
```

Un test de pagination avec `batchSize: 2` et 3+ items doit être ajouté pour protéger cette logique.

---

### 🔴 BLOQUANT 2 — Full table scan dans `SemanticRetrievalService.enrichWithMetadata`

**Fichier** : `apps/api/src/services/semantic-retrieval-service.ts`, lignes 34–49

```ts
movieIds.length > 0
  ? this.db
      .select({ id: movies.id, title: movies.title, year: movies.year, posterPath: movies.posterPath })
      .from(movies)
      // ← Pas de WHERE clause : charge toute la table movies
  : Promise.resolve([])
```

Les tableaux `movieIds` et `seriesIds` sont construits mais jamais utilisés dans la requête. Chaque appel à `retrieve()` dump la totalité des tables `movies` et `series` en mémoire.

**Effet concret** : Avec un catalogue de 5 000 films, une requête sémantique charge ~5 000 lignes pour en utiliser 10. La recherche vectorielle est O(log n) grâce à HNSW ; l'enrichissement est O(n). Cela rend le Lab inutilisable en pratique sur un vrai catalogue.

**Fix** :
```ts
import { eq, inArray } from 'drizzle-orm'

// Pour les films :
? this.db
    .select({ id: movies.id, title: movies.title, year: movies.year, posterPath: movies.posterPath })
    .from(movies)
    .where(inArray(movies.id, movieIds))

// Pour les séries :
? this.db
    .select({ id: series.id, title: series.title, year: series.firstAirYear, posterPath: series.posterPath })
    .from(series)
    .where(inArray(series.id, seriesIds))
```

---

## Risques éventuels (non bloquants)

### 🟡 `sql.raw()` avec le vecteur dans `semanticSearch`

**Fichier** : `apps/api/src/services/embedding-service.ts`, lignes 98-117

```ts
const vectorLiteral = `[${queryVector.join(',')}]`
sql.raw(`'${vectorLiteral}'::vector`)
```

Le vecteur est interpolé via `sql.raw()`, bypassing la parameterisation de Drizzle. En pratique le risque d'injection est nul (la source est un `number[]` retourné par l'API OpenAI), mais le pattern est mauvais. Acceptable pour v1 si documenté, mais à adresser lors d'un refactor pgvector/Drizzle.

### 🟡 Coverage endpoint ne remonte pas les crédits

**Fichier** : `apps/api/src/routes/embedding-backfill.ts`

Le plan (§13) et le ticket (§10) mentionnent explicitement `credits` dans les métriques de coverage. L'endpoint retourne `overview`, `keywords`, `language` mais pas `credits`. Mineur car les autres champs sont présents, mais incomplet vis-à-vis des critères d'acceptation.

### 🟡 Concurrence effective 2× le paramètre documenté

`runBackfill` lance `MOVIE` et `SERIES` en `Promise.all`. Avec `concurrency: 5`, le maximum effectif d'appels OpenAI simultanés est 10. À surveiller pour les rate limits.

### 🟡 Backfill synchrone (timeout HTTP)

Le `POST /admin/embedding-backfill` est synchrone. Pour un catalogue de 2 000+ items avec rate limiting OpenAI, la requête peut prendre plusieurs minutes. Documenté dans le plan comme "for now", mais à opérer avec précaution.

### 🟡 Pas de validation de longueur maximale sur `query`

**Fichier** : `apps/api/src/routes/recommendation-lab.ts`

Une requête très longue sera transmise à l'API OpenAI qui retournera une erreur de token limit, résultant en un 500 côté client. Un clamp à 2000 caractères suffirait.

---

## Décision

Deux bugs bloquants doivent être corrigés avant validation :

1. **Cursor `lt` → `gt`** dans le backfill + test de pagination multi-batch.
2. **`inArray` WHERE clause manquant** dans `enrichWithMetadata`.

Sans ces corrections, le backfill ne peut pas traiter un catalogue réel (>50 items) et le Lab charge la table entière à chaque requête. Les critères d'acceptation "catalog can be embedded idempotently" et "Recommendation Engine retrieves top-K real titles" ne sont pas satisfaits en conditions réelles.

## Actions demandées

1. `embedding-backfill-service.ts` : remplacer `lt` par `gt` (importer `gt` depuis drizzle-orm) ; ajouter un test avec `batchSize: 2` et 3 items vérifiant que tous sont traités.
2. `semantic-retrieval-service.ts` : ajouter `.where(inArray(movies.id, movieIds))` et `.where(inArray(series.id, seriesIds))`.
3. (Optionnel, non bloquant) `embedding-backfill.ts` : ajouter le champ `credits` dans la réponse de coverage.

IMPLEMENTATION_FIX_REQUIRED