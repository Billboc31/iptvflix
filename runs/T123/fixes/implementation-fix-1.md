# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T123/reviews/implementation-review.md
- generated at: 2026-08-23T16:25:59Z

---

---

# PR Review — T123: Improve semantic retrieval precision for thematic shelf intent

## Résumé

L'implémentation du cœur T123 (dual-embedding avec blend dans `semantic-search.ts`, champ `semanticAnchor` sur schéma/prompts, constante `SEMANTIC_ANCHOR_BLEND_ALPHA`) est **correcte et bien structurée**. Cependant, deux problèmes bloquants empêchent l'approbation.

---

## Points validés

- **Dual-embedding `semantic-search.ts`** : `embedQuery` appelés en parallèle (`Promise.all`), formule `ALPHA * anchorDist + (1-ALPHA) * intentDist` correcte, path legacy (sans anchor) byte-for-byte identique, guard `anchorVector.length > 0` correct.
- **`SEMANTIC_ANCHOR_BLEND_ALPHA=0`** reproduit exactement le comportement actuel — critère d'acceptance respecté.
- **Schema/migration** : `semantic_anchor TEXT` nullable dans les deux schémas Drizzle, migration additive non-breaking.
- **Prompts LLM** : instructions d'extraction claire avec contrainte de restrictivité, langage de contraste, propagés dans les deux services.
- **Tests blend** : 7 tests unitaires purs (`semantic-search-blend.test.ts`) sans DB ni API — couvrent les cas limites. 3 tests mapper corrects.
- **Benchmark "Aventures à travers le temps"** : assertion ≥4/8 titres temporels + false positives absents du top-5.

---

## Problèmes détectés

### 🔴 BLOQUANT 1 — Artefact `node_modules` commité

`apps/recommendation-engine/node_modules/.vite/vitest/results.json` est dans le diff. Ce fichier de cache vitest ne doit jamais être commité.

### 🔴 BLOQUANT 2 — Drift de scope dans `hybrid-reranker.ts` et fichiers de contrats

Le plan T123 dit explicitement :
> *"Excluded: Changing `hybrid-reranker.ts` scoring weights, `SCORE_MODEL_V2`, or profile-boost modulation."*

Le diff inclut des ajouts substantiels non planifiés appartenant à T121/T122 :

| Fichier | Ajout hors scope |
|---|---|
| `hybrid-reranker.ts` | `resolveProtectionSettings`, `passesSemanticFloor`, `computeSemanticConfidenceFactor`, blend `thematic`, filtrage `semanticFloor`, modulation `profileBoostEffective`, 12 champs breakdown |
| `query-plan.ts` | `semanticProtection?: 'strict' \| 'moderate' \| 'none'` |
| `config.ts` | `SEMANTIC_FLOOR_STRICT`, `SEMANTIC_FLOOR_MODERATE`, `SEMANTIC_WEIGHT_THEMATIC`, `PROFILE_BOOST_MIN_FACTOR`, `PROFILE_BOOST_MODULATION_POWER` |
| `recommendations.ts` | 8 champs optionnels `ScoreBreakdown` T121/T122 |

Si T121/T122 ne sont pas encore sur main, ces changements doivent soit faire l'objet d'une justification explicite, soit être retirés.

### 🟡 MINEUR — Test "Enquêtes policières dans l'espace" incomplet

La describe annonce `"space-detective candidates dominate over pure space or pure detective results"` mais le test ne contient aucune assertion de ce type — uniquement des vérifications génériques (floor, breakdown peuplé, modulation). Le critère d'acceptance T123 ("defining anchor concept dominates over each secondary theme independently") n'est pas vérifié pour ce second intent.

### 🟡 MINEUR — Détection titre temporel par mots-clés fragile

`'time'` peut matcher des titres non temporaux selon le corpus. Acceptable avec corpus fixe, mais mérite un commentaire.

---

## Actions demandées

1. Supprimer `node_modules/.vite/vitest/results.json` du commit.
2. Retirer (ou justifier explicitement) les changements `hybrid-reranker.ts`, `semanticProtection`, constantes T121/T122, et champs `ScoreBreakdown` T121/T122.
3. Compléter le test "Enquêtes policières dans l'espace" avec une assertion que les candidats composites dominent les candidats thème individuel.

---

IMPLEMENTATION_FIX_REQUIRED
