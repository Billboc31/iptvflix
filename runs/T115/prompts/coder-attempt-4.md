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

No TypeScript errors on the modified file. The changes are clean.

Here's a summary of what was fixed in `catalog-enrich-missing-service.ts`:

**Fix 1 — `retryFailures` conflict check ordering** (line 340): `checkNoRunningConflict()` is now called before fetching failures, so a 409 is returned correctly even when there happen to be 0 failures and another run is RUNNING.

**Fix 2 — `retryFailures` concurrency** (lines 364–381): The sequential `for...of` loop is replaced with `runWithConcurrency(failures, concurrency, ...)`, defaulting to concurrency=3, matching the behavior of `execute()`. A new `concurrency` option is also accepted via the method signature.

---

**Remaining operational requirement** (cannot be satisfied by code alone): The ticket's completion rule requires running the enrichment mode against the production database and publishing before/after stats. This must be done manually by triggering `POST /admin/catalog-enrich-missing`, then querying `GET /admin/catalog-stats` and `GET /admin/catalog-enrich-missing/failures` to capture the results.

---

## Review

I have a complete picture. Let me write the final review.

---

# PR Review — T115: Complete catalog enrichment and make refresh failures resumable/observable

## Résumé

L'implémentation est code-complète et bien structurée : normalisation TMDB, persistance des vrais codes d'erreur PostgreSQL, service `enrich-missing` avec pagination par curseur, routes admin, stats catalog étendues, et politique d'éligibilité embedding. Les deux correctifs demandés lors de la review précédente (conflit de run et concurrence dans `retryFailures`) sont appliqués. **La completion rule du ticket reste la seule condition bloquante non satisfaite : aucun run contre la production ni résultats before/after n'ont été produits.**

## Vérifications effectuées

- `apps/api/src/providers/metadata/tmdb/client.ts` — normalisation dans `mapMovieDetail()` et `mapSeriesDetail()`
- `apps/api/src/db/schema/enrichment-failures.ts` + migration `0045_t115_enrichment_failures.sql`
- `apps/api/migrations/0046_t115_catalog_refresh_runs_type.sql` — colonne `type`
- `apps/api/src/services/metadata-enrichment-service.ts` — `classifyError`, `persistFailure`, `clearFailure`, `enrichMovie`, `enrichSeries`
- `apps/api/src/services/catalog-enrich-missing-service.ts` — curseur, retry, checkpoint, `checkNoRunningConflict`, `retryFailures` avec `runWithConcurrency`
- `apps/api/src/routes/catalog-enrich-missing.ts` — 4 routes admin
- `apps/api/src/routes/catalog-stats.ts` — nouvelles métriques et `EMBEDDING_ELIGIBLE_SQL_PREDICATE`
- `apps/api/src/services/embedding-eligibility.ts`
- `runs/T115/` — aucun artefact de run production trouvé

## Points validés

**Normalisation TMDB** (`client.ts:53,59,94`)
- `raw.runtime || null` → `runtimeMinutes: null` pour runtime=0
- `raw.imdb_id || null` → `imdbId: null` pour chaîne vide (movies uniquement — series hardcode `null`, cohérent avec l'absence du champ direct dans l'endpoint TMDB series)
- `raw.overview?.trim() || null` → `synopsis: null` pour overview blanc, dans les deux mappers

**Persistance des échecs** (`metadata-enrichment-service.ts:48–134`)
- `classifyError()` extrait la vraie `errorClass` (ex. `PostgresError`), `errorCode` (ex. `23505`), et `errorMessage` — plus de SQL généré en guise d'erreur
- Upsert `ON CONFLICT (media_type, media_id) DO UPDATE` avec `retryCount + 1` correct
- `stage` distingue `fetch` / `db_update` (le stage `map` n'est pas déclenché dans l'implémentation actuelle ; les erreurs de mapping se manifestent comme des valeurs null acceptées, non comme des exceptions — comportement acceptable)
- `clearFailure()` supprime l'entrée en cas de succès

**Fixes de la review précédente** (`catalog-enrich-missing-service.ts`)
- ✅ `checkNoRunningConflict()` appelé ligne 340, **avant** la récupération des failures — retourne 409 même si 0 failures
- ✅ `retryFailures()` utilise `runWithConcurrency` lignes 364–381 avec `concurrency` configurable (défaut 3)

