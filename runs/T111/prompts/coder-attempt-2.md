# GLOBAL CONTEXT

# Global Context — Iptvflix

## Project

- project_id: iptvflix
- repo: git@github.com:Billboc31/iptvflix.git

## AI Dev Factory

This project uses AI Dev Factory for AI-assisted development.

Agent context folders:
- `ai/` — roles and skills
- `docs/` — project documentation
- `prompts/` — ticket-specific and generic prompts
- `runs/` — per-ticket runtime artifacts
- `tickets/` — ticket definitions

---

# ROLE

# Role — Coder

## Mission

Implémenter strictement un ticket en suivant le plan validé et les skills applicables.

## Tu dois

- lire le ticket
- lire le plan validé
- respecter le scope
- lister les fichiers créés ou modifiés
- produire un changement minimal, lisible et testable
- ajouter ou adapter les tests si nécessaire
- signaler les hypothèses et limites

## Tu ne dois pas

- élargir le ticket
- réécrire l’architecture sans demande explicite
- faire un refactor massif non demandé
- modifier la mémoire projet sauf si le ticket le demande explicitement
- masquer les erreurs ou incertitudes

## Sortie attendue

- résumé des changements
- liste des fichiers modifiés
- vérifications effectuées
- limites connues

## Règles

- coder uniquement après `PLAN_APPROVED`
- ne jamais contourner les contraintes du plan
- garder les changements petits et reviewables

---

# SKILL: workflow-discipline

# Skill — Workflow Discipline

## Objectif

Faire respecter le lifecycle officiel des tickets et PR IA.

## Règles

- respecter l’ordre des étapes du workflow
- ne pas bypass les reviews obligatoires
- maintenir les statuts cohérents
- conserver les artefacts versionnés
- séparer plan, implémentation et mémoire

## Refuser si

- une review obligatoire est sautée
- la mémoire est mise à jour avant validation implémentation
- le workflow officiel est contourné

---

# SKILL: git-discipline

# Skill — Git Discipline

## Objectif

Maintenir un historique Git propre, compréhensible et traçable.

## Règles

- un ticket = une unité de travail cohérente
- éviter les commits mélangeant plusieurs sujets
- utiliser des messages de commit explicites
- conserver les PR lisibles
- éviter les modifications hors scope
- maintenir les fichiers mémoire cohérents avec les changements réels

## Refuser si

- la PR mélange plusieurs fonctionnalités
- des changements non liés sont ajoutés
- les commits deviennent impossibles à reviewer

---

# SKILL: code-quality

# Skill — Code Quality

## Objectif

Produire des changements simples, lisibles, robustes et faciles à reviewer.

## Règles

- privilégier le code simple avant le code sophistiqué
- utiliser des noms explicites
- garder des fonctions courtes et lisibles
- éviter la magie cachée
- gérer les erreurs explicitement
- ajouter des logs utiles sans bruit excessif
- éviter les dépendances inutiles
- conserver un changement borné au ticket

## Refuser si

- le code devient inutilement complexe
- le ticket introduit une dépendance non justifiée
- les erreurs sont masquées
- les changements dépassent le scope demandé

---

# SKILL: refactor-safety

# Skill — Refactor Safety

## Objectif

Limiter les régressions et les dérives de scope lors des modifications.

## Règles

- modifier uniquement le périmètre demandé
- éviter les refactors transversaux implicites
- préserver les comportements existants
- maintenir la compatibilité sauf demande explicite
- privilégier des changements incrémentaux

## Refuser si

- le ticket dérive vers une réécriture globale
- plusieurs couches sont modifiées sans justification
- le comportement change silencieusement

---

# SKILL: security

# Skill — Security

## Objectif

Réduire les risques de sécurité et éviter les comportements dangereux.

## Règles

- ne pas exposer de secrets dans logs ou documentation
- limiter les permissions au strict nécessaire
- éviter les exécutions implicites dangereuses
- valider les entrées externes
- documenter les impacts sécurité importants
- éviter les comportements destructifs implicites

## Refuser si

- des secrets sont hardcodés
- des données sensibles sont logguées
- une opération destructive n’est pas explicitement contrôlée

---

# TASK

# Generic Coder Task

Read the ticket and the approved plan below, then implement the required changes.

The implementation must:
- follow the approved plan strictly
- remain within scope
- list all created or modified files
- be minimal, readable, and testable

The ticket follows.


# T111 — Consolidate recommendation logic into the standalone recommendation-engine

**Source**: GitHub Issue #233

## Description

## Context

The repository currently contains two partially overlapping recommendation implementations:

