Now I have a complete picture of all three review attempts. Let me write the third review.

---

# PR Review — T106: Persist ShelfConcept/ShelfInstance history and item-level feedback (attempt #3)

## Résumé

Les deux problèmes bloquants identifiés lors des reviews précédentes ont été corrigés. L'infrastructure de persistance est complète, correctement intégrée dans le pipeline réel, et le critère de complétion end-to-end peut être satisfait.

---

## Vérifications effectuées

- Vérification que `persistShelfInstance` est appelé dans `home-service.ts` et que `shelfInstanceId` est retourné dans la réponse HTTP
- Lecture complète de `shelf-fatigue-service.ts` pour confirmer l'usage de `FATIGUE_LOOKBACK_DAYS`
- Relecture de `shelf-instance-service.ts` (transaction, upserts, COALESCE)
- Relecture de `shelf-performance-service.ts` (calcul visibleRate, openRate, playRate)
- Vérification du contrat API (`ShelfResponse.shelfInstanceId` dans `packages/api-contracts/src/shelves.ts`)
- Lecture du test unitaire `home-service.test.ts`
- Vérification de la route Lab `/shelf-history` pour l'état des N+1

---

## Bloquant #1 — `persistShelfInstance` ✅ RÉSOLU

`home-service.ts` appelle `shelfInstanceService.persistShelfInstance()` pour les deux shelves système (`sys_rec_for_you`, `sys_rec_upcoming`). Le `shelfInstanceId` est retourné dans le `ShelfResponse` via le champ `shelfInstanceId?: string | null` (contrat API confirmé). L'attribution via events (`SHELF_IMPRESSION`, `SHELF_ITEM_OPENED`, etc.) est désormais possible.

Note : les deux instances sont créées avec `shelfConceptId: null` car ce sont des shelves système non liées à un concept nommé. Les instances issues de `ShelfConceptGeneratorService` (ticket #208) n'entrent pas encore dans ce pipeline, mais l'infrastructure les prend en charge dès maintenant. C'est dans le scope.

---

## Bloquant #2 — `FATIGUE_LOOKBACK_DAYS` ✅ RÉSOLU

`shelf-fatigue-service.ts` importe et utilise `FATIGUE_LOOKBACK_DAYS` pour calculer `lookbackCutoff` (ligne 58). Le `zeroInteractionStreakCount` est remis à `1` dans l'upsert SQL si `lastShownAt < lookbackCutoff`, ce qui empêche des impressions ignorées hors de la fenêtre temporelle de déclencher un cooldown. Implémentation simplifiée (reset-on-boundary plutôt que requête sur l'historique), mais la déviation est commentée et délibérée — acceptable.

---

## Points validés (inchangés depuis review-attempt-1)

- Schémas `shelfInstances`, `shelfInstanceItems`, `recommendationHomeSessions`, `shelfConceptFatigue`, `profileMediaExposure` corrects avec indexes, FKs, et migration SQL cohérente
- `persistShelfInstance` en transaction avec insert items en batch
- `markFirstDisplayed` avec `COALESCE` côté DB — idempotent
- `markItemOpened` / `markItemPlayed` avec upsert sur `profileMediaExposure`
- Attribution 30 min pour `PLAY_STARTED` — bornée et correcte
- `SHELF_ITEM_VISIBLE` dans `ALLOWED_EVENT_TYPES` et dispatché
- Side-effects non-bloquants dans `dispatchSideEffects` — erreurs loguées, pas propagées
- Filtre fatigue correctement wired dans `getActivePool()`
- Routes Lab `/shelf-history` et `/trace` bien structurées, auth protégée sous `protectedApp`
- Contrats API complets et cohérents avec les services
- Test unitaire `home-service.test.ts` couvre les scenarios de filtrage, tri et CW exclusion

---

## Problèmes résiduels non-bloquants

### ⚠️ Significatif — N+1 queries dans `/shelf-history` (inchangé)

**Fichier :** `apps/api/src/routes/recommendation-lab.ts:643-648`

`getConceptPerformance()` est appelé une fois par instance (`Promise.all()` concurrent). Pour un Lab de diagnostic, acceptable. À batcher dans un suivi.

### ⚠️ Significatif — `impressionCount` = instances générées, pas affichées (inchangé)

**Fichier :** `apps/api/src/services/shelf-performance-service.ts:26`

`impressionCount = instances.length` inclut les instances avec `firstDisplayedAt = null`. `visibleRate = displayedCount / impressionCount` est donc calculée sur une base qui mélange "généré" et "affiché". À clarifier sémantiquement ou à corriger dans un suivi.

### ⚠️ Mineur — Cursor pagination `before` sans `decodeURIComponent` (inchangé)

**Fichier :** `apps/api/src/services/shelf-instance-service.ts:292`

`new Date(before)` sur un timestamp ISO avec `+02:00` dont le `+` est URL-décodé en espace rend la date invalide. À corriger ou à passer par un token Unix opaque.

---

## Risques résiduels acceptables

- Race condition bénigne dans `recordImpression` (upsert + check seuil en deux requêtes) — doublon idempotent, pas de corruption
- `shownInConceptIds` JSONB array sans plafond — à surveiller pour media très exposés
- `.catch()` global sur le `Promise.all([forYouId, upcomingId])` dans `home-service.ts` — si l'un échoue, les deux retournent `null`. Dégrade gracieusement.

---

## Décision

Les deux corrections bloquantes sont résolues. L'infrastructure est complète et opérationnelle. Des shelves réelles peuvent être générées, persistées, et leurs IDs transmis au client pour l'attribution. Le Lab peut inspecter l'historique complet (instance, items, scores, visibility, opened, played). Le critère de complétion end-to-end peut être satisfait.

IMPLEMENTATION_APPROVED
