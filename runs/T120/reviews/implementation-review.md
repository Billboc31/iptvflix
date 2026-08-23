---

# PR Review — T120 (attempt 3)

## Résumé

L'unique BLOQUANT de la review précédente — *cause racine non identifiée, aucun fix fonctionnel appliqué* — est adressé. L'implémentation livre une correction fonctionnelle réelle pour le Cas C (sous-cas pgvector column type mismatch), avec une identification de cause racine par analyse statique du code. L'end-to-end reste structurellement impossible depuis ce worktree et est correctement signalé comme condition de fermeture du ticket.

## Fichiers vérifiés

- `apps/recommendation-engine/src/pipeline/stages/semantic-search.ts`
- `apps/recommendation-engine/src/pipeline/recommendation-service.ts` (lignes 126–131, 184)
- `apps/recommendation-engine/src/routes/shelf-concepts.ts` (lignes 97–141)
- `apps/recommendation-engine/src/routes/diagnostics.ts`
- `apps/recommendation-engine/src/pipeline/types.ts`
- `apps/recommendation-engine/src/index.ts`
- `packages/api-contracts/src/shelf-concepts.ts`
- `apps/web/src/pages/RecommendationLabPage.tsx`
- `runs/T120/implementation-output.md`

## Points validés

**Fix fonctionnel Cas C appliqué** — `checkPgvector()` vérifie maintenant deux conditions indépendantes :
1. `pg_extension WHERE extname = 'vector'` présente
2. `information_schema.columns udt_name = 'vector'` pour `media_embeddings.embedding`

Si l'extension existe mais que la colonne est encore `_float8` (migration `0040` non appliquée en prod), `pgvectorAvailable = false` → le code route vers le fallback SQL cosine similarity qui fonctionne correctement avec `double precision[]`. C'est un fix de comportement réel, pas seulement de diagnostics.

**Cause racine identifiée par analyse statique** — L'hypothèse Case C est cohérente avec les symptômes : `pgvectorAvailable = true` (extension présente) mais colonne toujours `double precision[]` → cast `::vector` lève une exception → catch block silencieux → `available: false, outputCount: 0`. Le mécanisme de défaillance correspond exactement aux logs observés.

**Preuve confirmable immédiatement** — `semanticDiagnostics.columnType` est exposé dans la réponse Lab. Un opérateur peut lire `columnType: "_float8"` ou `columnType: "vector"` directement depuis l'UI Lab sans accès DB direct, ce qui confirme ou infirme l'hypothèse Case C en 30 secondes après déploiement.

**Compteurs corrigés** — `semanticRetrieved / fallbackCandidates / rerankedCandidates / finalResults` remplace correctement le display trompeur `0 retrieved → 200 postFilter`. Le calcul `fallbackCandidateCount = popularityFallbackUsed ? mergedCandidates.length - semanticCandidates.length : 0` est correct : quand fallback s'active, `semanticCandidates.length = 0` et `mergedCandidates` est le pool popularity, donc le résultat est `fallbackPool.length`.

**`detectedColumnType` module-level** — Cohérent avec `pgvectorAvailable` : les deux sont des singletons initialisés au premier appel. Comportement prévisible. Si la migration est appliquée en cours de service, le restart sera nécessaire — acceptable et documenté.

**Contrat API aligné** — `ShelfConceptPreviewResponse` (api-contracts) déclare tous les nouveaux champs. Le frontend consomme exactement ces champs. TypeScript enforce les clés de `retrievalCounts`.

**Scope respecté** — Pas de drift vers tuning V2, pas de modification du hybrid-reranker ou des scoring weights, pas de nouvelle dépendance. Changements strictement dans le périmètre du ticket.

**Endpoint diagnostics enrichi** — `/v1/diagnostics/vector-corpus` expose maintenant `embeddingColumnType` et `pgvectorExtensionInstalled` séparément, permettant de distinguer Cases A, B et C sans accès direct à la DB.

**Escalade correcte** — L'implementation output ne déclare pas le bug corrigé. Il indique explicitement : *"The ticket should not be closed until that live proof is available."* C'est le comportement attendu selon la completion rule du ticket.

## Problèmes détectés

### MINEUR — `stageAvailability` provient du pipeline final, pas du raw semantic call

`stageAvailability: finalResult.stageAvailability` (route ligne 131) reflète la disponibilité des stages du pipeline complet (`runRecommendationFromPlan`), tandis que `semanticAvailable` reflète l'appel raw séparé (`runSemanticSearch` ligne 97). Dans le cas nominal (les deux réussissent), c'est cohérent. Dans un cas pathologique où les deux appels ont des résultats différents, `stageAvailability` pourrait contredire `semanticAvailable`. Non bloquant pour un outil Lab, mais à noter pour une prochaine itération.

### MINEUR — `semanticPostFilter` sémantique incertaine

`semanticPostFilter: fallbackUsed ? null : (rerankerStage?.filteredCount ?? null)` utilise `filteredCount` du hybrid-reranker, qui représente les candidats filtrés dans l'étape de reranking, pas spécifiquement les candidats filtrés après la recherche sémantique. La labellisation est approximative. Non bloquant — mieux que l'affichage précédent.

## Actions requises

### POST-DÉPLOIEMENT OBLIGATOIRE (validation humaine)

Après déploiement sur Railway :

1. Appeler `GET /v1/diagnostics/vector-corpus` sur recommendation-engine et lire :
   - `embeddingColumnType` : si `"_float8"` → Case C confirmé, le fix s'applique et semantic passera via pure-SQL
   - `pgvectorAvailable` : devrait être `false` si `embeddingColumnType != "vector"`
   - `totalEmbeddings` : si `0` → Case A, backfill nécessaire malgré le fix
   - `eligibleCount` : si `0` et total > 0 → Case B, env vars à corriger

2. Prévisualiser `Aventures à travers le temps` et confirmer :
   ```
   semanticAvailable = true
   semanticRetrieved > 0
   fallbackUsed = false
   semanticDiagnostics.columnType présent
   ```

3. Si Case C confirmé (`columnType = "_float8"`) et que le fix résout le problème → fermer le ticket.
4. Si Case A ou B au lieu de C → appliquer les actions opérationnelles correspondantes (backfill ou correction des env vars Railway).

Le ticket reste ouvert jusqu'à cette preuve live.

---

IMPLEMENTATION_APPROVED
