I have all the information I need. Let me write the final review.

---

## PR Review — T066: Add scheduled refreshes for the canonical catalog (re-review after fix)

### Résumé

La review précédente avait identifié un seul bug bloquant dans `runCatalogRefreshTick` : l'utilisation de `statusCode === 409` au lieu de `instanceof CatalogRefreshAlreadyRunningError`. Le fix a été correctement appliqué. L'implémentation est complète et conforme au plan et au ticket.

---

### Vérifications effectuées

- Correction du bug `scheduler-service.ts:163`
- Migration SQL vs schema Drizzle
- Logique de bucket segmentation movies + series (JS + DB)
- Mécanisme lock / stale-lock
- Checkpoints et idempotence
- Discovery upsert idempotent
- Routes `POST /catalog-refresh` et `GET /catalog-refresh/status`
- Authentification (protectedScope)
- Variables d'environnement (6 vars)
- Wiring `index.ts`
- Tests unitaires (12 cas)
- Résultats de test (706 tests passent)

---

### Fix confirmé

**`apps/api/src/services/scheduler-service.ts:163`**

```typescript
// AVANT (bug)
const statusCode = (err as Error & { statusCode?: number }).statusCode
if (statusCode === 409) { ... }

// APRÈS (correct)
if (err instanceof CatalogRefreshAlreadyRunningError) { ... }
```

L'import `CatalogRefreshAlreadyRunningError` est présent à la ligne 8. Le fix est exact et minimal. ✅

---

### Points validés (inchangés depuis review-1)

- **Migration** : `catalog_refresh_runs` avec toutes les colonnes, index partiel `WHERE status = 'RUNNING'` ✅
- **Schema Drizzle** : correspond à la migration ✅
- **Bucket movies** : `classifyMovieBucket` et `fetchStaleMovies` alignés, bornes 60/90 jours correctes ✅
- **Bucket series** : `fetchStaleSeries` couvre les 3 buckets côté DB ✅
- **Stale-lock** : RUNNING rows > 2 h → FAILED avant tentative d'insertion ✅
- **Async execution** : `void this.execute(run.id)`, erreurs capturées dans `execute()` ✅
- **Checkpoints** : `done: true` empêche le re-traitement lors d'une reprise ✅
- **Discovery** : feeds `upcoming` + `trending`, upsert idempotent sur `tmdbId`, déduplication intra-batch ✅
- **Routes** : POST 202/409 correct, GET retourne le dernier run trié par `startedAt desc` ✅
- **Authentification** : routes dans `protectedScope` ✅
- **Env vars** : 6 variables avec valeurs par défaut conformes au plan ✅
- **Scheduler** : cadence vérifiée avant lancement, timer nettoyé dans `stop()` ✅
- **Tests** : 12 cas couvrant classification, lock, async, staleDays par bucket, skip checkpoint ✅

---

### Observations mineures (non bloquantes, inchangées)

- **Race condition lock** : séquence non atomique ; second `run()` simultané échouerait en 500 au lieu de 409. Acceptable en single-instance.
- **`THROTTLE_MS = 250` local** : diverge du plan (qui prévoyait de réutiliser `ENRICH_THROTTLE_MS`), mais la constante n'est pas exportée depuis `metadata-enrichment-service.ts`. Valeur identique, comportement inchangé.
- **`classifySeriesBucket`** : ne retourne jamais `'recent'` (seulement `upcoming` | `stable`). La requête DB couvre bien `recent` pour les series. Pas de bug en production ; les tests de classification series ne couvrent pas ce cas.

---

### Décision

Le seul bug bloquant identifié a été corrigé correctement. Tous les critères d'acceptance du ticket sont couverts. Aucun nouveau problème détecté.

IMPLEMENTATION_APPROVED
