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

Aucune erreur TypeScript. Voici le résumé des changements appliqués :

---

## Corrections appliquées

### Fix optionnel 1 — `enrichWithRetry` n'effectue plus de retries sur les erreurs non-transientes

**`metadata-enrichment-service.ts`**
- `EnrichResult` : ajout de `'terminal-failed'` (erreur non-transiente, pas de retry) aux côtés de `'provider-failed'` (transiente, retryable).
- `persistFailure()` : retourne maintenant `{ retryable: boolean }` au lieu de `void`.
- `enrichMovie` et `enrichSeries` : chaque `catch` utilise la valeur retournée pour décider entre `'provider-failed'` (transient → retry dans `enrichWithRetry`) et `'terminal-failed'` (terminal → court-circuit immédiat).

`enrichWithRetry` n'a **pas besoin d'être modifié** : son check existant `if (result !== 'provider-failed') return result` interrompt déjà les retries pour `'terminal-failed'` sans changement de code.

### Fix optionnel 2 — `embeddingBlocked` documenté

**`catalog-stats.ts`** : commentaire ajouté sur les deux lignes `embeddingBlocked` (movies et series) expliquant qu'il est structurellement 0 tant que la politique d'éligibilité embedding ne dépasse pas `metadataEnrichedAt IS NOT NULL`.

### Tests mis à jour

**`metadata-enrichment-service.test.ts`** + **`t115-enrichment.test.ts`** : assertions et noms de tests mis à jour pour refléter la distinction `terminal-failed` / `provider-failed`.

---

**Point bloquant restant** (inchangé, non-code) : exécuter `POST /admin/catalog-enrich-missing` contre la production et publier les résultats before/after dans `runs/T115/`.

---

## Review

I now have everything I need. Let me write the formal review.

---

# PR Review — T115: Complete catalog enrichment and make refresh failures resumable/observable

## Résumé

L'implémentation est fonctionnellement complète sur le plan du code : normalisation TMDB, persistance des vraies erreurs PostgreSQL, service `enrich-missing` avec keyset pagination et checkpoint, 4 routes admin, stats catalog étendues, politique d'éligibilité embedding. Les deux correctifs demandés lors de la review précédente (concurrency guard `checkNoRunningConflict` avant le fetch des failures, `runWithConcurrency` dans `retryFailures`) sont bien appliqués.

**Deux problèmes subsistent.** Le premier est bloquant selon les critères du ticket lui-même : la production run n'a pas été effectuée. Le second est un bug de code nouveau : `force=true` supprime le filtre `matchStatus = 'MATCHED'`, ce qui inclut des items non-matchés dans les force runs.

## Vérifications effectuées

- `apps/api/src/providers/metadata/tmdb/client.ts` — normalisations `mapMovieDetail()` / `mapSeriesDetail()` (runtime, imdb_id, overview)
- `apps/api/src/db/schema/enrichment-failures.ts` + migrations `0045` et `0046`
- `apps/api/src/services/metadata-enrichment-service.ts` — `classifyError`, `persistFailure`, `clearFailure`, `enrichMovie`, `enrichSeries`
- `apps/api/src/services/catalog-enrich-missing-service.ts` — curseur keyset, retry, checkpoint, `checkNoRunningConflict`, `countEligible`, `retryFailures`
- `apps/api/src/routes/catalog-enrich-missing.ts` — 4 routes admin, codes HTTP
- `apps/api/src/routes/catalog-stats.ts` — nouvelles métriques, `EMBEDDING_ELIGIBLE_SQL_PREDICATE`
- `apps/api/src/services/embedding-eligibility.ts`
- `apps/api/src/index.ts` — enregistrement des routes
- Tests normalization, persistFailure, enrichMovie failure, cursor pagination

## Points validés

**Normalisation TMDB** (`client.ts:53,58,59,94`)
- `raw.runtime || null` → `durationMinutes: null` pour runtime=0 ✓
- `raw.imdb_id || null` → `imdbId: null` pour chaîne vide (movies) ; series hardcode `null`, cohérent avec l'API TMDB ✓
- `raw.overview?.trim() || null` → `synopsis: null` pour overview blanc, dans les deux mappers ✓