**Service enrich-missing** (`catalog-enrich-missing-service.ts`)
- Keyset pagination `WHERE id > :lastId ORDER BY id LIMIT batchSize` — pas de drift, 100% resumable
- Checkpoint JSONB mis à jour après chaque batch
- Idempotent : rows fraîches skippées sauf `force=true`
- Support MOVIE et SERIES

**Catalog stats** (`catalog-stats.ts`)
- 8 nouvelles métriques par type : `neverEnriched`, `partiallyEnriched`, `fullyEnriched`, `stale`, `failedLastEnrichment`, `embeddingEligible`, `embeddingBlocked`, `embeddingPending`
- `embeddingPending` compte via `NOT EXISTS (SELECT 1 FROM media_embeddings ...)` — ne retourne pas 0 hardcodé

**Embedding eligibility** (`embedding-eligibility.ts`)
- Source unique de vérité : `isEmbeddingEligible()`, `EMBEDDING_ELIGIBLE_SQL_PREDICATE`, `embeddingEligibleCondition()`
- Politique documentée inline

## Problèmes détectés

### BLOQUANT — Completion rule non satisfaite (inchangée depuis la review précédente)

Le ticket stipule explicitement :

> **Do not close after unit tests. Run the new enrichment mode against production (or an equivalent restored production snapshot), publish before/after counts, and show the remaining terminal failures with their real causes.**

Aucune trace dans `runs/T115/` d'un run réel. Aucun résultat `GET /admin/catalog-stats` before/after. Aucune liste des 126 échecs terminaux avec leurs vraies causes d'erreur.

Les 51 tests unitaires sont présents et passent. Ils ne remplacent pas cette validation opérationnelle.

**Action requise** : exécuter `POST /admin/catalog-enrich-missing` contre la production ou un snapshot restauré, capturer `GET /admin/catalog-stats` avant et après, et publier `GET /admin/catalog-enrich-missing/failures` avec les causes réelles.

---

### Mineur — `enrichWithRetry` retente systématiquement les erreurs DB non transientes

`catalog-enrich-missing-service.ts:91–99` : la méthode retente 3 fois sur tout `provider-failed`, y compris les violations de contraintes PostgreSQL (`23502`, `23505`) qui ne sont pas transientes. `classifyError()` marque correctement ces erreurs `retryable: false` dans `enrichment_failures`, mais `enrichWithRetry()` les ignore et fait quand même 3 appels supplémentaires.

Impact borné : au plus 2 appels supplémentaires × ~750 ms de délai par item terminal non-transient. Non bloquant, mais en contradiction mineure avec la spécification "retry transient failures".

---

### Mineur — `embeddingBlocked` est structurellement toujours 0

`catalog-stats.ts:152` : `embeddingBlocked = enriched - eligible`. La politique actuelle d'éligibilité est `metadataEnrichedAt IS NOT NULL`, ce qui est exactement la définition de `enriched`. Donc `eligible === enriched` toujours, et `embeddingBlocked === 0` toujours. La colonne est correcte mais sans valeur d'information tant que la politique n'ajoute pas de critères supplémentaires. À documenter ou à noter pour le suivi.

---

### Mineur — Stat `retrying` absente

Le ticket demande d'exposer une stat `retrying` dans les stats de run. `EnrichMissingStats` (`catalog-enrich-missing-service.ts:23–32`) n'inclut pas ce champ. Non bloquant — `enrichWithRetry` opère de façon synchrone dans le batch et la notion de "en cours de retry" n'est pas facilement observable, mais l'absence est à noter.

## Risques éventuels

- Si `runWithConcurrency` est appelé avec des items qui lèvent des erreurs non gérées dans le handler, ces erreurs sont absorbées par `.catch((err) => console.warn(...))` — les échecs individuels ne font pas planter le run, ce qui est correct pour un enrichissement best-effort.
- La stat `totalEligible` est capturée au lancement et ne se met pas à jour pendant le run : l'ETA peut dériver si de nouvelles rows deviennent éligibles pendant l'exécution. Acceptable pour un calcul estimatif.

## Décision

- REQUEST_CHANGES

## Actions demandées

1. **[OBLIGATOIRE]** Exécuter `POST /admin/catalog-enrich-missing` contre la production (ou snapshot restauré), capturer `GET /admin/catalog-stats` before/after, publier `GET /admin/catalog-enrich-missing/failures` avec les vraies causes d'erreur. Déposer les résultats dans `runs/T115/`.

