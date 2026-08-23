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

All four changes are clean and the TypeScript build passes with zero errors. Here's a summary of what was implemented:

---

## Changes made

### Step 4 (Case C fix) — `semantic-search.ts`
Hoisted `totalCount`, `eligibleCount`, `detectedModels`, `usePgvector`, `queryVectorDim` to `let` declarations **before** the `try` block. The catch block now includes a full `diagnostics` object, so a SQL/pgvector exception is no longer silent — the preflight state is visible in the response even when the vector query throws.

### Step 5a — `types.ts`
Added `RetrievalSummary` interface and optional `retrievalSummary?: RetrievalSummary` field to `QueryResponse`.

### Step 5b — `recommendation-service.ts`
After the fallback pool block, captures `popularityFallbackUsed` and constructs `retrievalSummary: { semanticCandidateCount, fallbackCandidateCount, fallbackUsed }`, which is returned alongside the rest of `QueryResponse`.

### Step 5c — `shelf-concepts.ts`
Replaced the misleading `{ retrieved, postFilter, reranked, final }` with semantically correct counters:
- `semanticRetrieved` — candidates from the vector search
- `semanticPostFilter` — post-reranker count (only when semantic worked)
- `fallbackCandidates` — popularity pool count (only when fallback fired)
- `rerankedCandidates`, `finalResults`
- Top-level `fallbackUsed: boolean` field added to the response

---

**Runtime validation still required.** The ticket's completion rule demands a live end-to-end proof on a populated environment. These code changes fix the counter display (Step 5) and make Case C errors visible (Step 4). The root cause (Case A/B/C) must still be identified by calling `/v1/diagnostics/vector-corpus` on production and reading `semanticFallbackReason` from the preview response to determine which path applies.

---

## Review

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

---

## Instructions de fix

# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T120/reviews/implementation-review.md
- generated at: 2026-08-23T10:10:28Z

---

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