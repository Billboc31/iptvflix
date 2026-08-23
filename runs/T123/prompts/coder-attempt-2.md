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


# T123 — Improve semantic retrieval precision for thematic shelf intent

**Source**: GitHub Issue #262

## Description

## Context

After the recent reranking changes, profile boosts are better bounded by semantic relevance. The next bottleneck is now visible in the semantic candidate pool itself.

Benchmark shelf: **« Aventures à travers le temps »**.

The semantic pipeline is healthy (`semanticRetrieved` populated, `fallbackCandidates = 0`), but RAW VECTOR still ranks several candidates highly because they match broad concepts such as *adventure*, *journey* or *time* without actually matching the intended theme of **time travel / temporal adventure**.

Examples observed in the semantic pool/final ranking include candidates such as:
- `L'Avventura`
- `France, le fabuleux voyage`
- `Mystery at the Louvre Museum`
- `Treasure Island`

while genuine temporal candidates such as `The Time Machine`, `Timescape: Back to the Dinosaurs`, `The Visitor from the Future`, `Time Lapse`, etc. should receive stronger thematic relevance.

## Problem

Semantic retrieval currently appears too tolerant of individual lexical/semantic components of a shelf concept. For a compound thematic intent, matching *adventure* or *journey* should not be enough when the defining concept is **travel through time**.

The reranker should not have to repair a candidate pool whose semantic intent has already drifted.

## Goal

Improve semantic retrieval / intent representation so that compound thematic concepts preserve their defining semantic constraints.

For **« Aventures à travers le temps »**, the system should understand that temporal displacement/time travel is a central semantic anchor, not merely that the content relates independently to adventure, travel or time.

## Expected direction

Investigate the current ShelfConcept → semantic query / embedding construction and determine the best generic solution. Possible approaches include semantic intent expansion, required/weighted thematic anchors, richer query representation, or another mechanism that preserves compound concepts.

Do **not** hardcode this specific shelf or movie titles. The solution must generalize to other compound thematic shelves.

Do not change database data manually as part of the fix.

## Acceptance criteria

- Semantic retrieval remains vector/semantic based and does not fall back to title keyword matching.
- Compound shelf intents preserve their defining thematic concept.
- For the benchmark **« Aventures à travers le temps »**, genuine time-travel/temporal-story candidates rank materially above generic adventure/travel candidates.
- Candidates matching only broad secondary concepts such as adventure/journey should not dominate the top semantic results.
- Existing personalization/reranking remains functional; this ticket focuses on improving the semantic candidate pool before personalization.
- Add regression tests covering this benchmark and at least one additional compound thematic intent.
- No shelf-specific hardcoding and no manual production database modification.

---

## Contexte de retry injecté par run_ticket.py

## Output précédent

Implementation complete. Here's a summary of all changes:

---

## Files modified / created

### Schema & contracts (additive, non-breaking)
- **`packages/api-contracts/src/shelf-concepts.ts`** — `semanticAnchor?: string | null` added to `ShelfConcept`
- **`packages/api-contracts/src/query-plan.ts`** — `semanticAnchor?: string | null` added to `RecommendationQueryPlan`
- **`apps/api/src/db/schema/shelf-concepts.ts`** — `semanticAnchor: text('semantic_anchor')` column
- **`apps/recommendation-engine/src/db/schema.ts`** — same column
- **`apps/api/migrations/0049_t123_shelf_concept_anchor.sql`** *(new)* — `ALTER TABLE shelf_concepts ADD COLUMN semantic_anchor TEXT`

### LLM prompts
- **`apps/recommendation-engine/src/prompts/shelf-concept-generator-v1.ts`** — added `semanticAnchor` field + anchor extraction instructions for compound thematic intents
- **`apps/api/src/prompts/shelf-concept-generator-v1.ts`** — same
- **`apps/recommendation-engine/src/prompts/query-planner-v1.ts`** — added `semanticAnchor` to output schema + instructions

### Services
- **`apps/recommendation-engine/src/services/shelf-concept-mapper.ts`** — accepts and forwards `semanticAnchor` to query plan
- **`apps/recommendation-engine/src/services/shelf-concept-generator.ts`** — persists and maps `semanticAnchor`
- **`apps/api/src/services/shelf-concept-generator-service.ts`** — same

### Config & pipeline
- **`apps/recommendation-engine/src/config.ts`** — `SEMANTIC_ANCHOR_BLEND_ALPHA = 0.45` (env-overridable; `0.0` = legacy behavior)
- **`apps/recommendation-engine/src/pipeline/stages/semantic-search.ts`** — dual-embedding: when `semanticAnchor` is present, embeds both intent and anchor in parallel, blends distances in SQL as `ALPHA × anchorDist + (1-ALPHA) × intentDist`

