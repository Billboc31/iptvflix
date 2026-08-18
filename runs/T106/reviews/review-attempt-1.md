# PR Review — T106: Persist ShelfConcept/ShelfInstance history and item-level feedback

## Résumé

L'implémentation crée correctement toute l'infrastructure de persistance demandée : schémas DB, services, routes Lab. Le code est bien structuré, les transactions sont utilisées là où nécessaire, et la qualité générale est bonne.

Cependant un problème **bloquant** rend le ticket non livrable : `persistShelfInstance()` n'est jamais appelé depuis le pipeline réel de génération de shelves. Le `home-service.ts` (qui assemble le Home) et `recommendation-ranking-service.ts` n'ont pas été modifiés pour créer des lignes `ShelfInstance`. La couche d'historique est de l'infrastructure morte en production — les endpoints Lab retourneront toujours des listes vides.

---

## Vérifications effectuées

- Lecture de tous les fichiers modifiés/créés (schémas, services, routes, migration SQL, contrats API)
- Vérification que `persistShelfInstance` est appelé quelque part → non trouvé hors de sa définition
- Analyse de `home-service.ts` → utilise `rankRecommendations()` (l'ancienne fonction), jamais modifié par T106
- Vérification de l'intégration fatigue dans `getActivePool()` → correcte
- Vérification des indexes, FKs, migration SQL
- Analyse du chemin d'attribution 30 min dans `dispatchSideEffects`
- Analyse des routes Lab (`/shelf-history`, `/trace`)

---

## Points validés

- **Schémas corrects** : `shelfInstances`, `shelfInstanceItems`, `recommendationHomeSessions`, `shelfConceptFatigue`, `profileMediaExposure` avec les bons champs, indexes, et FKs (migration SQL cohérente avec le code Drizzle).
- **`ShelfInstanceService`** : `persistShelfInstance` en transaction, `markFirstDisplayed` avec COALESCE côté DB pour l'idempotence, `markItemVisible/Opened/Played` corrects avec upsert sur `profileMediaExposure`.
- **`ShelfFatigueService`** : `recordImpression` avec auto-cooldown, `recordInteraction` (reset streak), `suppressConcept` avec reason/version. Filtre fatigue wired dans `getActivePool()`.
- **Attribution 30 min** dans `dispatchSideEffects` pour `PLAY_STARTED` : cherche le `SHELF_ITEM_OPENED` le plus récent pour le même `(profileId, mediaId)` — correct et borné.
- **`SHELF_ITEM_VISIBLE`** ajouté à `ALLOWED_EVENT_TYPES` et traité dans la dispatch chain.
- **Side-effects non-bloquants** : erreurs loguées mais pas propagées — bonne pratique pour ne pas casser l'enregistrement d'événements.
- **Routes Lab** : `/shelf-history` et `/trace` bien structurées, retournent les bonnes données.
- **Auth** : `shelfInstancesRoutes` enregistré sous `protectedApp` — protégé.
- **Config** : Variables `FATIGUE_*` et `EXPOSURE_MEMORY_HOURS` correctement définies et exportées.
- **Contrats API** : Types `ShelfInstanceDetail`, `ConceptPerformance`, `FatigueState`, etc. cohérents avec les services.

---

## Problèmes détectés

### 🚨 BLOQUANT — `persistShelfInstance` jamais appelé dans le pipeline de génération

**Fichiers concernés :** `apps/api/src/services/home-service.ts`, `apps/api/src/routes/recommendations.ts`

Le `home-service.ts` appelle `rankRecommendations()` (l'ancienne fonction) et assemble des shelves sans jamais créer de `ShelfInstance`. Les routes `/profiles/:profileId/home` et `/recommendations` n'ont pas été touchées par T106.

Résultat : zéro ligne `shelf_instances` ne sera jamais créée lors d'une vraie session utilisateur. Tous les endpoints Lab (`/shelf-history`, `/trace`) retourneront des listes vides. L'attribution via `shelfInstanceId` dans les events sera impossible car il n'y aura jamais de `shelfInstanceId` à fournir.

Le critère de complétion du ticket dit explicitement :
> "Generate and display several real shelves for a test Profile, interact with different items, and prove the Lab/history can reconstruct..."

Ceci ne peut pas être démontré.

**Correction requise :** Appeler `ShelfInstanceService.persistShelfInstance()` au moment où des items sont rankés et retournés pour affichage — au minimum dans `buildHome()` ou `rankRecommendations()`, et retourner le `shelfInstanceId` dans la réponse HTTP pour que le client puisse l'inclure dans ses events.

---

### 🚨 BLOQUANT — `FATIGUE_LOOKBACK_DAYS` non utilisé dans `ShelfFatigueService`

**Fichier concerné :** `apps/api/src/services/shelf-fatigue-service.ts`

La variable `FATIGUE_LOOKBACK_DAYS` est définie dans `env.ts` mais n'est pas importée dans `shelf-fatigue-service.ts`. Le plan spécifiait que le streak zero-interaction devait être évalué *dans la fenêtre de `FATIGUE_LOOKBACK_DAYS`*, mais l'implémentation utilise un compteur global sans fenêtre temporelle.

Conséquence : un utilisateur avec 4 impressions ignorées il y a 6 mois et 1 today verra son concept mis en cooldown, ce qui contredit la logique "dans les X derniers jours".

**Correction requise :** Soit windower le `zeroInteractionStreakCount` par rapport à `lastShownAt` (moins trivial), soit faire une requête sur les `shelfInstances` récents du concept pour compter les impressions sans interaction dans la fenêtre — ou à défaut, documenter explicitement que la fenêtre n'est pas implémentée et que c'est un choix délibéré.

---

### ⚠️ Significatif — N+1 queries dans `/recommendation-lab/profiles/:profileId/shelf-history`

**Fichier concerné :** `apps/api/src/routes/recommendation-lab.ts:643-668`

Pour chaque ShelfInstance retourné (jusqu'à 100), `getConceptPerformance()` est appelé individuellement. Chaque appel fait 2 requêtes (instances + items). Pour 20 shelves avec 20 concepts différents → 40+ requêtes synchrones sérialisées par le `Promise.all` sur les instances.

**Correction suggérée :** Agréger les performances par batch (par `conceptId`) plutôt qu'une requête par instance.

---

### ⚠️ Significatif — `getConceptPerformance.impressionCount` comptabilise les instances générées, pas les affichées

**Fichier concerné :** `apps/api/src/services/shelf-performance-service.ts:26`

```ts
const impressionCount = instances.length  // toutes les instances, y compris jamais affichées
```

Une `ShelfInstance` générée mais jamais envoyée au client (firstDisplayedAt = null) compte comme une impression, ce qui fausse `visibleRate` vers le bas.

**Correction suggérée :** Utiliser `displayedCount` comme `impressionCount` dans le contrat de performance, ou distinguer `generatedCount` vs `displayedCount`.

---

### ⚠️ Mineur — Cursor pagination timestamp URL-encoding

**Fichier concerné :** `apps/api/src/services/shelf-instance-service.ts:293`

```ts
sql`${shelfInstances.createdAt} < ${new Date(before)}`
```

Si `before` est un ISO timestamp avec offset timezone (`+02:00`), le `+` sera décodé comme espace par certains clients HTTP, rendant `new Date(before)` invalide (NaN). Il faut soit `decodeURIComponent(before)` côté route, soit utiliser un token opaque (timestamp Unix).

---

### ⚠️ Mineur — Race condition bénigne dans `ShelfFatigueService.recordImpression`

**Fichier concerné :** `apps/api/src/services/shelf-fatigue-service.ts:86-122`

L'upsert et la vérification du seuil de cooldown sont deux opérations séparées sans transaction. Deux appels concurrents pourraient tous deux lire `zeroInteractionStreakCount >= threshold && !cooldownUntil` et tous deux écrire le cooldown. Conséquence : doublon d'écriture identique (idempotent), pas de corruption. Acceptable mais à noter.

---

## Risques éventuels

1. **Scalabilité de `getConceptPerformance`** — Charge TOUS les `shelfInstanceItems` d'un concept en mémoire. Pour un concept affiché 100 fois avec 20 items chacun → 2000 lignes. Acceptable à court terme, indexé, mais à surveiller.

2. **`shownInConceptIds` croissance non bornée** — Le JSONB array s'agrandit à chaque nouvelle exposition sans plafond. Pour un media très exposé, cet array pourrait devenir grand. Acceptable pour l'instant mais prévoir une limite ou un compactage.

3. **`profileMediaExposure.exposureCount` initialisé à 1 dans l'insert** — Le schéma a `DEFAULT 0` mais l'insert fournit `exposureCount: 1`. Correct et cohérent, mais à documenter pour éviter confusion.

---

## Décision

IMPLEMENTATION_FIX_REQUIRED

### Actions demandées

1. **[Bloquant]** Intégrer `ShelfInstanceService.persistShelfInstance()` dans le pipeline de génération réel (`home-service.ts` et/ou `buildHome()` / `rankRecommendations()`). Retourner le `shelfInstanceId` dans la réponse HTTP afin que le client puisse l'envoyer dans les events (`SHELF_IMPRESSION`, `SHELF_ITEM_OPENED`, etc.).

2. **[Bloquant]** Implémenter la fenêtre temporelle `FATIGUE_LOOKBACK_DAYS` dans `ShelfFatigueService.recordImpression()`, ou documenter explicitement la déviation par rapport au plan et le comportement réel.

3. **[Recommandé]** Batcher les `getConceptPerformance` dans `/shelf-history` pour éviter N+1.

4. **[Mineur]** Corriger le cursor pagination `before` pour gérer l'URL-encoding du `+` dans les timestamps ISO.

IMPLEMENTATION_FIX_REQUIRED