2. **[Optionnel — suivi]** Affiner `enrichWithRetry()` pour consulter le `retryable` flag de `classifyError()` et n'effectuer les tentatives supplémentaires que pour les erreurs transientes.

3. **[Optionnel — suivi]** Documenter dans un commentaire `catalog-stats.ts` que `embeddingBlocked` sera significatif uniquement quand la politique d'éligibilité inclura des champs au-delà de `metadataEnrichedAt`.

IMPLEMENTATION_FIX_REQUIRED

---

## Instructions de fix

# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T115/reviews/implementation-review.md
- generated at: 2026-08-19T13:59:57Z

---

I have a complete picture. Let me write the final review.

---

# PR Review — T115: Complete catalog enrichment and make refresh failures resumable/observable

## Résumé

L'implémentation est code-complète et bien structurée : normalisation TMDB, persistance des vrais codes d'erreur PostgreSQL, service `enrich-missing` avec pagination par curseur, routes admin, stats catalog étendues, et politique d'éligibilité embedding. Les deux correctifs demandés lors de la review précédente (conflit de run et concurrence dans `retryFailures`) sont appliqués. **La completion rule du ticket reste la seule condition bloquante non satisfaite : aucun run contre la production ni résultats before/after n'ont été produits.**

## Vérifications effectuées

- `apps/api/src/providers/metadata/tmdb/client.ts` — normalisation dans `mapMovieDetail()` et `mapSeriesDetail()`
- `apps/api/src/db/schema/enrichment-failures.ts` + migration `0045_t115_enrichment_failures.sql`
- `apps/api/migrations/0046_t115_catalog_refresh_runs_type.sql` — colonne `type`
- `apps/api/src/services/metadata-enrichment-service.ts` — `classifyError`, `persistFailure`, `clearFailure`, `enrichMovie`, `enrichSeries`
- `apps/api/src/services/catalog-enrich-missing-service.ts` — curseur, retry, checkpoint, `checkNoRunningConflict`, `retryFailures` avec `runWithConcurrency`
- `apps/api/src/routes/catalog-enrich-missing.ts` — 4 routes admin
- `apps/api/src/routes/catalog-stats.ts` — nouvelles métriques et `EMBEDDING_ELIGIBLE_SQL_PREDICATE`
- `apps/api/src/services/embedding-eligibility.ts`
- `runs/T115/` — aucun artefact de run production trouvé

## Points validés

**Normalisation TMDB** (`client.ts:53,59,94`)
- `raw.runtime || null` → `runtimeMinutes: null` pour runtime=0
- `raw.imdb_id || null` → `imdbId: null` pour chaîne vide (movies uniquement — series hardcode `null`, cohérent avec l'absence du champ direct dans l'endpoint TMDB series)
- `raw.overview?.trim() || null` → `synopsis: null` pour overview blanc, dans les deux mappers

**Persistance des échecs** (`metadata-enrichment-service.ts:48–134`)
- `classifyError()` extrait la vraie `errorClass` (ex. `PostgresError`), `errorCode` (ex. `23505`), et `errorMessage` — plus de SQL généré en guise d'erreur
- Upsert `ON CONFLICT (media_type, media_id) DO UPDATE` avec `retryCount + 1` correct
- `stage` distingue `fetch` / `db_update` (le stage `map` n'est pas déclenché dans l'implémentation actuelle ; les erreurs de mapping se manifestent comme des valeurs null acceptées, non comme des exceptions — comportement acceptable)
- `clearFailure()` supprime l'entrée en cas de succès

**Fixes de la review précédente** (`catalog-enrich-missing-service.ts`)
- ✅ `checkNoRunningConflict()` appelé ligne 340, **avant** la récupération des failures — retourne 409 même si 0 failures
- ✅ `retryFailures()` utilise `runWithConcurrency` lignes 364–381 avec `concurrency` configurable (défaut 3)

**Service enrich-missing** (`catalog-enrich-missing-service.ts`)
- Keyset pagination `WHERE id > :lastId ORDER BY id LIMIT batchSize` — pas de drift, 100% resumable
- Checkpoint JSONB mis à jour après chaque batch
- Idempotent : rows fraîches skippées sauf `force=true`
- Support MOVIE et SERIES

