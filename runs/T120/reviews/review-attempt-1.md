# PR Review — T120

## Résumé

L'implémentation couvre partiellement le ticket : elle améliore la visibilité des erreurs de retrieval (Case C) et ajoute un endpoint de diagnostic (`/v1/diagnostics/vector-corpus`). Elle restructure également les compteurs du pipeline. En revanche, elle laisse deux problèmes bloquants : le contrat API (`api-contracts`) n'a pas été mis à jour avec les nouveaux noms de champs, et le frontend lit toujours les anciens noms — les compteurs seront `undefined` au runtime. De plus, aucune validation live sur environnement peuplé n'est fournie, alors que la completion rule du ticket l'exige explicitement.

## Vérifications effectuées

- Lecture du plan `runs/T120/plan.md`
- Lecture du `runs/T120/implementation-output.md`
- `git diff main...HEAD` — 8 fichiers modifiés
- Lecture de `packages/api-contracts/src/shelf-concepts.ts` (ligne 62-78)
- Lecture de `apps/web/src/pages/RecommendationLabPage.tsx` (lignes 500-527)
- Grep sur `retrievalCounts`, `semanticRetrieved`, `fallbackUsed` dans les fichiers backend et frontend
- Lecture de `apps/recommendation-engine/src/routes/shelf-concepts.ts` (lignes 120-136)
- Lecture de `apps/recommendation-engine/src/routes/diagnostics.ts`
- Lecture de `apps/recommendation-engine/src/pipeline/stages/semantic-search.ts`

## Points validés

- **`semantic-search.ts` (Step 4 / Case C)** — Hoisting des variables `totalCount`, `eligibleCount`, `detectedModels`, `usePgvector`, `queryVectorDim` avant le bloc `try`. Le catch block inclut désormais les diagnostics complets : une exception SQL/pgvector ne sera plus silencieuse. Pattern propre et sans magie.
- **`types.ts`** — Ajout de `RetrievalSummary` et du champ optionnel `retrievalSummary` sur `QueryResponse`. Backward-compatible.
- **`diagnostics.ts`** — Nouvel endpoint `GET /v1/diagnostics/vector-corpus` avec comptages par modèle, par type de média, détection pgvector, et `eligibleCount` pour le modèle configuré. Implémentation propre, couvre les Cases A et B en lecture.
- **`index.ts`** — Route enregistrée correctement.
- **`recommendation-service.ts`** — `popularityFallbackUsed` capturé, `retrievalSummary` construit et retourné dans `QueryResponse`.
- **Build TypeScript** — L'implémentation output indique zéro erreur. C'est cohérent avec l'analyse : le mismatch échappe au type-checker car le backend n'a pas d'annotation de retour pointant vers le contrat, et le frontend lit via le type du contrat (qui n'a pas été mis à jour).

## Problèmes détectés

### BLOQUANT 1 — Contrat API non mis à jour

**Fichier :** `packages/api-contracts/src/shelf-concepts.ts:72-78`

Le type `ShelfConceptPreviewResponse.retrievalCounts` déclare toujours les anciens champs :

```typescript
retrievalCounts: {
  retrieved: number
  postFilter: number | null
  reranked: number | null
  final: number
}
```

Le backend retourne désormais :

```typescript
retrievalCounts: {
  semanticRetrieved: number
  semanticPostFilter: number | null
  fallbackCandidates: number | null
  rerankedCandidates: number | null
  finalResults: number
}
fallbackUsed: boolean
```

Le contrat n'a pas suivi. `fallbackUsed` est absent du type. Résultat : les consommateurs du package `api-contracts` (web, tout autre client) voient une structure fausse.

**Correction requise :** Mettre à jour `ShelfConceptPreviewResponse` pour refléter les nouveaux champs et ajouter `fallbackUsed: boolean`.

---

### BLOQUANT 2 — Frontend lit les anciens noms de champs au runtime

**Fichier :** `apps/web/src/pages/RecommendationLabPage.tsx:515`

```typescript
{(['retrieved', 'postFilter', 'reranked', 'final'] as const).map((key, i, arr) => (
  ...
  {previewResponse.retrievalCounts[key] !== null ? previewResponse.retrievalCounts[key] : '—'}
```