**Persistance des échecs** (`metadata-enrichment-service.ts:48–134`)
- `classifyError()` extrait `errorClass` (constructor.name), `errorCode` (propriété `.code`), `errorMessage` — plus de SQL généré ✓
- `TmdbRateLimitError` et `TmdbNetworkError` correctement identifiés comme transients (name.includes check) ✓
- Upsert ON CONFLICT incrémente `retryCount` correctement ✓
- `stage` distingue `fetch` / `db_update` ✓
- `clearFailure()` appelé après succès pour movie (`line:288`) et series (`line:442`) ✓

**Fixes review précédente confirmés**
- ✅ `checkNoRunningConflict()` appelé ligne 340 dans `retryFailures()` avant tout fetch — 409 systématique si un run tourne déjà
- ✅ `retryFailures()` utilise `runWithConcurrency` avec concurrence configurable

**Service enrich-missing**
- Keyset cursor `WHERE id > :lastId ORDER BY id LIMIT batchSize` — aucun drift, 100% resumable ✓
- Checkpoint JSONB mis à jour après chaque batch ✓
- `totalEligible` compté avant le run, `remaining` calculé dynamiquement ✓
- ETA en secondes : `(remaining / ratePerMinute) * 60` — formule correcte ✓

**Catalog stats** (`catalog-stats.ts`)
- 8 nouvelles métriques : `neverEnriched`, `partiallyEnriched`, `fullyEnriched`, `stale`, `failedLastEnrichment`, `embeddingEligible`, `embeddingBlocked`, `embeddingPending` ✓
- `embeddingPending` via `NOT EXISTS (SELECT 1 FROM media_embeddings ...)` — plus de 0 hardcodé ✓
- `EMBEDDING_ELIGIBLE_SQL_PREDICATE` importé depuis `embedding-eligibility.ts` — source unique ✓

**Migrations**
- `0045` : table `enrichment_failures` + unique index `(media_type, media_id)` ✓
- `0046` : `ALTER TABLE ... ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'REFRESH'` — idempotent, rétrocompatible ✓

## Problèmes détectés

### BLOQUANT — Completion rule non satisfaite

Le ticket stipule explicitement :

> **Do not close after unit tests. Run the new enrichment mode against production (or an equivalent restored production snapshot), publish before/after counts, and show the remaining terminal failures with their real causes.**

Aucune trace d'exécution réelle dans `runs/T115/`. Aucun `GET /admin/catalog-stats` before/after. Aucune liste des 126 échecs originaux avec leurs vraies causes.

Cette condition n'est pas optionnelle : elle fait partie des acceptance criteria du ticket (dernier point). Les tests unitaires présents (normalization × 3, persistFailure × 2, enrichMovie failure, cursor pagination) ne la remplacent pas.

**Action requise :** exécuter `POST /admin/catalog-enrich-missing` contre la production ou un snapshot restauré, capturer les stats avant/après, publier `GET /admin/catalog-enrich-missing/failures` avec les causes réelles. Déposer les artefacts dans `runs/T115/`.

---

### BLOQUANT — `force=true` supprime le filtre `matchStatus = 'MATCHED'`

Dans `catalog-enrich-missing-service.ts:206–213` et `countEligible:104–110` :

```typescript
const eligible = force
  ? and(isNotNull(table.tmdbId), lastId ? gt(table.id, lastId) : undefined)
  // manque : eq(table.matchStatus, 'MATCHED')
  : and(
      isNotNull(table.tmdbId),
      eq(table.matchStatus, 'MATCHED'),
      ...
    )
```

Le plan définit : *"Eligible row selection: movies/series where `tmdbId IS NOT NULL` AND `matchStatus = 'MATCHED'`"*. La sémantique de `force` est de bypasser le check de fraîcheur (`metadataEnrichedAt`), pas le filtre de statut de matching.

En mode `force=true`, des items `PENDING` ou `UNMATCHED` possédant un `tmdbId` sont inclus dans le run. Ces items peuvent échouer (TMDB 404 ou contrainte DB) et polluer `enrichment_failures` avec des items hors scope.

