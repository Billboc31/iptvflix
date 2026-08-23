---

# PR Review — T120

## Résumé

L'implémentation améliore la visibilité des erreurs de retrieval (Case C), ajoute un endpoint `/v1/diagnostics/vector-corpus`, et restructure les compteurs du pipeline. Mais elle laisse deux problèmes bloquants : le contrat API n'est pas mis à jour, et le frontend lit des champs qui n'existent plus au runtime.

## Vérifications effectuées

- `runs/T120/plan.md` et `implementation-output.md`
- `git diff main...HEAD` — 8 fichiers
- `packages/api-contracts/src/shelf-concepts.ts:62-78`
- `apps/web/src/pages/RecommendationLabPage.tsx:515`
- Backend `shelf-concepts.ts:120-136`, `semantic-search.ts`, `diagnostics.ts`, `recommendation-service.ts`

## Points validés

- `semantic-search.ts` — hoisting des variables de préflight avant le `try`, catch block non silencieux. Clean.
- `types.ts` — ajout de `RetrievalSummary`, backward-compatible.
- `diagnostics.ts` — endpoint correct, couvre la détection Cases A/B.
- `recommendation-service.ts` — `fallbackUsed` capturé et retourné.
- Build TS : passe car le mismatch échappe au type-checker (route sans annotation de retour typée, contrat stale).

## Problèmes détectés

### BLOQUANT 1 — Contrat API non mis à jour

`packages/api-contracts/src/shelf-concepts.ts:72-78` déclare toujours les anciens champs `retrieved/postFilter/reranked/final`. Le backend retourne désormais `semanticRetrieved/semanticPostFilter/fallbackCandidates/rerankedCandidates/finalResults` + un top-level `fallbackUsed`. Le contrat n'a pas suivi.

### BLOQUANT 2 — Frontend lit les anciens noms au runtime

`RecommendationLabPage.tsx:515` itère sur `['retrieved', 'postFilter', 'reranked', 'final']`. Ces champs n'existent plus dans la réponse. Tous les compteurs afficheront `'—'`. TypeScript ne le détecte pas car le type contract (Problème 1) est stale.

### MOYEN 3 — `fallbackCandidateCount` sémantique imprécise

`mergedCandidates.length` inclut les candidats semantic + fallback. Lorsque les deux produisent des résultats, le compteur fallback est gonflé. Devrait être `mergedCandidates.length - semanticCandidates.length`.

### MOYEN 4 — Completion rule non satisfaite

Aucune preuve live sur environnement peuplé. Le ticket l'exige explicitement : `semanticRetrieved > 0`, `fallbackUsed=false` pour `Aventures à travers le temps`. L'implementation output le reconnaît lui-même.

## Actions requises

1. **[BLOQUANT]** Mettre à jour `packages/api-contracts/src/shelf-concepts.ts` avec les nouveaux noms de champs et `fallbackUsed: boolean`.
2. **[BLOQUANT]** Mettre à jour `RecommendationLabPage.tsx:515` pour itérer sur `semanticRetrieved`, `semanticPostFilter`, `fallbackCandidates`, `rerankedCandidates`, `finalResults`.
3. **[MOYEN]** Corriger le calcul de `fallbackCandidateCount`.
4. **[OBLIGATOIRE]** Fournir la preuve end-to-end sur environnement peuplé (completion rule du ticket).

IMPLEMENTATION_FIX_REQUIRED
