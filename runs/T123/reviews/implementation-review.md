All blockers from the previous review have been resolved. The implementation is clean.

---

# PR Review — T123 (attempt 3) : Improve semantic retrieval precision for thematic shelf intent

## Résumé

Les deux blockers de la review précédente sont entièrement résolus. La compilation TypeScript est propre sur `recommendation-engine`. Les trois erreurs restantes dans `apps/api` (`accountId` dans les fixtures pairing/commands) sont pre-existing sur main et hors scope T123.

---

## Blockers résolus

### BLOQUANT 1 — `resolveSemanticProtection` résiduelle ✅

`shelf-concept-mapper.ts` est désormais propre : aucune fonction `resolveSemanticProtection`, aucun paramètre `generationType`, aucun champ `semanticProtection` dans le return. La route n'envoie plus `generationType` non plus.

### BLOQUANT 2 — `semanticAnchor` absent de `RawConcept` ✅

`semanticAnchor?: string | null` correctement déclaré dans `RawConcept` des deux services (`recommendation-engine` et `api`). L'insert valide le type et sanitize la valeur (`typeof === 'string' && trim() ? trim() : null`).

---

## Points validés

- **`recommendation-engine` TSC** : `npx tsc --noEmit` — aucune erreur. ✅
- **`apps/api` TSC** : uniquement les erreurs pre-existing `accountId` dans `commands.test.ts` et `pairing.test.ts`, hors scope T123. ✅
- **`shelf-concept-mapper.ts`** : paramètre `semanticAnchor?: string | null`, forwarding `?? null`, aucune pollution T121/T122. ✅
- **`query-plan.ts`** : `semanticAnchor?: string | null` présent, `semanticProtection` absent. ✅
- **`shelf-concepts.ts` (contrat)** : `semanticAnchor?: string | null` sur `ShelfConcept`. ✅
- **`semantic-search.ts`** : dual-embedding `Promise.all`, formule `ALPHA * anchorDist + (1-ALPHA) * intentDist`, path legacy inchangé quand anchor absent. ✅
- **`config.ts`** : `SEMANTIC_ANCHOR_BLEND_ALPHA = 0.45`, env-overridable. `SEMANTIC_FLOOR_MODERATE` et autres constantes T121 intactes. ✅
- **Prompts (×2 shelf-concept + query-planner)** : instruction `semanticAnchor` identique, avec contrainte de restrictivité et langage de contraste. ✅
- **Migration SQL** : `ALTER TABLE shelf_concepts ADD COLUMN semantic_anchor TEXT;` — additive, non-breaking. ✅
- **Drizzle schemas (×2)** : `semanticAnchor: text('semantic_anchor')` nullable, sans `.notNull()`. ✅
- **`semantic-search-blend.test.ts`** : 6 cas (alpha=0/1/0.45, symétrie dist/sim, fixture temporel, fixture espace-policier), aucune dépendance DB/API. ✅
- **`pipeline-regression.test.ts`** : bloc T123 avec 2 tests `it.skipIf(!canRun)` — benchmark "Aventures" (≥4/8 temporels + false positives absents du top-5) et "Enquêtes espace" (≥3/8 composite + ≤2/5 single-theme en top-5). ✅
- **`shelf-concept-mapper.test.ts`** : 9 tests dont 3 dédiés au forwarding de `semanticAnchor` (fourni, absent, null explicite). ✅
- **`hybrid-reranker.test.ts`** : diff = trailing newline uniquement, aucun changement fonctionnel. ✅
- **Artefact `node_modules/.vite/vitest/results.json`** : supprimé du tracking git. ✅
- **Aucun hardcoding** de titre de rayon ou de film en production. ✅

---

## Risques mineurs (carry-forward, non-bloquants)

- 🟡 Double-garde `useAnchorBlend && anchorVector.length > 0` dans `semantic-search.ts` — conservatif et défensif face à une réponse OpenAI vide silencieuse. Acceptable.
- 🟡 Mots-clés de titre dans les tests de régression (`time`, `chrono`, etc.) — fragiles si le corpus fixture évolue, mais commentaire explicatif présent et corpus fixe dans le contexte CI.

---

IMPLEMENTATION_APPROVED
