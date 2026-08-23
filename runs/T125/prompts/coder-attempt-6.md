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


# T125 — Build personalized Home page with production shelf rails

**Source**: GitHub Issue #266

## Description

## Context

The semantic + hybrid personalized shelf pipeline is now good enough to move from diagnostics/benchmarking into the real IPTVFlix product experience.

We want the **Accueil / Home** page to become the main personalized discovery surface, Netflix-style: multiple horizontal rails mixing useful product shelves and recommendation shelves rather than exposing recommendation diagnostics.

This ticket is the first production integration of the shelf/recommendation engine into the Home UI.

## Goal

Build the Home page infrastructure for horizontally scrollable content shelves and populate an initial set of personalized rails using real catalog/user data.

Initial Home order:

1. **Continuer à regarder** — movies/episodes with playback progress, when non-empty.
2. **Pour toi** — strongest general personalized recommendations.
3. **Nouveautés pour toi** — recent/new catalog content reranked for the user.
4. **One dynamic editorial/personalized thematic shelf** — e.g. concepts generated/selected by the existing shelf system such as « Aventures à travers le temps », « Action sans temps mort », « SF qui fait réfléchir ». This must use the generic shelf pipeline, not hardcoded movie lists.
5. **Films pour toi** — personalized movie-only recommendations.
6. **Séries pour toi** — personalized series-only recommendations.

Empty shelves must simply not render.

## UX

- Netflix-like horizontal poster rails suitable for TV and responsive web/mobile.
- Each rail has a clear human-readable title.
- Poster cards reuse existing content/navigation behavior where possible rather than creating a parallel detail flow.
- Horizontal navigation must work correctly with TV remote/focus as well as touch/mouse.
- Keep the Home experience consumer-facing: semantic diagnostics, raw vector scores, reranker tags and internal scoring explanations must not appear in normal Home UI.
- Loading/error states should degrade gracefully and should not block unrelated shelves.

## Recommendation behavior

- Use the existing semantic/hybrid personalization pipeline rather than implementing a second recommendation engine for Home.
- Preserve media-type constraints for movie-only / series-only shelves.
- `Continuer à regarder` is behavioral/product data and should not be reranked as a semantic discovery shelf.
- `Nouveautés pour toi` should combine recency/catalog freshness with personalization rather than simply listing all newest content chronologically.
- The dynamic thematic shelf should be replaceable/rotatable without frontend code changes.

### Cross-shelf diversity

Avoid making Home look like the same 10–20 titles repeated in every rail.

Introduce a generic cross-shelf diversity policy for discovery shelves: titles already shown prominently in an earlier Home shelf should receive an exclusion or strong attenuation in subsequent shelves when enough alternative relevant candidates exist. Do not sacrifice shelf relevance merely to force uniqueness.

`Continuer à regarder` is exempt: a currently watched title may legitimately coexist with discovery/history surfaces where product logic requires it.

## Prepare for upcoming watch/feedback model

Do not require the full watched/like/dislike feature in this ticket, but design the Home shelf/card contracts so they can later consume user-content state without a rewrite:

- unseen
- seen / neutral
- liked
- disliked
- playback progress

Future behavior will generally remove already-seen titles from discovery shelves while allowing liked/seen titles to appear in a dedicated **À revoir** shelf. Do not build `À revoir` yet unless the underlying state already makes it trivial.

## Architecture

- Prefer a reusable shelf/rail component and declarative Home shelf configuration over six bespoke sections.
- Backend/API should expose the data needed by the Home page in a way that does not require the client to understand recommendation internals.
- Avoid N+1 catalog calls and avoid independently recomputing expensive profile/recommendation context for every shelf when context can safely be shared within the request.
- Preserve existing diagnostic/preview tooling for development; this ticket is about consuming the engine in the production UI, not removing the tooling.

## Acceptance criteria

- Home renders the six initial shelf types above when data exists.
- Shelves are horizontal poster rails and usable on Android TV/TV focus navigation and responsive web/mobile.
- `Pour toi`, `Nouveautés pour toi`, the dynamic thematic shelf, `Films pour toi`, and `Séries pour toi` use the current personalization/recommendation architecture.
- Dynamic thematic shelf content is generic/data-driven and not a hardcoded movie list.
- Movie and series constraints are respected.
- Empty/erroring individual shelves do not break the whole Home page.
- Internal recommendation diagnostics are absent from consumer Home.
- Cross-shelf duplication is materially reduced while preserving relevance.
- Existing recommendation diagnostics/preview functionality continues to work.
- Add automated tests for shelf composition/order, media-type constraints, empty/error cases, and cross-shelf diversity.
- No manual production DB changes and no title-specific/shelf-specific recommendation hacks.