**Fix** : conserver `eq(table.matchStatus, 'MATCHED')` dans la branche `force=true`, supprimer uniquement la condition stale threshold :

```typescript
const eligible = and(
  isNotNull(table.tmdbId),
  eq(table.matchStatus, 'MATCHED'),
  force ? undefined : or(isNull(table.metadataEnrichedAt), lt(table.metadataEnrichedAt, threshold)),
  lastId ? gt(table.id, lastId) : undefined,
)
```

Appliquer le même correctif dans `countEligible()`.

---

### Mineur — `enrichWithRetry` retente les erreurs non-transientes

`catalog-enrich-missing-service.ts:87–99` : la méthode retente 3 fois sur tout résultat `'provider-failed'`, mais `enrichMovie`/`enrichSeries` retournent `'provider-failed'` également pour des erreurs non-transientes (`retryable: false`) en cas de ré-entrée dans le catch externe. Résultat : jusqu'à 2 appels supplémentaires inutiles (+ délais 250ms + 500ms) par item terminal non-transient.

Non bloquant mais contradictoire avec la spec "retry transient failures with bounded retry/backoff".

---

### Mineur — Stat `retrying` absente

Le ticket demande : *"retrying: number"* dans les stats de run. `EnrichMissingStats` ne l'expose pas. `enrichWithRetry` opère de manière synchrone dans le batch (non observable externally) — la valeur serait toujours 0 entre snapshots checkpoint. À documenter comme limitation ou à retirer explicitement de la spécification.

## Risques éventuels

- La stat `totalEligible` est figée au démarrage du run. Si de nouvelles rows deviennent éligibles pendant l'exécution, l'ETA dérive légèrement. Acceptable pour un estimatif.
- `embeddingBlocked = enriched - eligible` est structurellement toujours 0 avec la politique actuelle (eligibility ≡ enriched). La métrique n'a pas de valeur d'information jusqu'à ce que des critères supplémentaires soient ajoutés. Un commentaire à l'attention des futurs développeurs est déjà présent (`catalog-stats.ts:152`), ce qui est suffisant.

## Décision

- REQUEST_CHANGES

## Actions demandées

1. **[OBLIGATOIRE]** Exécuter `POST /admin/catalog-enrich-missing` contre la production ou un snapshot, capturer stats before/after et failures list, déposer dans `runs/T115/`.
2. **[OBLIGATOIRE]** Corriger le filtre `force=true` dans `execute()` et `countEligible()` pour conserver `eq(table.matchStatus, 'MATCHED')`.
3. **[Optionnel]** Affiner `enrichWithRetry()` pour consulter le `retryable` flag et n'effectuer des tentatives supplémentaires que sur les erreurs transientes.

IMPLEMENTATION_FIX_REQUIRED

---

## Instructions de fix

# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T115/reviews/implementation-review.md
- generated at: 2026-08-19T14:09:53Z

---

I now have everything I need. Let me write the formal review.

---

# PR Review — T115: Complete catalog enrichment and make refresh failures resumable/observable

## Résumé

L'implémentation est fonctionnellement complète sur le plan du code : normalisation TMDB, persistance des vraies erreurs PostgreSQL, service `enrich-missing` avec keyset pagination et checkpoint, 4 routes admin, stats catalog étendues, politique d'éligibilité embedding. Les deux correctifs demandés lors de la review précédente (concurrency guard `checkNoRunningConflict` avant le fetch des failures, `runWithConcurrency` dans `retryFailures`) sont bien appliqués.

**Deux problèmes subsistent.** Le premier est bloquant selon les critères du ticket lui-même : la production run n'a pas été effectuée. Le second est un bug de code nouveau : `force=true` supprime le filtre `matchStatus = 'MATCHED'`, ce qui inclut des items non-matchés dans les force runs.

## Vérifications effectuées