**Catalog stats** (`catalog-stats.ts`)
- 8 nouvelles métriques par type : `neverEnriched`, `partiallyEnriched`, `fullyEnriched`, `stale`, `failedLastEnrichment`, `embeddingEligible`, `embeddingBlocked`, `embeddingPending`
- `embeddingPending` compte via `NOT EXISTS (SELECT 1 FROM media_embeddings ...)` — ne retourne pas 0 hardcodé

**Embedding eligibility** (`embedding-eligibility.ts`)
- Source unique de vérité : `isEmbeddingEligible()`, `EMBEDDING_ELIGIBLE_SQL_PREDICATE`, `embeddingEligibleCondition()`
- Politique documentée inline

## Problèmes détectés

### BLOQUANT — Completion rule non satisfaite (inchangée depuis la review précédente)

Le ticket stipule explicitement :

> **Do not close after unit tests. Run the new enrichment mode against production (or an equivalent restored production snapshot), publish before/after counts, and show the remaining terminal failures with their real causes.**

Aucune trace dans `runs/T115/` d'un run réel. Aucun résultat `GET /admin/catalog-stats` before/after. Aucune liste des 126 échecs terminaux avec leurs vraies causes d'erreur.

Les 51 tests unitaires sont présents et passent. Ils ne remplacent pas cette validation opérationnelle.

**Action requise** : exécuter `POST /admin/catalog-enrich-missing` contre la production ou un snapshot restauré, capturer `GET /admin/catalog-stats` avant et après, et publier `GET /admin/catalog-enrich-missing/failures` avec les causes réelles.

---

### Mineur — `enrichWithRetry` retente systématiquement les erreurs DB non transientes

`catalog-enrich-missing-service.ts:91–99` : la méthode retente 3 fois sur tout `provider-failed`, y compris les violations de contraintes PostgreSQL (`23502`, `23505`) qui ne sont pas transientes. `classifyError()` marque correctement ces erreurs `retryable: false` dans `enrichment_failures`, mais `enrichWithRetry()` les ignore et fait quand même 3 appels supplémentaires.

Impact borné : au plus 2 appels supplémentaires × ~750 ms de délai par item terminal non-transient. Non bloquant, mais en contradiction mineure avec la spécification "retry transient failures".

---

### Mineur — `embeddingBlocked` est structurellement toujours 0

`catalog-stats.ts:152` : `embeddingBlocked = enriched - eligible`. La politique actuelle d'éligibilité est `metadataEnrichedAt IS NOT NULL`, ce qui est exactement la définition de `enriched`. Donc `eligible === enriched` toujours, et `embeddingBlocked === 0` toujours. La colonne est correcte mais sans valeur d'information tant que la politique n'ajoute pas de critères supplémentaires. À documenter ou à noter pour le suivi.

---

### Mineur — Stat `retrying` absente

Le ticket demande d'exposer une stat `retrying` dans les stats de run. `EnrichMissingStats` (`catalog-enrich-missing-service.ts:23–32`) n'inclut pas ce champ. Non bloquant — `enrichWithRetry` opère de façon synchrone dans le batch et la notion de "en cours de retry" n'est pas facilement observable, mais l'absence est à noter.

## Risques éventuels

- Si `runWithConcurrency` est appelé avec des items qui lèvent des erreurs non gérées dans le handler, ces erreurs sont absorbées par `.catch((err) => console.warn(...))` — les échecs individuels ne font pas planter le run, ce qui est correct pour un enrichissement best-effort.
- La stat `totalEligible` est capturée au lancement et ne se met pas à jour pendant le run : l'ETA peut dériver si de nouvelles rows deviennent éligibles pendant l'exécution. Acceptable pour un calcul estimatif.

## Décision

- REQUEST_CHANGES

## Actions demandées

1. **[OBLIGATOIRE]** Exécuter `POST /admin/catalog-enrich-missing` contre la production (ou snapshot restauré), capturer `GET /admin/catalog-stats` before/after, publier `GET /admin/catalog-enrich-missing/failures` avec les vraies causes d'erreur. Déposer les résultats dans `runs/T115/`.

2. **[Optionnel — suivi]** Affiner `enrichWithRetry()` pour consulter le `retryable` flag de `classifyError()` et n'effectuer les tentatives supplémentaires que pour les erreurs transientes.

3. **[Optionnel — suivi]** Documenter dans un commentaire `catalog-stats.ts` que `embeddingBlocked` sera significatif uniquement quand la politique d'éligibilité inclura des champs au-delà de `metadataEnrichedAt`.

IMPLEMENTATION_FIX_REQUIRED