# PR Review — T129 Build personalized Series page

## Résumé

L'implémentation est structurellement solide et fidèle au plan : deux nouvelles tables DB, trois services backend, un hook React, une réécriture du SeriesPage, des tests unitaires, une migration Drizzle. La logique exploitation/exploration, le cache snapshot, la déduplication cross-shelf, l'exclusion des séries en cours, et le curseur signé HMAC sont tous présents et corrects dans l'ensemble.

Deux points bloquants sont identifiés : un bug de requête non bornée et un test manquant requis par les critères d'acceptance.

---

## Vérifications effectuées

- Plan vs. fichiers produits : tous les fichiers planifiés sont présents.
- Schema DB (`recommendation-series-sessions.ts`, `series-discovery-snapshots.ts`) : conforme au plan.
- Migration SQL (`0051_t129_series_discovery.sql`) : tables, FK, index, colonne `series_session_id` sur `shelf_instances` — correct.
- Config env (`env.ts`) : toutes les variables `SERIES_*` avec defaults raisonnables.
- `series-snapshot-service.ts` : upsert, validité, staleness, invalidation — correct.
- `series-pool-service.ts` : session lifecycle, declared rails (rail 1 & 2 + 2 thématiques + 1 exploration), déduplication cross-shelf, exclusion in-progress, pool fill async — correct.
- `series-page-service.ts` : logic HIT/STALE/MISS, reconstruction snapshot, fallback — globalement correct sauf bug identifié ci-dessous.
- `series-cursor.ts` : HMAC SHA-256 avec TTL 48h, timing-safe compare — correct et sécurisé.
- Route `/profiles/:profileId/series/personalized` : auth, validation cursor, intégration dans `index.ts` dans `protectedApp` — correct.
- Frontend `useSeriesPage.ts` : retry avec backoff exponentiel, reset sur `profileId`/`profileVersion` — correct.
- `SeriesPage.tsx` : `ShelfErrorBoundary` par shelf, skeleton, infinite scroll via `IntersectionObserver`, `EmptyState`/`ErrorState` — correct.
- Tests `series-pool-service.test.ts` : 11 tests, couvrant series-only constraint, composition, déduplication, exclusion in-progress, isolation erreur — correct.
- Tests `series-personalized.test.ts` : 9 tests route — correct.

---

## Points validés

