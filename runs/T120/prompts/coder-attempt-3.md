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


# T120 — Semantic retrieval still returns 0 after #254 — fix root cause, not diagnostics

**Source**: GitHub Issue #256

## Description

## Contexte

#254 / PR #255 a été mergé et a correctement amélioré l'observabilité du Recommendation Lab, mais **le bug fonctionnel n'est pas corrigé**.

Test réel en production après déploiement, sur le ShelfConcept **`Aventures à travers le temps`** :

```text
Semantic retrieval failed — fallback results displayed

PIPELINE COUNTS
0 retrieved → 200 postFilter → 20 reranked → 20 final

RAW VECTOR
Candidats sémantiques : 0
```

Les résultats finaux sont donc toujours issus du fallback puis personnalisés, avec des titres sans rapport évident avec l'intention (`The Passengers of the Night`, `Icon`, `Behind The Scenes`, etc.).

Les stages affichés incluent `semantic-search`, `text-search`, `popularity-fallback`, `hybrid-reranker`, mais **le semantic retrieval réel reste à zéro**.

## Objectif

**Trouver et corriger la cause racine qui fait que `runSemanticSearch()` retourne 0 candidat en production.**

Ce ticket n'est PAS un ticket d'observabilité supplémentaire et n'est PAS un ticket de tuning de `SCORE_MODEL_V2`.

Le résultat attendu est que le retrieval vectoriel retourne réellement des candidats pertinents avant fallback/reranking.

## Investigation obligatoire

Utiliser les diagnostics ajoutés par #254/#255 pour identifier la cause exacte sur l'environnement réellement peuplé.

Vérifier notamment :

- `totalEmbeddings`
- `eligibleEmbeddings`
- `detectedModels`
- `configuredModel`
- `queryVectorDim`
- dimension des vecteurs stockés
- `usePgvector`
- `pgvectorAvailable`
- `retrievalLimit`
- `retrievedRawRows`
- DB/schema réellement utilisés par recommendation-engine
- modèle/provider réellement utilisés lors de l'indexation et lors de la query
- filtres SQL `model_provider`, `model_name`, `media_type`, versions/document versions
- correspondance des IDs `media_embeddings.media_id` avec les IDs canoniques
- comportement pgvector vs fallback SQL
- éventuelle exception SQL/vector silencieusement convertie en `available:false`

## Important — distinguer la vraie cause

### Cas A — corpus vide

Si `totalEmbeddings = 0`, corriger le mécanisme d'indexation/backfill/déploiement afin que le corpus de production soit effectivement vectorisé.

Ne pas considérer le ticket terminé après avoir simplement affiché `no embeddings indexed`.

### Cas B — embeddings présents mais `eligibleEmbeddings = 0`

Identifier et corriger le mismatch entre :

```text
EMBEDDING_MODEL_PROVIDER / EMBEDDING_MODEL_NAME
```

et les valeurs réellement enregistrées dans `media_embeddings`.

Ne pas contourner le problème en supprimant arbitrairement le filtre modèle sans garantir la compatibilité des embeddings.

### Cas C — embeddings éligibles > 0 mais retrieval = 0

Exécuter/inspecter la requête vectorielle réelle et corriger la SQL, le cast pgvector, les dimensions, filtres ou mapping responsables.

### Cas D — retrieval > 0 puis candidats supprimés

Corriger les filtres/exclusions responsables et exposer les compteurs aux bonnes étapes. Dans ce cas `retrieved` doit représenter le nombre réellement retourné par la recherche vectorielle AVANT les filtres suivants.

## Attention aux compteurs actuels

Le Lab affiche actuellement :

```text
0 retrieved → 200 postFilter → 20 reranked → 20 final
```

Cette séquence est trompeuse : `postFilter = 200` alors que `retrieved = 0` indique vraisemblablement que le compteur mélange le pool fallback avec le pipeline sémantique.

Corriger la sémantique des compteurs afin de distinguer explicitement :

```text
semanticRetrieved
semanticPostFilter
fallbackCandidates
rerankedCandidates
finalResults
```

Par exemple, en cas de panne sémantique :

```text
semantic: 0 → 0
fallback: 200
reranked: 20
final: 20
```

et en fonctionnement normal :

```text
semantic: 200 → 187
fallback: 0
reranked: 187
final: 20
```

## Correction attendue

Le chemin nominal doit réellement devenir :

