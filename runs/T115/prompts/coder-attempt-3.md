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


# T115 — Complete catalog enrichment and make refresh failures resumable/observable

**Source**: GitHub Issue #242

## Description

## Context

A real production catalog refresh completed with:
- 2,725 movies refreshed
- 807 series refreshed
- 0 imported (expected after bootstrap)
- **126 failed updates**

The latest refresh checkpoint shows bounded batches (for example `refresh:MOVIE:stable offset 2750`, `refresh:SERIES:stable offset 800`) rather than a complete enrichment pass over the full ~60k movie / ~5k series catalog.

Some titles are still visibly incomplete until opened, indicating lazy/on-demand enrichment remains in use.

Before generating the production embedding corpus, we need a deterministic way to fully enrich all eligible catalog titles and retry failures.

## Goals

1. Provide a complete/resumable `enrich missing` pass over the canonical catalog.
2. Diagnose and fix the 126 refresh failures instead of only storing a generic failed query string.
3. Expose accurate enrichment progress so we know when the catalog is ready for embeddings.

## Required investigation

Audit `CatalogRefreshService` and related metadata enrichment code to determine:
- why stable refresh is capped/batched at the observed offsets;
- how titles are selected for `recent`, `stable`, `upcoming`;
- whether repeated refresh runs eventually cover the entire incomplete population or continually revisit the same rows;
- why specific updates fail;
- whether nullable/empty TMDB values such as runtime `0`, empty IMDb ID, empty synopsis, keywords/collection/external IDs can violate DB constraints or type expectations.

The production example failure included a movie update for `Les Chevaliers du Fiel : L'assassin est dans la salle`; preserve and expose the actual PostgreSQL/driver error cause, not only `Failed query: update ... params ...`.

## Enrich-missing mode

Add an explicit resumable mode/action that targets all canonical movies/series whose metadata is incomplete/stale, independently from the normal periodic refresh cadence.

It should:
- enumerate eligible incomplete rows deterministically;
- process in bounded batches with configurable concurrency/rate limiting;
- checkpoint by stable cursor/key so restart does not lose progress;
- skip already-complete/fresh rows unless forced;
- retry transient TMDB/DB failures with bounded retry/backoff;
- retain per-item terminal failures for later retry;
- be idempotent;
- support movies and series;
- not depend on opening a detail page to become enriched.

## Failure observability

Persist/report at minimum for each terminal failure:
- media type;
- media ID;
- TMDB ID;
- title;
- stage (`fetch`, `map`, `db_update`, etc.);
- sanitized error class/code/message;
- retry count;
- occurredAt;
- whether retryable.

Do not log secrets/credentials.

Expose run-level stats such as:
- total eligible;
- processed;
- enriched/completed;
- skipped already complete;
- remaining;
- retrying;
- failed terminal;
- current rate;
- ETA if practical.

## Catalog stats

Extend `/admin/catalog-stats` (or a dedicated diagnostic endpoint) so we can distinguish:
- total canonical titles;
- fully enriched;
- partially enriched;
- never enriched;
- stale;
- failed last enrichment;
- embedding eligible;
- embedding blocked by incomplete metadata.

Do not report `embeddingPending: 0` when the embedding corpus has not actually been created in the target pgvector DB.

## Embedding readiness

Define an explicit minimum metadata-quality policy for embedding generation. At minimum document which fields are required/preferred and whether incomplete titles are excluded or embedded with reduced documents.

The eventual backfill must be able to select only titles that meet this policy, and later pick up titles once enrichment succeeds.

## Acceptance criteria

- [ ] Production refresh failure root causes are observable with the real DB error, not only generated SQL/params.
- [ ] Known classes of invalid/empty TMDB values are normalized safely.
- [ ] Explicit `enrich missing` pass exists and is resumable/idempotent.
- [ ] Re-running it progresses toward zero eligible incomplete titles rather than repeatedly processing the same capped batch.
- [ ] Terminal failures are persisted/listable and individually retryable or retryable as a batch.
- [ ] Admin stats expose complete/partial/missing/failed/remaining counts accurately.
- [ ] Detail-page lazy enrichment is no longer required to obtain complete metadata for eligible catalog items.
- [ ] Embedding eligibility/readiness is explicit and accurate.
- [ ] Run against the real production catalog and demonstrate meaningful reduction of incomplete titles and successful retry/fix of the previous failure population.

## Completion rule

Do not close after unit tests. Run the new enrichment mode against production (or an equivalent restored production snapshot), publish before/after counts, and show the remaining terminal failures with their real causes.

