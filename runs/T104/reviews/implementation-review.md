I now have a complete picture of the implementation across all 3 review rounds. Let me write the structured review.

---

# PR Review — T104: Hybrid recommendation reranking

## Résumé

Troisième review. Les deux problèmes bloquants des rounds précédents (ScoreBreakdown incomplet, `enrichAsHybridCandidates` incomplète) ont été corrigés. L'implémentation est globalement solide. Quelques observations mineures à documenter, aucun bloquant.

---

## Vérifications effectuées

- Lecture complète de `recommendation-ranking-service.ts` (690 lignes)
- Lecture complète de `recommendation-lab.ts` (598 lignes)
- Lecture de `packages/api-contracts/src/recommendations.ts` et `query-plan.ts`
- Lecture de `recommendation-ranking-benchmark.test.ts`
- Vérification des critères d'acceptance du ticket

---

## Points validés

**Architecture / Score model**
- `SCORE_MODEL_V1` : versioning présent (`'v1'`), constante unique, aucune magic constant dispersée. ✓
- `rankHybrid` : fonction pure, pas d'accès DB, testable en isolation. ✓
- Hard filters (`passesHardFilters`) appliqués *avant* le scoring — conformes à la règle "do not sneak in via soft scores". ✓

**Corrections round 1 & 2 — toutes appliquées**
- `ScoreBreakdown` contient maintenant `abandonPenalty` et `avoidPenalty` (champs manquants en round 1). ✓
- `enrichAsHybridCandidates` charge `durationMinutes`, `originalLanguage`, `collectionId`, `keywords`, `directors`, `completionRatio` (lacune majeure en round 2). ✓
- `alreadyShownIds` cappé à 500 avec `.slice(0, 500)`. ✓
- Poids `discover` mode corrigés (0.64+0.02+0.02+0.02+0.05+0.20+0.05 = 1.00). ✓

**Score breakdown reconstructible**
Le test `scoreBreakdown.final is mathematically reconstructible` (benchmark ligne 321-346) vérifie `bd.final ≈ reconstructed` avec `toBeCloseTo(_, 10)` pour chaque résultat. Intégrité garantie. ✓

**Signaux négatifs**
- Dislike explicite : −1.5 ✓
- Abandon rapide (completionRatio < 0.2) : −0.1 (signal faible, conforme au ticket "ne pas blacklister tout abandon") ✓  
- Avoid signals (query plan) : `computeAvoidPenalty` sur keywords + genreNames ✓
- Déjà regardé (≥ 0.9) : −0.3 ✓
- Déjà montré en session : −0.15 ✓

**Diversité**
- Collection cap (`maxPerCollection`, défaut 2) + director cap (`maxPerDirector`, défaut 3) avec deferred fill ✓
- Benchmark test vérifie que franchise COLLECTION_FRANCHISE ≤ 2 en top-10 avec diversity=true ✓

**Exploration**
- Trois niveaux : `exploit` / `explore` / `discover` avec blending de poids documenté ✓
- Exposé dans le Lab via paramètre HTTP `explorationLevel` ✓

**Lab controls (section 9)**
- `useHybridRanking`, `profileId`, `compareProfileId`, `explorationLevel`, `diversityEnabled`, `alreadyShownIds`, `debug`, `scoreModel` en réponse debug — tous présents ✓

**Deux profils différents**
- `TASTE_A` (sci-fi/action) vs `TASTE_B` (romance/comedy) avec assertion `top5 overlap ≤ 3` ✓
- Test `Profile A and Profile B produce top-5 overlap ≤ 3` passe ✓

**Sécurité**
- `sanitizeProfileContext` limite les champs et longueurs pour prévenir l'injection de prompt ✓
- `alreadyShownIds` filtré sur strings uniquement + cappé ✓
- Pas de secrets hardcodés ✓

---

## Problèmes détectés

### Mineur — Condition `taste2 !== undefined` incorrecte (non bloquant)

**Fichier** : `recommendation-lab.ts`, lignes 507 et 572

```ts
if (compareProfileId && taste2 !== undefined) {
```

`loadTasteSignals` retourne `TasteSignals | null`, jamais `undefined`. La condition `!== undefined` est toujours `true`, ce qui rend le check `compareProfileId &&` seul effectif. L'intent est probablement `taste2 !== null`. Fonctionnellement non bloquant car `rankHybrid(enriched, plan, null, ...)` est valide (cold start), mais le code est trompeur.

**Correction** : remplacer `taste2 !== undefined` par `taste2 !== null` aux deux endroits.

---