### Tests
- **`apps/recommendation-engine/src/pipeline/stages/__tests__/semantic-search-blend.test.ts`** *(new)* — 7 pure unit tests for the blend formula, no DB/API calls
- **`apps/recommendation-engine/src/pipeline/__tests__/pipeline-regression.test.ts`** — added 2 T123 integration tests (benchmark shelf + "Enquêtes policières dans l'espace"), `makeRegressionPlan` accepts optional `semanticAnchor`
- **`apps/recommendation-engine/src/services/__tests__/shelf-concept-mapper.test.ts`** — 3 new anchor-forwarding tests

---

## Review

---

# PR Review — T123: Improve semantic retrieval precision for thematic shelf intent

## Résumé

L'implémentation du cœur T123 (dual-embedding avec blend dans `semantic-search.ts`, champ `semanticAnchor` sur schéma/prompts, constante `SEMANTIC_ANCHOR_BLEND_ALPHA`) est **correcte et bien structurée**. Cependant, deux problèmes bloquants empêchent l'approbation.

---

## Points validés

- **Dual-embedding `semantic-search.ts`** : `embedQuery` appelés en parallèle (`Promise.all`), formule `ALPHA * anchorDist + (1-ALPHA) * intentDist` correcte, path legacy (sans anchor) byte-for-byte identique, guard `anchorVector.length > 0` correct.
- **`SEMANTIC_ANCHOR_BLEND_ALPHA=0`** reproduit exactement le comportement actuel — critère d'acceptance respecté.
- **Schema/migration** : `semantic_anchor TEXT` nullable dans les deux schémas Drizzle, migration additive non-breaking.
- **Prompts LLM** : instructions d'extraction claire avec contrainte de restrictivité, langage de contraste, propagés dans les deux services.
- **Tests blend** : 7 tests unitaires purs (`semantic-search-blend.test.ts`) sans DB ni API — couvrent les cas limites. 3 tests mapper corrects.
- **Benchmark "Aventures à travers le temps"** : assertion ≥4/8 titres temporels + false positives absents du top-5.

---

## Problèmes détectés

### 🔴 BLOQUANT 1 — Artefact `node_modules` commité

`apps/recommendation-engine/node_modules/.vite/vitest/results.json` est dans le diff. Ce fichier de cache vitest ne doit jamais être commité.

### 🔴 BLOQUANT 2 — Drift de scope dans `hybrid-reranker.ts` et fichiers de contrats

Le plan T123 dit explicitement :
> *"Excluded: Changing `hybrid-reranker.ts` scoring weights, `SCORE_MODEL_V2`, or profile-boost modulation."*

Le diff inclut des ajouts substantiels non planifiés appartenant à T121/T122 :

| Fichier | Ajout hors scope |
|---|---|
| `hybrid-reranker.ts` | `resolveProtectionSettings`, `passesSemanticFloor`, `computeSemanticConfidenceFactor`, blend `thematic`, filtrage `semanticFloor`, modulation `profileBoostEffective`, 12 champs breakdown |
| `query-plan.ts` | `semanticProtection?: 'strict' \| 'moderate' \| 'none'` |
| `config.ts` | `SEMANTIC_FLOOR_STRICT`, `SEMANTIC_FLOOR_MODERATE`, `SEMANTIC_WEIGHT_THEMATIC`, `PROFILE_BOOST_MIN_FACTOR`, `PROFILE_BOOST_MODULATION_POWER` |
| `recommendations.ts` | 8 champs optionnels `ScoreBreakdown` T121/T122 |

Si T121/T122 ne sont pas encore sur main, ces changements doivent soit faire l'objet d'une justification explicite, soit être retirés.

### 🟡 MINEUR — Test "Enquêtes policières dans l'espace" incomplet

La describe annonce `"space-detective candidates dominate over pure space or pure detective results"` mais le test ne contient aucune assertion de ce type — uniquement des vérifications génériques (floor, breakdown peuplé, modulation). Le critère d'acceptance T123 ("defining anchor concept dominates over each secondary theme independently") n'est pas vérifié pour ce second intent.

### 🟡 MINEUR — Détection titre temporel par mots-clés fragile

`'time'` peut matcher des titres non temporaux selon le corpus. Acceptable avec corpus fixe, mais mérite un commentaire.

---

## Actions demandées

