# Plan T117 — Finir #248 : UI Lab, candidatePoolSize, validation seeds, mapping ShelfConcept

## Objective

Corriger quatre écarts post-merge de la PR #249 : brancher l'UI Lab sur le vrai endpoint preview backend, faire respecter `candidatePoolSize` dans le retrieval sémantique, émettre une erreur explicite sur les seeds inexistantes, et centraliser le mapping `ShelfConcept → RecommendationQueryPlan` pour couvrir `freshnessPolicy` et les autres champs disponibles.

## Included

### A. UI Recommendation Lab

**`packages/api-contracts/src/shelf-concepts.ts`**
- Ajouter le type `ShelfConceptPreviewResponse` :
  ```ts
  { rawVector: Array<{ id: string; title: string; vectorScore: number }>;
    finalPersonalized: Array<{ id: string; title: string; finalScore: number; scoreBreakdown?: ScoreBreakdown }>;
    candidatePoolSize: number;
    queryPlan: RecommendationQueryPlan }
  ```
- Exporter ce type depuis le barrel `packages/api-contracts/src/index.ts`.

**`apps/api/src/client/recommendation-engine-client.ts`**
- Ajouter la méthode `previewShelfConcept(conceptId: string, body: { profileId: string; debug?: boolean })` qui appelle `POST ${RECOMMENDATION_ENGINE_URL}/v1/shelf-concepts/:id/preview` via `fetchWithTimeout`, avec circuit-breaker (pattern identique aux méthodes existantes).
- Retourne `ShelfConceptPreviewResponse | null`.

**`apps/api/src/routes/shelf-concepts.ts`**
- Ajouter la route `POST /shelf-concepts/:id/preview` qui délègue à `RecommendationEngineClient.previewShelfConcept()`.
- Transmettre `profileId` et `debug` depuis le corps de la requête.
- Retourner 502 si le client engine renvoie `null`.

**`apps/web/src/lib/api.ts`**
- Ajouter `previewShelfConcept(id: string, body: { profileId: string; debug?: boolean }): Promise<ShelfConceptPreviewResponse>` appelant `POST /shelf-concepts/${id}/preview`.

**`apps/web/src/pages/RecommendationLabPage.tsx`**
- Remplacer l'appel `semanticQuery({ query: concept.semanticIntent, topK: 5 })` (ligne 379) par `previewShelfConcept(concept.id, { profileId: selectedProfileId, debug: true })`.
- Le profil sélectionné (`selectedProfileId`) doit être non vide pour activer le bouton "Prévisualiser".
- Remplacer le panneau de prévisualisation existant par deux sections clairement séparées (ou deux onglets) :
  - **Raw vector** : rang, titre, score vectoriel (`vectorScore`).
  - **Final personnalisé** : rang, titre, score final (`finalScore`), `scoreBreakdown` / reasons si présents.
- Afficher le `queryPlan` retourné (via le composant `QueryPlanPanel` existant ou équivalent).
- Afficher `candidatePoolSize` comme indicateur debug sous le titre de section.

---

### B. candidatePoolSize effectif

**`apps/recommendation-engine/src/pipeline/types.ts`**
- Ajouter `candidatePoolSize?: number` à l'interface `PipelineContext`.

**`apps/recommendation-engine/src/pipeline/recommendation-service.ts`**
- À la construction du `ctx` (après la ligne 80), assigner `ctx.candidatePoolSize = poolSize`.
  (`poolSize` est déjà calculé ligne 70 : `opts.candidatePoolSize ?? 200`.)

**`apps/recommendation-engine/src/pipeline/stages/semantic-search.ts`**
- Remplacer la ligne 48 :
  ```ts
  const retrievalLimit = Math.min(SEMANTIC_RETRIEVAL_LIMIT, SEMANTIC_RETRIEVAL_MAX_CAP)
  ```
  par :
  ```ts
  const retrievalLimit = Math.min(
    ctx.candidatePoolSize ?? SEMANTIC_RETRIEVAL_LIMIT,
    SEMANTIC_RETRIEVAL_MAX_CAP,
  )
  ```

**Tests**
- Dans `apps/recommendation-engine/src/pipeline/__tests__/e2e-retrieval-pool.test.ts` (ou `recommendation-service.test.ts`), ajouter un test vérifiant que `runRecommendationFromPlan` avec `candidatePoolSize: 50` produit une requête SQL limitée à 50 (mocker `pgClient` pour capturer la valeur de LIMIT passée).

---

### C. Validation seeds

