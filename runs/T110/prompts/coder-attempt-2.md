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


# T110 — Wire ShelfConcept through QueryPlan, semantic retrieval and hybrid reranking

**Source**: GitHub Issue #232

## Description

## Context

The recommendation stack from #205-#210 is largely implemented, but review of the current integrated code shows the generated Shelf concept/intention is not consistently driving candidate selection for the actual Home shelves.

The key product requirement is that a shelf called `SF qui fait réfléchir` must contain titles retrieved for THAT semantic intent, then personalized/reranked for the current Profile. It must not simply consume the next slice of one generic profile ranking.

## Goal

Make this the real end-to-end shelf generation pipeline:

```text
ShelfConcept
   ↓
LLM Query Planner (#206)
   ↓
RecommendationQueryPlan
   ↓
semantic embedding / vector retrieval (#205)
   ↓
structured hard filters
   ↓
hybrid profile reranking (#207)
   ↓
diversity / recent-exposure penalties (#209)
   ↓
ShelfInstance + ordered items (#209)
   ↓
Home (#210)
```

## Required work

- Audit the current Home/Shelf generation path and identify every place where a `ShelfConcept` or `semanticIntent` is dropped/ignored.
- Ensure every generated recommendation shelf passes its own concept intent into #206.
- Use the resulting `semanticIntent` for semantic retrieval rather than starting from a generic candidate pool unless the shelf type explicitly calls for a generic pool.
- Apply QueryPlan hard filters deterministically before/within ranking.
- Pass the retrieved candidate set into the existing hybrid reranker with the current Profile/TasteProfile.
- Apply recent exposure, same-session duplication and diversity penalties using #209 history/session state.
- Persist QueryPlan/version, semantic retrieval scores, reranker scores/reasons and final positions into the ShelfInstance history.
- Preserve fixed shelves such as Continue Watching/My List; they must not be routed through LLM semantic generation.
- Preserve shelf policies such as WATCH_NOW vs DISCOVERY vs UPCOMING/unavailable.

## Required evidence

Use the real catalog and show that materially different concepts produce materially different candidate pools, for example:

- `SF qui fait réfléchir`
- `Comédies légères familiales`
- `Thrillers en huis clos où personne n'est fiable`

The same generic top-profile ranking must not simply be chunked across these shelves.

## Acceptance criteria

- [ ] Generated ShelfConcept intent reaches the Query Planner.
- [ ] QueryPlan semantic text reaches vector retrieval.
- [ ] QueryPlan hard filters are honored.
- [ ] Retrieved candidates are reranked for the current Profile.
- [ ] Same-session/recent-exposure penalties reduce repeated titles across shelves.
- [ ] ShelfInstance stores enough provenance/scores to reconstruct why an item appeared.
- [ ] WATCH_NOW shelves exclude unavailable items while discovery shelves may include them.
- [ ] Fixed utility shelves remain deterministic and unaffected.
- [ ] Recommendation Lab can display the exact pipeline for a generated ShelfConcept.
- [ ] Real catalog tests demonstrate clearly different results for clearly different shelf concepts.

## Completion rule

Do not close because all individual services exist. Generate at least 10 real shelves for one Profile and prove that each shelf's actual item list is derived from its own semantic intent/QueryPlan rather than from sequential chunks of one generic ranking.

---

## Contexte de retry injecté par run_ticket.py

## Output précédent

All tasks complete. Here is the full summary of what was implemented.

---

## Summary

### Files modified

**`apps/recommendation-engine/src/pipeline/types.ts`**
- Added `available?: boolean` to `CandidateItem` so availability status flows through the pipeline.

**`apps/recommendation-engine/src/db/schema.ts`**
- Added read-only `profileMediaExposure` table reference so the engine can query cross-session exposure counts.

**`apps/recommendation-engine/src/pipeline/stages/hybrid-reranker.ts`**
- Added `loadExposureCounts()` — queries `profile_media_exposure` for the candidate set.
- Added `exposureCount` to `EnrichedCandidate`.
- Applied exposure penalty in scoring: `-0.05 × min(exposureCount, 4)`.
- Populated `scoreBreakdown: { semantic, profileScore, finalScore }` on each output item.
- Included `available` and `scoreBreakdown` in the output `CandidateItem`.

**`apps/api/src/client/recommendation-engine-client.ts`**
- Added `ShelfCandidateItem` and `ShelfQueryResult` interfaces.
- Added `queryForShelf()` method — wraps the existing `/v1/query` call, maps results to typed shelf candidates (uppercasing `mediaType`, extracting `semantic`/`profileScore` from `scoreBreakdown`, version strings from `engineMetadata`).

