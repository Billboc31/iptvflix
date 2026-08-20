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