---

## Contexte de retry injecté par run_ticket.py

## Output précédent

The file looks correct. All 4 fixes are in place. Here's a summary of what was done:

---

**BLOQUANT 2 — `isEmbeddingEligible` as single source of truth**

`embedding-eligibility.ts` now exports two additional symbols derived from the same policy:
- `EMBEDDING_ELIGIBLE_SQL_PREDICATE` — raw SQL string for use inside `sql`` FILTER (WHERE ...)` aggregates (can't use a Drizzle expression builder there)
- `embeddingEligibleCondition()` — Drizzle `.where()` condition builder

`embedding-backfill-service.ts` now uses `embeddingEligibleCondition(table.metadataEnrichedAt)` in both cursor query variants (removed the inline `isNotNull`).

`catalog-stats.ts` now interpolates `sql.raw(EMBEDDING_ELIGIBLE_SQL_PREDICATE)` into all 4 FILTER WHERE clauses (movie `eligible`, movie `pending`, series `eligible`, series `pending`).

**BLOQUANT 3 — UNIQUE constraint crash on concurrent RUNNING**

`CatalogEnrichMissingService.checkNoRunningConflict()` queries for any existing RUNNING row and throws an error with `code: 'RUN_CONFLICT'` if one is found. It's called at the top of both `start()` and `retryFailures()` (before the `RUNNING` insert). The route handlers for both POSTs catch `RUN_CONFLICT` and return `409` with a descriptive message.

**BLOQUANT 4 — Retry transient failures (3 attempts, 250/500/1000 ms backoff)**

`CatalogEnrichMissingService.enrichWithRetry()` loops up to 3 times, returning early on any non-`'provider-failed'` result and sleeping between attempts. Both `execute()` (the batch cursor loop) and `retryFailures()` now call it instead of invoking `enrichMovie`/`enrichSeries` directly.

**BLOQUANT 1 — Production run** remains an operational step (cannot be automated from code). The enrichment endpoint is now correctly guarded and functional — it needs to be triggered against production to satisfy the completion rule.

---

## Review

Now I have enough information to write the complete review.

---

# PR Review — T115: Complete catalog enrichment and make refresh failures resumable/observable

## Résumé

L'implémentation couvre l'ensemble des composants fonctionnels demandés : normalisation des valeurs TMDB problématiques, persistance des échecs par item avec les vraies causes d'erreur PostgreSQL, service d'enrichissement manquant avec pagination par curseur, routes admin, extension des stats catalog, et politique d'éligibilité embedding. La qualité du code est bonne et les tests sont présents. **Cependant, la completion rule du ticket est explicitement non satisfaite.**

## Vérifications effectuées

- Code des 8 fichiers modifiés/créés principaux
- Migration SQL `0045_t115_enrichment_failures.sql`
- Migration `0046_t115_catalog_refresh_runs_type.sql`
- Service `catalog-enrich-missing-service.ts` (curseur, retry, checkpoint, conflits)
- Service `metadata-enrichment-service.ts` (`classifyError`, `persistFailure`, `clearFailure`, `enrichMovie`, `enrichSeries`)
- Client TMDB : normalisation `runtime || null`, `imdb_id || null`, `overview?.trim() || null`
- Route `catalog-stats.ts` : nouvelles métriques + `EMBEDDING_ELIGIBLE_SQL_PREDICATE`
- Service `embedding-eligibility.ts`
- Artefacts `runs/T115/` — aucun résultat de run production trouvé

## Points validés

**Normalisation TMDB** (`client.ts:53,59`)
- `runtime === 0` → `null` via `raw.runtime || null`
- `imdb_id` vide → `null` via `raw.imdb_id || null`
- `overview` whitespace → `null` via `raw.overview?.trim() || null`
- Couvre précisément les cas cités dans le ticket.

**Persistance des échecs** (`metadata-enrichment-service.ts:48–133`)
- `classifyError()` extrait `errorClass`, `errorCode`, `errorMessage` depuis l'erreur réelle (y compris PostgresError avec code `23505`)
- Upsert avec `ON CONFLICT DO UPDATE` incrémente `retryCount` correctement
- `stage` distingue `fetch` / `map` / `db_update`
- `clearFailure()` supprime l'entrée quand l'enrichissement réussit

**Service enrich-missing** (`catalog-enrich-missing-service.ts`)
- Pagination par keyset (`WHERE id > :lastId ORDER BY id`) — pas d'offset drift, cursor stable
- `checkNoRunningConflict()` retourne `409` si un run est déjà `RUNNING`
- `enrichWithRetry()` : 3 tentatives avec backoff `250ms / 500ms / 1000ms`
- Checkpoint persisted en JSONB dans `catalogRefreshRuns`
- Idempotent : skip les rows fraîches sauf `force=true`
- Support MOVIE et SERIES

**Catalog stats** (`catalog-stats.ts`)
- 8 nouvelles métriques par type (neverEnriched, partiallyEnriched, fullyEnriched, stale, failedLastEnrichment, embeddingEligible, embeddingBlocked, embeddingPending)
- `embeddingPending` est une vraie requête avec `NOT EXISTS (SELECT 1 FROM media_embeddings ...)` — ne retourne pas `0` hardcodé

**Embedding eligibility** (`embedding-eligibility.ts`)
- Source unique de vérité avec `isEmbeddingEligible()`, `EMBEDDING_ELIGIBLE_SQL_PREDICATE`, `embeddingEligibleCondition()`
- Politique documentée dans le JSDoc de la fonction
- Utilisée dans `catalog-stats.ts` (via `EMBEDDING_ELIGIBLE_SQL_PREDICATE`) et `embedding-backfill.ts` (via `embeddingEligibleCondition()`)

**Routes admin** (`catalog-enrich-missing.ts`)
- `POST /admin/catalog-enrich-missing` → 202 / 409 si conflit
- `GET /admin/catalog-enrich-missing/status`
- `GET /admin/catalog-enrich-missing/failures` (paginé, filtrable)
- `POST /admin/catalog-enrich-missing/retry-failures`

## Problèmes détectés

### BLOQUANT — Completion rule non satisfaite

Le ticket stipule explicitement :

> **Do not close after unit tests. Run the new enrichment mode against production (or an equivalent restored production snapshot), publish before/after counts, and show the remaining terminal failures with their real causes.**

Aucune trace dans les artefacts (`runs/T115/`) d'un run réel contre la production ou un snapshot. Aucun before/after count. Aucune liste des 126 échecs terminaux avec leurs vraies causes d'erreur PostgreSQL.

Les tests unitaires (51 tests) sont présents et passent, mais ils ne remplacent pas cette validation opérationnelle. Cette condition est non-négociable selon le ticket.

**Action requise** : exécuter le mode `enrich-missing` contre la production (ou snapshot restauré), capturer les stats before/after via `GET /admin/catalog-stats`, et publier la liste des échecs terminaux via `GET /admin/catalog-enrich-missing/failures`.

---

### Mineur — `enrichWithRetry` retente tous les `provider-failed` sans distinguer les erreurs transientes

`enrichWithRetry()` retente systématiquement 3 fois dès que le résultat est `provider-failed`, y compris les violations de contraintes DB (`23505`, `23502`) qui ne sont pas transientes. Le `classifyError()` classe correctement `retryable: false` dans `enrichment_failures`, mais la logique de retry automatique l'ignore.

Impact borné : au plus 3 appels × 1,75 s de délai supplémentaire par item non-transient. Non bloquant, mais le ticket demande explicitement "retry transient failures" — ce pourrait être précisé dans un suivi.

---

### Mineur — `embeddingBlocked` sera toujours 0 avec la politique actuelle

`embeddingBlocked = mEnriched - mEligible`. Or la politique d'éligibilité est `metadata_enriched_at IS NOT NULL`, ce qui est exactement ce que `enriched` compte. Donc `mEligible === mEnriched` toujours, et `embeddingBlocked === 0` toujours. La colonne est exacte mais ne transmet aucune information utile tant que la politique ne requiert pas de champs supplémentaires.

---

### Mineur — `retryFailures` avec 0 échecs insère un run COMPLETED sans vérifier le conflit

`catalog-enrich-missing-service.ts:347–353` : quand `failures.length === 0`, le code insère directement un run `COMPLETED` sans appeler `checkNoRunningConflict()`. Comportement inoffensif (le run passe de null à COMPLETED instantanément), mais sémantiquement incohérent avec la logique de conflit du reste du service.

---

### Mineur — `retryFailures` exécute les items en série

Contrairement à `execute()` qui utilise `runWithConcurrency()`, `retryFailures()` traite chaque item séquentiellement. Pour un lot de 126+ échecs, cela peut être significativement plus lent. Non bloquant pour la correction, mais à noter pour les cas de retry massif.

## Risques éventuels

- **Race condition sur le curseur** : si deux runs `ENRICH_MISSING` démarraient en même temps (impossible grâce à `checkNoRunningConflict()`), les curseurs se marcheraient dessus. La protection est correctement en place.
- **`enrichPending()` charge toute la table en mémoire** (`metadata-enrichment-service.ts:598`) — méthode pré-existante non modifiée par ce ticket, mais risque OOM sur 60k films si utilisée. Hors scope T115 mais à corriger séparément.
- **Pas de rate limiting TMDB dans `retryFailures`** — les retries s'enchaînent sans throttle inter-items, contrairement à `execute()` qui respecte `throttleMs`. Risque de rate limit TMDB sur large batch.

## Décision

L'implémentation est techniquement solide et adresse tous les critères fonctionnels. La seule raison de bloquer est la **completion rule explicite du ticket** : un run production avec before/after counts et liste des échecs terminaux réels est requis avant de clore.

IMPLEMENTATION_FIX_REQUIRED

---

## Instructions de fix

# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T115/reviews/implementation-review.md
- generated at: 2026-08-19T13:46:20Z

---

Now I have enough information to write the complete review.

---

# PR Review — T115: Complete catalog enrichment and make refresh failures resumable/observable

## Résumé

L'implémentation couvre l'ensemble des composants fonctionnels demandés : normalisation des valeurs TMDB problématiques, persistance des échecs par item avec les vraies causes d'erreur PostgreSQL, service d'enrichissement manquant avec pagination par curseur, routes admin, extension des stats catalog, et politique d'éligibilité embedding. La qualité du code est bonne et les tests sont présents. **Cependant, la completion rule du ticket est explicitement non satisfaite.**

## Vérifications effectuées

- Code des 8 fichiers modifiés/créés principaux
- Migration SQL `0045_t115_enrichment_failures.sql`
- Migration `0046_t115_catalog_refresh_runs_type.sql`
- Service `catalog-enrich-missing-service.ts` (curseur, retry, checkpoint, conflits)
- Service `metadata-enrichment-service.ts` (`classifyError`, `persistFailure`, `clearFailure`, `enrichMovie`, `enrichSeries`)
- Client TMDB : normalisation `runtime || null`, `imdb_id || null`, `overview?.trim() || null`
- Route `catalog-stats.ts` : nouvelles métriques + `EMBEDDING_ELIGIBLE_SQL_PREDICATE`
- Service `embedding-eligibility.ts`
- Artefacts `runs/T115/` — aucun résultat de run production trouvé

## Points validés

**Normalisation TMDB** (`client.ts:53,59`)
- `runtime === 0` → `null` via `raw.runtime || null`
- `imdb_id` vide → `null` via `raw.imdb_id || null`
- `overview` whitespace → `null` via `raw.overview?.trim() || null`
- Couvre précisément les cas cités dans le ticket.

**Persistance des échecs** (`metadata-enrichment-service.ts:48–133`)
- `classifyError()` extrait `errorClass`, `errorCode`, `errorMessage` depuis l'erreur réelle (y compris PostgresError avec code `23505`)
- Upsert avec `ON CONFLICT DO UPDATE` incrémente `retryCount` correctement
- `stage` distingue `fetch` / `map` / `db_update`
- `clearFailure()` supprime l'entrée quand l'enrichissement réussit

**Service enrich-missing** (`catalog-enrich-missing-service.ts`)
- Pagination par keyset (`WHERE id > :lastId ORDER BY id`) — pas d'offset drift, cursor stable
- `checkNoRunningConflict()` retourne `409` si un run est déjà `RUNNING`
- `enrichWithRetry()` : 3 tentatives avec backoff `250ms / 500ms / 1000ms`
- Checkpoint persisted en JSONB dans `catalogRefreshRuns`
- Idempotent : skip les rows fraîches sauf `force=true`
- Support MOVIE et SERIES

**Catalog stats** (`catalog-stats.ts`)
- 8 nouvelles métriques par type (neverEnriched, partiallyEnriched, fullyEnriched, stale, failedLastEnrichment, embeddingEligible, embeddingBlocked, embeddingPending)
- `embeddingPending` est une vraie requête avec `NOT EXISTS (SELECT 1 FROM media_embeddings ...)` — ne retourne pas `0` hardcodé

**Embedding eligibility** (`embedding-eligibility.ts`)
- Source unique de vérité avec `isEmbeddingEligible()`, `EMBEDDING_ELIGIBLE_SQL_PREDICATE`, `embeddingEligibleCondition()`
- Politique documentée dans le JSDoc de la fonction
- Utilisée dans `catalog-stats.ts` (via `EMBEDDING_ELIGIBLE_SQL_PREDICATE`) et `embedding-backfill.ts` (via `embeddingEligibleCondition()`)

**Routes admin** (`catalog-enrich-missing.ts`)
- `POST /admin/catalog-enrich-missing` → 202 / 409 si conflit
- `GET /admin/catalog-enrich-missing/status`
- `GET /admin/catalog-enrich-missing/failures` (paginé, filtrable)
- `POST /admin/catalog-enrich-missing/retry-failures`

## Problèmes détectés

### BLOQUANT — Completion rule non satisfaite

Le ticket stipule explicitement :

> **Do not close after unit tests. Run the new enrichment mode against production (or an equivalent restored production snapshot), publish before/after counts, and show the remaining terminal failures with their real causes.**

Aucune trace dans les artefacts (`runs/T115/`) d'un run réel contre la production ou un snapshot. Aucun before/after count. Aucune liste des 126 échecs terminaux avec leurs vraies causes d'erreur PostgreSQL.

Les tests unitaires (51 tests) sont présents et passent, mais ils ne remplacent pas cette validation opérationnelle. Cette condition est non-négociable selon le ticket.

**Action requise** : exécuter le mode `enrich-missing` contre la production (ou snapshot restauré), capturer les stats before/after via `GET /admin/catalog-stats`, et publier la liste des échecs terminaux via `GET /admin/catalog-enrich-missing/failures`.

---

### Mineur — `enrichWithRetry` retente tous les `provider-failed` sans distinguer les erreurs transientes

`enrichWithRetry()` retente systématiquement 3 fois dès que le résultat est `provider-failed`, y compris les violations de contraintes DB (`23505`, `23502`) qui ne sont pas transientes. Le `classifyError()` classe correctement `retryable: false` dans `enrichment_failures`, mais la logique de retry automatique l'ignore.

Impact borné : au plus 3 appels × 1,75 s de délai supplémentaire par item non-transient. Non bloquant, mais le ticket demande explicitement "retry transient failures" — ce pourrait être précisé dans un suivi.

---

### Mineur — `embeddingBlocked` sera toujours 0 avec la politique actuelle

`embeddingBlocked = mEnriched - mEligible`. Or la politique d'éligibilité est `metadata_enriched_at IS NOT NULL`, ce qui est exactement ce que `enriched` compte. Donc `mEligible === mEnriched` toujours, et `embeddingBlocked === 0` toujours. La colonne est exacte mais ne transmet aucune information utile tant que la politique ne requiert pas de champs supplémentaires.

---

### Mineur — `retryFailures` avec 0 échecs insère un run COMPLETED sans vérifier le conflit

`catalog-enrich-missing-service.ts:347–353` : quand `failures.length === 0`, le code insère directement un run `COMPLETED` sans appeler `checkNoRunningConflict()`. Comportement inoffensif (le run passe de null à COMPLETED instantanément), mais sémantiquement incohérent avec la logique de conflit du reste du service.

---

### Mineur — `retryFailures` exécute les items en série

Contrairement à `execute()` qui utilise `runWithConcurrency()`, `retryFailures()` traite chaque item séquentiellement. Pour un lot de 126+ échecs, cela peut être significativement plus lent. Non bloquant pour la correction, mais à noter pour les cas de retry massif.

## Risques éventuels

- **Race condition sur le curseur** : si deux runs `ENRICH_MISSING` démarraient en même temps (impossible grâce à `checkNoRunningConflict()`), les curseurs se marcheraient dessus. La protection est correctement en place.
- **`enrichPending()` charge toute la table en mémoire** (`metadata-enrichment-service.ts:598`) — méthode pré-existante non modifiée par ce ticket, mais risque OOM sur 60k films si utilisée. Hors scope T115 mais à corriger séparément.
- **Pas de rate limiting TMDB dans `retryFailures`** — les retries s'enchaînent sans throttle inter-items, contrairement à `execute()` qui respecte `throttleMs`. Risque de rate limit TMDB sur large batch.

## Décision

L'implémentation est techniquement solide et adresse tous les critères fonctionnels. La seule raison de bloquer est la **completion rule explicite du ticket** : un run production avec before/after counts et liste des échecs terminaux réels est requis avant de clore.

IMPLEMENTATION_FIX_REQUIRED