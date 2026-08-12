# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T042/reviews/implementation-review.md
- generated at: 2026-08-12T13:29:57Z

---

I have all the information needed. Let me write the review.

---

# PR Review — T042 : Generate personalized Shelves from seed media

## Résumé

Il s'agit de la review d'un retry. Les trois problèmes bloquants de la review précédente ont été corrigés : seuil minimum de 3 seeds (était 2), signal de ranking via `preferGenreIds` (bonus genre +3.0 impacte réellement les candidats hors-seeds), et transaction sur `refreshGeneratedShelf`. La base de l'implémentation backend est solide. Deux nouveaux problèmes bloquants sont identifiés : l'absence totale de web flow (explicitement exigé par le ticket) et la non-atomicité de `generateShelfFromSeeds` (risque d'états corrompus en base).

---

## Vérifications effectuées

- Lecture du ticket T042, du plan, et de la review précédente (`runs/T042/reviews/implementation-review.md`)
- Lecture complète de `shelf-generation-service.ts`, `shelves.ts` (routes), `shelf-generation-service.test.ts`, `shelves.test.ts` (routes), `recommendation-ranking-service.ts`, `shelves.ts` (schema), migration `0019_generated_shelf.sql`, `api-contracts/shelves.ts`
- Vérification des corrections demandées par la review précédente
- Recherche exhaustive du web flow dans `apps/web/src/`
- Analyse de l'atomicité des opérations DB dans les deux fonctions publiques

---

## Points validés

**Corrections de la review précédente :**
- ✅ Seuil minimum de seeds : `< 3` dans le service et dans la route, messages d'erreur cohérents, tests mis à jour.
- ✅ Signal de ranking : `preferGenreIds` passé à `rankRecommendations`, bonus `+3.0` dans le ranking service pour les candidats dont les genres correspondent — les seeds influencent effectivement les recommandations via l'affinité de genre.
- ✅ Transaction sur refresh : `refreshGeneratedShelf` enveloppe delete/insert/update dans `db.transaction`, atomicité correcte.

**Points du ticket validés :**
- Schema : `GENERATED` ajouté à `shelfTypeEnum`, migration SQL correcte (`ALTER TYPE ADD VALUE`), intent stocké en `rules` JSONB sous `GeneratedShelfRules`.
- Validation des seeds : format, existence canonique vérifiée, erreurs descriptives.
- Exclusion des seeds du résultat : `seedIdSet` correctement utilisé post-ranking.
- Matérialisation : `materializeDiscoveryCandidate` vérifie le lien canonique avant d'insérer, idempotent.
- Déduplication : candidat DISCOVERY avec `canonicalMovieId` existant ne crée pas de nouvelle ligne.
- Intent persisté : `seedMediaIds`, `inferredGenreIds`, `generatedAt` dans `rules`.
- Refresh : rejet des shelves non-GENERATED (400), 404 si inexistant, rejet si rules malformées.
- Types partagés complets et cohérents (`SeedMediaRef`, `GeneratedShelfRules`, `GenerateShelfBody`, `GenerateShelfResponse`).
- Sécurité : aucun secret hardcodé, validation aux frontières, ownership vérifié sur refresh.
- Couverture tests service : 10 scénarios couvrant seed count, unknown seed, déterminisme, exclusion, déduplication, matérialisation, availableToMe, persistance, refresh, explanation.

---

## Problèmes détectés

### 🔴 BLOQUANT 1 — Web flow absent : critère d'acceptation ticket non satisfait

La section **Included** du ticket est explicite :
> *"Expose a lightweight web flow for selecting seed Media and creating the Shelf."*

Le critère d'acceptation correspondant :
> *"A user can select at least 3 canonical Movies/Series and create a generated Shelf."*

Aucun composant, page ou hook React n'existe pour cette fonctionnalité. La recherche exhaustive dans `apps/web/src/` ne trouve aucune référence à `generate`, `seed`, `GENERATED`, ni `GenerateShelf`. Le plan a explicitement exclu le web flow sans que cette exclusion soit couverte par le ticket — la section "Excluded" du ticket ne mentionne pas l'UI. Le feature est invisible pour l'utilisateur en l'état.

**Correction requise** : implémenter un flow web minimal — une page ou un dialog de sélection de seeds (recherche ou liste de médias), appel `POST /shelves/generate`, affichage de la réponse. L'extension `apps/web/src/lib/api.ts` doit exposer les appels aux deux nouveaux endpoints.

---

### 🔴 BLOQUANT 2 — `generateShelfFromSeeds` non-atomique

`refreshGeneratedShelf` utilise correctement `db.transaction`. `generateShelfFromSeeds` ne le fait pas.

La séquence dans `resolveGeneratedMembers` puis `generateShelfFromSeeds` :
1. Matérialisation de discovery candidates (INSERT canonical Movie/Series + UPDATE discoveryCandidate)
2. SELECT MAX(position)
3. INSERT shelf
4. INSERT shelfMembers

Si l'étape 3 ou 4 échoue après la matérialisation (step 1), des lignes canoniques orphelines existent en base sans aucune appartenance à un shelf. Ces records ont `availability` nulle (zéro rows) et peuvent influencer le pool de recommandations sans jamais être accessibles via un shelf. La matérialisation peut aussi être répétée en cas de retry sans entraîner de doublon (idempotente grâce au check `canonicalMovieId`), mais les records orphelins persistent.

Le ticket dit explicitement : *"Materialize external discovery candidates into canonical zero-Availability Media only when needed for durable Shelf membership"* — la matérialisation doit être liée à la création effective du shelf.

**Correction requise** :

```typescript
// Dans generateShelfFromSeeds, après resolveGeneratedMembers :
await db.transaction(async (tx) => {
  const [shelf] = await tx.insert(shelves).values({ ... }).returning()
  if (members.length > 0) {
    await tx.insert(shelfMembers).values(...).onConflictDoNothing()
  }
})
```

Note : la matérialisation elle-même (dans `resolveGeneratedMembers`) ne peut pas être facilement enveloppée dans la même transaction car elle est appelée avant le retour de `generateShelfFromSeeds`. L'approche la plus propre est de déplacer la matérialisation à l'intérieur de la transaction, ou d'accepter que les candidats matérialisés soient des "pre-allocated" records stables. A minima, le shelf + members doivent être créés atomiquement.

---

### 🟡 MODÉRÉ — Absence de tests HTTP pour les deux nouveaux endpoints

Le fichier `apps/api/src/routes/__tests__/shelves.test.ts` (613 lignes) ne contient aucun test pour `POST /shelves/generate` ni `POST /shelves/:id/refresh`. La validation HTTP de la route (titre absent, `seedMediaIds` manquant, seeds invalides, `mediaType` invalide) n'est pas testée au niveau HTTP. Un bug introduit dans la couche route ne serait détecté que par les tests service (qui mockent le service, pas la route).

Le ticket exige : *"Tests cover seed validation, deterministic generation, deduplication, unavailable candidates and persistence"* — la validation au niveau route (HTTP 400 avec `validationError: true`) n'est pas couverte.

**Correction recommandée** : ajouter dans `shelves.test.ts` au minimum :
- `POST /shelves/generate` 201 (happy path, mock `generateShelfFromSeeds`)
- `POST /shelves/generate` 400 (fewer than 3 seeds, invalid mediaType, missing title)
- `POST /shelves/:id/refresh` 200 (mock `refreshGeneratedShelf`)
- `POST /shelves/:id/refresh` 400 (non-GENERATED shelf — via `ValidationError` mock)

---

### 🟢 MINEUR — Check `!rules.limit` imprécis

`shelf-generation-service.ts`, ligne 241 :
```typescript
if (!rules?.seedMediaIds || !Array.isArray(rules.seedMediaIds) || !rules.limit) {
```

`!rules.limit` est truthy si `limit === 0`. La valeur 0 est hors de la plage valide 1–100, donc ne devrait jamais être stockée, mais le check `rules.limit == null` serait plus précis et résistant à des données corrompues.

---

### 🟢 MINEUR — Doublons dans `seedMediaIds` non rejetés

Si le même `mediaId` apparaît deux fois dans `seedMediaIds`, il passe la validation (array de 3–10 éléments). La déduplication post-ranking via `seedIdSet` fonctionnera correctement (le media est bien exclu du résultat), mais `seedTitles` contiendra ce titre deux fois et le shelf stockera deux occurrences dans `rules.seedMediaIds`. Impact faible mais incohérent pour le refresh.

---

## Risques éventuels

- La modification de `recommendation-ranking-service.ts` (ajout de `preferGenreIds` à `RankOpts`) est partagée avec d'autres callers. Le bonus `+3.0` ne s'applique que si `opts.preferGenreIds` est fourni, donc pas de régression sur les appels existants.
- La désérialisation `shelf.rules as GeneratedShelfRules` sans validation de schema reste un point fragile : un rules corrompu manuellement en DB ferait crasher le refresh avec un message peu descriptif.

---

## Décision

- REQUEST_CHANGES

## Actions demandées

1. **Obligatoire** — Implémenter le web flow minimal (page ou dialog de sélection de seeds, hook `useGenerateShelf`, appels aux deux endpoints). C'est un critère d'acceptation ticket non satisfait.
2. **Obligatoire** — Envelopper `INSERT shelves` + `INSERT shelfMembers` dans `generateShelfFromSeeds` dans une transaction `db.transaction`, de la même façon que `refreshGeneratedShelf`.
3. **Recommandé** — Ajouter des tests HTTP pour `POST /shelves/generate` et `POST /shelves/:id/refresh` dans `shelves.test.ts`.
4. **Optionnel** — Remplacer `!rules.limit` par `rules.limit == null` pour un check plus précis.
5. **Optionnel** — Ajouter une déduplication des `seedMediaIds` par `mediaId` à la validation initiale.

---

IMPLEMENTATION_FIX_REQUIRED
