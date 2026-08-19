# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T115/reviews/implementation-review.md
- generated at: 2026-08-19T13:34:48Z

---

I have enough to write the review now.

---

# PR Review — T115: Complete catalog enrichment and make refresh failures resumable/observable

## Résumé

L'implémentation couvre la majorité du scope défini : normalisation TMDB, persistance des échecs par item, service `enrich-missing` avec curseur keyset, 4 routes admin, extension des stats catalog, et policy d'éligibilité embedding. L'architecture globale est correcte. Cependant, 4 problèmes bloquants sont identifiés, dont un critique lié au completion rule du ticket.

---

## Vérifications effectuées

- Plan (`runs/T115/plan.md`) vs implémentation produite
- Service principal `catalog-enrich-missing-service.ts` — logique de curseur, retry, concurrence
- `metadata-enrichment-service.ts` — persistFailure, clearFailure, classifyError
- `embedding-eligibility.ts` — définition et usages effectifs
- `catalog-stats.ts` — nouvelles métriques et requêtes SQL
- `embedding-backfill-service.ts` — filtre de candidats
- `catalog-refresh-runs.ts` — contrainte d'unicité RUNNING
- Migrations `0045` et `0046`
- Tests unitaires T115 (`t115-normalization.test.ts`, `t115-enrichment.test.ts`)

---

## Points validés

- **Normalisation TMDB** : `runtime === 0 → null`, `imdb_id === '' → null`, `overview whitespace → null` via falsy (`raw.runtime || null`, `raw.imdb_id || null`, `raw.overview?.trim() || null`). Correct et testé.
- **Schéma `enrichment_failures`** : table + index unique sur `(media_type, media_id)` correctement définis en SQL et Drizzle.
- **`persistFailure` upsert** : incrémente `retry_count`, met à jour `occurred_at` et le detail d'erreur au fil des runs. `clearFailure` supprime en succès. Logique solide.
- **`classifyError`** : extrait `errorClass`, `errorCode`, `errorMessage` du PostgresError — résout le problème de "Failed query: update ... params ..." observable en prod.
- **Cursor keyset par `id`** : pagination `WHERE id > :lastId ORDER BY id LIMIT batchSize` — évite le drift offset, est totalement resumable. Checkpoint sauvegardé par batch.
- **Concurrence + throttle** : `runWithConcurrency` fonctionne, paramètre `throttleMs` respecté.
- **Routes admin** : 4 endpoints bien structurés (`POST /start`, `GET /status`, `GET /failures`, `POST /retry-failures`). Pagination, filtres `mediaType`/`retryable`.
- **Stats catalog** : `neverEnriched`, `partiallyEnriched`, `fullyEnriched`, `stale`, `failedLastEnrichment`, `embeddingEligible`, `embeddingPending` (requête réelle, non hardcodée à 0). Corrige le bug signalé.
- **Migration 0046** : `ALTER TABLE ... ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'REFRESH'` — rétrocompatible.

---

## Problèmes détectés

### [BLOQUANT 1] — Completion rule non respectée : aucune run production

Le ticket stipule explicitement :

> **Completion rule** : Do not close after unit tests. Run the new enrichment mode against production (or an equivalent restored production snapshot), publish before/after counts, and show the remaining terminal failures with their real causes.

Les acceptance criteria demandent aussi :

> Run against the real production catalog and demonstrate meaningful reduction of incomplete titles and successful retry/fix of the previous failure population.

L'implémentation présente 51 tests unitaires passants mais aucune trace d'une run contre le catalog de production (ni `implementation-output.md`, ni commentaire ticket, ni artefact `runs/T115/`). **Ce point est non négociable pour valider le ticket.**

---

### [BLOQUANT 2] — `isEmbeddingEligible` non utilisée : single source of truth non atteinte

**Plan (section 6)** :
> Use this function in: `catalog-stats.ts` to compute `embeddingEligible`/`embeddingBlocked` **and** `embedding-backfill-service.ts` to filter the candidate set (replace any inline check)

**Acceptance criteria** :
> `isEmbeddingEligible()` is the single source of truth used by both stats and backfill; no inline duplicate check

**Constat** : `isEmbeddingEligible` est définie dans `embedding-eligibility.ts` mais n'est importée **nulle part** — ni dans `catalog-stats.ts`, ni dans `embedding-backfill-service.ts`. Les deux fichiers utilisent `metadata_enriched_at is not null` en inline :

```typescript
// catalog-stats.ts:99
eligible: sql<number>`cast(count(*) filter (where metadata_enriched_at is not null) as integer)`

// embedding-backfill-service.ts:125
isNotNull(table.metadataEnrichedAt)
```