- `apps/api/src/providers/metadata/tmdb/client.ts` — normalisations `mapMovieDetail()` / `mapSeriesDetail()` (runtime, imdb_id, overview)
- `apps/api/src/db/schema/enrichment-failures.ts` + migrations `0045` et `0046`
- `apps/api/src/services/metadata-enrichment-service.ts` — `classifyError`, `persistFailure`, `clearFailure`, `enrichMovie`, `enrichSeries`
- `apps/api/src/services/catalog-enrich-missing-service.ts` — curseur keyset, retry, checkpoint, `checkNoRunningConflict`, `countEligible`, `retryFailures`
- `apps/api/src/routes/catalog-enrich-missing.ts` — 4 routes admin, codes HTTP
- `apps/api/src/routes/catalog-stats.ts` — nouvelles métriques, `EMBEDDING_ELIGIBLE_SQL_PREDICATE`
- `apps/api/src/services/embedding-eligibility.ts`
- `apps/api/src/index.ts` — enregistrement des routes
- Tests normalization, persistFailure, enrichMovie failure, cursor pagination

## Points validés

**Normalisation TMDB** (`client.ts:53,58,59,94`)
- `raw.runtime || null` → `durationMinutes: null` pour runtime=0 ✓
- `raw.imdb_id || null` → `imdbId: null` pour chaîne vide (movies) ; series hardcode `null`, cohérent avec l'API TMDB ✓
- `raw.overview?.trim() || null` → `synopsis: null` pour overview blanc, dans les deux mappers ✓

**Persistance des échecs** (`metadata-enrichment-service.ts:48–134`)
- `classifyError()` extrait `errorClass` (constructor.name), `errorCode` (propriété `.code`), `errorMessage` — plus de SQL généré ✓
- `TmdbRateLimitError` et `TmdbNetworkError` correctement identifiés comme transients (name.includes check) ✓
- Upsert ON CONFLICT incrémente `retryCount` correctement ✓
- `stage` distingue `fetch` / `db_update` ✓
- `clearFailure()` appelé après succès pour movie (`line:288`) et series (`line:442`) ✓

**Fixes review précédente confirmés**
- ✅ `checkNoRunningConflict()` appelé ligne 340 dans `retryFailures()` avant tout fetch — 409 systématique si un run tourne déjà
- ✅ `retryFailures()` utilise `runWithConcurrency` avec concurrence configurable

**Service enrich-missing**
- Keyset cursor `WHERE id > :lastId ORDER BY id LIMIT batchSize` — aucun drift, 100% resumable ✓
- Checkpoint JSONB mis à jour après chaque batch ✓
- `totalEligible` compté avant le run, `remaining` calculé dynamiquement ✓
- ETA en secondes : `(remaining / ratePerMinute) * 60` — formule correcte ✓

**Catalog stats** (`catalog-stats.ts`)
- 8 nouvelles métriques : `neverEnriched`, `partiallyEnriched`, `fullyEnriched`, `stale`, `failedLastEnrichment`, `embeddingEligible`, `embeddingBlocked`, `embeddingPending` ✓
- `embeddingPending` via `NOT EXISTS (SELECT 1 FROM media_embeddings ...)` — plus de 0 hardcodé ✓
- `EMBEDDING_ELIGIBLE_SQL_PREDICATE` importé depuis `embedding-eligibility.ts` — source unique ✓

**Migrations**
- `0045` : table `enrichment_failures` + unique index `(media_type, media_id)` ✓
- `0046` : `ALTER TABLE ... ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'REFRESH'` — idempotent, rétrocompatible ✓

## Problèmes détectés

### BLOQUANT — Completion rule non satisfaite

Le ticket stipule explicitement :

> **Do not close after unit tests. Run the new enrichment mode against production (or an equivalent restored production snapshot), publish before/after counts, and show the remaining terminal failures with their real causes.**

Aucune trace d'exécution réelle dans `runs/T115/`. Aucun `GET /admin/catalog-stats` before/after. Aucune liste des 126 échecs originaux avec leurs vraies causes.

Cette condition n'est pas optionnelle : elle fait partie des acceptance criteria du ticket (dernier point). Les tests unitaires présents (normalization × 3, persistFailure × 2, enrichMovie failure, cursor pagination) ne la remplacent pas.

