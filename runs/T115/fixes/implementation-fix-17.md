# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T115/reviews/implementation-review.md
- generated at: 2026-08-19T16:27:42Z

---

I have all the information needed. Let me write the review now.

---

# PR Review — T115: Complete catalog enrichment and make refresh failures resumable/observable

## Résumé

L'implémentation couvre la grande majorité des exigences fonctionnelles du ticket. Le code est architecturalement solide : normalisation TMDB, persistance des échecs par item, mode enrich-missing avec cursor keyset, routes admin, stats enrichies, politique d'éligibilité d'embedding. Deux bugs bloquants identifiés dans les itérations précédentes (logique de resume, état incohérent series/seasons) sont corrigés dans la version actuelle. **Un seul critère de complétude reste ouvert : l'exécution contre la production réelle.**

---

## Vérifications effectuées

### Fichiers lus

- `apps/api/src/services/catalog-enrich-missing-service.ts` (434 lignes)
- `apps/api/src/services/metadata-enrichment-service.ts` (824 lignes)
- `apps/api/src/services/embedding-eligibility.ts`
- `apps/api/src/services/embedding-backfill-service.ts` (imports vérifiés)
- `apps/api/src/routes/catalog-enrich-missing.ts`
- `apps/api/src/routes/catalog-stats.ts`
- `apps/api/src/providers/metadata/tmdb/client.ts` (lignes 49-144)
- `apps/api/src/db/schema/enrichment-failures.ts`
- `apps/api/migrations/0046_t115_catalog_refresh_runs_type.sql`
- `apps/api/migrations/0047_t115_enrichment_failures.sql`
- `apps/api/src/index.ts` (registration)
- `apps/api/src/providers/metadata/tmdb/__tests__/t115-normalization.test.ts`
- `apps/api/src/services/__tests__/t115-enrichment.test.ts`
- `runs/T115/production-run-20260819.md`
- `runs/T115/implementation-output.md`

---

## Points validés

### 1. Normalisation TMDB ✅

`mapMovieDetail()` (`client.ts:59-88`):
- `raw.runtime || null` → `runtime === 0` donne `null` ✅
- `raw.imdb_id || null` → chaîne vide donne `null` ✅  
- `raw.overview?.trim() || null` → synopsis whitespace donne `null` ✅

`mapSeriesDetail()` : même guards. Tests présents et passants (3 cas couverts).

### 2. Persistance des échecs par item ✅

Table `enrichment_failures` correcte : 13 colonnes, unique index sur `(media_type, media_id)`. L'upsert incrémente `retry_count` et met à jour `occurred_at`. `classifyError()` extrait `constructor.name` et `.code` PostgreSQL réel — plus de chaîne "Failed query: ...". Les stages couverts : `fetch`, `map`, `db_update`, `seasons`. `clearFailure()` nettoyage sur succès.

### 3. Logique de resume — BUG PRÉCÉDENT CORRIGÉ ✅

`catalog-enrich-missing-service.ts:165,169` : la condition `||` est correcte.  
```typescript
checkpoint.movies.done = prev.movies.done || !mediaTypes.includes('MOVIE')
```
Logique vérifiée : si un type était `done` dans le run précédent, il reste `done`. Si le type n'est pas dans `mediaTypes`, il est marqué `done`. Correct.

### 4. Incohérence series/seasons — BUG PRÉCÉDENT CORRIGÉ ✅

`metadata-enrichment-service.ts:437-459` : quand `enrichSeriesSeasons()` lance une exception, `seasonsFailed = true`, la fonction retourne `'terminal-failed'` sans appeler `onEnriched()`. La série apparaît dans `failedLastEnrichment` et non dans les succès du run. Correct.

### 5. Cursor keyset pagination ✅

La sélection `WHERE id > lastId ORDER BY id ASC LIMIT batchSize` (lignes 242-254) est correcte. Le curseur avance après chaque batch. Le checkpoint est sauvegardé. Idempotent : les lignes déjà fraîches ne sont pas dans la condition eligible.

### 6. Retry logic ✅

`enrichWithRetry()` (lignes 94-104) : 3 tentatives avec backoff `[250ms, 500ms, 1000ms]` sur résultat `provider-failed`. Terminal sur le 3e échec.

### 7. Routes admin ✅

4 routes registrées dans `protectedScope` (JWT requis). Input validation sur `batchSize`, `concurrency`, `throttleMs`. `POST /retry-failures` : fix de la route `force` confirmé, le flag est transmis au service.

### 8. Catalog-stats ✅

