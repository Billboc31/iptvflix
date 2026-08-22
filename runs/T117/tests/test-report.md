Le rapport est écrit. Voici le résultat de validation :

---

## Rapport de test — T117

**Décision : VALIDÉ**

### A. UI Recommendation Lab — ✅ PASS
`RecommendationLabPage.tsx` appelle bien `POST /v1/shelf-concepts/:id/preview` (ligne 385). Les deux sections **Raw vector** (rang, titre, score vectoriel) et **Final personnalisé** (rang, titre, score final, reasons) sont présentes et séparées. Le `queryPlan` est affiché via `<QueryPlanPanel>`. Le profil est obligatoire.

### B. candidatePoolSize effectif — ✅ PASS
`runSemanticSearch()` calcule `Math.min(ctx.candidatePoolSize ?? SEMANTIC_RETRIEVAL_LIMIT, SEMANTIC_RETRIEVAL_MAX_CAP)` — la valeur est propagée depuis les options via `PipelineContext`. Test de propagation présent et vert (`recommendation-service.test.ts:239-264`).

### C. Validation seeds — ✅ PASS
`buildSeedQueryPlan()` valide l'existence de chaque seed après lecture en DB et lève `ValidationError("Seed not found: MOVIE:<id>")` si manquante. Test couvert dans `shelf-generator.test.ts:144-158`.

### D. Mapping ShelfConcept → QueryPlan — ✅ PASS
`buildQueryPlanFromShelfConcept()` existe dans `shelf-concept-mapper.ts`. Mappe `semanticIntent`, `desiredMediaTypes`, et `freshnessPolicy` (NEW_RELEASES → `minReleaseYear`). Les champs `desiredThemes/desiredTone/avoidSignals` restent vides à juste titre — ils n'existent pas dans le schéma DB `shelf_concepts`.

### Correction appliquée
Une erreur TypeScript bloquante a été corrigée : `concept.desiredMediaTypes` est `unknown` (Drizzle `jsonb`), un cast `as string[] | null` a été ajouté dans `shelf-concepts.ts:83`.

### Tests
- **80 tests passent**, 0 échec
- 12 skippés normalement (nécessitent DB + OpenAI — environnement worktree sans credentials)
- Les 3 tests de non-régression (`Aventures à travers le temps`, `Épopées modernes`, `film qui retourne le cerveau`) sont présents dans `pipeline-regression.test.ts`, skippés sans DB
