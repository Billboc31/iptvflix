---

# PR Review — T111: Consolidate recommendation logic into recommendation-engine

## Résumé

L'implémentation déplace correctement les stages de pipeline (LLM planner, semantic search, hybrid reranker, shelf concept/instance generation) vers `apps/recommendation-engine`. La Home integration (`recommendations.ts`) et le client circuit-breaker (`recommendation-engine-client.ts`) sont bien architecturés. Le `EngineMetadata` est défini et propagé.

Cependant, **la route du Recommendation Lab (`expandWithLlm=true`) continue d'exécuter les services dépréciés comme chemin principal**, et ne délègue au moteur que le bloc `hybridResults` en overlay. Cela contredit directement le critère d'acceptance "Main API no longer contains a competing full recommendation implementation" et "Recommendation Lab uses that engine as its actual computation source."

---

## Vérifications effectuées

- Pipeline `recommendation-engine` : `llm-planner.ts`, `semantic-search.ts`, `hybrid-reranker.ts`, `pipeline.ts`
- Routes engine : `query.ts`, `shelf-concepts.ts`, `shelf-instances.ts`
- Couche proxy API : `recommendation-engine-client.ts`, `recommendations.ts`, `recommendation-lab.ts` (intégral)
- Contrats versionnés : `packages/api-contracts/src/engine-metadata.ts`
- Présence de tests projet (aucun trouvé)
- Diff `main...HEAD` via exploration agent

---

## Points validés

- **Pipeline engine complet** : les trois stages stub sont remplacés par des implémentations réelles (pgvector cosine similarity, OpenAI chat completion, hybrid scoring avec 7 dimensions de poids).
- **Fallback resilient** : circuit-breaker à 3 échecs / fenêtre 30s dans `recommendation-engine-client.ts`; Home et Lab disposent d'un chemin de repli local.
- **EngineMetadata** : interface versionnée dans `packages/api-contracts`, propagée dans les réponses Home et Lab (`hybridResults`).
- **Auth boundary correct** : seul le `profileId` traverse la frontière interne ; pas d'objet Profile exposé depuis l'engine.
- **Home integration propre** : `recommendations.ts` appelle le moteur en premier, tombe en fallback sur `rankRecommendations()`.
- **Marqueurs `@deprecated`** correctement posés sur les services API supplantés.
- **Sanitisation prompt-injection** : `sanitizeProfileContext()` bornant les champs string est preservée dans le Lab.

---

## Problèmes détectés

### BLOQUANT 1 — Lab `expandWithLlm=true` : services dépréciés toujours sur le chemin principal

**Fichier** : `apps/api/src/routes/recommendation-lab.ts`, lignes 462–563

Quand `expandWithLlm=true`, le Lab instancie et appelle séquentiellement :
- `new EmbeddingService(db, provider)` (déprécié)
- `new SemanticRetrievalService(db, embeddingService)` (déprécié)
- `plannerService.plan(rawQuery, profileContext)` (déprécié — singleton `LlmQueryPlannerService`)
- `retrievalService.retrieve(rawQuery, topK, plan.semanticIntent)` (déprécié, deux fois)

Ces résultats locaux peuplent le champ **`results`** de la réponse (le champ principal présenté au Lab UI). L'engine n'est appelé que pour le champ optionnel `hybridResults` quand `useHybridRanking=true` est également activé.

L'acceptance criteria "Recommendation Lab uses that engine as its **actual computation source**" et "Main API no longer contains a competing full recommendation implementation" ne sont donc **pas satisfaits**. Le Lab affiche toujours les résultats de l'ancien algorithme comme output primaire.

**Correction attendue** : pour le chemin `expandWithLlm`, appeler `RecommendationEngineClient.query({ text: rawQuery, profileId, ... })` et utiliser son résultat comme `results` primaire. Supprimer les instanciations locales de `EmbeddingService`/`SemanticRetrievalService`/`LlmQueryPlannerService` du hot path. Conserver le fallback local uniquement si le client renvoie `null`.

---

### BLOQUANT 2 — Home envoie `text: ''` au moteur de query libre

**Fichier** : `apps/api/src/routes/recommendations.ts`, ligne 49–53

```typescript
const engineResult = await RecommendationEngineClient.query({
  text: '',          // ← chaîne vide
  profileId,
  ...
})
```

L'endpoint `/v1/query` du moteur est conçu pour un free-text query. Avec `text: ''`, le LLM planner reçoit une requête vide (`rawQueryFallbackPlan('')` sera utilisé ou la réponse LLM sera générique), le text-search renvoie zéro résultat, et le semantic search embed un vecteur nul — la similarité sémantique contribue 0 pour tous les candidats. Seul le reranker profile-based fonctionne.