**Action requise :** exécuter `POST /admin/catalog-enrich-missing` contre la production ou un snapshot restauré, capturer les stats avant/après, publier `GET /admin/catalog-enrich-missing/failures` avec les causes réelles. Déposer les artefacts dans `runs/T115/`.

---

### BLOQUANT — `force=true` supprime le filtre `matchStatus = 'MATCHED'`

Dans `catalog-enrich-missing-service.ts:206–213` et `countEligible:104–110` :

```typescript
const eligible = force
  ? and(isNotNull(table.tmdbId), lastId ? gt(table.id, lastId) : undefined)
  // manque : eq(table.matchStatus, 'MATCHED')
  : and(
      isNotNull(table.tmdbId),
      eq(table.matchStatus, 'MATCHED'),
      ...
    )
```

Le plan définit : *"Eligible row selection: movies/series where `tmdbId IS NOT NULL` AND `matchStatus = 'MATCHED'`"*. La sémantique de `force` est de bypasser le check de fraîcheur (`metadataEnrichedAt`), pas le filtre de statut de matching.

En mode `force=true`, des items `PENDING` ou `UNMATCHED` possédant un `tmdbId` sont inclus dans le run. Ces items peuvent échouer (TMDB 404 ou contrainte DB) et polluer `enrichment_failures` avec des items hors scope.

**Fix** : conserver `eq(table.matchStatus, 'MATCHED')` dans la branche `force=true`, supprimer uniquement la condition stale threshold :

```typescript
const eligible = and(
  isNotNull(table.tmdbId),
  eq(table.matchStatus, 'MATCHED'),
  force ? undefined : or(isNull(table.metadataEnrichedAt), lt(table.metadataEnrichedAt, threshold)),
  lastId ? gt(table.id, lastId) : undefined,
)
```

Appliquer le même correctif dans `countEligible()`.

---

### Mineur — `enrichWithRetry` retente les erreurs non-transientes

`catalog-enrich-missing-service.ts:87–99` : la méthode retente 3 fois sur tout résultat `'provider-failed'`, mais `enrichMovie`/`enrichSeries` retournent `'provider-failed'` également pour des erreurs non-transientes (`retryable: false`) en cas de ré-entrée dans le catch externe. Résultat : jusqu'à 2 appels supplémentaires inutiles (+ délais 250ms + 500ms) par item terminal non-transient.

Non bloquant mais contradictoire avec la spec "retry transient failures with bounded retry/backoff".

---

### Mineur — Stat `retrying` absente

Le ticket demande : *"retrying: number"* dans les stats de run. `EnrichMissingStats` ne l'expose pas. `enrichWithRetry` opère de manière synchrone dans le batch (non observable externally) — la valeur serait toujours 0 entre snapshots checkpoint. À documenter comme limitation ou à retirer explicitement de la spécification.

## Risques éventuels

- La stat `totalEligible` est figée au démarrage du run. Si de nouvelles rows deviennent éligibles pendant l'exécution, l'ETA dérive légèrement. Acceptable pour un estimatif.
- `embeddingBlocked = enriched - eligible` est structurellement toujours 0 avec la politique actuelle (eligibility ≡ enriched). La métrique n'a pas de valeur d'information jusqu'à ce que des critères supplémentaires soient ajoutés. Un commentaire à l'attention des futurs développeurs est déjà présent (`catalog-stats.ts:152`), ce qui est suffisant.

## Décision

- REQUEST_CHANGES

## Actions demandées

1. **[OBLIGATOIRE]** Exécuter `POST /admin/catalog-enrich-missing` contre la production ou un snapshot, capturer stats before/after et failures list, déposer dans `runs/T115/`.
2. **[OBLIGATOIRE]** Corriger le filtre `force=true` dans `execute()` et `countEligible()` pour conserver `eq(table.matchStatus, 'MATCHED')`.
3. **[Optionnel]** Affiner `enrichWithRetry()` pour consulter le `retryable` flag et n'effectuer des tentatives supplémentaires que sur les erreurs transientes.

IMPLEMENTATION_FIX_REQUIRED