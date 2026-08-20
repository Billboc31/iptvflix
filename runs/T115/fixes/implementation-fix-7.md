# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T115/reviews/implementation-review.md
- generated at: 2026-08-19T14:43:56Z

---

I now have a complete picture. Writing the review.

---

# PR Review — T115: Complete catalog enrichment and make refresh failures resumable/observable

## Résumé

L'implémentation est techniquement solide sur les critères d'acceptance au niveau code : le service `CatalogEnrichMissingService`, la persistence des failures, la normalisation TMDB, et les stats de catalog sont tous corrects et testés. Deux problèmes bloquants persistent : la completion rule du ticket (run production absent) et le bug original sur `enrichPending()` — qui reste actif dans la route `/enrichment/trigger` sans le filtre `matchStatus = 'MATCHED'` — n'a pas été corrigé malgré l'audit explicitement demandé.

## Vérifications effectuées

- Lecture complète de `catalog-enrich-missing-service.ts`, `metadata-enrichment-service.ts`, `catalog-stats.ts`, `embedding-eligibility.ts`, `catalog-enrich-missing.ts`
- Migrations `0046` et `0047`
- TMDB client (`mapMovieDetail`, `mapSeriesDetail`)
- Artefact de validation locale `local-validation-run-20260819.md`
- Route `enrichment.ts` (ancienne route `/enrichment/trigger`)

## Points validés

**Failure observability** — `classifyError()` extrait le code PostgreSQL natif (`err.code`), l'error class et le message. `persistFailure()` upsert avec `ON CONFLICT DO UPDATE` incrémentant `retryCount`. Tous les champs demandés par le ticket sont stockés (mediaType, mediaId, tmdbId, title, stage, errorClass, errorCode, errorMessage, retryCount, occurredAt, retryable).

**Normalisation TMDB** — `runtime === 0 → null`, `imdb_id === '' → null`, `overview.trim() === '' → null` via les opérateurs falsy `|| null`. Correct.

**Cursor pagination** — Keyset (`WHERE id > :lastId ORDER BY id LIMIT batchSize`), checkpoint JSONB par run, pas de drift d'offset. Relance d'un nouveau run repart de `lastId = null` mais les items déjà enrichis (`metadataEnrichedAt IS NOT NULL`) sont naturellement exclus → convergence vers zéro.

**Retry transient** — `enrichWithRetry()` itère jusqu'à 3 fois sur `provider-failed`, backoff 250/500/1000ms. Les failures retryables sont persistées puis effacées sur succès (`clearFailure()`).

**RUN_CONFLICT** — `checkNoRunningConflict()` avant chaque `start()` et `retryFailures()`, route retourne 409 avec le code `RUN_CONFLICT`.

**Catalog stats** — 8 nouveaux champs par media type : `neverEnriched`, `partiallyEnriched`, `fullyEnriched`, `stale`, `failedLastEnrichment`, `embeddingEligible`, `embeddingBlocked`, `embeddingPending`. La requête `embeddingPending` joint vraiment `media_embeddings`, la valeur n'est pas hardcodée à 0.

**Embedding eligibility** — `embedding-eligibility.ts` est la source unique de vérité. `EMBEDDING_ELIGIBLE_SQL_PREDICATE` est importé dans `catalog-stats.ts`. Policy documentée : required=title, preferred=synopsis/genres/originalLanguage, optional=keywords/credits.

**Validation locale** — Run de bout-en-bout sur dev DB : 5 eligible (3 films + 2 series), 5 enrichis, 0 terminal failures, 444 épisodes persistés, stats avant/après cohérentes.

## Problèmes détectés

### Bloquant 1 — Completion rule non respectée

Le ticket est explicite :
> "Do not close after unit tests. Run the new enrichment mode against production (or an equivalent restored production snapshot), publish before/after counts, and show the remaining terminal failures with their real causes."

Le local run sur un dev DB avec 3 films TMDB synthétiques ne satisfait pas cette exigence. Les 126 failures de production ne sont pas diagnostiquées avec leurs vraies causes PostgreSQL. La réduction significative du catalogue incomplet (`~60k films / ~5k séries`) n'est pas démontrée.