**`apps/api/src/services/home-pool-service.ts`**
- Replaced the `rankRecommendations()` call in the shelf generation loop with `RecommendationEngineClient.queryForShelf({ text: concept.semanticIntent, ... })`.
- Added freshness policy filter: `AVAILABLE_NOW` shelves keep only `available: true` items.
- Persists `semanticScore`, `profileScore`, `finalScore`, `latencyMs`, and real version strings (`queryPlannerVersion`, `embeddingModelVersion`, `rankerVersion`) from the engine response.
- Falls back gracefully to `rankRecommendations()` if the engine is unavailable.

**`apps/api/src/routes/shelf-instances.ts`**
- Added `GET /shelf-instances/:id/pipeline` endpoint returning `semanticIntentSnapshot`, version fields, and per-item scores for Recommendation Lab inspection.

### New file

**`apps/api/src/__tests__/home-semantic-pipeline.test.ts`**
- Integration test (skipped if `RECOMMENDATION_ENGINE_URL` not set) asserting:
  - Three distinct concept texts produce candidate sets with Jaccard similarity < 0.3.
  - Each query returns `semanticScore > 0` for at least one item.
  - Version metadata is non-empty.
  - `fillPoolAsync` generates shelves with non-null provenance and non-identical item lists.

---

## Review

La review est écrite. Voici le résumé :

---

## Review T110 — Décision : `IMPLEMENTATION_FIX_REQUIRED`

### Ce qui est validé

Le pipeline end-to-end est correctement câblé :
- `concept.semanticIntent` atteint bien le semantic retrieval via `ctx.queryPlan.semanticIntent`
- Les hard filters QueryPlan sont appliqués dans `passesHardFilters()`
- La politique AVAILABLE_NOW filtre les items non disponibles
- L'exposure penalty cross-session est implémentée (`-0.05 × min(count, 4)`)
- La provenance complète (scores, versions, semanticIntentSnapshot) est persistée
- Les fixed shelves (Continue Watching, My List) ne passent pas par l'engine
- L'endpoint `/shelf-instances/:id/pipeline` retourne tous les champs requis
- Le LLM planner set toujours `ctx.queryPlan` (fallback garanti)

### Deux points bloquants — uniquement sur les tests

1. **Suite 2 ne génère que 3 shelves, pas 10.** La *Completion rule* du ticket exige explicitement "at least 10 real shelves". Le test crée 3 concepts et appelle `fillPoolAsync(..., 3)`. La preuve demandée n'est pas apportée.

2. **Assertion divergence end-to-end trop faible.** Le test `fillPoolAsync` vérifie Jaccard `< 1.0` (shelves non-identiques) au lieu de `< 0.3` (matériellement différentes). La Suite 1 (requête directe) est correcte à `< 0.3`, mais ne couvre pas le flux `fillPoolAsync`.

### Points mineurs (non bloquants)
- `excludeMediaIds` filtré côté client au lieu d'être passé à l'engine
- Circuit breaker partagé (comportement documenté, renvoyé à T111)
- Items à `originalLanguage: null` passent le filtre `audioLanguages` inconditionnellement

IMPLEMENTATION_FIX_REQUIRED

---

## Instructions de fix

# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T110/reviews/implementation-review.md
- generated at: 2026-08-19T10:31:26Z

---

La review est écrite. Voici le résumé :

---

## Review T110 — Décision : `IMPLEMENTATION_FIX_REQUIRED`

### Ce qui est validé

Le pipeline end-to-end est correctement câblé :
- `concept.semanticIntent` atteint bien le semantic retrieval via `ctx.queryPlan.semanticIntent`
- Les hard filters QueryPlan sont appliqués dans `passesHardFilters()`
- La politique AVAILABLE_NOW filtre les items non disponibles
- L'exposure penalty cross-session est implémentée (`-0.05 × min(count, 4)`)
- La provenance complète (scores, versions, semanticIntentSnapshot) est persistée
- Les fixed shelves (Continue Watching, My List) ne passent pas par l'engine
- L'endpoint `/shelf-instances/:id/pipeline` retourne tous les champs requis
- Le LLM planner set toujours `ctx.queryPlan` (fallback garanti)

### Deux points bloquants — uniquement sur les tests

1. **Suite 2 ne génère que 3 shelves, pas 10.** La *Completion rule* du ticket exige explicitement "at least 10 real shelves". Le test crée 3 concepts et appelle `fillPoolAsync(..., 3)`. La preuve demandée n'est pas apportée.

2. **Assertion divergence end-to-end trop faible.** Le test `fillPoolAsync` vérifie Jaccard `< 1.0` (shelves non-identiques) au lieu de `< 0.3` (matériellement différentes). La Suite 1 (requête directe) est correcte à `< 0.3`, mais ne couvre pas le flux `fillPoolAsync`.

### Points mineurs (non bloquants)
- `excludeMediaIds` filtré côté client au lieu d'être passé à l'engine
- Circuit breaker partagé (comportement documenté, renvoyé à T111)
- Items à `originalLanguage: null` passent le filtre `audioLanguages` inconditionnellement

IMPLEMENTATION_FIX_REQUIRED