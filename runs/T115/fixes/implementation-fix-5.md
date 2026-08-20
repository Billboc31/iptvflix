# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T115/reviews/implementation-review.md
- generated at: 2026-08-19T14:18:08Z

---

I have a complete picture of the current state. Let me write the review.

---

# PR Review — T115: Complete catalog enrichment and make refresh failures resumable/observable

## Résumé

Ceci est la 5ème review (attempt 5). Les deux blockers identifiés lors de la review précédente ont été traités différemment : le bug de code `force=true` supprimant le filtre `matchStatus = 'MATCHED'` a été corrigé et vérifié dans le code actuel. L'item optionnel (`terminal-failed` vs `provider-failed`) a également été implémenté. **La condition bloquante de completion rule (exécution production) reste non satisfaite**, aucun artefact de run réel n'étant présent dans `runs/T115/`.

## Vérifications effectuées

- `apps/api/src/providers/metadata/tmdb/client.ts` — normalisations `mapMovieDetail()` / `mapSeriesDetail()`
- `apps/api/src/db/schema/enrichment-failures.ts` + migrations `0045` et `0046`
- `apps/api/src/services/metadata-enrichment-service.ts` — `classifyError`, `persistFailure`, `clearFailure`, `enrichMovie`, `enrichSeries`
- `apps/api/src/services/catalog-enrich-missing-service.ts` — curseur keyset, retry, checkpoint, `countEligible`, `execute`, `retryFailures`
- `apps/api/src/routes/catalog-enrich-missing.ts` — 4 routes admin
- `apps/api/src/routes/catalog-stats.ts` — nouvelles métriques
- `apps/api/src/services/embedding-eligibility.ts`
- `runs/T115/` — artefacts d'exécution

## Points validés

**Normalisation TMDB** (`client.ts:53,58,59,94-95`)
- `raw.runtime || null` → `durationMinutes: null` pour runtime=0 ✓
- `raw.imdb_id || null` → `imdbId: null` pour chaîne vide ✓
- `raw.overview?.trim() || null` → `synopsis: null` pour overview blanc, dans les deux mappers ✓

**Fix bloquant review 4 — `force=true` préserve `matchStatus = 'MATCHED'`**

`catalog-enrich-missing-service.ts:104–108` (`countEligible`) et `204–209` (`execute`) :
```typescript
const where = and(
  isNotNull(table.tmdbId),
  eq(table.matchStatus, 'MATCHED'),            // ← présent inconditionnellement ✓
  force ? undefined : or(isNull(table.metadataEnrichedAt), lt(table.metadataEnrichedAt, threshold)),
)
```
Les items `PENDING` / `UNMATCHED` sont correctement exclus, que `force=true` ou non. ✓

**Fix optionnel review 4 — distinction `terminal-failed` / `provider-failed`**

- `persistFailure()` retourne `{ retryable: boolean }` ✓
- `enrichMovie` / `enrichSeries` retournent `'terminal-failed'` pour les erreurs non-transientes, `'provider-failed'` pour les transientes ✓
- `enrichWithRetry` court-circuite immédiatement sur `'terminal-failed'` via le guard `if (result !== 'provider-failed') return result` ✓ — aucun appel supplémentaire inutile

**Persistance des échecs** (`metadata-enrichment-service.ts:48–135`)
- `classifyError()` extrait le vrai `error.constructor.name`, `.code`, `.message` — plus de SQL généré ✓
- Upsert `ON CONFLICT` incrémente `retryCount` et met à jour `occurredAt` ✓
- `clearFailure()` appelé sur succès pour movies (`line:288`) et series ✓

**Service enrich-missing**
- Keyset cursor `WHERE id > :lastId ORDER BY id LIMIT batchSize` — aucun drift, 100% resumable ✓
- `checkNoRunningConflict()` appelé dans `start()` et `retryFailures()` — conflit 409 systématique ✓
- `retryFailures()` utilise `runWithConcurrency` ✓
- Checkpoint JSONB sauvegardé après chaque batch ✓

