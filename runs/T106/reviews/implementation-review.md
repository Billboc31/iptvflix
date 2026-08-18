---

## PR Review — T106

### Résumé

L'infrastructure est bien construite : schémas DB corrects, services cohérents, routes Lab fonctionnelles, migration SQL alignée. Cependant, **deux problèmes bloquants** rendent le ticket non livrable.

---

### Points validés

- Schémas `shelfInstances`, `shelfInstanceItems`, `recommendationHomeSessions`, `shelfConceptFatigue`, `profileMediaExposure` corrects avec indexes et FKs conformes au plan
- `ShelfInstanceService` : transaction sur `persistShelfInstance`, COALESCE côté DB pour l'idempotence de `markFirstDisplayed`
- Attribution 30 min pour `PLAY_STARTED` : correcte et bornée
- `SHELF_ITEM_VISIBLE` ajouté à `ALLOWED_EVENT_TYPES` et dispatché
- Side-effects non-bloquants (erreurs loguées, pas propagées)
- Filtre fatigue wired dans `getActivePool()`
- Routes Lab (`/shelf-history`, `/trace`) bien structurées
- Auth : `shelfInstancesRoutes` sous `protectedApp` — protégé

---

### Problèmes bloquants

**1. `persistShelfInstance` n'est jamais appelé dans le pipeline réel**

`home-service.ts` appelle `rankRecommendations()` (l'ancienne fonction) sans jamais créer de `ShelfInstance`. Aucun fichier hors de la définition du service n'appelle `persistShelfInstance`. Résultat : zéro ligne `shelf_instances` ne sera créée lors d'une vraie session utilisateur — tous les endpoints Lab retourneront des listes vides, et l'attribution via `shelfInstanceId` dans les events sera impossible.

La completion rule du ticket exige de prouver l'end-to-end — ce n'est pas possible dans l'état actuel.

**Correction requise :** Intégrer l'appel dans `buildHome()` / `rankRecommendations()` et retourner le `shelfInstanceId` dans la réponse HTTP.

**2. `FATIGUE_LOOKBACK_DAYS` non utilisé — le streak n'est pas borné dans le temps**

La variable est définie dans `env.ts` mais n'est pas importée dans `shelf-fatigue-service.ts`. Le `zeroInteractionStreakCount` est un compteur global sans fenêtre temporelle : des impressions ignorées il y a 6 mois contribuent au cooldown autant que celles d'aujourd'hui. Déviation significative par rapport au plan.

---

### Problèmes non-bloquants

- N+1 queries dans `/shelf-history` : `getConceptPerformance()` appelé une fois par instance (2 requêtes chacun) — à batcher
- `impressionCount` dans `getConceptPerformance` compte les instances générées, pas les affichées — fausse `visibleRate`
- Cursor pagination `before` : timestamp ISO avec `+02:00` sera URL-décodé en espace → `new Date()` invalide

---

**Décision :** `IMPLEMENTATION_FIX_REQUIRED`