```text
ShelfConcept.semanticIntent
        ↓
query embedding
        ↓
pgvector search
        ↓
~candidatePoolSize candidats sémantiques
        ↓
hard filters / exclusions
        ↓
SCORE_MODEL_V2
        ↓
diversification
        ↓
final results
```

Le fallback ne doit intervenir que lorsque ce chemin ne peut réellement pas produire suffisamment de candidats.

## Test de validation principal

Après correction et déploiement, rejouer **exactement** :

### `Aventures à travers le temps`

La preview doit montrer :

```text
semanticAvailable = true
semanticRetrieved > 0
fallbackUsed = false
RAW VECTOR candidates > 0
```

Le Raw Vector doit contenir des films sémantiquement liés au voyage temporel / temporalité / aventure, avant toute personnalisation.

Le `Final personnalisé` doit provenir de ce pool sémantique et non d'un pool de popularité générique.

## Tests supplémentaires

Rejouer également :

- `SF qui fait réfléchir`
- `film qui retourne le cerveau`

Pour chacun :

- Raw Vector > 0
- pas de popularity fallback lorsque le corpus permet de répondre
- candidats raw cohérents avec l'intention
- final provenant du pool semantic

## Acceptance criteria

- [ ] Cause racine identifiée explicitement dans l'implementation output / PR.
- [ ] Correction fonctionnelle appliquée, pas uniquement des logs/diagnostics supplémentaires.
- [ ] `Aventures à travers le temps` retourne `semanticRetrieved > 0` en environnement réellement peuplé.
- [ ] `RAW VECTOR` affiche des candidats.
- [ ] `fallbackUsed=false` sur ce test nominal.
- [ ] Les candidats Raw Vector sont sémantiquement cohérents avec l'intention.
- [ ] Le final personnalisé est dérivé du pool semantic.
- [ ] Les compteurs distinguent semantic et fallback sans afficher `0 retrieved → 200 postFilter`.
- [ ] `SF qui fait réfléchir` et `film qui retourne le cerveau` passent également le smoke test.
- [ ] Aucun tuning des poids V2 n'est utilisé pour masquer le problème de retrieval.

## Completion rule — obligatoire

**Ne pas fermer ce ticket sur tests unitaires, mocks, compilation, diagnostics ou présence d'embeddings seulement.**

Le ticket n'est terminé que lorsqu'une preuve end-to-end sur un environnement avec le corpus réellement peuplé montre pour `Aventures à travers le temps` :

```text
semantic intent
→ query embedding OK
→ eligible corpus > 0
→ vector query > 0
→ RAW VECTOR > 0
→ reranking V2
→ final
→ fallbackUsed=false
```

Si l'agent ne peut pas exécuter le test sur l'environnement peuplé, il doit laisser le ticket ouvert / signaler explicitement que la validation runtime reste requise, et ne pas déclarer le bug corrigé.

---

## Contexte de retry injecté par run_ticket.py

## Output précédent

No errors related to my changes — all failures are the pre-existing missing `@types/react` in this worktree environment (present before T120).

---

Three fixes applied:

**BLOQUANT 1 — `packages/api-contracts/src/shelf-concepts.ts`**
Replaced `retrievalCounts: { retrieved, postFilter, reranked, final }` with `{ semanticRetrieved, semanticPostFilter, fallbackCandidates, rerankedCandidates, finalResults }` and added `fallbackUsed: boolean` at the top level of `ShelfConceptPreviewResponse`. The contract now matches what the backend actually returns.

**BLOQUANT 2 — `apps/web/src/pages/RecommendationLabPage.tsx:515`**
Updated the `as const` array from `['retrieved', 'postFilter', 'reranked', 'final']` to `['semanticRetrieved', 'semanticPostFilter', 'fallbackCandidates', 'rerankedCandidates', 'finalResults']`. TypeScript now enforces key validity against the updated contract.

**MOYEN 3 — `apps/recommendation-engine/src/pipeline/recommendation-service.ts:129`**
`fallbackCandidateCount` now uses `mergedCandidates.length - semanticCandidates.length` instead of `mergedCandidates.length`. In practice equivalent (fallback only fires when semantic=0), but semantically precise for future edge cases.

**Completion rule (MOYEN 4)** — Runtime validation on a populated environment is still required. The code changes are ready; a live end-to-end proof on production with `Aventures à travers le temps` showing `semanticRetrieved > 0` and `fallbackUsed=false` is needed before the ticket can be closed.

---

## Review

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

---

## Instructions de fix

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