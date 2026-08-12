# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T042/reviews/implementation-review.md
- generated at: 2026-08-12T13:16:24Z

---

Now I have enough context to write the full review.

---

# PR Review — T042: Generate personalized Shelves from seed media

## Résumé

L'implémentation couvre l'essentiel du plan : service `shelf-generation-service.ts`, routes `POST /shelves/generate` et `POST /shelves/:id/refresh`, migration enum, types partagés, et 14 tests. Le code est lisible et bien structuré. Cependant, deux problèmes bloquants sont identifiés : un écart direct avec un critère d'acceptation du ticket (seuil minimum de seeds), et une faille de design significative sur le comportement de recommandation attendu.

---

## Vérifications effectuées

- Lecture complète du ticket T042, du plan, et de l'`implementation-output.md`
- Lecture des fichiers : `shelf-generation-service.ts`, test file, `shelves.ts` (routes), `shelves.ts` (schema), `api-contracts/shelves.ts`, `recommendation-ranking-service.ts`, `shelf-service.ts`, migration SQL
- Vérification de chaque critère d'acceptation du ticket et du plan
- Analyse de la logique de ranking et de l'usage de `positiveMediaIds`
- Analyse des opérations DB et de leur atomicité

---

## Points validés

- **Schema** : `GENERATED` ajouté à `shelfTypeEnum`, migration SQL correcte (`ALTER TYPE ADD VALUE`), aucune colonne superflue, intent stocké dans `rules` JSONB sous `GeneratedShelfRules`.
- **Validation des seeds** : format (`mediaType` + `mediaId`), existence canonique vérifiée, erreurs descriptives renvoyées.
- **Exclusion des seeds** : filtrage post-ranking via `seedIdSet`, les seeds n'apparaissent pas dans les membres.
- **Matérialisation** : le helper `materializeDiscoveryCandidate` vérifie d'abord le lien canonical existant avant d'insérer, idempotent et correct.
- **Déduplication** : un candidat DISCOVERY avec `canonicalMovieId` existant ne crée pas de nouvelle ligne canonique (testé, correct).
- **Persistence du intent** : `rules.seedMediaIds`, `rules.inferredGenreIds`, `rules.generatedAt` persistés.
- **Refresh** : membres remplacés, `generatedAt` mis à jour, intent inchangé, rejet correct des shelves non-GENERATED (400), 404 si shelf inexistant.
- **Routes** : ordre de registration correct, pas de conflit Fastify entre `/shelves/generate` (statique) et `/shelves/:id` (dynamique), validation côté serveur complète.
- **Types partagés** : `SeedMediaRef`, `GeneratedShelfRules`, `GenerateShelfBody`, `GenerateShelfResponse` bien typés et cohérents.
- **Couverture de tests** : 14 scénarios couvrant tous les cas du plan.
- **Sécurité** : aucun secret hardcodé, validation entrées à la frontière (route handler), `ForbiddenError` sur ownership du shelf.

---

## Problèmes détectés

### 🔴 BLOQUANT 1 — Minimum de seeds : 2 dans l'implémentation, 3 dans le ticket

Le critère d'acceptation du ticket est explicite :
> *"A user can select **at least 3** canonical Movies/Series and create a generated Shelf."*

Le plan a changé ce seuil à 2 sans justification documentée. L'implémentation suit le plan (2–10), y compris dans les tests (`accepts exactly 2 seeds`). C'est une violation directe d'un critère d'acceptation ticket.

**Correction requise** :
- `shelf-generation-service.ts` ligne ~175 : changer `seedMediaIds.length < 2` → `seedMediaIds.length < 3`
- `shelves.ts` (routes) : changer la validation route (`< 2` → `< 3`) et le message d'erreur
- Test `accepts exactly 2 seeds` → renommer et valider avec 3 seeds ; ajouter un test de rejet à 2 seeds

---

### 🔴 BLOQUANT 2 — Les seeds n'influencent pas les recommandations des autres médias

Le ticket dit :
> *"Derive a recommendation intent/profile from the seed Media using existing metadata and recommendation boundaries"*
> *"The Shelf contains ranked recommendations derived from the seeds and current recommendation engine."*

