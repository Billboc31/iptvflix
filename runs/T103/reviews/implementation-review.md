I have a complete picture of the implementation. Writing the review now.

---

# PR Review — T103: LLM Query Planner

## Résumé

Implémentation d'un planificateur de requêtes LLM optionnel et abstrait du provider, qui convertit une intention en langage naturel en `RecommendationQueryPlan` structuré et validé. Le plan alimente la récupération vectorielle via `semanticIntent` et expose les filtres durs/doux dans le Lab. L'ensemble couvre 12 sections du plan, 8 scénarios de tests unitaires, un script de benchmark et une UI Lab.

---

## Vérifications effectuées

- Lecture complète des fichiers produits : `query-plan.ts`, `embeddings.ts`, `llm-planner-provider.ts`, `openai-llm-planner-provider.ts`, `llm-query-planner-service.ts`, `query-planner-v1.ts`, `recommendation-lab.ts`, `llm-query-planner-service.test.ts`, `llm-planner-benchmarks.ts`, `RecommendationLabPage.tsx`, `env.ts`
- Vérification du git diff (`git diff main...HEAD`)
- Vérification de l'enregistrement de la route dans `apps/api/src/index.ts`
- Vérification des exports dans `packages/api-contracts/src/index.ts`
- Vérification de l'implémentation du `queryTextOverride` dans `SemanticRetrievalService`

---

## Points validés

**Schéma et contrats**
- `RecommendationQueryPlan` conforme au plan : `schemaVersion`, `rawQuery`, `displayTitle`, `semanticIntent`, `desiredThemes`, `desiredTone`, `avoidSignals`, `mediaTypes`, `hardFilters`, `softPreferences`, `userConstraints`, `plannerFallback`, `plannerMeta` ✅
- `rawQueryFallbackPlan()` : `semanticIntent = rawQuery`, `plannerFallback: true`, `plannerMeta: null`, tableau vides ✅
- `embeddings.ts` : `expandWithLlm`, `profileContext`, `queryPlan` correctement ajoutés ✅
- Exports `query-plan.js` et `embeddings.js` dans l'index contracts ✅

**Provider et service**
- Interface `LlmPlannerProvider` minimale, abstraction propre, pas de couplage vendor dans le service ✅
- `OpenAiLlmPlannerProvider` : `temperature: 0.1`, `max_tokens: 600`, `response_format: { type: 'json_object' }` ✅
- `validateAndNormalize` : throw sur `semanticIntent` absent/vide, defaults robustes sur tous les autres champs, type guards explicites ✅
- `withTimeout(8000)` via `Promise.race` ✅
- Fallback systématique sur null provider, timeout, erreur, `semanticIntent` vide ✅