**Action requise** : Exécuter le run sur la production (ou snapshot production), publier `runs/T115/production-run-YYYYMMDD.md` avec before/after stats et la liste des terminal failures avec leurs `errorClass`/`errorCode`/`errorMessage` réels.

### Bloquant 2 — `enrichPending()` toujours actif sans filtre `matchStatus`

La route `/enrichment/trigger` (`apps/api/src/routes/enrichment.ts:17`) appelle toujours `enrichPending()` qui ne filtre pas par `matchStatus = 'MATCHED'` :

```typescript
// metadata-enrichment-service.ts:610-625
const [moviesToEnrich, seriesToEnrich] = await Promise.all([
  this.db.select({ id: movies.id }).from(movies).where(
    and(
      isNotNull(movies.tmdbId),
      or(isNull(movies.metadataEnrichedAt), lt(movies.metadataEnrichedAt, threshold)),
    ),
  ),
  // ...
])
```

Le ticket demande explicitement d'auditer "whether repeated refresh runs eventually cover the entire incomplete population or continually revisit the same rows." Ce filtre manquant est précisément pourquoi des runs répétés peuvent revisiter les mêmes lignes non-matchées. La route `/enrichment/trigger` reste cassée pour la même raison qu'avant T115.

**Action requise** : Ajouter `eq(movies.matchStatus, 'MATCHED')` dans les filtres de `enrichPending()` pour movies et series, en cohérence avec le filtre utilisé dans `CatalogEnrichMissingService.countEligible()` et `execute()`.

### Mineur 1 — Stat `retrying` absente

Le ticket demande d'exposer "retrying" comme run-level stat. Les stats actuelles (`totalEligible`, `processed`, `enriched`, `skipped`, `failedTerminal`, `remaining`, `ratePerMinute`, `etaSeconds`) ne comptabilisent pas les items en cours de retry transient. Acceptable pour une v1 mais gap spec.

### Mineur 2 — Absence de validation d'input sur les routes admin

`POST /admin/catalog-enrich-missing` accepte `batchSize`, `concurrency`, `throttleMs` sans validation (valeurs négatives, concurrency=1000, etc.). Les routes admin ne devraient pas crasher sur des inputs malformés.

### Mineur 3 — Stage `map` non couvert dans la persistence des failures

La table `enrichment_failures.stage` accepte `fetch | map | db_update`. Le code ne wrape pas le mapping TMDB dans un try/catch séparé : si `mapMovieDetail` lève une exception (données TMDB inattendues), l'erreur remonte sans être persistée avec `stage='map'`. Elle serait comptée dans `stats.failedTerminal` via le catch générique mais invisible dans `enrichment_failures`.

## Risques éventuels

**Race condition sur le conflict check** : `checkNoRunningConflict()` n'est pas dans une transaction avec l'insert suivant. Deux appels concurrents pourraient passer le check simultanément et créer deux runs RUNNING. Risque faible sur une route admin, mais à noter.

**`retryFailures` sans checkpoint** : le retry batch ne maintient pas de progression. Si interrompu, il faut relancer manuellement. Acceptable pour ~126 failures mais limité en cas de volume plus important.

## Décision

- REQUEST_CHANGES

## Actions demandées

1. **[Bloquant]** Exécuter `POST /admin/catalog-enrich-missing` sur la production ou un snapshot équivalent, publier l'artefact `runs/T115/production-run-YYYYMMDD.md` avec before/after counts et terminal failures réels.

2. **[Bloquant]** Ajouter `eq(movies.matchStatus, 'MATCHED')` et `eq(series.matchStatus, 'MATCHED')` dans les filtres de `enrichPending()` (`metadata-enrichment-service.ts` lignes 610-625), en cohérence avec le comportement de `CatalogEnrichMissingService`.

3. **[Mineur]** Ajouter une validation d'input basique sur `POST /admin/catalog-enrich-missing` (batchSize > 0 ≤ 500, concurrency > 0 ≤ 20, throttleMs ≥ 0).

---

IMPLEMENTATION_FIX_REQUIRED