1. Supprimer `node_modules/.vite/vitest/results.json` du commit.
2. Retirer (ou justifier explicitement) les changements `hybrid-reranker.ts`, `semanticProtection`, constantes T121/T122, et champs `ScoreBreakdown` T121/T122.
3. Compléter le test "Enquêtes policières dans l'espace" avec une assertion que les candidats composites dominent les candidats thème individuel.

---

IMPLEMENTATION_FIX_REQUIRED

---

## Instructions de fix

# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T123/reviews/implementation-review.md
- generated at: 2026-08-23T16:25:59Z

---

---

# PR Review — T123: Improve semantic retrieval precision for thematic shelf intent

## Résumé

L'implémentation du cœur T123 (dual-embedding avec blend dans `semantic-search.ts`, champ `semanticAnchor` sur schéma/prompts, constante `SEMANTIC_ANCHOR_BLEND_ALPHA`) est **correcte et bien structurée**. Cependant, deux problèmes bloquants empêchent l'approbation.

---

## Points validés

- **Dual-embedding `semantic-search.ts`** : `embedQuery` appelés en parallèle (`Promise.all`), formule `ALPHA * anchorDist + (1-ALPHA) * intentDist` correcte, path legacy (sans anchor) byte-for-byte identique, guard `anchorVector.length > 0` correct.
- **`SEMANTIC_ANCHOR_BLEND_ALPHA=0`** reproduit exactement le comportement actuel — critère d'acceptance respecté.
- **Schema/migration** : `semantic_anchor TEXT` nullable dans les deux schémas Drizzle, migration additive non-breaking.
- **Prompts LLM** : instructions d'extraction claire avec contrainte de restrictivité, langage de contraste, propagés dans les deux services.
- **Tests blend** : 7 tests unitaires purs (`semantic-search-blend.test.ts`) sans DB ni API — couvrent les cas limites. 3 tests mapper corrects.
- **Benchmark "Aventures à travers le temps"** : assertion ≥4/8 titres temporels + false positives absents du top-5.

---

## Problèmes détectés

### 🔴 BLOQUANT 1 — Artefact `node_modules` commité

`apps/recommendation-engine/node_modules/.vite/vitest/results.json` est dans le diff. Ce fichier de cache vitest ne doit jamais être commité.

### 🔴 BLOQUANT 2 — Drift de scope dans `hybrid-reranker.ts` et fichiers de contrats

Le plan T123 dit explicitement :
> *"Excluded: Changing `hybrid-reranker.ts` scoring weights, `SCORE_MODEL_V2`, or profile-boost modulation."*

Le diff inclut des ajouts substantiels non planifiés appartenant à T121/T122 :

| Fichier | Ajout hors scope |
|---|---|
| `hybrid-reranker.ts` | `resolveProtectionSettings`, `passesSemanticFloor`, `computeSemanticConfidenceFactor`, blend `thematic`, filtrage `semanticFloor`, modulation `profileBoostEffective`, 12 champs breakdown |
| `query-plan.ts` | `semanticProtection?: 'strict' \| 'moderate' \| 'none'` |
| `config.ts` | `SEMANTIC_FLOOR_STRICT`, `SEMANTIC_FLOOR_MODERATE`, `SEMANTIC_WEIGHT_THEMATIC`, `PROFILE_BOOST_MIN_FACTOR`, `PROFILE_BOOST_MODULATION_POWER` |
| `recommendations.ts` | 8 champs optionnels `ScoreBreakdown` T121/T122 |

Si T121/T122 ne sont pas encore sur main, ces changements doivent soit faire l'objet d'une justification explicite, soit être retirés.

### 🟡 MINEUR — Test "Enquêtes policières dans l'espace" incomplet

La describe annonce `"space-detective candidates dominate over pure space or pure detective results"` mais le test ne contient aucune assertion de ce type — uniquement des vérifications génériques (floor, breakdown peuplé, modulation). Le critère d'acceptance T123 ("defining anchor concept dominates over each secondary theme independently") n'est pas vérifié pour ce second intent.

### 🟡 MINEUR — Détection titre temporel par mots-clés fragile

`'time'` peut matcher des titres non temporaux selon le corpus. Acceptable avec corpus fixe, mais mérite un commentaire.

---

## Actions demandées

1. Supprimer `node_modules/.vite/vitest/results.json` du commit.
2. Retirer (ou justifier explicitement) les changements `hybrid-reranker.ts`, `semanticProtection`, constantes T121/T122, et champs `ScoreBreakdown` T121/T122.
3. Compléter le test "Enquêtes policières dans l'espace" avec une assertion que les candidats composites dominent les candidats thème individuel.

---

IMPLEMENTATION_FIX_REQUIRED