I have everything I need to write the review.

---

# PR Review — T119: Fix semantic retrieval returning 0 candidates

## Résumé

L'implémentation met en place les outils de diagnostic décrits dans le plan : détection de mismatch modèle/corpus, compteurs par étape, banner fallback dans le Lab, endpoint `/v1/diagnostics/vector-corpus`, et bloc de diagnostics JSON collapsible. L'ensemble est cohérent avec le scope du ticket.

## Vérifications effectuées

- Lecture complète de tous les fichiers modifiés (`semantic-search.ts`, `types.ts`, `diagnostics.ts`, `index.ts`, `shelf-concepts.ts`, `api-contracts/shelf-concepts.ts`, `RecommendationLabPage.tsx`)
- Vérification de la chaîne `totalCount → eligibleCount → detectedModels → fallback reason`
- Vérification de l'exposition des secrets (DATABASE_URL, credentials)
- Vérification de la conformité TypeScript des types `StageResult` et `ShelfConceptPreviewResponse`
- Vérification de la propagation de `candidatePoolSize` dans la preview
- Vérification des `pgClient.unsafe()` utilisés dans le SQL

## Points validés

1. **Détection mismatch modèle** (`semantic-search.ts:84-97`) : quand `eligibleCount === 0` mais `totalCount > 0`, le `reason` inclut le modèle configuré et les modèles détectés dans le corpus. Logique correcte et message explicite.

2. **`diagnostics` sur tous les chemins de retour** (success, no-corpus, mismatch) : présent sauf en cas d'erreur `catch` (voir observations). Conforme à l'AC4.

3. **Endpoint `/v1/diagnostics/vector-corpus`** : 5 requêtes parallèles, aucune fuite de `DATABASE_URL` ou credentials, réponse bien typée. Conforme à l'AC1.

4. **Contrat API** (`ShelfConceptPreviewResponse`) : tous les champs requis par l'AC5 sont présents et typés.

5. **Lab UI** : banner fallback conditionnel, compteurs `retrieved → postFilter → reranked → final`, badges de disponibilité par stage, bloc diagnostics JSON collapsible. Conforme aux AC6 et AC7.

6. **Enregistrement de `diagnosticsRoutes`** dans `index.ts` : correctement ajouté.

7. **Aucun secret exposé** : `EMBEDDING_MODEL_PROVIDER`/`EMBEDDING_MODEL_NAME` sont des noms de modèle, pas des credentials.

## Problèmes détectés

### P1 — `detectedModels` DISTINCT query s'exécute sur chaque appel (y compris production) — moyen

`semantic-search.ts:79-82` :
```typescript
const detectedModelsRows = await pgClient<{ m: string }[]>`
  SELECT DISTINCT model_provider || '/' || model_name AS m FROM media_embeddings LIMIT 10
`
```
Cette requête `SELECT DISTINCT` s'exécute **sur chaque appel à `runSemanticSearch`**, même dans le chemin nominal (corpus peuplé avec le bon modèle). Le résultat est inclus dans les `diagnostics` du chemin success mais cette valeur a peu de valeur diagnostique quand tout fonctionne — on sait déjà que le modèle configuré est présent.

Sur une table `media_embeddings` volumineuse sans index couvrant `(model_provider, model_name)`, ce `DISTINCT` peut déclencher un full scan à chaque recommandation de la homepage.

**Fix recommandé** : déplacer la requête `detectedModels` à l'intérieur du bloc `if (eligibleCount === 0)` où elle est réellement utile, et ne pas l'inclure dans le `diagnostics` du chemin success (ou la remplacer par `[`${EMBEDDING_MODEL_PROVIDER}/${EMBEDDING_MODEL_NAME}`]` en dur pour le chemin success). Les requêtes `eligibleRows` et `detectedModelsRows` peuvent aussi être parallélisées avec `Promise.all` pour réduire la latence du chemin d'erreur.

### P2 — `retrievalCounts.retrieved` et `postFilter/reranked/final` proviennent de deux invocations différentes du pipeline — mineur

Dans `shelf-concepts.ts:119-136`, `retrieved` vient de `rawSemanticResult.outputCount` (run "raw", sans `candidatePoolSize`, capped à `SEMANTIC_RETRIEVAL_LIMIT` ou moins), tandis que `postFilter/reranked/final` viennent de `finalResult` (pipeline complet avec ses propres paramètres). Ces deux runs peuvent avoir des `retrievalLimit` différents, rendant la lecture du flow `retrieved → postFilter → reranked → final` potentiellement trompeuse pour un utilisateur du Lab.

Ce comportement est explicitement prévu dans le plan. Le risque principal est de faire croire que le fallback (`final=20` avec `retrieved=200`) confirme un pipeline sémantique fonctionnel alors que le `retrieved` vient du run brut séparé. Le banner fallback atténue partiellement ce risque.

### P3 — Pas de `diagnostics` dans le chemin `catch` — mineur

`semantic-search.ts:186-196` : en cas d'erreur pgvector ou embedding, le `StageResult` retourné n'a pas de champ `diagnostics`. Le `fallbackReason` contient le message d'erreur (AC satisfait), mais l'utilisateur du Lab ne voit pas les valeurs partielles (`totalEmbeddings`, `eligibleEmbeddings`, etc.) collectées avant l'erreur si elles existent.

### P4 — `/v1/diagnostics/vector-corpus` sans authentification au niveau applicatif — mineur

L'endpoint est enregistré sans middleware d'auth (cohérent avec les autres routes du service). Il expose des métadonnées internes (model names, counts par media type). Ce n'est pas une régression par rapport au reste du service, mais c'est un nouvel endpoint permanent qui mériterait un contrôle d'accès (IP allowlist infra, ou header interne) avant de passer en production publique.

## Risques éventuels

- Le `SELECT DISTINCT` non indexé (P1) est le seul risque réel de régression de performance en production. Les autres points sont des observations diagnostiques ou de conception.
- La dépendance sur `finalResult.engineMetadata.fallbackFlags` pour la condition du banner suppose que ce champ est toujours défini. À vérifier que `runRecommendationFromPlan` garantit toujours `fallbackFlags: []` (non null/undefined) en l'absence de fallback.

## Décision

L'implémentation satisfait tous les critères d'acceptance du plan et du ticket. La détection du mismatch modèle/corpus est correcte, le Lab est instrumenté, aucun secret n'est exposé. Le point P1 (query `detectedModels` sur chaque call) est un défaut de performance réel mais n'invalide pas la logique de diagnostic. Les autres points sont des observations pour suivi.

IMPLEMENTATION_APPROVED