Le frontend itère sur `['retrieved', 'postFilter', 'reranked', 'final']`. Ces champs n'existent plus dans la réponse backend. Ils retourneront `undefined` au runtime — tous les compteurs s'afficheront `'—'` au lieu des vraies valeurs.

TypeScript ne le détecte pas parce que le contrat (`ShelfConceptPreviewResponse`) n'a pas été mis à jour (Problème 1) : le frontend s'indexe sur des clés du type stale, pas de la vraie réponse.

**Correction requise :** Mettre à jour la liste des clés pour `['semanticRetrieved', 'semanticPostFilter', 'fallbackCandidates', 'rerankedCandidates', 'finalResults']` et adapter les labels affichés. Faire cette correction après avoir résolu le Problème 1.

---

### MOYEN 3 — Sémantique ambiguë de `fallbackCandidateCount`

**Fichier :** `apps/recommendation-engine/src/pipeline/recommendation-service.ts`

```typescript
fallbackCandidateCount: popularityFallbackUsed ? mergedCandidates.length : 0,
```

`mergedCandidates` est le pool total après merge (semantic + fallback). Si le semantic retourne N candidats et le fallback en ajoute M, le compteur affiche N+M, pas M. Ce sera trompeur dans le cas nominal (semantic partiel + fallback partiel). En cas de panne totale du semantic (N=0), le comportement est correct (affiche 200).

**Correction suggérée :**

```typescript
fallbackCandidateCount: popularityFallbackUsed
  ? mergedCandidates.length - semanticCandidates.length
  : 0,
```

Ou bien tracker séparément les candidats ajoutés par le fallback.

---

### MOYEN 4 — Validation runtime absente (completion rule non satisfaite)

Le ticket stipule explicitement :

> "Ne pas fermer ce ticket sur tests unitaires, mocks, compilation, diagnostics ou présence d'embeddings seulement."
>
> "Le ticket n'est terminé que lorsqu'une preuve end-to-end sur un environnement avec le corpus réellement peuplé montre..."

L'implementation output reconnaît lui-même que la validation live est requise. Aucun résultat de test sur environnement peuplé n'est fourni pour :
- `Aventures à travers le temps` (`semanticRetrieved > 0`, `fallbackUsed=false`)
- `SF qui fait réfléchir`
- `film qui retourne le cerveau`

Ce point ne peut pas être approuvé par review de code seule — il nécessite une preuve d'exécution.

## Risques éventuels

- Le fait que le build TypeScript passe malgré le mismatch montre que le backend Fastify n'est pas fortement typé sur le retour de la route. L'absence d'annotation de retour explicite (`reply.send<ShelfConceptPreviewResponse>(...)`) crée un angle mort permanent pour les dérives de contrat futures.
- Les Cases A et B sont désormais **détectables** via le nouvel endpoint et les diagnostics du `fallbackReason` — mais non **corrigées** côté déploiement/backfill. Le ticket le note mais c'est un scope que le coder a correctement délégué à la validation live : acceptable si la validation est ensuite faite.

## Décision

- REQUEST_CHANGES

## Actions demandées

1. **[BLOQUANT]** Mettre à jour `packages/api-contracts/src/shelf-concepts.ts` : remplacer les champs `retrieved/postFilter/reranked/final` par `semanticRetrieved/semanticPostFilter/fallbackCandidates/rerankedCandidates/finalResults` et ajouter `fallbackUsed: boolean` au niveau racine.
2. **[BLOQUANT]** Mettre à jour `apps/web/src/pages/RecommendationLabPage.tsx:515` : utiliser les nouveaux noms de clés (`semanticRetrieved`, `semanticPostFilter`, `fallbackCandidates`, `rerankedCandidates`, `finalResults`) pour l'itération du pipeline counter.
3. **[MOYEN]** Corriger le calcul de `fallbackCandidateCount` dans `recommendation-service.ts` pour ne compter que les candidats ajoutés par le fallback (et non le total mergé).
4. **[OBLIGATOIRE — completion rule]** Fournir une preuve end-to-end sur environnement peuplé : `semanticRetrieved > 0` et `fallbackUsed=false` pour `Aventures à travers le temps`, puis smoke test `SF qui fait réfléchir` et `film qui retourne le cerveau`.
