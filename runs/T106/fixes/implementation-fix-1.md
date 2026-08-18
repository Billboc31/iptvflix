# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T106/reviews/implementation-review.md
- generated at: 2026-08-18T12:49:07Z

---

I have all the information needed to write the review. Both blocking issues from review-attempt-1 are confirmed unresolved.

---

# PR Review — T106: Persist ShelfConcept/ShelfInstance history and item-level feedback (attempt #2)

## Résumé

Il s'agit du second passage de review. L'infrastructure DB/service est bien construite et inchangée depuis la première review. **Les deux problèmes bloquants identifiés lors du premier passage n'ont pas été corrigés.** L'implémentation ne peut pas être approuvée dans cet état.

---

## Vérifications effectuées

- Relecture de `home-service.ts` pour vérifier l'intégration de `persistShelfInstance`
- Recherche globale (`grep -rn`) de tous les appelants de `persistShelfInstance` hors du fichier de définition
- Lecture complète de `shelf-fatigue-service.ts` pour vérifier l'usage de `FATIGUE_LOOKBACK_DAYS`
- Vérification dans `env.ts` que `FATIGUE_LOOKBACK_DAYS` est bien défini (ligne 116) mais pas importé dans le service
- Lecture des routes Lab (`/shelf-history`, `/trace`) pour vérifier leur fonctionnement
- Comparaison avec le contenu de `runs/T106/reviews/review-attempt-1.md` et `runs/T106/reviews/implementation-review.md`

---

## Points validés (inchangés depuis review-attempt-1)

- Schémas corrects : `shelfInstances`, `shelfInstanceItems`, `recommendationHomeSessions`, `shelfConceptFatigue`, `profileMediaExposure` avec les bons champs, indexes, FKs — cohérents avec la migration SQL
- `ShelfInstanceService` : transaction sur `persistShelfInstance`, COALESCE idempotent pour `markFirstDisplayed`, upsert correct sur `profileMediaExposure` dans `markItemOpened`/`markItemPlayed`
- Attribution 30 min pour `PLAY_STARTED` : correcte, bornée, fallback via `SHELF_ITEM_OPENED` récent
- `SHELF_ITEM_VISIBLE` correctement ajouté à `ALLOWED_EVENT_TYPES` et dispatché
- Side-effects non-bloquants dans `dispatchSideEffects` — erreurs loguées, pas propagées
- Filtre fatigue correctement wired dans `getActivePool()`
- Routes Lab `/shelf-history` et `/trace` bien structurées, auth protégée
- `shelfInstancesRoutes` enregistré sous `protectedApp`
- Contrats API complets (`ShelfInstanceDetail`, `ConceptPerformance`, `FatigueState`, etc.)
- `/shelf-history` batchifie `getFatigueStates` et `conceptRows` — bon

---

## Problèmes détectés

### 🚨 BLOQUANT #1 — `persistShelfInstance` toujours pas appelé dans le pipeline de génération

**Fichier concerné :** `apps/api/src/services/home-service.ts`

Le fichier est identique à sa version pré-T106. `buildHome()` appelle `rankRecommendations()` puis construit et retourne le `HomeResponse` sans jamais créer de `ShelfInstance`. La recherche globale confirme que `persistShelfInstance` n'est appelé nulle part hors de sa propre définition :

```
Callers trouvés hors shelf-instance-service.ts :
  recommendation-lab.ts   → lecture seulement (getShelfInstanceWithItems, listProfileShelfInstances)
  shelf-instances.ts      → lecture seulement
  interaction-event-service.ts → markFirstDisplayed, markItemVisible, markItemOpened, markItemPlayed — jamais persistShelfInstance
```

Résultat : zéro ligne `shelf_instances` ne sera créée lors d'une vraie session utilisateur. Les endpoints Lab retourneront systématiquement des listes vides. Le `shelfInstanceId` que les clients devraient inclure dans leurs events (`SHELF_IMPRESSION`, `SHELF_ITEM_OPENED`, etc.) n'existe pas car personne ne le génère.

