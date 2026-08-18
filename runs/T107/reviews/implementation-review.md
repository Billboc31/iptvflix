The file is the input prompt — the review output is my text response. Here is the complete review:

---

# PR Review — T107 — Infinite Home Shelves with Cursor Loading (attempt 3)

## Résumé

Les deux blockers identifiés lors de la review précédente sont corrigés. La migration SQL est présente (`0044_t107_shelf_served_at.sql`, numérotation correcte — `0043` existe pour un autre ticket). La garde d'idempotence dans `persistFixedShelvesForSession` évite l'accumulation DB non bornée. L'implémentation couvre tous les acceptance criteria du ticket.

---

## Vérifications effectuées

- `apps/api/migrations/0044_t107_shelf_served_at.sql` : présent, idempotent (`IF NOT EXISTS`), index compound sur `(home_session_id, served_at, vertical_position)` ✓
- Numérotation migrations : `0043_t095_continue_watching_dismissals.sql` existe sur main → `0044` correct, pas de gap ✓
- `home-pool-service.ts` `persistFixedShelvesForSession` lignes 318–328 : garde d'idempotence présente, retour immédiat si row `SYSTEM_FIXED` déjà existante pour la session ✓
- `home-cursor.ts` : HMAC-SHA256, `timingSafeEqual`, TTL 48h, version check ✓
- `home-pool-service.ts` : `getOrCreateSession`, `serveBatch`, `fillPool`/`fillPoolAsync`, `excludedMediaIds` Set, fatigue concepts, `buildFallbackShelf` ✓
- `home-service.ts` : premier appel (cold start, sync fill, fallback), cursor request, profile mismatch 403, async replenishment ✓
- `home.ts` (route) : validation cursor (≤512 chars, pas d'espace), 403 propagation ✓
- `useInfiniteHome` : guard `isFetchingMoreRef`, retry exponentiel 3 × (500 × 2^n ms), reset sur changement `profileId`/`profileVersion` ✓
- `HomePage.tsx` : IntersectionObserver sentinel 400px, ShelfSkeleton ×3, end-of-feed indicator ✓
- `home-cursor.test.ts` : 7 cas (round-trip, tamper payload, tamper sig, garbage, expiry >48h, sous-48h valide, wrong-secret) ✓
- `home-service.test.ts` : 11 cas (first request, cursor, 403 mismatch, 403 invalid, fallback, replenishment, item count borné) ✓
- `env.ts` : `HOME_CURSOR_SECRET` absent → startup fail immédiat ✓
- `api-contracts/src/home.ts` : `HomeResponse` préservée + `HomePageResponse` ajouté ✓

---

## Points validés

- **Blocker 1 résolu** : migration `0044_t107_shelf_served_at.sql` crée `served_at timestamptz` + index compound idempotents ✓
- **Blocker 2 résolu** : `persistFixedShelvesForSession` vérifie l'existence de rows `SYSTEM_FIXED` avant insert, accumulation DB bornée ✓
- Curseur opaque tamper-proof : HMAC-SHA256, `timingSafeEqual`, TTL 48h ✓
- Pool replenishment async fire-and-forget, session 24h réutilisable ✓
- Déduplication cross-shelves via `excludedMediaIds` Set dans `_fillPoolAsync`, mis à jour après chaque shelf générée ✓
- Fatigue concept via `ShelfFatigueService.getFatigueStates` + cooldown check ✓
- Profile isolation : `session.profileId !== profileId` → 403 sur cursor request ✓
- Fixed shelves toujours prepended, non substituables par le pool généré ✓
- Fallback `buildFallbackShelf` (popular movies triés par `vote_average DESC, popularity DESC`) quand pool vide ET sync fill échoue ✓
- Guard anti-concurrent `isFetchingMoreRef` ✓
- Reset d'état complet sur changement de profil (pas de fuite cross-profile côté client) ✓
- Items per shelf : `HOME_ITEMS_PER_SHELF` (24 défaut) + `HOME_ITEMS_MAX` (30 max) configurables ✓
- `HOME_CURSOR_SECRET` fail-fast au démarrage ✓

---

## Problèmes détectés

### ⚠️ Observation 1 — `rankRecommendations` appelé sans contexte sémantique du concept

`_fillPoolAsync` (home-pool-service.ts lignes 222–226) appelle `rankRecommendations(profileId, { limit, includeSeen })` sans transmettre le `semanticIntent` du concept. Toutes les shelves tirent leurs candidats du même ranking profile-global ; la différenciation vient uniquement de l'exclusion progressive via `excludedMediaIds`. Concrètement, les premières shelves reçoivent les titres les mieux scorés pour le profil, les suivantes les décalés. Le titre de concept est correct mais les items ne sont pas concept-spécifiques.

Ce point dépend de l'interface de `rankRecommendations` (#207) et de sa capacité à accepter un filtre sémantique. T107 pose le framework ; l'intégration concept-spécifique est à adresser dans une itération de suivi avec le service de recommandation. Non-bloquant pour les acceptance criteria (la déduplication cross-shelves est correcte).

---

### ⚠️ Observation 2 — `newNextPosition` non utilisé sur le premier appel (persistant)

`home-service.ts` ligne 87 :
```typescript
const { shelves: batchRows } = await serveBatch(session.id, 0, HOME_BATCH_SIZE)
```
`newNextPosition` est non-capturé. Ligne 113 utilise `generatedShelves.length` à la place. Fonctionne quand les positions démarrent à 0 (cas normal), mais fragile si une session réutilisée a des positions non séquentielles depuis 0. Utiliser `newNextPosition` de `serveBatch` serait plus robuste et cohérent avec le chemin cursor. Non-bloquant.

---

### ⚠️ Observation 3 — `served_at` marqué avant enrichissement

`serveBatch` applique `UPDATE … SET served_at = now()` (home-pool-service.ts ligne 96–100) puis retourne les IDs. L'enrichissement DB (`batchRowsToShelfResponses`) s'exécute après dans `home-service.ts`. Si l'enrichissement échoue, les shelves sont marquées servies mais jamais retournées au client. L'impact est faible (pool refill compense), mais la non-atomicité est notable. Non-bloquant.

---

### ℹ️ Observation 4 — `fetchHome` dead code

`apps/web/src/lib/api.ts` ligne 323 : `fetchHome()` (ancienne API) n'est plus appelée depuis le remplacement par `useInfiniteHome`. À nettoyer. Non-bloquant.

---

### ℹ️ Observation 5 — Tests hook React manquants (persistant)

Pas de tests pour les appels `loadMore()` rapides concurrents (guard présent dans le code) ni pour le reset du cursor state sur changement de profil (logique présente dans `useEffect`). Mieux couverts par tests e2e. Non-bloquant.

---

## Risques éventuels

- **Race condition `getOrCreateSession`** : deux requêtes parallèles pour le même profil pourraient créer deux sessions simultanées. Risque faible en usage normal ; le `orderBy(desc startedAt).limit(1)` choisira la plus récente sur les appels suivants. Acceptable.
- **Replenishment silencieux** : si `fillPool` échoue systématiquement, le pool s'épuise sans alerte visible (seul un log `error` est émis). Un compteur/metric de replenishment failure serait souhaitable en production.

---

## Décision

Les deux blockers identifiés lors des reviews précédentes sont corrigés. Tous les acceptance criteria du ticket sont satisfaits. Les observations ci-dessus sont non-bloquantes et tracées pour suivi dans des itérations suivantes.

IMPLEMENTATION_APPROVED