**`apps/recommendation-engine/src/services/shelf-generator.ts`**
- Après la construction de `movieById` et `seriesById` (lignes 59-60), vérifier que chaque `SeedMediaRef` demandé est présent dans la map correspondante.
- Si au moins un ID est absent, lever `new ValidationError(`Seed not found: ${mediaType}:${mediaId}`)` (la classe `ValidationError` est déjà définie ligne 18 du même fichier).
- La vérification doit couvrir movies ET series séparément.

**`apps/recommendation-engine/src/services/__tests__/shelf-generator.test.ts`**
- Ajouter un test : `buildSeedQueryPlan` avec un `SeedMediaRef` dont l'ID n'existe pas en base doit rejeter avec une `ValidationError` contenant l'ID manquant.

---

### D. Mapping complet ShelfConcept → QueryPlan

**`apps/recommendation-engine/src/routes/shelf-concepts.ts`**
- Extraire le bloc inline `plan: RecommendationQueryPlan = { … }` (lignes 90-104) dans une fonction nommée `buildQueryPlanFromShelfConcept(concept: ShelfConcept): RecommendationQueryPlan`, dans le même fichier (ou dans `apps/recommendation-engine/src/services/shelf-concept-mapper.ts` si le fichier grossit).
- La fonction doit mapper :
  - `rawQuery` ← `concept.semanticIntent`
  - `displayTitle` ← `concept.title`
  - `semanticIntent` ← `concept.semanticIntent`
  - `mediaTypes` ← `concept.desiredMediaTypes` (conversion lowercase puis uppercase, pattern existant)
  - `freshnessPolicy` → `hardFilters` :
    - `NEW_RELEASES` → `hardFilters.minReleaseYear = new Date().getFullYear() - 2`
    - `AVAILABLE_NOW` → aucun filtre (availability non trackée dans le schéma `hardFilters`)
    - `null` / `ALL` → `hardFilters = {}`
  - `desiredThemes`, `desiredTone`, `avoidSignals`, `softPreferences`, `userConstraints` : rester à `[]` / `{}` (ShelfConcept ne contient pas ces données aujourd'hui ; la fonction est le bon endroit pour les ajouter quand le type sera enrichi).
  - `plannerFallback: true`, `plannerMeta: null` (inchangé).
- Remplacer le bloc inline par un appel `buildQueryPlanFromShelfConcept(concept)`.

**Tests de non-régression**
- Dans les tests existants du pipeline (`recommendation-service.test.ts` ou un nouveau fichier `shelf-concept-mapper.test.ts`), vérifier que `buildQueryPlanFromShelfConcept` produit le bon `hardFilters.minReleaseYear` pour `freshnessPolicy = 'NEW_RELEASES'` et un `hardFilters` vide pour `'ALL'`.

---

### Tests de non-régression globaux (queries)

- Dans un fichier de test existant ou nouveau, ajouter trois snapshots de non-régression vérifiant que `runRecommendationFromPlan` sur les intents suivants retourne au moins 5 résultats non vides :
  - `Aventures à travers le temps`
  - `Épopées modernes`
  - `film qui retourne le cerveau`

---

## Excluded

- Enrichissement du type `ShelfConcept` lui-même (ajout de champs theme/tone/avoidSignals) — hors scope de ce ticket.
- Stratégie cache/invalidation des shelves — ticket suivant.
- Composition Home et recommandations Film/Série — ticket suivant.
- Modification de la logique de circuit-breaker du `RecommendationEngineClient`.
- Mapping `AVAILABLE_NOW` vers un filtre d'availability réel (non trackable dans le schéma actuel).
- Modification du schéma DB.

## Acceptance criteria

- Dans le Lab, cliquer "Prévisualiser" sans profil sélectionné est désactivé ; avec un profil, affiche Raw vector et Final personnalisé dans deux sections séparées.
- Les résultats Final personnalisé sont bien produits par `SCORE_MODEL_V2` (visible dans `scoreBreakdown`).
- Le `queryPlan` affiché dans le Lab contient `hardFilters.minReleaseYear` quand le concept a `freshnessPolicy = 'NEW_RELEASES'`.
- `runRecommendationFromPlan({ candidatePoolSize: 50 })` déclenche un retrieval sémantique limité à 50 (vérifié par test unitaire).
- `buildSeedQueryPlan` avec un ID inexistant lève une `ValidationError` contenant l'ID manquant (vérifié par test unitaire).
- `buildQueryPlanFromShelfConcept` remplace le bloc inline dans le handler preview ; aucun attribut de `ShelfConcept` influençant le ranking n'est silencieusement perdu.
- Les trois queries de non-régression retournent chacune ≥ 5 résultats.
- `npm run test` (ou `pnpm test`) passe sans régression sur les tests existants.