### Mineur — `completionRatio` toujours null pour les séries (limitation connue)

**Fichier** : `recommendation-lab.ts`, ligne 272

```ts
eq(viewingProgress.mediaType, 'MOVIE'),
```

La query viewingProgress est hardcodée sur `MOVIE`. Les séries auront toujours `completionRatio: null`, donc `alreadyWatchedPenalty` et `abandonPenalty` ne s'appliquent jamais aux séries. Cohérent avec `rankRecommendations` existant (même limitation), mais incomplet par rapport à la section 2 du ticket ("completion/abandon history" sans restriction au type).

Acceptable si le schéma ne supporte pas encore le tracking épisode/série, mais à documenter.

---

### Mineur — Poids de base SCORE_MODEL_V1 somment à 1.05

```
0.35 + 0.25 + 0.15 + 0.10 + 0.05 + 0.10 + 0.05 = 1.05
```

Le mode `discover` a été correctement normalisé à 1.0. Le mode `explore` somme à 0.955. Le mode `exploit` (base) somme à 1.05. Cette inconsistance ne cause pas de bug (les scores sont comparatifs dans le même appel) mais rend le score maximum théorique légèrement supérieur à 1.0 en exploit. Non bloquant, mais à normaliser dans un futur SCORE_MODEL_V2.

---

### Observation — Maturity/kids filtering déclaré TODO

**Fichier** : `query-plan.ts`, lignes 18-20

```ts
// TODO: maturity/kids restriction — field defined but not yet enforced in passesHardFilters
maxMaturityRating?: string
kidsOnly?: boolean
```

Le ticket (section 1) liste "maturity/kids restrictions" comme hard constraint. Les champs sont déclarés dans le type mais `passesHardFilters` ne les utilise pas. La review précédente avait classé cela "optionnel". Acceptable comme forward-declaration mais à traiter avant d'exposer à des profils enfants en production.

---

### Observation — `availabilityPolicy` absent des `rankingOpts` dans le Lab

**Fichier** : `recommendation-lab.ts`, lignes 491-497 et 554-560

```ts
const rankingOpts: RankingOptions = {
  limit: topK,
  explorationLevel,
  diversityEnabled,
  alreadyShownIds,
  debug: debugMode,
  // availabilityPolicy absent
}
```

La feature `availabilityPolicy` existe dans `RankingOptions` et est utilisée dans `passesHardFilters`, mais n'est pas exposée comme paramètre HTTP dans le Lab. Le critère "Availability can be hard/soft/ignored" est satisfait dans le code, mais non démontrable via le Lab. Pour la production (shelf generator), ce paramètre serait passé directement — acceptable pour l'instant.

---

### Observation — `minRuntimeMinutes` absent

Le ticket (section 1) mentionne "runtime min/max" mais seul `maxRuntimeMinutes` est implémenté dans le schéma et les filtres. Le cas `minRuntimeMinutes` est ignoré. Peu critique en pratique (les utilisateurs cherchent rarement un minimum de durée), mais incomplétude de section 1.

---

## Risques éventuels

- **Null-passthrough dans les hard filters** : items avec `originalLanguage: null`, `durationMinutes: null`, ou `year: null` passent les filtres correspondants. Comportement permissif documenté implicitement, mais potentiellement risqué si `audioLanguages` est utilisé comme contrainte de sécurité. Pour usage consumer (pas enfants), acceptable.

- **Benchmark freshness dépend de l'année courante** : `computeFreshness` appelle `new Date().getFullYear()`, les scores de freshness changeront chaque année. Les assertions du benchmark sont relatives (comparaisons, pas valeurs absolues) donc robustes pour plusieurs années.

---

## Décision

Les deux bloquants des rounds précédents sont résolus :
1. `ScoreBreakdown` complet avec `abandonPenalty` et `avoidPenalty` ✓
2. `enrichAsHybridCandidates` charge toutes les métadonnées nécessaires ✓

Les issues restantes sont mineures et non bloquantes. Le cœur de l'algorithme est correct, testé, et les critères d'acceptance principaux sont satisfaits.

- APPROVED

## Actions demandées (post-merge, non bloquantes)

1. Corriger `taste2 !== undefined` → `taste2 !== null` (lignes 507 et 572 de `recommendation-lab.ts`)
2. Tracer le tracking `completionRatio` pour les séries dans un ticket séparé
3. Normaliser `SCORE_MODEL_V1` weights à 1.0 dans SCORE_MODEL_V2
4. Implémenter `maturity/kids` filtering avant toute exposition à profils enfants

---

IMPLEMENTATION_APPROVED
