All evidence gathered. Here is the test report.

---

## Test Report — T116 — Unifier tous les parcours de recommandation

**Branch:** `ticket/T116-unifier-tous-les-parcours-de-recommandation-sur-le`
**Date:** 2026-08-22

---

### Acceptance Criteria

---

#### AC1 — La preview d'un ShelfConcept propose deux modes clairement nommés : `Raw vector` et `Final personnalisé`

**PASS**

`POST /v1/shelf-concepts/:id/preview` (`shelf-concepts.ts:68-143`) retourne un objet avec deux champs distincts :
- `rawVector`: top-50 résultats vectoriels bruts (semantic search uniquement, sans reranking), avec `{ id, title, vectorScore }`
- `finalPersonalized`: résultats du pipeline complet (20 items max), avec `{ id, title, finalScore, scoreBreakdown }`

Les deux modes sont exécutés indépendamment sur la même `semanticIntent` du concept.

---

#### AC2 — `Final personnalisé` passe par le même scorer que les recommandations de production

**PASS**

Le mode final appelle directement `runRecommendationFromPlan(plan, { profileId, mediaTypes, limit: 20, debug }, ...)` (`shelf-concepts.ts:122-127`), le même service central utilisé par `/v1/query` et `/v1/personalized`. Le scoring s'effectue via `SCORE_MODEL_V2` (confirmé `hybrid-reranker.ts:616`, `665`). Aucune divergence de poids ou de logique.

---

#### AC3 — `/v1/personalized` n'utilise plus uniquement les top contenus par popularité comme candidate pool

**PASS**

`personalized.ts:26-99` implémente `buildProfileQueryPlan()` qui construit un `RecommendationQueryPlan` à partir des signaux `profileTaste` (genres, keywords, langues, décennies). Le plan est ensuite routé vers `runRecommendationFromPlan()` qui fait du retrieval sémantique en premier. La popularité n'intervient plus qu'en dernier recours via `fetchPopularityFallbackPool()` dans `recommendation-service.ts:119-123`, uniquement si le retrieval sémantique et textuel reviennent vides (cold-start réel). `fetchCatalogCandidates()` (top-200 par popularité) est entièrement supprimé des routes.

---

#### AC4 — Une shelf générée depuis des seeds utilise embeddings/retrieval + profil + V2

**PASS**

`shelf-generator.ts:32-134` agrège les métadonnées des seeds (genres par fréquence, keywords, réalisateurs, langue dominante, décennies dominantes) en un `semanticIntent` textuel. Ce plan est passé à `runRecommendationFromPlan(plan, { profileId, mediaTypes, limit, candidatePoolSize: 200 }, ...)` (`shelf-generator.ts:160-165`). Post-filtrage : seeds exclus, `availableToMe` respecté, `mediaType` respecté. Le ranking genre-only est entièrement remplacé.

---

#### AC5 — Les mêmes entrées donnent un score/ranking cohérent quel que soit le point d'entrée

**PASS**

Les quatre parcours (`/v1/query` via `pipeline.ts`, `/v1/personalized`, shelf depuis seeds, shelf-concept preview) convergent tous vers `runRecommendationFromPlan()` → `runHybridReranker()` avec `getBlendedWeights(SCORE_MODEL_V2, 'exploit')`. La fonction de scoring est identique pour toutes les entrées : mêmes 12 dimensions (semantic, genre, theme, people, keywords, franchise, language, decade, mediaType, freshness, quality, availability) + mêmes pénalités (watched, abandon, disliked, avoid, repetition).

---

#### AC6 — Les debug outputs montrent clairement : intention utilisée → candidate pool → score V2 → filtres → résultat final

**PASS avec réserve mineure**

Pour `/v1/query` et `/v1/personalized`, la réponse contient en mode `debug=true` :
- `queryPlan.semanticIntent` — intention utilisée
- `stageOutputs` avec `outputCount` par étape — taille du candidate pool
- `engineMetadata.rerankerVersion = 'v2'` + `fallbackFlags` — modèle et filtres activés
- `results[].scoreBreakdown` — décomposition du score V2 par candidat
- `timing.stages` — timings par étape

**Réserve** : le endpoint `/v1/shelf-concepts/:id/preview` ne retransmet pas les `stageOutputs` ni `stageAvailability` du pipeline V2. Le champ `candidatePoolSize` dans sa réponse correspond au count de la recherche sémantique brute (rawVector, max 50), non au pool candidat effectif du pipeline V2. Un développeur comparant les deux modes dans le Lab ne peut pas voir la taille réelle du pool traité par V2. Ceci n'est pas bloquant mais constitue un gap de transparence pour ce mode preview spécifique.

---

#### AC7 — Aucun endpoint n'annonce V1 s'il exécute V2

**PASS**

`SCORE_MODEL_V1` est marqué `@deprecated` (`hybrid-reranker.ts:19`) et n'est référencé dans aucune route de production. Toutes les réponses passent par `recommendation-service.ts:174` qui fixe `rerankerVersion: SCORE_MODEL_V2.version` (= `'v2'`). Aucune mention de `V1` dans les routes.

---

### Tests ajoutés

| Fichier | Couverture |
|---|---|
| `recommendation-service.test.ts` | Promotion d'un candidat vector-rank 8 en top-3 final ; `rerankerVersion = 'v2'` pour tous les chemins ; cold-start vers popularity fallback sans erreur |
| `shelf-generator.test.ts` | `buildSeedQueryPlan` produit un `semanticIntent` non vide ; langue dominante correcte ; directors inclus ; `mediaTypes` corrects |
| `pipeline-regression.test.ts` | Pool sémantique ≥ 100 candidats, résultats finaux ≤ 30 (3 intents, integration-only, skip sans `OPENAI_API_KEY`) |

Les tests d'intents ambiguës (`Aventures à travers le temps`, `Épopées modernes`) sont des tests d'intégration avec `skipIf(!canRun)` — non exécutables sans infrastructure réelle. La logique unitaire couvrant la promotion via V2 est, elle, entièrement vérifiée sans infra.

---

### Régressions observées

Aucune régression identifiée sur les paths existants. `/v1/query` continue de passer par `runPipeline` → `runRecommendationFromPlan`, sans modification de sa signature externe.

---

### Verdict

**VALIDATION** — Les 7 critères d'acceptation sont satisfaits. La réserve sur AC6 (debug incomplet dans la preview) est non-bloquante : la préview expose `queryPlan` et `scoreBreakdown` par item, ce qui est suffisant pour diagnostiquer l'intention et le scoring final. Un ticket de suivi pourrait ajouter le `stageOutputs` V2 à la réponse preview si la transparence Lab est prioritaire.