**Catalog stats** (`catalog-stats.ts`)
- 8 nouvelles métriques : `neverEnriched`, `partiallyEnriched`, `fullyEnriched`, `stale`, `failedLastEnrichment`, `embeddingEligible`, `embeddingBlocked`, `embeddingPending` ✓
- `embeddingPending` via `NOT EXISTS (SELECT 1 FROM media_embeddings ...)` — plus de 0 hardcodé ✓
- `EMBEDDING_ELIGIBLE_SQL_PREDICATE` importé depuis `embedding-eligibility.ts` — source unique ✓

**Migrations**
- `0045_t115_enrichment_failures.sql` — table + unique index `(media_type, media_id)` ✓
- `0046_t115_catalog_refresh_runs_type.sql` — colonne `type` avec DEFAULT `'REFRESH'`, idempotent ✓

## Problème bloquant

### BLOQUANT — Completion rule non satisfaite (inchangée depuis review 4)

Le ticket stipule explicitement, dans la section **Completion rule** ET dans les **Acceptance criteria** :

> **Do not close after unit tests. Run the new enrichment mode against production (or an equivalent restored production snapshot), publish before/after counts, and show the remaining terminal failures with their real causes.**

> - Run against the real production catalog and demonstrate meaningful reduction of incomplete titles and successful retry/fix of the previous failure population.

Aucun artefact de run réel n'est présent dans `runs/T115/`. L'ensemble des fichiers présents sont : ticket, plan, prompts/fixes de review, et un fichier `implementation-output.md` qui confirme explicitement que "le point bloquant restant" est l'exécution production.

Cette condition n'est pas une obligation de documentation optionnelle — elle est listée comme critère d'acceptance du ticket. Les tests unitaires existants (normalization, persistFailure, cursor pagination, enrichMovie failure) ne la remplacent pas.

**Action requise :** exécuter `POST /admin/catalog-enrich-missing` (ou déployer sur un snapshot production), capturer :
1. `GET /admin/catalog-stats` — before/after (neverEnriched, failedLastEnrichment, embeddingEligible)
2. `GET /admin/catalog-enrich-missing/status` — stats finales du run
3. `GET /admin/catalog-enrich-missing/failures` — liste des échecs terminaux avec causes réelles

Déposer ces artefacts JSON dans `runs/T115/production-run-YYYYMMDD.md` ou équivalent.

## Observations mineures

**`retrying` stat absente** — Le ticket demande cette métrique dans le run-level stats. `EnrichWithRetry` opère de façon synchrone au sein du batch ; la valeur serait toujours 0 entre deux snapshots checkpoint. La stat est structurellement non observable à ce niveau de granularité. Acceptable tel quel mais devrait être documenté comme limitation connue ou retiré de la spécification.

**`embeddingBlocked` structurellement 0** — La politique d'éligibilité embedding est `metadataEnrichedAt IS NOT NULL`, identique à la définition de "enriched". `embeddingBlocked = enrichedCount - eligibleCount` sera toujours 0 tant qu'aucun critère supplémentaire n'est ajouté. Un commentaire est présent dans `catalog-stats.ts` — suffisant pour l'instant.

## Risques

- `totalEligible` figé au démarrage : si de nouvelles rows deviennent éligibles pendant l'exécution, l'ETA dérive. Acceptable pour un estimatif.
- La migration `0045` entre en conflit avec `0045_t114_...` (deux fichiers avec le même préfixe `0045`). À vérifier que l'outil de migration gère correctement la numérotation — si non, une renommage de `0045_t115_enrichment_failures.sql` en `0047_t115_enrichment_failures.sql` serait nécessaire.

## Décision

Le code est correct sur tous les points techniques. Un seul blocker subsiste : l'exécution réelle contre la production n'a pas été réalisée, ce qui est un critère d'acceptance explicite du ticket.

IMPLEMENTATION_FIX_REQUIRED
