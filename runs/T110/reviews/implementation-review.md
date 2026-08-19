I have reviewed all the key files. Here is the structured review:

---

## PR Review — T110 Wire ShelfConcept through QueryPlan, semantic retrieval and hybrid reranking (retry #2)

## Résumé

Ce second passage de review fait suite à `IMPLEMENTATION_FIX_REQUIRED` sur les deux points bloquants identifiés précédemment : (1) Suite 2 ne générait que 3 shelves, (2) le seuil Jaccard dans `fillPoolAsync` était `< 1.0` au lieu de `< 0.3`. Les deux corrections ont été appliquées dans le seul fichier concerné (`home-semantic-pipeline.test.ts`). Le code de production n'a pas été modifié.

## Vérifications effectuées

- Lecture de tous les fichiers de production modifiés : `home-pool-service.ts`, `recommendation-engine-client.ts`, `pipeline/pipeline.ts`, `pipeline/stages/llm-planner.ts`, `pipeline/stages/semantic-search.ts`, `pipeline/stages/hybrid-reranker.ts`, `routes/shelf-instances.ts`
- Lecture du fichier de test `home-semantic-pipeline.test.ts` (version corrigée)
- Lecture du plan, de la review précédente et de l'artifact fix

## Points validés

| Critère d'acceptation | Statut | Détail |
|---|---|---|
| ShelfConcept intent → Query Planner | ✅ | `concept.semanticIntent` passé comme `text` à `/v1/query` → `ctx.request.text` → prompt LLM |
| QueryPlan semantic text → vector retrieval | ✅ | `semantic-search.ts` : `ctx.queryPlan?.semanticIntent ?? ctx.request.text` |
| Hard filters honorés | ✅ | `passesHardFilters()` appliqué avant scoring dans `hybrid-reranker.ts` |
| Reranking profile-aware | ✅ | `loadTasteSignals` + `loadExposureCounts` utilisés pour tout `profileId` fourni |
| Pénalité d'exposition cross-session | ✅ | `exposurePenalty = 0.05 × min(exposureCount, 4)` dans le reranker ; `excludedMediaIds` pour le dedup intra-session |
| Provenance complète stockée | ✅ | `semanticIntentSnapshot`, `queryPlannerVersion`, `embeddingModelVersion`, `rankerVersion`, `semanticScore`, `profileScore`, `finalScore`, `reasonCodes` persistés |
| WATCH_NOW filtre les items indisponibles | ✅ | `pool.filter((c) => c.available)` si `freshnessPolicy === 'AVAILABLE_NOW'` |
| Fixed shelves non affectées | ✅ | `buildFixedShelves()` appelle `getShelf('sys_continue_watching', ...)` directement |
| Endpoint `/pipeline` Recommendation Lab | ✅ | `GET /shelf-instances/:id/pipeline` retourne tous les champs requis |
| Tests : 10 shelves sémantiquement distincts | ✅ | Suite 2 appelle `fillPoolAsync(..., 10)` avec 10 concepts insérés ; assert `>= 10` ; Jaccard `< 0.3` entre toutes les paires |
| Suite 1 : Jaccard `< 0.3` direct queries | ✅ | Inchangé depuis la première implémentation |

**Corrections appliquées par rapport à la review précédente :**
- `ALL_CONCEPT_TEXTS` : 10 concepts distincts (3 d'origine + 7 nouveaux)
- `fillPoolAsync(..., 10)` au lieu de `fillPoolAsync(..., 3)`
- Assertion `>= 10` au lieu de `>= 1`
- Seuil Jaccard corrigé à `< 0.3` dans Suite 2

## Problèmes détectés

Aucun problème bloquant. Les trois observations mineures déjà signalées restent présentes mais restent non-bloquantes et acceptées :

- `excludeMediaIds` filtré côté client uniquement (l'engine peut retourner des items exclus puis les filtrer) — compensé par `requestLimit = HOME_ITEMS_PER_SHELF + excludedMediaIds.size + 10`
- `PROBE_PROFILE_ID = '00000000-...-0001'` supposé exister en base dans les environnements où le test s'exécute — la validation `profileId` dans `/v1/query` fera échouer le test explicitement si le profile est absent (comportement correct)
- Items à `originalLanguage: null` passent inconditionnellement le filtre `audioLanguages` — comportement conservateur défensif, non régressif

## Risques éventuels

Aucun risque nouveau identifié. Le circuit breaker partagé reste acceptable pour MVP (suivi sous T111 comme noté dans le code).

## Décision

APPROVED — les deux points bloquants ont été corrigés de manière minimale et chirurgicale. Le pipeline end-to-end répond à tous les critères d'acceptation du ticket.

## Actions demandées

Aucune.

---

IMPLEMENTATION_APPROVED