---

## Contexte de retry injecté par run_ticket.py

## Output précédent

All 27 home tests pass (12 pool + 15 service). The three root causes were:

1. **`vi.clearAllMocks()` not clearing `mockReturnValueOnce` queue** → changed to `vi.resetAllMocks()`
2. **`vi.resetAllMocks()` clearing constructor `mockImplementation`** → re-establish `ShelfInstanceService` and `ShelfFatigueService` constructor mocks in `beforeEach`; without this, Rail 4 fails immediately, shifts the engine mock queue, and breaks all subsequent rails
3. **DB mock order wrong in freshness test** → `getFreshMediaIds` (Rail 3) hits the DB before `selectThematicConcept` (Rail 4), so fresh movies mock must be first in the queue

The 33 pre-existing failures in other test files are unrelated to this ticket.

---

## Review

---

## Review — T125: Build personalized Home page with production shelf rails

L'implémentation est **fonctionnellement complète** : 6 rails dans le bon ordre, déduplication cross-shelf, contraintes mediaType, filtre de fraîcheur, isolation d'erreur par rail, aucune donnée diagnostique exposée côté consumer, 27+ tests passants.

**Deux points bloquants** exigent un correctif avant merge :

### 🔴 Bloquant 1 — `trace_test.ts` : artefact de debug committé

`apps/api/src/services/__tests__/trace_test.ts` est un fichier de debugging laissé en production avec des `console.log`, des variables inutilisées (`dbCallN`, `label`), et un test nommé `'TRACE: Films rail with selectN logging'`. Il doit être supprimé.

### 🔴 Bloquant 2 — `persistFixedShelvesForSession` : code mort

La fonction `persistFixedShelvesForSession` (lignes 702–750 de `home-pool-service.ts`) est exportée mais jamais importée dans `home-service.ts`. Le plan dit explicitement de la retirer ("declared rails persist themselves internally"). Elle doit être supprimée.

### 🟡 Observation — Fragilité du premier test d'ordre de déclaration

Le premier test dans `describe('buildDeclaredRails — declaration order')` appelle `setupEngineRails()` (qui empile des mocks DB) puis ajoute d'autres mocks DB dans son corps. L'enrichissement consomme des mocks désynchronisés. Le test passe uniquement parce que les assertions ne couvrent que les titres de rails, pas les données d'items.

### 🟡 Observation — `componentDidCatch` vide

`ShelfErrorBoundary` absorbe silencieusement les erreurs de rendu sans aucune trace. Acceptable pour la dégradation gracieuse, mais rendra le debugging difficile en production.

**Décision** : `IMPLEMENTATION_FIX_REQUIRED`

IMPLEMENTATION_FIX_REQUIRED

---

## Instructions de fix

# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T125/reviews/implementation-review.md
- generated at: 2026-08-23T23:45:30Z

---

---

## Review — T125: Build personalized Home page with production shelf rails

L'implémentation est **fonctionnellement complète** : 6 rails dans le bon ordre, déduplication cross-shelf, contraintes mediaType, filtre de fraîcheur, isolation d'erreur par rail, aucune donnée diagnostique exposée côté consumer, 27+ tests passants.

**Deux points bloquants** exigent un correctif avant merge :

### 🔴 Bloquant 1 — `trace_test.ts` : artefact de debug committé

`apps/api/src/services/__tests__/trace_test.ts` est un fichier de debugging laissé en production avec des `console.log`, des variables inutilisées (`dbCallN`, `label`), et un test nommé `'TRACE: Films rail with selectN logging'`. Il doit être supprimé.

### 🔴 Bloquant 2 — `persistFixedShelvesForSession` : code mort

La fonction `persistFixedShelvesForSession` (lignes 702–750 de `home-pool-service.ts`) est exportée mais jamais importée dans `home-service.ts`. Le plan dit explicitement de la retirer ("declared rails persist themselves internally"). Elle doit être supprimée.

### 🟡 Observation — Fragilité du premier test d'ordre de déclaration

Le premier test dans `describe('buildDeclaredRails — declaration order')` appelle `setupEngineRails()` (qui empile des mocks DB) puis ajoute d'autres mocks DB dans son corps. L'enrichissement consomme des mocks désynchronisés. Le test passe uniquement parce que les assertions ne couvrent que les titres de rails, pas les données d'items.

### 🟡 Observation — `componentDidCatch` vide

`ShelfErrorBoundary` absorbe silencieusement les erreurs de rendu sans aucune trace. Acceptable pour la dégradation gracieuse, mais rendra le debugging difficile en production.

**Décision** : `IMPLEMENTATION_FIX_REQUIRED`

IMPLEMENTATION_FIX_REQUIRED