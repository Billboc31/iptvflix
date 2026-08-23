# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T123/reviews/implementation-review.md
- generated at: 2026-08-23T16:37:46Z

---

I have all the information needed. Writing the review now.

---

# PR Review — T123 (re-review après fix) : Improve semantic retrieval precision for thematic shelf intent

## Résumé

Le fix résout correctement les deux blockers de la review précédente (artefact node_modules, drift T121/T122 dans hybrid-reranker/recommendations/config/query-plan) et améliore substantiellement le test "Enquêtes policières dans l'espace". Cependant, le nettoyage du scope drift dans `shelf-concept-mapper.ts` est **incomplet** : la fonction `resolveSemanticProtection` a été retirée du type mais pas du code, ce qui provoque deux blockers TypeScript empêchant la compilation.

---

## Points validés

- **Artefact node_modules** : `node_modules/.vite/vitest/results.json` supprimé du git (`-rw deleted` dans le diff vs main). ✅
- **hybrid-reranker.ts** : zéro ligne modifiée vs main — scope T121/T122 entièrement retiré. ✅
- **recommendations.ts** : zéro ligne modifiée vs main. ✅
- **config.ts** : uniquement `SEMANTIC_ANCHOR_BLEND_ALPHA` ajouté, les 5 constantes T121/T122 absentes. ✅
- **query-plan.ts** : uniquement `semanticAnchor?: string | null` ajouté, `semanticProtection` absent du type. ✅
- **semantic-search.ts** : dual-embedding correct (`Promise.all`, formule `ALPHA * anchorDist + (1-ALPHA) * intentDist`), path legacy byte-for-byte identique quand `semanticAnchor` absent. ✅
- **Prompts** : instruction `semanticAnchor` avec contrainte de restrictivité et langage de contraste propagée dans `shelf-concept-generator-v1.ts` (API et reco-engine) et `query-planner-v1.ts`. ✅
- **Migration SQL / Drizzle schemas** : `semantic_anchor TEXT` nullable ajouté de façon additive dans les deux schemas. ✅
- **Tests blend** (`semantic-search-blend.test.ts`) : 6 cas couvrant alpha=0/1/0.45, symétrie distance/similarité, et fixture espace-policier. Aucune dépendance DB/API. ✅
- **Test benchmark "Aventures à travers le temps"** : assertions ≥4/8 titres temporels + false positives absents du top-5. ✅
- **Test "Enquêtes policières dans l'espace"** — correctement fixé : assertions composite ≥3/8 ET single-theme ≤2/5 en top-5. ✅
- **Mapper tests** : 3 cas couvrant forwarding de `semanticAnchor`. ✅
- Aucun hardcoding de titre ou de rayon en code de production. ✅

---

## Problèmes détectés

### 🔴 BLOQUANT 1 — `resolveSemanticProtection` résiduelle dans `shelf-concept-mapper.ts`

La fonction `resolveSemanticProtection` a été retirée de `RecommendationQueryPlan` (type propre) mais **pas** de l'implémentation du mapper. La ligne :

```typescript
semanticProtection: resolveSemanticProtection(concept.generationType),  // ligne 55
```

provoque :
```
TS2353: Object literal may only specify known properties, and 'semanticProtection' does not exist in type 'RecommendationQueryPlan'
```

Par ricochet, `generationType?: string | null` a été ajouté en paramètre du mapper et `generationType: concept.generationType` est passé dans la route `shelf-concepts.ts` uniquement pour alimenter cette fonction morte. Ces trois éléments (fonction, paramètre, usage dans la route) sont du scope drift T121/T122 non retiré.

**Correction attendue** :
- Supprimer `resolveSemanticProtection` de `shelf-concept-mapper.ts`
- Supprimer `semanticProtection:` du return et `generationType?: string | null` du type de paramètre
- Supprimer `generationType: concept.generationType` dans `apps/recommendation-engine/src/routes/shelf-concepts.ts`

### 🔴 BLOQUANT 2 — `semanticAnchor` absent de `RawConcept` dans les deux generators

`RawConcept` (type local dans chaque service) ne déclare pas `semanticAnchor`. L'accès `raw.semanticAnchor` à l'insert provoque des erreurs TS2339 dans les deux services :

| Fichier | Erreur |
|---|---|
| `apps/recommendation-engine/src/services/shelf-concept-generator.ts:383` | `Property 'semanticAnchor' does not exist on type 'RawConcept'` (×3) |
| `apps/api/src/services/shelf-concept-generator-service.ts:461` | `Property 'semanticAnchor' does not exist on type 'RawConcept'` (×3) |

**Correction attendue** : ajouter `semanticAnchor?: string | null` à `type RawConcept` dans les deux fichiers.

---

## Risques éventuels

- 🟡 MINEUR (carry-forward) : mots-clés temporels ('time') fragiles si le corpus fixture évolue. Acceptable avec corpus fixe, commentaire déjà présent dans le test.
- 🟡 MINEUR : le bloc `useAnchorBlend && anchorVector.length > 0` dans semantic-search.ts est une double-garde (si `useAnchorBlend` est vrai, `anchorVector.length` sera toujours > 0 sauf erreur OpenAI silencieuse). Comportement conservatif acceptable.

---

## Actions demandées

1. Dans `apps/recommendation-engine/src/services/shelf-concept-mapper.ts` : supprimer la fonction `resolveSemanticProtection`, supprimer `semanticProtection:` du return et `generationType?: string | null` du paramètre.
2. Dans `apps/recommendation-engine/src/routes/shelf-concepts.ts` : supprimer `generationType: concept.generationType` de l'appel `buildQueryPlanFromShelfConcept`.
3. Dans `apps/recommendation-engine/src/services/shelf-concept-generator.ts` (type `RawConcept`, ligne ~37) : ajouter `semanticAnchor?: string | null`.
4. Dans `apps/api/src/services/shelf-concept-generator-service.ts` (type `RawConcept`) : même correction.
5. Vérifier `npx tsc --noEmit` sur les deux packages avant resoumission.

---

IMPLEMENTATION_FIX_REQUIRED
