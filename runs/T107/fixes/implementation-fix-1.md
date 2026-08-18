# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T107/reviews/implementation-review.md
- generated at: 2026-08-18T14:14:11Z

---

---

# PR Review — T107 — Infinite Home Shelves with Cursor Loading

## Résumé

Implémentation cursor-based Home complète et globalement de qualité : curseur HMAC tamper-proof, pool/replenishment async, déduplication cross-shelves, isolation profile, IntersectionObserver, fallback déterministe. L'architecture est conforme au plan. Les deux blockers identifiés lors de la review précédente n'ont pas été corrigés dans le commit de fix qui a suivi — il ne contenait que des artefacts de run. Le statut de cette review est donc `IMPLEMENTATION_FIX_REQUIRED`.

---

## Vérifications effectuées

- `home-cursor.ts` : HMAC-SHA256, `timingSafeEqual`, TTL 48h, version check
- `home-pool-service.ts` : session lifecycle, `serveBatch`, `fillPool`/`fillPoolAsync`, dedup cross-shelves, fatigue filtering, `buildFallbackShelf`, `persistFixedShelvesForSession`
- `home-service.ts` : premier appel (cold start, fallback), cursor request, profile mismatch, async replenishment
- `home.ts` (route) : validation cursor (Zod-like, longueur max 512, pas d'espace), 403 propagation
- `useInfiniteHome.ts` : guard `isFetchingMoreRef`, retry exponential, reset profil
- `HomePage.tsx` : IntersectionObserver sentinel 400px, ShelfSkeleton, end-of-feed indicator
- `api.ts` : `fetchHomePage` + `cursor` encoded correctement
- `env.ts` : `HOME_CURSOR_SECRET` requis au démarrage ✓
- `home-cursor.test.ts` : 6 cas couverts (round-trip, tamper payload, tamper sig, garbage, expiry, wrong-secret) ✓
- `home-service.test.ts` : 12 cas couverts (first request, cursor, 403 mismatch, 403 invalid, fallback, replenishment) ✓
- Migrations folder : `apps/api/migrations/0000` → `0042` — pas de fichier T107

---

## Points validés

- Curseur opaque et sécurisé : HMAC-SHA256, longueur vérifiée, `timingSafeEqual` anti-timing-attack ✓
- Pool + replenishment async (fire-and-forget) conforme au plan §8 ✓
- Déduplication cross-shelves via `excludedMediaIds` Set dans `_fillPoolAsync` ✓
- Fatigue concept via `ShelfFatigueService.getFatigueStates` + cooldown check ✓
- Profile isolation : vérification `session.profileId === profileId` sur cursor request ✓
- Fixed shelves (Continue Watching, My List) toujours en tête, non remplaçables ✓
- Fallback `buildFallbackShelf` (popular movies) quand pool vide ET sync fill échoue ✓
- `isFetchingMoreRef` guard anti-double-request concurrente ✓
- Reset d'état complet sur changement `profileId`/`profileVersion` ✓
- Exponential backoff retry (3 max, 500 × 2^n ms) ✓
- `HOME_CURSOR_SECRET` absent → startup fail immédiat ✓
- Backward compat : `HomeResponse` préservée dans `api-contracts/src/home.ts` ✓
- `servedAt` ajouté au schéma Drizzle `shelf_instances.ts` ✓
- Items per shelf cap : `HOME_ITEMS_PER_SHELF` (24 par défaut) + `HOME_ITEMS_MAX` (30) configurables ✓

---

## Problèmes détectés

### 🔴 Blocker 1 — Migration SQL manquante (non corrigée depuis review précédente)

`served_at timestamptz` est déclaré dans `apps/api/src/db/schema/shelf-instances.ts` (ligne 38) mais **aucun fichier SQL dans `apps/api/migrations/`** ne l'ajoute à la table. La dernière migration est `0042_t106_shelf_history.sql`. En production, toute requête `WHERE served_at IS NULL` ou tout UPDATE sur `served_at` plantera avec `column "served_at" does not exist`.

**Correction requise** : Créer `apps/api/migrations/0043_t107_shelf_served_at.sql` :

```sql
ALTER TABLE shelf_instances ADD COLUMN IF NOT EXISTS served_at timestamptz;
CREATE INDEX IF NOT EXISTS shelf_instances_session_served_pos_idx
  ON shelf_instances (home_session_id, served_at, vertical_position)
  WHERE home_session_id IS NOT NULL;
```

---

### 🔴 Blocker 2 — `persistFixedShelvesForSession` sans garde d'idempotence (non corrigée)

`home-service.ts` ligne 100-103 appelle `persistFixedShelvesForSession` à chaque requête sans cursor sur la même session 24h. `persistFixedShelvesForSession` fait un INSERT sans vérifier si les fixed shelves existent déjà pour cette session → accumulation illimitée de rows dans `shelf_instances` sur la durée de la session.

Conséquence directe : la query de dedup dans `_fillPoolAsync` (lignes 163-168 de `home-pool-service.ts`) récupère tous les items de la session sans filtre — les médias des fixed shelves sont dupliqués dans le Set mais le Set les déduplique, donc la logique reste correcte. Le problème est purement de croissance DB non bornée : chaque visite Home (~toutes les 10-20 minutes en usage normal) insère 2 nouvelles rows `shelf_instances` + N rows `shelf_instance_items`.

**Correction requise** : Ajouter une vérification d'existence avant l'insert dans `persistFixedShelvesForSession` :

```typescript
const existing = await db
  .select({ id: shelfInstances.id })
  .from(shelfInstances)
  .where(
    and(
      eq(shelfInstances.homeSessionId, sessionId),
      eq(shelfInstances.generationType, 'SYSTEM_FIXED'),
    ),
  )
  .limit(1)
if (existing.length > 0) return
```

---

## Recommandations non-bloquantes

**1. `newNextPosition` ignoré sur le premier appel**

`home-service.ts` ligne 87 :
```typescript
const { shelves: batchRows } = await serveBatch(session.id, 0, HOME_BATCH_SIZE)
```
`newNextPosition` est destructuré mais non utilisé. Ligne 113 utilise `generatedShelves.length` à la place. Cela fonctionne quand les positions sont séquentielles depuis 0 (cas normal), mais est fragile. Utiliser `newNextPosition` de `serveBatch` est plus correct et cohérent avec le chemin cursor.

**2. `fetchHome` (dead code dans `api.ts`)**

`apps/web/src/lib/api.ts` ligne 319 : `fetchHome()` (ancienne API) n'est plus appelée nulle part depuis le remplacement de `useHome` par `useInfiniteHome`. Peut être supprimée.

**3. Tests hook React manquants**

Le plan §10 mentionne explicitement deux tests hook :
- "Rapid duplicate cursor calls: second call blocked by `isFetchingMore` guard"
- "Profile switch resets cursor state"

Ces tests ne sont pas présents dans `home-service.test.ts` (qui teste le service, pas le hook). Pas d'autres fichiers de test pour `useInfiniteHome`. Coverage incomplète sur les garanties UI du ticket.

---

## Décision

Les deux blockers identifiés lors de la review 1 restent non corrigés. Le commit `b44836a9` ne modifie que les artefacts de run (`reviews/`, `prompts/`, `runtime.log`). L'implémentation ne peut pas être mergée sans la migration SQL (risque critique en production) ni sans le garde d'idempotence (croissance DB non bornée).

IMPLEMENTATION_FIX_REQUIRED