- `apps/recommendation-engine`, intended by #204 to be the standalone/queryable source of truth, but parts of its planner/vector pipeline are still stubbed/incomplete;
- real recommendation logic implemented inside `apps/api` (embedding service, semantic retrieval, LLM query planning, profile-aware ranking, shelf history/Home integration).

This duplication makes the Recommendation Lab misleading and creates a high risk that Home and Lab evaluate different algorithms.

## Goal

Make `apps/recommendation-engine` the single source of truth for recommendation computation, while `apps/api` becomes a thin authenticated/product integration layer.

Target architecture:

```text
IPTVFlix canonical DB / profiles / interaction data
                ↓
      recommendation-engine
      - Query Planner
      - semantic retrieval
      - hybrid reranker
      - shelf concept generation
      - shelf instance generation
                ↑
       internal versioned API
          ↙             ↘
IPTVFlix API/Home     Recommendation Lab
```

## Required work

- Inventory duplicate recommendation services in `apps/api` and `apps/recommendation-engine`.
- Move/extract the working implementations rather than rewriting them from scratch.
- Remove/replace stub semantic-search/query-planner behavior in the standalone engine.
- Define versioned internal contracts for:
  - free-text recommendation query;
  - QueryPlan/debug output;
  - semantic candidate retrieval;
  - personalized reranking;
  - shelf concept preview/generation;
  - final ShelfInstance generation.
- Update the Recommendation Lab to call the standalone engine directly (or through one explicitly thin authenticated proxy), not a separate in-API algorithm.
- Update Home/recommendation integration to consume the same standalone engine outputs.
- Keep authentication/account authorization in the main API where appropriate; do not expose private Profile data publicly from the engine.
- Preserve resilient fallback behavior if recommendation-engine is temporarily unavailable.
- Remove dead/duplicate code only after callers have migrated and tests prove equivalence.

## Observability/versioning

Every recommendation result should expose internally/debug:
- engine version;
- embedding model/index version;
- planner model/prompt/schema version;
- reranker version;
- timings per stage;
- fallback flags.

This allows Home and Lab output to be compared exactly.

## Acceptance criteria

- [ ] Standalone `recommendation-engine` performs real LLM planning, vector retrieval and hybrid ranking; no production stage remains a stub.
- [ ] Recommendation Lab uses that engine as its actual computation source.
- [ ] Personalized Home uses the same engine as the Lab.
- [ ] Main API no longer contains a competing full recommendation implementation.
- [ ] One query with the same Profile/config produces equivalent ordered results in Lab and product integration.
- [ ] Missing recommendation-engine does not break authentication, playback, Continue Watching or basic catalog browsing.
- [ ] Internal Profile access is authorization-safe.
- [ ] Engine/version/timing metadata is observable.

## Completion rule

Do not close because an HTTP client was added. Run `SF qui fait réfléchir` with a real Profile through the Lab and through the product integration and demonstrate both paths invoke the same engine version and return the same ranked recommendation result (allowing only presentation-level differences).

---

## Contexte de retry injecté par run_ticket.py

## Output précédent

All tasks complete. The workspace type-checks cleanly across all 7 packages. Here's a summary of what was done in this session continuation:

**Task 8 — API routes updated to delegate to engine:**
- `apps/api/src/config/env.ts`: Added `RECOMMENDATION_ENGINE_URL` export
- `apps/api/src/routes/recommendations.ts`: Tries `RecommendationEngineClient.query()` first; falls back to `rankRecommendations()` when engine unavailable
- `apps/api/src/routes/recommendation-lab.ts`: Both `useHybridRanking` blocks (LLM-expanded and default paths) now call `RecommendationEngineClient.query()` first; fall back to local `rankHybrid()` + `enrichAsHybridCandidates()` when engine unreachable
- `apps/api/src/routes/shelf-concepts.ts`: `generate` and `getActivePool` endpoints proxy to engine; `feedback` stays as local DB write
- `apps/api/src/routes/shelves.ts`: `POST /shelves/generate` and `POST /shelves/:id/refresh` proxy to engine with local fallback

**Task 9 — Deprecation markers added** (`// @deprecated — use recommendation-engine`) to:
- `embedding-service.ts`, `semantic-retrieval-service.ts`, `llm-query-planner-service.ts`, `openai-llm-planner-provider.ts`, `shelf-concept-generator-service.ts`, `shelf-generation-service.ts`
- `rankHybrid()` in `recommendation-ranking-service.ts` (JSDoc `@deprecated`)

**Bug fixed:** `shelfConcepts.id` in the engine's schema was missing `.defaultRandom()`, causing a TS insert error.

---

## Review

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

---

## Instructions de fix

# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T111/reviews/implementation-review.md
- generated at: 2026-08-19T09:42:25Z

---

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