Fonctionnellement le reranker profile-based peut suffire pour Home, mais architecturalement c'est un abus de l'endpoint query texte, et le `plannerModelVersion` affiché dans `engineMetadata` sera mensonger ("openai/gpt-4o-mini@query-planner-v1") alors qu'aucun planning réel n'a eu lieu. Cela casse l'observabilité et la comparaison Home/Lab.

**Correction attendue** : ajouter un endpoint dédié `/v1/personalized` sur le moteur (acceptant `profileId` + `mediaTypes` + `limit` sans `text`), qui appelle directement le reranker profile-based en sautant les stages planner/semantic. Cela clarifie l'intent, donne des métadonnées correctes, et ne pollue pas les métriques de query planning.

---

### MODÉRÉ 1 — `reasons: []` : perte des explications dans les candidats engine

**Fichiers** : `recommendation-lab.ts` ligne 389, `recommendations.ts` ligne 64

```typescript
reasons: [],   // toujours vide pour les résultats engine
```

L'engine calcule des `scoreBreakdown` dans le reranker mais ne les remonte pas dans le champ `reasons` de la réponse `/v1/query`. Le Lab perd donc les explications de ranking pour les `hybridResults`. Impact UX/debug modéré mais contraire à la valeur du Lab.

---

### MINEUR 1 — `source: 'LOCAL'` incorrect pour les résultats moteur

**Fichiers** : `recommendation-lab.ts` ligne 393, `recommendations.ts` ligne 65

Les résultats provenant de l'engine sont taggés `source: 'LOCAL'`. Ce devrait être `'ENGINE'` ou une valeur distincte pour permettre à l'UI de distinguer l'origine.

---

### MINEUR 2 — Absence de tests prouvant l'équivalence Lab/Home

Le ticket stipule : "Remove dead/duplicate code only after callers have migrated **and tests prove equivalence**." Aucun fichier de test projet n'a été trouvé. Le critère d'acceptance "One query with the same Profile/config produces equivalent ordered results in Lab and product integration" n'est pas vérifiable automatiquement.

---

### MINEUR 3 — Circuit-breaker module-level non réinitialisable

**Fichier** : `apps/api/src/client/recommendation-engine-client.ts`, lignes 8–9

```typescript
let failureCount = 0
let circuitOpenUntil = 0
```

Le state du circuit-breaker est partagé entre tous les endpoints (query, shelf-concepts, shelf-instances). Un pic d'erreurs sur les shelf-concepts ouvrira le circuit et bloquera aussi les query de recommandations pendant 30s. Acceptable pour un MVP mais à documenter.

---

## Risques éventuels

- **Double coût LLM** : quand `expandWithLlm=true && useHybridRanking=true`, le Lab appelle le planner local ET le moteur (qui appelle aussi son planner). Deux appels OpenAI par requête Lab dans l'état actuel — latence et coût doublés.
- **Divergence Lab/Home** : tant que le Lab affiche des résultats locaux comme chemin principal, la comparaison Lab/Home demandée par le *completion rule* est impossible.

---

## Décision

- REQUEST_CHANGES

## Actions demandées

1. **[Bloquant]** Réécrire le chemin `expandWithLlm=true` dans `recommendation-lab.ts` pour déléguer à `RecommendationEngineClient.query()` comme source primaire (`results`). Le fallback local ne doit s'activer que si le client renvoie `null`. Supprimer les instanciations hot-path de `EmbeddingService`, `SemanticRetrievalService`, `LlmQueryPlannerService`.

2. **[Bloquant]** Soit ajouter `/v1/personalized` sur le moteur pour Home (recommandé), soit documenter explicitement que Home envoie `text: ''` et corriger le `plannerModelVersion` dans `engineMetadata` pour refléter "no-query/profile-only" au lieu du nom du modèle LLM.

3. **[Modéré]** Exposer les `scoreBreakdown` / `reasons` du reranker dans la réponse `/v1/query` pour que le Lab puisse les afficher.

4. **[Mineur]** Corriger `source: 'LOCAL'` → valeur distincte pour les résultats engine.

5. **[Mineur]** Ajouter au moins un test d'intégration ou de smoke-test prouvant que Lab et Home avec le même `profileId` et la même query retournent le même `engineVersion` et le même top-3 candidats.

---

IMPLEMENTATION_FIX_REQUIRED
