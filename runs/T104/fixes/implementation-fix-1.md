# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T104/reviews/implementation-review.md
- generated at: 2026-08-18T10:43:14Z

---

I now have enough information to write the complete review.

---

# PR Review — T104: Hybrid Recommendation Reranking

## Résumé

The implementation adds a pure-function `rankHybrid` engine on top of the existing `rankRecommendations`, wires it into the Lab route, and covers the ticket's core requirements: versioned weights, hard eligibility filters, profile taste signals, negative penalties, diversity capping, exploration levels, and debug score breakdown. The test suite is comprehensive (29 new tests across two files, all pre-existing tests intact).

One structural defect requires a fix before approval: the debug `ScoreBreakdown.final` is computed from six penalty terms but only three of them appear as labelled fields. The exposed components don't reconstruct the final score, directly undermining the explainability requirement.

## Vérifications effectuées

- `recommendation-ranking-service.ts` — full scoring pipeline, weight blending, hard filters, diversity
- `recommendation-lab.ts` — hybrid path, DB helpers, response shape
- `packages/api-contracts/src/recommendations.ts` — `ScoreBreakdown` interface
- `packages/api-contracts/src/query-plan.ts` — `RecommendationQueryPlan`, `rawQueryFallbackPlan`
- `recommendation-ranking-service.test.ts` — scenarios 11–16
- `recommendation-ranking-benchmark.test.ts` — deterministic benchmark

## Points validés

| Critère | Statut |
|---|---|
| `rankHybrid` exported, accepts `HybridCandidate[]` with similarity | ✓ |
| `SCORE_MODEL_V1` — tous les poids nommés, zéro constante magique | ✓ |
| Filtres hard (mediaTypes, runtime, year, genres, language, WATCH_NOW) | ✓ |
| Profils A et B produisent un top-5 avec overlap ≤ 3 (scenario 11 + benchmark) | ✓ |
| `negativeMediaIds` hors top-10 quand 10+ alternatives (scenario 13) | ✓ |
| Abandon (< 0.2) ≠ dislike (large) — signaux bien distincts | ✓ |
| `avoidSignals` → pénalité thématique | ✓ |
| Exploration levels (exploit / explore / discover) avec blending correct | ✓ |
| Diversity (franchise ≤ 2, directeur ≤ 3, alreadyShownIds) | ✓ |
| Lab retourne `results` + `hybridResults` + `compareProfileHybridResults` | ✓ |
| `debug: true` → `scoreBreakdown.modelVersion = 'v1'` + `reasons.length ≥ 1` | ✓ |
| `rankRecommendations` signature inchangée (rétrocompat) | ✓ |
| Sanitisation `profileContext` préservée dans le lab | ✓ |
| 29/29 nouveaux tests + 23 scénarios existants passent | ✓ |

## Problèmes détectés

### Bloquant — Score breakdown mathématiquement incohérent

**Fichier** : `apps/api/src/services/recommendation-ranking-service.ts` lignes 629–630 et 648–664

Le `finalScore` est calculé avec six termes de pénalité :

```ts
const finalScore =
  weighted - watchedPenalty - abandonPenalty - dislikePenalty - avoidPenalty - shownPenalty
```

Mais `ScoreBreakdown` n'expose que trois d'entre eux :

```ts
alreadyWatchedPenalty: watchedPenalty,   // ✓
dislikedPenalty: dislikePenalty,          // ✓
repetitionPenalty,                        // = shownPenalty ✓
// abandonPenalty (-0.1) — absent
// avoidPenalty   (-0.2) — absent
```

Conséquence : `breakdown.final` ne peut pas être reconstitué en additionnant les composantes exposées. Un item qui matche un `avoidSignal` et a été brièvement abandonné se voit silencieusement pénalisé jusqu'à -0.3 points sans que le breakdown l'explique. `buildReasons` ne mentionne pas non plus l'abandon.

Le ticket (§8) exige "score components" et montre un exemple JSON où `final` se reconstruit à partir des champs listés. L'acceptance criterion est "Every debug result has explainable score components". Cette cohérence n'est pas respectée.

**Correction attendue** : ajouter `abandonPenalty` et `avoidPenalty` (ou `themeAvoidPenalty`) à `ScoreBreakdown` dans `packages/api-contracts/src/recommendations.ts`, les peupler dans le bloc debug, et ajouter une entrée dans `buildReasons` quand `avoidPenalty > 0`.

---

### Mineur — `modelVersion` du body lab non utilisé

**Fichier** : `apps/api/src/routes/recommendation-lab.ts` ligne 293

Le champ `modelVersion?: string` est parsé depuis le body mais n'est jamais transmis ni validé. Le Lab annonce ce contrôle (plan §9) mais l'implémentation l'ignore silencieusement. Soit le supprimer de l'interface jusqu'à ce qu'un deuxième modèle existe, soit retourner une erreur 400 si la valeur reçue n'est pas `"v1"`.

---

### Mineur — `alreadyShownIds` non exposé dans le lab

**Fichier** : `apps/api/src/routes/recommendation-lab.ts` lignes 388–390 (les deux blocs `rankingOpts`)

`RankingOptions.alreadyShownIds` existe mais n'est jamais alimenté depuis le body du lab. Ce n'est pas un critère d'acceptance mais le plan (§7) le mentionne comme contrôle lab.

---

### Observation — Filtre maturité/kids absent

Le plan (§2) liste "Profile maturity restriction (from `profilePreferences.kidsMode / maxCertification`)" comme filtre hard. Ni `HybridCandidate` ni `TasteSignals` n'ont de champ certification. Techniquement bloqué par l'absence de donnée dans le schéma DB. Non listé dans la section "Excluded" du plan. L'impact est nul à court terme, mais ce filtre devrait être documenté comme deferred (ex. commentaire inline ou mise à jour de la section Excluded).

## Risques éventuels

- L'inconsistance du breakdown pourrait faire douter les utilisateurs Lab de la fiabilité du système de scoring si les chiffres ne s'additionnent pas. Risque faible en production (debug désactivé) mais présent en Lab.
- Les pénalités `abandonPenalty` et `avoidPenalty` influencent réellement le ranking en production sans être visibles dans le log de debug.

## Décision

- REQUEST_CHANGES

## Actions demandées

1. **Obligatoire** — Ajouter `abandonPenalty` et `avoidPenalty` (ou les regrouper sous `avoidSignalPenalty`) à l'interface `ScoreBreakdown` dans `recommendations.ts`, les renseigner dans le bloc `scoreBreakdown` de `rankHybrid`, et couvrir leur présence dans `buildReasons` (au moins "quick abandon penalty" et "theme avoid match").
2. **Obligatoire** — S'assurer que `ScoreBreakdown.final` vérifie l'égalité avec la somme des composantes exposées (peut être un test unitaire dédié : `expect(bd.final).toBeCloseTo(bd.semantic * w.wSemantic + ... - bd.alreadyWatchedPenalty - bd.dislikedPenalty - bd.repetitionPenalty - bd.abandonPenalty - bd.avoidPenalty)`).
3. **Recommandé** — Supprimer `modelVersion` du body de la route lab ou ajouter une validation 400 si la valeur n'est pas `"v1"`.
4. **Optionnel** — Documenter le filtre maturité comme deferred dans le plan ou ajouter un commentaire `// TODO(T1xx): kidsMode/maxCertification filter requires certification field in HybridCandidate`.

IMPLEMENTATION_FIX_REQUIRED
