La review est écrite. Voici le résumé :

---

## Résultat de la review T107

**Décision : `IMPLEMENTATION_FIX_REQUIRED`**

### Points validés
- Curseur HMAC-SHA256 correct (tamper-proof, TTL 48h, timing-safe)
- Architecture pool + replenishment async conforme au plan
- Profile isolation : vérification session côté API + reset state côté hook
- Fallback déterministe fonctionnel
- Guard concurrent requests (`isFetchingMoreRef`)
- IntersectionObserver + ShelfSkeleton + end-of-feed OK
- Backward compat `HomeResponse` préservée

### 2 Blockers

**🔴 Bloquant 1 — Migration SQL manquante**
La colonne `served_at` est dans le schéma Drizzle mais absente de tous les 43 fichiers SQL en `apps/api/migrations/`. La DB existante ne connaît pas la colonne → toutes les routes Home planteront en production.

**Correction** : Créer `0043_t107_shelf_served_at.sql` avec `ALTER TABLE shelf_instances ADD COLUMN served_at timestamptz` + index compound `(home_session_id, served_at, vertical_position)`.

**🔴 Bloquant 2 — Fixed shelves dupliquées à chaque visite**
`persistFixedShelvesForSession` est appelée à chaque requête sans cursor (retour sur Home, refresh) sur la même session 24h. Elle fait un INSERT sans garde d'idempotence → accumulation de rows parasites dans `shelf_instances`.

**Correction** : Vérifier `WHERE home_session_id = ? AND generation_type = 'SYSTEM_FIXED'` avant d'insérer.

### Recommandations non-bloquantes
- Utiliser `newNextPosition` de `serveBatch` (vs `generatedShelves.length`) dans le premier curseur
- Supprimer `fetchHome` (dead code dans `api.ts`)
- Tests hook React manquants (plan §10 les mentionnait)