L'implémentation passe `positiveMediaIds: seedIds` au ranking service. Or, dans `recommendation-ranking-service.ts`, `positiveMediaIds` sert uniquement à un bonus direct sur le media ID lui-même (`+5.0` si `positiveMediaIds.has(c.mediaId)`). Les seeds sont ensuite filtrés des résultats. Résultat : **les seeds donnent un bonus à des items qui sont immédiatement supprimés, et n'influencent pas le score des autres candidats**.

Les recommandations générées sont celles du profil de goût existant de l'utilisateur, indépendamment des seeds choisis. La personnalisation "from seeds" est absente au niveau du ranking.

**L'intent stocké** (`inferredGenreIds`) est correct pour l'explication, mais il n'est pas utilisé pour booter le scoring.

**Correction requise** :
L'approche la plus simple et sans régression : dans `resolveGeneratedMembers`, après avoir collecté `inferredGenreIds`, les passer à `rankRecommendations` via un mécanisme existant (ou une option `preferGenreIds`) pour qu'ils influencent le genre affinity scoring. Si le ranking service ne supporte pas encore cette option, il faut l'ajouter, ou à défaut, documenter explicitement dans le code pourquoi ce comportement est acceptable (et le confirmer dans le plan).

---

### 🟡 MODÉRÉ — Refresh non-atomique : risque de perte de membres

Dans `refreshGeneratedShelf` :
```typescript
await db.delete(shelfMembers).where(eq(shelfMembers.shelfId, shelfId))  // step 1
await db.insert(shelfMembers).values(...)                                 // step 2
await db.update(shelves).set({ rules: updatedRules }).where(...)         // step 3
```

Si step 2 ou 3 échoue après le DELETE, le shelf se retrouve sans membres et avec des règles potentiellement désynchronisées. Il n'y a pas de transaction englobante.

**Correction recommandée** : wrapper dans une transaction DB (`db.transaction(async (tx) => { ... })`). Ne bloque pas si l'équipe accepte ce risque en v1, mais doit être documenté.

---

### 🟡 MODÉRÉ — Aucune influence des seeds sur les candidats DISCOVERY

Le filtrage des seeds dans `resolveGeneratedMembers` :
```typescript
const seedIdSet = new Set(seedMediaIds.map((s) => s.mediaId))
const candidates = recs.candidates.filter((c) => !seedIdSet.has(c.mediaId))
```

Pour les candidats `source: 'DISCOVERY'`, `c.mediaId` est l'ID du discovery candidate, pas l'ID canonique. Si un titre seed existe aussi comme discovery candidate (peu probable mais possible), il ne sera pas filtré. Risque faible en pratique (UUIDs différents), mais valeur mentionnée pour exhaustivité.

---

### 🟢 MINEUR — Pas de validation du format UUID pour `mediaId`

Aucune vérification que les `mediaId` sont des UUIDs valides. Une valeur invalide provoquera une erreur DB non-descriptive. Acceptable en v1 si la validation UUID est gérée au niveau DB.

---

## Risques éventuels

- La modification de `recommendation-ranking-service.ts` (ajout de `positiveMediaIds` à `RankOpts`) est partagée avec le ranking standard. Si le comportement actuel (`+5.0` bonus) est utilisé par d'autres callers, le changement de comportement pourrait affecter les recommandations classiques. À vérifier avant toute modification.
- La sérialisation `GeneratedShelfRules` en JSONB n'a pas de validation de schema à la lecture (`shelf.rules as GeneratedShelfRules`). Un `rules` corrompu ferait crasher le refresh sans message utile.

---

## Décision

- REQUEST_CHANGES

## Actions demandées

1. **Obligatoire** : Corriger le minimum de seeds de 2 à 3, conformément au critère d'acceptation du ticket. Mettre à jour les tests en conséquence.
2. **Obligatoire** : Corriger le mécanisme de dérivation de recommendations depuis les seeds — le passage de `positiveMediaIds` au ranking service ne produit pas de recommendations influencées par les seeds. Soit adapter le ranking service pour utiliser les `inferredGenreIds` des seeds comme boost de genre, soit documenter et justifier explicitement pourquoi le comportement actuel est acceptable au regard du ticket.
3. **Recommandé** : Wrapper `refreshGeneratedShelf` dans une transaction DB pour éviter l'état partiel.
4. **Optionnel** : Ajouter une validation defensive du schéma `GeneratedShelfRules` à la lecture en `refreshGeneratedShelf`.

---

IMPLEMENTATION_FIX_REQUIRED
