# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T113/reviews/implementation-review.md
- generated at: 2026-08-19T13:24:18Z

---

I have enough information to write the review. Here is my structured assessment:

---

## PR Review — T113: Increase Semantic Retrieval Pool

## Résumé

L'implémentation est fonctionnellement correcte et bien bornée. Le commit T113 (`b2ca8af5`) ne touche que 9 fichiers, exactement dans le scope du plan. Le découplage `retrievalLimit` / `limit`, la politique `STRICT_EXCLUDE_UNKNOWN` et les counts de provenance sont tous correctement implémentés. Un seul blocage : la règle de complétion du ticket (queries réelles obligatoires) n'a pas été satisfaite.

---

## Vérifications effectuées

- Lu le plan (`runs/T113/plan.md`) et le résumé d'implémentation (`implementation-output.md`)
- Inspecté le commit T113 (`git show b2ca8af5 --stat`) : scope propre, 9 fichiers, aucun hors-plan
- Relu intégralement `config.ts`, `semantic-search.ts`, `hybrid-reranker.ts`, `pipeline.ts`, `types.ts`, `hard-filters.test.ts`, `pipeline-regression.test.ts`, `vitest.config.ts`
- Vérifié le diff exact des changements T113 dans `hybrid-reranker.ts` (avant/après)
- Vérifié les artefacts de run (`runtime.log`, dossier `reviews/`, dossier `tests/`)

---

## Points validés

**Découplage retrieval / final limit**
- `semantic-search.ts` : `retrievalLimit = Math.min(SEMANTIC_RETRIEVAL_LIMIT, SEMANTIC_RETRIEVAL_MAX_CAP)` remplace `ctx.request.limit ?? 24` dans le `LIMIT ${retrievalLimit}` de la requête pgvector. ✅
- `hybrid-reranker.ts` : `limit = ctx.request.limit ?? 24` reste le seul endroit de troncature finale. ✅
- Le `pipeline.ts` ne touche pas le chemin critique, ajoute seulement `filteredCount`/`finalCount` dans le log. ✅

**Configuration**
- `SEMANTIC_RETRIEVAL_LIMIT = Number(process.env.SEMANTIC_RETRIEVAL_LIMIT ?? 200)` — configurable, défaut 200. ✅
- `SEMANTIC_RETRIEVAL_MAX_CAP = Number(process.env.SEMANTIC_RETRIEVAL_MAX_CAP ?? 500)` — cap de sécurité. ✅
- `Math.min(200, 500) = 200` par défaut : correct. Le cap ne s'active qu'en cas de surcharge via env var.

**Politique `STRICT_EXCLUDE_UNKNOWN`**
- `maxRuntimeMinutes` : `c.durationMinutes == null → false`. ✅
- `minReleaseYear` / `maxReleaseYear` : bloc unifié, `c.year == null → false` quand l'un ou l'autre est actif. ✅
- `audioLanguages` : `c.originalLanguage == null → false`. Comparé à l'ancien code qui avait `c.originalLanguage != null` comme guard (passait les inconnus), la correction est exacte. ✅
- `HARD_FILTER_UNKNOWN_POLICY` exportée et testée.

**Provenance / debug**
- `filteredCount` capturé après `passesHardFilters`, `finalCount` après `applyDiversityFilter`, tous deux dans `StageResult` et dans le log stage et pipeline. ✅

**Tests unitaires**
- `hard-filters.test.ts` : 18 cas couvrant les 3 dimensions (runtime, year, language) avec positif, négatif, et absence de filtre. Couverture complète et correcte. ✅

**Scope**
- Le diff du commit T113 est propre : exactement les fichiers du plan, aucune dérive. Les 2 400+ lignes visibles dans `git diff main...HEAD` proviennent des travaux T110/T111/T112 portés dans la branche. ✅

---

## Problèmes détectés

### 🔴 BLOQUANT — Règle de complétion non satisfaite

Le ticket stipule explicitement :

> *"Do not close on unit tests alone. Run at least three real recommendation queries against a populated embedding index and show retrieval pool size, filtered count and final result count."*

Et dans les AC :

> *"Real query `SF qui fait réfléchir` demonstrates that personalization can reorder/select from a pool materially larger than the final shelf."*

**Constat** : aucun artefact de run réel dans `runs/T113/` (pas de logs de query, pas de output de test d'intégration). Le `pipeline-regression.test.ts` est correctement écrit mais auto-skip quand `OPENAI_API_KEY` est absent. Le `runtime.log` ne contient aucune trace d'exécution de query réelle. Cette AC est non cochée.

**Correction requise** : exécuter les 3 queries (`films populaires`, `SF qui fait réfléchir`, `aventures épiques`) contre un index peuplé, capturer l'output montrant `retrievalLimit ≈ 200`, `filteredCount < 200`, `finalCount ≤ 30`, et le versionner dans `runs/T113/tests/`.

### 🟡 MINEUR — Redondance `finalCount` / `outputCount`

Dans `StageResult` pour le reranker, `finalCount = diversified.length` et `outputCount = output.length` (= `diversified.length`). Les deux champs portent la même valeur. La lisibilité du log est légèrement améliorée mais c'est une redondance de donnée. Non bloquant.

---

## Risques éventuels

- `STRICT_EXCLUDE_UNKNOWN` sur `audioLanguages` peut éliminer des candidats valides si `originalLanguage` n'est pas indexé pour les séries (le schéma indique que `series.originalLanguage` est nullable). À surveiller si la couverture de métadonnées est faible en production.
- `Math.min(SEMANTIC_RETRIEVAL_LIMIT, SEMANTIC_RETRIEVAL_MAX_CAP)` est calculé à chaque requête. Trivial, pas de concern.

---

## Décision

- APPROVED sur la qualité du code, le scope, et la correction fonctionnelle.
- REQUEST_CHANGES sur la règle de complétion obligatoire du ticket : les queries réelles doivent être exécutées et leur output capturé avant approbation finale.

## Actions demandées

1. **Exécuter les 3 queries réelles** avec `OPENAI_API_KEY` et un index pgvector peuplé :
   - `films populaires du moment à regarder ce soir` (WATCH_NOW)
   - `SF qui fait réfléchir` (DISCOVERY)
   - `aventures épiques films et séries` (mixed)
2. **Capturer et versionner l'output** dans `runs/T113/tests/real-query-results.md` : montrer `retrievalLimit`, `filteredCount`, `finalCount` pour chaque query.
3. Optionnel (non bloquant) : supprimer le champ `finalCount` de `StageResult` si `outputCount` suffit, ou l'inverser — mais pas les deux avec la même valeur.

---

IMPLEMENTATION_FIX_REQUIRED
