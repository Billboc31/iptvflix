# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T129/reviews/implementation-review.md
- generated at: 2026-08-24T13:30:41Z

---

---

## PR Review — T129

### Résumé

L'implémentation est structurellement solide : deux nouvelles tables DB, trois services backend, hook React, réécriture SeriesPage, tests unitaires, migration Drizzle. La logique exploitation/exploration, cache snapshot, déduplication cross-shelf, exclusion des séries en cours et curseur HMAC sont tous corrects dans l'ensemble.

Deux points bloquants identifiés.

---

### Points validés

- **Series-only constraint** : `mediaTypeFilter: 'SERIES'` dans tous les appels `queryForShelf`, double-filtre côté application. Testé.
- **Composition** : 2 rails système (Séries pour toi, Nouvelles séries pour toi) + 2 thématiques exploitation + 1 exploration conditionnel. Correct.
- **Déduplication cross-shelf** : `excludedMediaIds` propagé séquentiellement entre rails. Testé.
- **Cache snapshot** : logique HIT/STALE/MISS, stale-while-revalidate, snapshot sauvegardé async. Conforme au pattern Home.
- **Séries en cours exclues** : via `viewingProgress + episodes`, seuil 60s. Testé.
- **Curseur sécurisé** : HMAC SHA-256, timing-safe compare, TTL 48h.
- **Pas de thèmes hardcodés** : sélection dynamique depuis `shelfConcepts` filtrés.
- **Migration DB** : présente, FK en cascade, index.
- **Frontend** : `ShelfErrorBoundary` par shelf, skeleton, infinite scroll, EmptyState/ErrorState.

---

### Problèmes détectés

**🔴 BLOQUANT #1 — Requête trailers non bornée** (`series-page-service.ts:238`)

```typescript
// Actuel — BUG : charge TOUS les trailers series de la base
.where(eq(mediaVideos.mediaType, 'series'))

// Requis — déjà correct dans series-pool-service.ts:383
.where(and(eq(mediaVideos.mediaType, 'series'), inArray(mediaVideos.mediaId, seriesIds)))
```

Chaque appel HIT/STALE de reconstruction snapshot charge l'intégralité de `media_videos` pour les séries. Risque de timeout/OOM en production.

**🔴 BLOQUANT #2 — Test snapshot reuse manquant**

Le plan et les critères d'acceptance stipulent explicitement : *"A second call within TTL returns the same sessionId and does not trigger a new LLM/concept generation call (verified by mock call count in tests)."* Ce test n'existe ni dans `series-pool-service.test.ts` ni dans `series-personalized.test.ts`. Il n'y a pas de `series-page-service.test.ts`.

**🟡 MINEUR — `isSeriesSnapshotStale` ignore `invalidatedAt`** : un snapshot invalidé+expiré sera servi STALE plutôt que MISS, ce qui contourne l'intent d'invalidation explicite.

---

### Actions requises

1. Ajouter `inArray(mediaVideos.mediaId, seriesIds)` au `WHERE` de la requête trailers dans `batchRowsToShelfResponses`.
2. Ajouter un test qui vérifie qu'un deuxième appel dans la TTL retourne le même `sessionId` sans rappeler `buildSeriesDeclaredRails` (mock call count = 0).

IMPLEMENTATION_FIX_REQUIRED
