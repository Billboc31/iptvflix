Implémentation complète. Voici le récapitulatif :

---

## Résumé des changements

### A — UI Recommendation Lab

- **`packages/api-contracts/src/shelf-concepts.ts`** : ajout de `ShelfConceptPreviewResponse` (rawVector, finalPersonalized, candidatePoolSize, queryPlan)
- **`apps/api/src/client/recommendation-engine-client.ts`** : nouvelle méthode `previewShelfConcept()` avec circuit-breaker
- **`apps/api/src/routes/shelf-concepts.ts`** : nouvelle route `POST /shelf-concepts/:id/preview` qui délègue à l'engine (502 si indisponible)
- **`apps/web/src/lib/api.ts`** : ajout de `previewShelfConcept()`
- **`apps/web/src/pages/RecommendationLabPage.tsx`** : remplace `semanticQuery` par `previewShelfConcept`, deux sections séparées **Raw vector** et **Final personnalisé**, bouton "Prévisualiser" désactivé sans profil, affichage du `QueryPlanPanel`

### B — candidatePoolSize effectif

- **`apps/recommendation-engine/src/pipeline/types.ts`** : `candidatePoolSize?: number` ajouté à `PipelineContext`
- **`apps/recommendation-engine/src/pipeline/recommendation-service.ts`** : `candidatePoolSize: poolSize` propagé dans le ctx
- **`apps/recommendation-engine/src/pipeline/stages/semantic-search.ts`** : `retrievalLimit = Math.min(ctx.candidatePoolSize ?? SEMANTIC_RETRIEVAL_LIMIT, SEMANTIC_RETRIEVAL_MAX_CAP)`

### C — Validation seeds

- **`apps/recommendation-engine/src/services/shelf-generator.ts`** : boucle de validation après construction des maps — `ValidationError` explicite pour chaque seed manquante

### D — Mapping complet ShelfConcept → QueryPlan

- **`apps/recommendation-engine/src/services/shelf-concept-mapper.ts`** : NOUVEAU — `buildQueryPlanFromShelfConcept()` avec mapping complet (freshnessPolicy → minReleaseYear, desiredMediaTypes, fallbacks)
- **`apps/recommendation-engine/src/routes/shelf-concepts.ts`** : remplace le bloc inline par un appel à `buildQueryPlanFromShelfConcept()`

### Tests (73 passent, 0 régression)

- **`recommendation-service.test.ts`** : test `candidatePoolSize` propagé au ctx
- **`shelf-generator.test.ts`** : test seed manquante → `ValidationError`
- **`shelf-concept-mapper.test.ts`** : NOUVEAU — 8 tests (freshnessPolicy, mediaTypes, fallbacks)
- **`pipeline-regression.test.ts`** : 3 tests de non-régression skipIf (Aventures à travers le temps, Épopées modernes, film qui retourne le cerveau)