Toutes les métriques demandées présentes : `neverEnriched`, `partiallyEnriched`, `fullyEnriched`, `stale`, `failedLastEnrichment` (query réelle), `embeddingEligible`, `embeddingPending` (NOT EXISTS réel, pas hardcodé à 0), `embeddingBlocked`.

### 9. Embedding eligibility — source unique ✅

`embedding-eligibility.ts` exporte 3 formes : fonction TypeScript, prédicat SQL raw, condition Drizzle.  
- `catalog-stats.ts` utilise `EMBEDDING_ELIGIBLE_SQL_PREDICATE` ✅  
- `embedding-backfill-service.ts` importe et utilise `embeddingEligibleCondition` (lignes 7, 126, 138) ✅  
Source unique confirmée.

---

## Problèmes détectés

### BLOQUANT — Exécution production absente

Le ticket spécifie une **Completion rule** explicite :

> *Do not close after unit tests. Run the new enrichment mode against production (or an equivalent restored production snapshot), publish before/after counts, and show the remaining terminal failures with their real causes.*

Et un critère d'acceptance non coché :

> *[ ] Run against the real production catalog and demonstrate meaningful reduction of incomplete titles and successful retry/fix of the previous failure population.*

Le `production-run-20260819.md` documente un run sur un DB local de **6 films** dont 1 inséré manuellement pour simuler la défaillance. Ce n'est pas une snapshot production équivalente :

- Catalog réel : ~60k films, ~5k séries
- Run local : 6 films, dont 1 avec un TMDB ID inventé (99999999 → 404 garanti)
- Aucun before/after sur les ~126 échecs production originaux
- Aucune démonstration de réduction de `neverEnriched` à l'échelle

Le `production-run-playbook.md` documente les étapes mais n'a pas pu être exécuté (accès Fly.io non disponible dans l'environnement CI).

**Ce critère ne peut pas être satisfait par un changement de code.** Il requiert un accès infrastructure.

---

### Observation — Validation absente pour `mediaTypes`

`catalog-enrich-missing.ts:11-18` : `mediaTypes` est casté sans validation runtime. Une valeur invalide comme `['INVALID']` ne déclenche pas d'erreur HTTP 400 — elle serait silencieusement traitée comme `'SERIES'` dans la boucle de `execute()`. Impact limité (pas d'exposition de données sensibles) mais contraire aux conventions de validation du service.

```typescript
// Absent — à ajouter :
if (body?.mediaTypes) {
  const valid = ['MOVIE', 'SERIES']
  if (!body.mediaTypes.every(t => valid.includes(t))) {
    return reply.status(400).send({ error: 'mediaTypes must contain only MOVIE or SERIES' })
  }
}
```

### Observation — `enrichMissingService` sans callback d'embedding

`index.ts:204` : `enrichMissingService` est instancié avec `refreshEnrichmentService`, créé sans callback `onEnriched`. Les titres enrichis via enrich-missing n'envoient pas de signal à `EmbeddingService` pour un upsert incrémental. Ils apparaîtront dans `embeddingPending` jusqu'au prochain run de l'embedding backfill. Comportement acceptable pour un mode batch, mais à documenter dans le playbook.

---

## Risques éventuels

- **Séries avec `metadataEnrichedAt` défini mais seasons échouées** : ne sont pas dans `neverEnriched` mais dans `failedLastEnrichment`. Un re-run sans `force=true` les skipperait (déjà enrichies). Le `retry-failures` utilise `force: true` hardcodé côté enrichment — ce chemin de retry est correct.
- **`retrying` counter** : compte les tentatives pas les items uniques (documenté dans l'interface). Peut paraître élevé comparé à `failedTerminal`. Lisible mais potentiellement trompeur pour l'opérateur.
- **`embeddingBlocked` toujours 0** : car la politique d'éligibilité est `metadataEnrichedAt IS NOT NULL` = même que `enriched`. Correct et documenté dans le code, mais la métrique n'a pas encore de valeur informative.

---

## Décision

L'implémentation est fonctionnellement correcte sur tous les plans code. La seule exigence non satisfaite est la **Completion rule** explicite du ticket — un run contre la production ou une snapshot de production représentative, avec publication des compteurs avant/après.

Ce point ne peut pas être résolu par un changement de code. Il requiert une action opérationnelle : accès `DATABASE_URL` production ou restauration d'un dump représentatif (~60k films).

**Recommandation** : escalader l'accès infrastructure à un opérateur humain. Dès que le run est exécuté et les résultats publiés dans `runs/T115/production-run-20260819.md`, l'implémentation peut être approuvée sans nouvelle itération de code.

IMPLEMENTATION_FIX_REQUIRED