Si la policy change (ex. ajouter `synopsis IS NOT NULL`), les deux contextes doivent être mis à jour manuellement — la fonction n'est pas le point d'entrée réel.

---

### [BLOQUANT 3] — Contrainte UNIQUE sur `status='RUNNING'` : crash si refresh en cours

La table `catalog_refresh_runs` a un index partiel unique :

```sql
CREATE UNIQUE INDEX "catalog_refresh_runs_running_idx" ON "catalog_refresh_runs" ("status") WHERE "status" = 'RUNNING';
```

Cela signifie qu'**une seule ligne** avec `status='RUNNING'` peut exister dans la table, tous types confondus.

`CatalogEnrichMissingService.start()` insère directement sans vérification préalable :

```typescript
const [run] = await this.db
  .insert(catalogRefreshRuns)
  .values({ type: 'ENRICH_MISSING', status: 'RUNNING', checkpoint: null })
  .returning(...)
```

Si un `REFRESH` est déjà `RUNNING`, cette insertion lève une `PostgresError` (code `23505`), qui se propage comme 500 non géré sur la route `POST /admin/catalog-enrich-missing`. Idem dans `retryFailures()` (ligne 331).

**Fix attendu** : vérifier qu'aucune run n'est `RUNNING` avant l'insert, ou utiliser `ON CONFLICT DO NOTHING` + retour d'erreur métier 409.

---

### [BLOQUANT 4] — Retry transient manquant : le plan promet 3 tentatives, l'implémentation ne les fait pas

**Plan (section 3)** :
> Retry logic: up to 3 retries with exponential backoff (250ms, 500ms, 1000ms) for transient TMDB/network errors. After 3 failures, persist to `enrichment_failures` as terminal (retryable=false) and continue.

L'implémentation dans `CatalogEnrichMissingService.execute()` appelle directement :

```typescript
await this.enrichmentService.enrichMovie(row.id, { force, runId })
```

`enrichMovie` capture l'erreur au premier échec et appelle `persistFailure()` immédiatement — `retryable: true` est stocké dans la DB mais aucun retry réel n'est tenté avant la persistance. La classification `classifyError` marque correctement les erreurs réseau comme retryable, mais le service `enrich-missing` ne les rejoue pas.

**Conséquence** : une erreur réseau ponctuelle sur TMDB sur un film génère une failure terminale immédiate sans retenter, ce qui contredit le design promis et peut gonfler artificiellement les compteurs `failedTerminal`.

---

## Risques éventuels (non bloquants)

**[MINEUR 1] — `retryFailures` séquentiel sans concurrence**  
La méthode itère sur les failures avec un `for...of` séquentiel. Sur une grande population (ex. 126 failures de prod), c'est significativement plus lent que la concurrence offerte par `runWithConcurrency`.

**[MINEUR 2] — Inputs route non validés**  
`batchSize`, `concurrency`, `throttleMs` sont passés au service sans validation range (ex. `batchSize=0` ou `concurrency=1000` arrivent tels quels). Un `Math.max`/`Math.min` de garde serait préférable, comme le fait déjà la route `/failures` pour `page`/`limit`.

**[MINEUR 3] — `runWithConcurrency` dupliqué**  
Même pattern semaphore dans `catalog-enrich-missing-service.ts` et `embedding-backfill-service.ts`. Pas bloquant mais fragile à maintenir en doublon.

**[MINEUR 4] — `matchStatus` absent dans `countEligible` force=true**  
En mode `force=true`, la condition eligible ne filtre que `tmdbId IS NOT NULL` sans vérifier `matchStatus = 'MATCHED'`. Des lignes avec tmdbId mais non matchées (`matchStatus = 'PENDING'` ou similaire) seraient traitées. Ce comportement doit être intentionnel ou documenté.

---

## Décision

Les 4 problèmes bloquants doivent être résolus :

1. **Exécuter le mode `enrich-missing` contre le catalog de production** et publier les compteurs avant/après (neverEnriched, failedTerminal, noms des failures restantes avec leur vraie cause).
2. **Importer et utiliser `isEmbeddingEligible`** dans `embedding-backfill-service.ts` (pour le filtre de candidats) et documenter pourquoi le SQL de stats ne peut pas l'appeler directement (ou en dériver une constante partagée).
3. **Gérer la contrainte unique RUNNING** avant l'insert dans `start()` et `retryFailures()` — retourner un 409 avec message explicite si un run est déjà actif.
4. **Implémenter le retry transient** : wrapper `enrichMovie`/`enrichSeries` dans `execute()` avec 3 tentatives + backoff avant de persister comme failure terminale.

IMPLEMENTATION_FIX_REQUIRED