- **Series-only constraint** : `queryForShelf` reçoit `mediaTypeFilter: 'SERIES'` dans tous les appels des declared rails et du pool fill. Double-filtre côté service (`c.mediaType === 'SERIES'`).
- **Composition exploitation/exploration** : 2 rails système déclarés + 2 rails thématiques exploitation + 1 shelf exploration conditionnel (≥ `SERIES_ITEMS_PER_SHELF / 4` candidats). Correct.
- **Déduplication cross-shelf** : `excludedMediaIds` propagé séquentiellement entre rails. Testé.
- **Cache snapshot** : logique HIT → servir immédiatement, STALE → servir + régénérer async, MISS → générer + sauvegarder async. Conforme au Home pattern.
- **Séries en cours exclues** : `getInProgressSeriesIds` via `viewingProgress + episodes`, seuil `IN_PROGRESS_MIN_SECONDS = 60s`. Testé.
- **Curseur sécurisé** : HMAC SHA-256 avec TTL, timing-safe compare, validation input côté route (longueur ≤ 512, pas d'espace). Aucune fuite de donnée interne.
- **Thèmes non hardcodés** : sélection dynamique depuis `shelfConcepts` filtrés par `profileId`, `active`, `desiredMediaTypes`. Aucun titre ou ID hardcodé.
- **No movie leaks** : filtres à la source ET côté application. Robuste.
- **Isolation shelf** : `ShelfErrorBoundary` par shelf, erreur silencieuse, rail vide non rendu. Correct.
- **UX** : skeleton pendant chargement, `EmptyState`, sentinel infinite scroll. Pas de debug scores exposés.
- **Migration DB** : présente, correcte, FK avec `ON DELETE CASCADE`.

---

## Problèmes détectés

### 🔴 BLOQUANT #1 — Requête trailers non bornée dans `batchRowsToShelfResponses`

**Fichier** : `apps/api/src/services/series-page-service.ts`, ligne 238

```typescript
// Code actuel — BUG
.where(eq(mediaVideos.mediaType, 'series'))
```

Cette requête charge **TOUS** les trailers de type `series` dans la base, sans filtrer sur les IDs de la page courante. Pour une base de production avec des milliers d'entrées dans `media_videos`, c'est une requête non bornée qui va :
- dégrader les performances de chaque appel HIT/STALE (reconstruction snapshot)
- potentiellement provoquer un OOM ou timeout sur une grande bibliothèque

Comparer avec le code correct dans `series-pool-service.ts` ligne 383 :
```typescript
// Code correct — déjà présent dans series-pool-service.ts
.where(and(eq(mediaVideos.mediaType, 'series'), inArray(mediaVideos.mediaId, seriesIds)))
```

**Correction requise** :
```typescript
// Dans batchRowsToShelfResponses
db.select({ mediaId: mediaVideos.mediaId, youtubeKey: mediaVideos.youtubeKey })
  .from(mediaVideos)
  .where(and(eq(mediaVideos.mediaType, 'series'), inArray(mediaVideos.mediaId, seriesIds)))
```

---

### 🔴 BLOQUANT #2 — Test snapshot reuse manquant

Le plan et les critères d'acceptance stipulent explicitement :

> "A second call within `SERIES_SNAPSHOT_TTL_HOURS` returns the same `sessionId` and does not trigger a new LLM/concept generation call (verified by mock call count in tests)."

Ce test **n'existe dans aucun des deux fichiers de tests**. Il n'y a pas non plus de fichier `series-page-service.test.ts`. La logique snapshot est implémentée dans `buildSeriesPage` (`series-page-service.ts`) mais son comportement n'est pas testé : un snapshot HIT doit retourner les mêmes shelves sans appeler `buildSeriesDeclaredRails`.

**Correction requise** : ajouter un test (dans `series-page-service.test.ts` ou dans un test d'intégration dédié) qui vérifie :
1. Premier appel → `buildSeriesDeclaredRails` est appelé 1 fois, snapshot sauvegardé.
2. Deuxième appel dans la TTL → snapshot HIT → `buildSeriesDeclaredRails` appelé 0 fois supplémentaire, même `sessionId` retourné.

---

### 🟡 MINEUR #1 — `isSeriesSnapshotStale` ne vérifie pas `invalidatedAt`

```typescript
export function isSeriesSnapshotStale(snapshot: SeriesSnapshot): boolean {
  return snapshot.expiresAt < new Date()  // ignores invalidatedAt
}
```

Un snapshot invalidé manuellement ET expiré serait servi en mode STALE (contenu périmé + régénération async) plutôt que de déclencher un MISS immédiat. Dans la pratique, un snapshot invalidé a probablement aussi été expiré, mais l'ordre des conditions dans `buildSeriesPage` garantit qu'un invalidé-mais-non-expiré tombe bien en MISS. Risque résiduel limité mais inconsistance de logique par rapport à l'intent d'invalidation explicite.

---

### 🟡 MINEUR #2 — `fillSeriesPool` déclenché après régénération snapshot STALE

Dans `buildSeriesPage` (STALE path) :
```typescript
_regenerateSeriesSnapshot(profileId, session.id).catch(...)
fillSeriesPool(session.id, profileId, SERIES_POOL_TARGET)
```

`fillSeriesPool` est appelé immédiatement sur la session courante, mais `_regenerateSeriesSnapshot` pourrait créer une nouvelle session. Si la session change en cours de regen, le pool fill peut alimenter l'ancienne session. Pas critique pour le premier release mais à surveiller si le comportement de regen de session évolue.

---

## Risques éventuels

- Le bug trailer (#1) peut causer des timeouts en production sur des catalogues >1000 séries dès le premier déploiement.
- L'absence de test snapshot reuse (#2) laisse un risque de régression non détectable si `buildSeriesPage` est modifié.

---

## Décision

REQUEST_CHANGES — 2 corrections bloquantes requises avant approbation.

---

## Actions demandées

1. **[BLOQUANT]** Corriger `batchRowsToShelfResponses` dans `series-page-service.ts` : ajouter `inArray(mediaVideos.mediaId, seriesIds)` au `WHERE` de la requête trailers.

2. **[BLOQUANT]** Ajouter un test de snapshot reuse vérifiant que le deuxième appel dans la TTL retourne le même `sessionId` sans rappeler `buildSeriesDeclaredRails` (mock call count = 0 sur le 2ème appel).

3. **[OPTIONNEL]** Aligner `isSeriesSnapshotStale` pour vérifier aussi `invalidatedAt` (ou documenter explicitement que le STALE d'un snapshot invalidé est acceptable par design).
