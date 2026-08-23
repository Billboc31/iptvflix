# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T120/reviews/implementation-review.md
- generated at: 2026-08-23T10:18:21Z

---

Now I have everything I need. Writing the review.

---

# PR Review — T120 (attempt 2)

## Résumé

Les deux BLOQUANT de la première review ont été corrigés : le contrat API est aligné sur les nouveaux noms de champs, le frontend lit les bons champs. Le code des changements CI est propre. Cependant, l'objectif principal du ticket — **trouver et corriger la cause racine** — n'est pas atteint. L'implémentation livre des diagnostics améliorés ; elle ne livre pas la correction fonctionnelle exigée par le ticket.

## Fichiers vérifiés

- `packages/api-contracts/src/shelf-concepts.ts` (lignes 62–80)
- `apps/web/src/pages/RecommendationLabPage.tsx` (ligne 515)
- `apps/recommendation-engine/src/pipeline/stages/semantic-search.ts`
- `apps/recommendation-engine/src/pipeline/recommendation-service.ts` (lignes 126–131)
- `apps/recommendation-engine/src/routes/shelf-concepts.ts` (lignes 120–141)
- `apps/recommendation-engine/src/routes/diagnostics.ts`
- `apps/recommendation-engine/src/pipeline/types.ts`
- `apps/recommendation-engine/src/index.ts`
- `runs/T120/implementation-output.md`

## Points validés

**BLOQUANT 1 résolu** — `ShelfConceptPreviewResponse` déclare maintenant `semanticRetrieved`, `semanticPostFilter`, `fallbackCandidates`, `rerankedCandidates`, `finalResults` et un top-level `fallbackUsed: boolean`. Alignement complet entre backend et contrat.

**BLOQUANT 2 résolu** — `RecommendationLabPage.tsx:515` itère sur `['semanticRetrieved', 'semanticPostFilter', 'fallbackCandidates', 'rerankedCandidates', 'finalResults'] as const`. TypeScript enforce la validité des clés.

**MOYEN 3 résolu** — `fallbackCandidateCount: popularityFallbackUsed ? mergedCandidates.length - semanticCandidates.length : 0` est sémantiquement correct.

**Hoisting Case C** — variables préflight hoistées avant le `try`, catch block non silencieux, diagnostics complets dans toutes les branches de retour. Pattern propre.

**Endpoint diagnostics** — `/v1/diagnostics/vector-corpus` correct : détecte Cases A (`totalEmbeddings = 0`) et B (`eligibleCount = 0`), expose `configuredModel` vs `byModel`, `pgvectorAvailable`. Enregistré dans `index.ts`.

**Compteurs corrigés** — La distinction `semanticRetrieved / fallbackCandidates` remplace l'affichage trompeur `0 retrieved → 200 postFilter`. La logique est correcte.

## Problèmes détectés

### BLOQUANT — Objectif du ticket non atteint : cause racine ni identifiée ni corrigée

Le ticket est intitulé **"fix root cause, not diagnostics"**. Il exige explicitement :

> "Cause racine identifiée explicitement dans l'implementation output / PR."
> "Correction fonctionnelle appliquée, pas uniquement des logs/diagnostics supplémentaires."

L'implémentation livre un endpoint de diagnostic et améliore la visibilité du catch block. Elle **ne livre pas** :

1. **L'investigation** — Aucun appel à `/v1/diagnostics/vector-corpus` sur le recommendation-engine de production. On ne sait toujours pas quel cas (A, B, C ou D) est la cause réelle.

2. **La correction** — Sans cas identifié, aucune action corrective n'a été appliquée :
   - Case A (corpus vide) : vérification DATABASE_URL + backfill non réalisés
   - Case B (model mismatch) : env vars Railway non vérifiées ni corrigées
   - Case C (exception pgvector) : le plan signale le risque d'une migration `0040_t102_pgvector_hnsw.sql` non appliquée sur prod (colonne encore `double precision[]` avec cast `::vector` qui échoue) — ce sous-cas n'a pas été vérifié ni résolu
   - Case D : non exploré

3. **La preuve end-to-end** — `runs/T120/implementation-output.md` reconnaît lui-même que la completion rule n'est pas satisfaite. Laisser une note dans un artefact interne n'est pas équivalent à une escalade explicite ni à une preuve live.

Le ticket dit clairement : *"Ne pas considérer le ticket terminé après avoir simplement affiché `no embeddings indexed`."* L'équivalent ici est d'avoir simplement rendu le message d'erreur plus lisible sans avoir lu ce message sur la production.

### MINEUR — Incohérence de scope pour `semanticRetrieved`

`retrievalCounts.semanticRetrieved = rawSemanticResult.outputCount` provient de l'appel raw (sans `candidatePoolSize`, donc avec `SEMANTIC_RETRIEVAL_LIMIT` par défaut), tandis que les autres compteurs proviennent du pipeline final (`finalResult`). Si les deux appels ont des `retrievalLimit` différents, le compteur est légèrement incohérent avec le reste de la chaîne affichée. Non bloquant — les deux appellent la même query, le résultat sera > 0 ou = 0 dans les deux cas — mais à noter pour une prochaine itération.

## Actions requises

### OBLIGATOIRE

1. **Identifier la cause racine** — Déployer le code actuel sur l'environnement recommendation-engine qui pointe sur la DB de production (ou le même pgClient). Appeler `GET /v1/diagnostics/vector-corpus`. Lire `totalEmbeddings`, `eligibleCount`, `configuredModel`, `byModel`, `pgvectorAvailable`. Inscrire le résultat dans `implementation-output.md`.

2. **Appliquer la correction correspondante** selon le cas identifié :
   - **Case A** : vérifier que `recommendation-engine` et `apps/api` partagent la même `DATABASE_URL`. Si oui, déclencher `POST /admin/embedding-backfill` et vérifier `coverage` endpoint. Si non, corriger la variable Railway.
   - **Case B** : corriger `EMBEDDING_MODEL_PROVIDER` / `EMBEDDING_MODEL_NAME` dans Railway recommendation-engine pour correspondre aux valeurs stockées dans `media_embeddings`.
   - **Case C — sous-cas pgvector** : vérifier si la migration `0040_t102_pgvector_hnsw.sql` a été appliquée sur la DB de prod. Si la colonne est encore `double precision[]`, soit appliquer la migration, soit ajouter un check du type de colonne dans `checkPgvector()` (pas seulement l'existence de l'extension).

3. **Valider end-to-end** — Appeler `/v1/shelf-concepts/:id/preview` pour `Aventures à travers le temps` sur l'environnement peuplé et confirmer dans l'implementation output :
   ```
   semanticAvailable = true
   semanticRetrieved > 0
   fallbackUsed = false
   RAW VECTOR > 0, candidats cohérents avec l'intention temporelle
   ```

Si l'accès production est structurellement impossible dans ce worktree, **escalader explicitement** (bloquer le ticket, notifier) plutôt qu'annoter silencieusement l'artefact.

IMPLEMENTATION_FIX_REQUIRED