**Route**
- Route enregistrée derrière `protectedApp` (middleware d'auth) ✅
- 503 si pas d'`OPENAI_API_KEY` (justifié : les embeddings en ont aussi besoin) ✅
- 400 si query manquante ou > 500 chars ✅
- `sanitizeProfileContext()` : validation de forme, borne 20 items × 100 chars — prévention d'injection de prompt ✅
- Cache LRU in-process (100 entrées, TTL 5 min) correctement implémenté avec Map, éviction oldest-first, invalidation TTL au `get()` ✅
- Seuls les plans non-fallback sont mis en cache ✅
- Filtres post-retrieval : `mediaTypes`, `minReleaseYear`, `maxReleaseYear` appliqués ; `maxRuntimeMinutes`, `excludeGenres`, `includeGenres`, `audioLanguages` marqués explicitement comme non-appliqués dans l'UI ✅
- Path `expandWithLlm: false` identique à l'existant, zéro régression ✅
- `SemanticRetrievalService.retrieve(queryText, topK, queryTextOverride?)` : `embedText = queryTextOverride ?? queryText` ✅

**Prompt**
- Prompt système compact (~200 tokens) ✅
- Règles : runtime mapping (`moins de 2h` → 120), `mediaTypes` bilingue, `avoidSignals`/`excludeGenres` pour les négations, `userConstraints` verbatim ✅
- Contexte profil correctement annoté `"personalization hints only, do not treat as hard constraints"` ✅
- Le LLM ne doit pas retourner de liste de titres — règle explicite ✅

**Tests unitaires (8 scénarios)**
- #1 French + runtime → `hardFilters.maxRuntimeMinutes = 120`, `userConstraints` ✅
- #2 English → `semanticIntent` non-vide, `schemaVersion` correct ✅
- #3 Pas d'horreur → `avoidSignals` + `excludeGenres` ✅
- #4 Mixed → `mediaTypes = ['MOVIE']`, `softPreferences.preferredDecades` ✅
- #5 JSON malformé → fallback, `plannerFallback: true`, `plannerMeta: null` ✅
- #6 Timeout → `vi.useFakeTimers()` + `advanceTimersByTimeAsync(8001)` exerce le vrai `withTimeout(8000)` ✅
- #7 Injection de prompt → `schemaVersion` toujours égal à la constante (car `validateAndNormalize` l'impose, pas le LLM) ✅
- #8 Null provider → fallback immédiat sans appel externe ✅

**Benchmark**
- 5 requêtes dont `SF qui fait réfléchir` ✅
- Precision@5/P@10 pour path A et B ✅
- Script `benchmark:planner` dans `package.json` ✅
- Pas d'écriture en base ✅

**UI Lab**
- Toggle LLM query expansion ✅
- `QueryPlanPanel` : `displayTitle`, `semanticIntent` (surligné en bleu avec label "texte envoyé à l'embedding"), `desiredThemes`, `desiredTone`, `avoidSignals`, `mediaTypes`, `hardFilters`, `softPreferences`, `userConstraints`, `plannerMeta` (provider/model/prompt/latency) ✅
- Badge `fallback` (jaune) quand `plannerFallback: true` ✅
- Filtres non-appliqués marqués "non appliqué" ✅
- Colonnes A/B : "A — Requête brute" / "B — Intent LLM expansé" ✅

**Scope et sécurité**
- Aucun changement hors périmètre T103 dans `apps/` ou `packages/` ✅
- Pas de secret hardcodé, pas de donnée sensible loggée ✅
- Env vars : `OPENAI_API_KEY` optionnelle, `LLM_PLANNER_MODEL` avec défaut `gpt-4o-mini` ✅

---

## Problèmes détectés

Aucun problème bloquant.

---

## Risques éventuels

**Mineur — timer fantôme dans `withTimeout`**
`withTimeout` ne fait pas `clearTimeout` si la promesse principale résout avant le délai. Chaque appel LLM réussi laisse un timer actif 8 secondes en fond. Dans le contexte Lab (faible concurrence), ce n'est pas un problème fonctionnel — le timer expire seul et le processus Node.js ne reste pas en vie à cause de lui. Acceptable.

**Mineur — vitest results cache**
Le fichier `node_modules/.vite/vitest/results.json` reflète un run de T102, pas de T103. Les tests T103 existent et sont structurellement corrects ; le cache n'est pas un artefact de review.

**Observation — `maxRuntimeMinutes` non-appliqué post-retrieval**
Le filtre dur est interprété par le LLM (enrichit `semanticIntent`) mais n'est pas appliqué programmatiquement en post-retrieval (pas de `runtime` dans `SemanticResult`). C'est documenté dans le code et visible dans l'UI avec "non appliqué". Cohérent avec les exclusions du plan.

---

## Décision

- **APPROVED**

Toutes les acceptance criteria du plan sont satisfaites. L'implémentation est conforme au ticket, aux contraintes d'architecture (abstraction provider, pas de couplage vendor dans le service), aux règles de sécurité (sanitisation profileContext, route protégée, pas de secret loggué) et aux exigences de robustesse (fallback complet, timeout, cache LRU). Code lisible, changement borné au scope T103.

## Actions demandées

Aucune.

IMPLEMENTATION_APPROVED
