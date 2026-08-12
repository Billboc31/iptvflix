I have everything needed for the review. Let me write it.

---

# PR Review — T030: Bound and harden Xtream per-series episode metadata synchronization

## Résumé

Le ticket demandait de remplacer le `Promise.all` non borné sur `getSeriesInfo()` par une stratégie à concurrence limitée, de définir des sémantiques d'échec par série, et d'éviter les disparitions d'épisodes causées par des échecs partiels provider. L'implémentation couvre l'ensemble du périmètre demandé sans dérive de scope.

Cinq fichiers modifiés :
- `providers/xtream/types.ts` — ajout de `failedSeriesIds` au snapshot
- `services/sync-runs-service.ts` — helper `withBoundedConcurrency`, remplacement du `Promise.all`, mapping `seriesInfoFailed`
- `services/catalog-sync-service.ts` — `failedSeriesProviderIds` dans `NormalizedSnapshot`, protection des épisodes via jointure 3 tables, `failedCount` initialisé depuis les IDs échoués
- `packages/api-contracts/src/sync.ts` — champ `seriesInfoFailed?: number` dans `SyncRunResponse`
- `catalog-sync-service.test.ts` — 3 nouveaux tests dans `describe('partial episode-fetch safety')`

## Vérifications effectuées

- Lecture complète des 5 fichiers modifiés
- Vérification de la logique `withBoundedConcurrency` (worker-queue, ordre des résultats, sécurité event-loop)
- Vérification de la jointure 3 tables dans `syncNormalized` (episodeAvailabilities → episodes → seriesAvailabilities)
- Vérification des edge cases : all-fail, no-fail, `seriesInfo = {}`, snapshot `undefined`
- Lecture des 3 nouveaux tests et des 24 tests pré-existants
- Vérification de la cohérence plan ↔ implémentation

## Points validés

**Concurrence bornée** (`sync-runs-service.ts:34-54`)
Le worker-queue est correct. Les résultats sont stockés à l'index d'origine (`results[item.i]`), donc `settledResults[i]` correspond toujours à `series[i]`. L'unicité de `queue.shift()` est garantie par le single-thread JS. Le default 5 est configurable via `XTREAM_SERIES_CONCURRENCY`.

**Isolation des échecs** (`catalog-sync-service.ts:591-615`)
La jointure `episodeAvailabilities → episodes → seriesAvailabilities` avec filtre `providerItemId IN failedProviderIds AND providerId = sourceId` est sémantiquement correcte. Les épisodes des séries échouées sont exclus du sweep UNAVAILABLE via `protectedEpisodeIds`. Le cas all-fail est couvert : `seriesInfo = {}` (truthy) déclenche le bloc épisode, mais `failedSeriesProviderIds` contient toutes les séries, donc tous les épisodes existants sont protégés.

**Observabilité** (`catalog-sync-service.ts:315`, `sync-runs-service.ts:29`)
`counts.failedCount = failedSeriesProviderIds?.length ?? 0` est initialisé avant la transaction. Il est persisté dans `sync_runs.failed_count` et exposé via `SyncRunResponse.seriesInfoFailed`. La chaîne complète est correcte.

**Non-régression Plex** (`catalog-sync-service.ts:723-754`)
`syncPlexCatalog` n'utilise pas `failedSeriesProviderIds` (field absent, donc `undefined`). La branche de protection est correctement court-circuitée.

**Tests** (`catalog-sync-service.test.ts:887-955`)
- Test 1 (`withBoundedConcurrency` peak) : valide directement l'helper avec 10 tâches et limit=3.
- Test 2 (isolation) : vérifie que `ep-701-1` reste `AVAILABLE` après un snapshot partiel avec `failedSeriesIds: [701]`.
- Test 3 (`failedCount`) : vérifie `result.counts.failedCount === 1` pour un snapshot avec 1 ID échoué.

**Scope** : pas de changement au timeout client, pas de retry automatique, pas de changement schema DB, pas de modification Plex. Conforme aux exclusions du plan.

## Problèmes détectés

### Mineur 1 — `withBoundedConcurrency` crash silencieux si `XTREAM_SERIES_CONCURRENCY` est non numérique

`parseInt('abc', 10)` retourne `NaN`. `Math.min(NaN, tasks.length)` = `NaN`. `Array.from({ length: NaN })` = `[]`. Aucun worker ne démarre ; `results` reste un tableau sparse d'`undefined`. La boucle for suivante fait `r.status` sur `undefined` → `TypeError`.

Ce cas n'est pas demandé par le ticket et ne survient qu'en cas de config invalide. Non bloquant.

### Mineur 2 — Le test d'isolation ne vérifie pas `epB.lastSeenAt`

Le test vérifie que `epB.status === 'AVAILABLE'` et `unavailableAt === null`, mais ne vérifie pas que `epB.lastSeenAt` n'a PAS été mis à jour à `t2` (comportement attendu puisque les épisodes de B n'ont pas été vus). Omission de couverture, non bloquant.

### Mineur 3 — `seriesInfoFailed` toujours présent dans la réponse (valeur 0) alors que le type le déclare optionnel

`seriesInfoFailed: row.failedCount` retourne toujours un nombre (jamais `undefined`), même quand aucun échec. Le type `seriesInfoFailed?: number` suggère que la propriété peut être absente. Le comportement actuel est plus informatif mais légèrement incohérent avec la signature. Non bloquant.

## Risques éventuels

- **Env var malformée** : voir Mineur 1. Risque faible en production, mais une validation `isNaN(concurrencyLimit) ? 5 : concurrencyLimit` serait défensive.
- **Grands volumes** : si `failedSeriesProviderIds` contient des milliers d'IDs, la clause `inArray` dans la protection query peut dépasser les limites du driver Postgres. Non concerné par les catalogs IPTV typiques (centaines de séries), pas in-scope du ticket.

## Décision

Aucun problème bloquant. Tous les critères d'acceptation du ticket sont satisfaits. L'implémentation est correcte, bornée au périmètre, et les 3 nouveaux tests couvrent les cas clés. Les observations mineures peuvent être adressées dans un ticket séparé si nécessaire.

IMPLEMENTATION_APPROVED