La completion rule du ticket est explicite :
> "Generate and display several real shelves for a test Profile, interact with different items, and **prove** the Lab/history can reconstruct..."

Ceci ne peut pas être démontré.

**Correction requise :** Appeler `ShelfInstanceService.persistShelfInstance()` dans `buildHome()` au moment où les items rankés sont connus, et retourner le `shelfInstanceId` dans le `ShelfResponse` pour que le client puisse l'inclure dans ses events.

---

### 🚨 BLOQUANT #2 — `FATIGUE_LOOKBACK_DAYS` défini mais jamais utilisé

**Fichier concerné :** `apps/api/src/services/shelf-fatigue-service.ts`

`env.ts` ligne 116 exporte `FATIGUE_LOOKBACK_DAYS = 14` (par défaut). `shelf-fatigue-service.ts` n'importe que `FATIGUE_MAX_ZERO_INTERACTION_STREAK`, `FATIGUE_COOLDOWN_DAYS`, `FATIGUE_SUPPRESSION_VERSION` — `FATIGUE_LOOKBACK_DAYS` n'est pas importé et n'apparaît nulle part dans le fichier.

Conséquence : le `zeroInteractionStreakCount` est un compteur global incrémental sans borne temporelle. Des impressions ignorées il y a 6 mois pèsent autant que celles de la semaine dernière. Un utilisateur avec 4 impressions ignorées il y a 4 mois et 1 today atteint le seuil et est mis en cooldown — comportement incorrect par rapport au plan.

**Correction minimale requise :** Soit (a) implémenter une vraie fenêtre temporelle en requêtant les ShelfInstances récents pour compter les impressions sans interaction dans `FATIGUE_LOOKBACK_DAYS`, soit (b) réinitialiser `zeroInteractionStreakCount` à 0 quand `lastShownAt < now - FATIGUE_LOOKBACK_DAYS` au moment de l'upsert, soit (c) documenter explicitement dans le code que la fenêtre n'est pas implémentée et que c'est un choix délibéré (déviation de plan assumée).

---

### ⚠️ Significatif (inchangé depuis review-attempt-1) — N+1 queries dans `/shelf-history`

**Fichier :** `apps/api/src/routes/recommendation-lab.ts:643-647`

`getConceptPerformance()` est toujours appelé une fois par instance via `Promise.all()`. Les requêtes sont concurrentes (mieux que le premier review ne l'indiquait), mais c'est toujours N × 2 requêtes DB pour une page de 20 shelves avec des conceptIds distincts, en plus des requêtes déjà faites pour `conceptRows` et `fatigueMap`. Pour un Lab de diagnostic, acceptable en l'état si les deux bloquants sont résolus, mais à batcher dans un suivi.

---

### ⚠️ Significatif (inchangé) — `impressionCount` compte les instances générées, pas affichées

**Fichier :** `apps/api/src/services/shelf-performance-service.ts`

`impressionCount = instances.length` inclut les ShelfInstances avec `firstDisplayedAt = null`, ce qui fausse `visibleRate` à la baisse. À corriger ou à documenter.

---

### ⚠️ Mineur (inchangé) — Cursor pagination `before` sensible à l'URL-encoding

**Fichier :** `apps/api/src/services/shelf-instance-service.ts:293`

Un timestamp ISO avec timezone (`+02:00`) dont le `+` est décodé comme espace invalide `new Date(before)` sans décoder l'URL explicitement.

---

## Risques éventuels

- `shownInConceptIds` (jsonb array) croît sans borne — à surveiller pour les media très exposés.
- Race condition bénigne dans `recordImpression` (upsert + check de seuil en deux requêtes séparées) — doublon d'écriture idempotent, pas de corruption.
- `getConceptPerformance` charge tous les ShelfInstanceItems d'un concept en mémoire — acceptable à court terme, indexé.

---

## Décision

Les deux corrections bloquantes identifiées lors du premier passage n'ont pas été réalisées. L'infrastructure est correcte mais inutilisable en production : aucun `ShelfInstance` ne sera jamais créé, et la fenêtre temporelle de fatigue n'est pas respectée.

IMPLEMENTATION_FIX_REQUIRED
