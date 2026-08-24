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


# T128 — Build personalized Movies page with exploitation and discovery shelves

**Source**: GitHub Issue #272

## Description

## Context

IPTVFlix now has a personalized Home powered by the semantic/hybrid recommendation and shelf pipeline. The next product step is to replace the Movies page's generic/catalog-first experience with a discovery experience made primarily of **personalized movie shelves**.

The page must not simply reproduce fixed genre categories. Both the **themes chosen for the user** and the **movies ranked inside each theme** should be personalized.

A key product requirement is to balance:
- **exploitation**: themes/content we already have strong reasons to think the user likes;
- **exploration / serendipity**: themes/content outside the user's established habits where we are less certain, but have credible signals that the user could like them.

Initial target balance: roughly **75% exploitation / 25% exploration**, treated as a product policy rather than an exact per-request mathematical quota.

## Goal

Build the production **Films / Movies** page as a set of horizontal personalized movie-only shelves generated from the existing recommendation architecture.

## Shelf composition

The page should include a useful mix such as:

- **Pour toi** — strongest general movie recommendations.
- **Nouveautés pour toi** — recent/new movies personalized for the profile.
- Multiple **personalized thematic shelves** whose themes are selected/generated dynamically from the user's profile and can rotate over time.
- At least one **exploration / serendipity shelf** designed to test potentially interesting tastes outside the strongest known preferences.

Do not hardcode example themes. A user may receive concepts analogous to « Aventures à travers le temps », « SF qui fait réfléchir » or « Action sans temps mort », but theme selection must come from the generic shelf/theme pipeline.

## Dynamic themes

The themes themselves should evolve rather than permanently exposing the same categories.

- Prefer themes strongly supported by the profile for exploitation shelves.
- Maintain diversity between exploitation themes so they do not become minor variations of the same concept.
- Rotate/refresh themes according to the snapshot/freshness policy rather than on every page refresh.
- A theme should only render when the catalog contains enough relevant movie candidates to make a useful rail.

## Exploration / serendipity

Exploration must **not be pure random content**.

Implement a generic controlled-exploration strategy. Candidates/themes should be meaningfully different from the user's strongest established preferences while retaining one or more plausible positive signals (semantic adjacency, cast/director affinity, secondary genres, era/language patterns, quality prior, adjacent taste cluster, etc.).

The goal is:

> « We don't know whether you like this yet, but there is a credible reason you might. »

Avoid both extremes:
- recommending only near-duplicates of known tastes;
- throwing arbitrary unrelated catalog content at the user.

Design this so future `seen / neutral / liked / disliked` feedback can measure exploration outcomes and improve the profile.

## Movie-only constraint

Every discovery shelf on this page must enforce `movie` media type at retrieval/query level where possible. Do not retrieve mixed media and merely hide series in the frontend.

## Cross-shelf diversity

Apply the existing Home-style diversity principle across the Movies page:

- materially reduce duplicate titles across rails when enough alternatives exist;
- do not destroy thematic relevance merely to force uniqueness;
- avoid themes that are effectively duplicates of one another.

## Cache / cost control

Do not regenerate themes or perform LLM-dependent work on every Movies page refresh.

Use/reuse the Home snapshot/materialization principles where architecturally appropriate:
- page-level personalized discovery snapshot or equivalent reusable persisted result;
- reasonable freshness window (~24h initially is acceptable);
- repeated refreshes should not repeatedly consume LLM tokens;
- stale-while-revalidate where feasible;
- cheap live state may remain live.

Do not couple Movies page freshness to Home if that creates unnecessary regeneration or prevents independent evolution; reuse infrastructure, not necessarily the exact same snapshot.

## UX

- Reuse the production horizontal shelf/rail UI from Home where possible.
- Responsive web/mobile behavior.
- Consumer-facing UI only: no recommendation scores/debug explanations.
- Empty shelves disappear cleanly.
- One failing shelf must not break the whole page.
- Preserve existing movie detail/playback navigation.

## Acceptance criteria

- Movies page is primarily composed of personalized movie-only horizontal shelves.
- Both shelf themes and shelf contents are personalized.
- Multiple exploitation themes are dynamically selected/generated and are meaningfully distinct.
- At least one controlled exploration/serendipity shelf exists.
- Exploration is not pure randomness and can explain its candidate selection through existing internal diagnostics/signals.
- Product behavior targets approximately 75% known-taste exploitation / 25% exploration.
- No series leak into movie shelves.
- Cross-shelf duplicate titles and near-duplicate themes are materially reduced.
- Themes/results remain stable across ordinary refreshes and do not trigger repeated expensive/LLM generation within the freshness window.
- Existing Home and recommendation diagnostic tooling do not regress.
- Add automated tests for movie-only constraints, exploitation/exploration composition, theme diversity, cross-shelf deduplication, cache/snapshot reuse, and empty/error behavior.
- No movie/theme-specific hacks and no manual production DB changes.

---

## Contexte de retry injecté par run_ticket.py

## Output précédent

All 59 tests pass (13 movies-pool + 17 movies-snapshot + 14 home-pool + 15 home-snapshot). The fix was applied to both test files.

**Summary of changes:**

Two files modified — `movies-pool-service.test.ts` and `home-pool-service.test.ts`:

- In both `vi.mock` factory closures (lines 20–30 in each file): replaced arrow functions with regular `function` expressions in `mockImplementation` for `ShelfInstanceService` and `ShelfFatigueService`
- In both `beforeEach` blocks: same replacement for the `mockImplementation` calls that re-establish constructor mocks after `vi.resetAllMocks()`

Root cause: arrow functions cannot be called with `new` (they have no `[[Construct]]` slot), so Vitest 4 raises `TypeError: ... is not a constructor` whenever the production code does `new ShelfInstanceService(db)`. Regular `function` expressions are constructable.

---

## Review

I have a complete picture of the implementation. Writing the review now.

---

# PR Review — T128: Build personalized Movies page

## Résumé

L'implémentation est architecturalement solide et fidèle au plan : trois nouvelles tables DB, trois nouveaux services backend, un hook React et un composant page, avec 30 tests unitaires. Le flux HIT/STALE/MISS, la déduplication cross-shelf, l'isolation d'erreur par rail, et la contrainte movie-only au niveau de l'engine sont correctement implémentés.

Deux problèmes bloquants sont détectés : le filtre `desiredMediaTypes` absent dans la sélection des concepts, et l'absence de `fillMoviesPool` sur le chemin HIT quand la session est nouvelle.

---

## Vérifications effectuées

- Lecture complète des 3 services backend (`movies-service.ts`, `movies-pool-service.ts`, `movies-snapshot-service.ts`)
- Route (`profiles-movies.ts`) et enregistrement dans `index.ts`
- Schémas DB et migration SQL (`0051_t128_movies_tables.sql`)
- Contrat API (`packages/api-contracts/src/movies.ts`)
- Frontend complet (`MoviesPage.tsx`, `useInfiniteMovies.ts`)
- Tests (`movies-pool-service.test.ts` — 13 cas, `movies-snapshot-service.test.ts` — 17 cas)
- Plan (`runs/T128/plan.md`)
- Colonne `desiredMediaTypes` dans `shelf-concepts.ts` (JSONB)
- Enregistrement de la route dans le groupe `authenticate` protégé JWT (ligne 156 de `index.ts`)

---

## Points validés

- **Contrainte movie-only** : tous les chemins filtrent `c.mediaType === 'MOVIE'` à la sortie de l'engine et sur le fallback `rankRecommendations`. Pas de fuite série.
- **Snapshot HIT/STALE/MISS** : logique correcte, STALE sert les données existantes + déclenche une regénération async sans bloquer la réponse.
- **Déduplication cross-shelf** : `excludedMediaIds` accumulé correctement sur toute la séquence de rails déclarés, et repris à chaque appel `fillMoviesPool` (via la requête `servedItems`).
- **Ratio 75/25** : géré dans les rails déclarés (3 PERSONALIZED / 1 EXPLORATION / 2 SYSTEM_DECLARED) et dans `fillMoviesPool` via `MOVIES_EXPLORATION_RATIO`. Le test `fillMoviesPoolAsync` vérifie le ratio sur 20 slots.
- **Exploration non-aléatoire** : les concepts EXPLORATION/DISCOVERY viennent du pipeline de concepts de profil ; le test vérifie des `semanticScore > 0` pour les items de l'exploration shelf.
- **Session indépendante du Home** : table `movies_sessions` distincte, TTL et curseurs indépendants.
- **Isolation d'erreur** : chaque rail déclaré est dans un try/catch, le `ShelfErrorBoundary` côté frontend couvre les erreurs de rendu.
- **Route sécurisée** : enregistrée dans le scope `protectedApp` avec hook `authenticate` preHandler — `request.account!` est sûr.
- **Fallback populaire** : `buildMoviesFallbackShelf` active si les rails déclarés et l'engine échouent tous.
- **Contrat API propre** : `MoviesPageResponse` sans champ `hero`, réutilise `ShelfResponse`/`ShelfItem` existants.
- **Frontend conforme** : `useInfiniteMovies` miroir de `useInfiniteHome`, 3 retries exponentiels, IntersectionObserver 400px, `ShelfRow` réutilisé.
- **Scope respecté** : pas de modification Home, pas de déduplication cross-page, pas de feedback collection.

---

## Problèmes détectés

### [BLOQUANT 1] — Concepts non filtrés par `desiredMediaTypes`

**Fichier** : `movies-pool-service.ts`, fonctions `selectThematicMovieConcept` (ligne 408), `selectExplorationMovieConcept` (ligne 440), et `_fillMoviesPoolAsync` (ligne 179).

**Problème** : les requêtes sur `shelfConcepts` ne filtrent pas par `desiredMediaTypes contains 'MOVIE'`. La colonne est de type JSONB et peut contenir `['SERIES']`, `['MOVIE']` ou `['MOVIE', 'SERIES']`. Un concept PERSONALIZED ou EXPLORATION destiné aux séries (`desiredMediaTypes: ['SERIES']`) peut être sélectionné pour une shelf films, introduisant un `semanticIntent` et un titre orientés séries dans une page películas. L'engine filtre quand même les candidats MOVIE, mais la qualité de la query et le titre de la shelf seront incorrects.

**Plan explicite** : `selectExplorationMovieConcept(profileId, usedConceptIds)` — *"picks EXPLORATION/DISCOVERY concept filtered to MOVIE"*. La sélection doit filtrer par `desiredMediaTypes` inclut MOVIE.

**Correction** : ajouter à chacune des trois requêtes :
```ts
sql`${shelfConcepts.desiredMediaTypes} @> '["MOVIE"]'::jsonb`
```
(opérateur de containment JSONB PostgreSQL). Adapter en Drizzle si un helper est disponible.

---

### [BLOQUANT 2] — HIT path ne déclenche pas `fillMoviesPool`

**Fichier** : `movies-service.ts`, lignes 75–85 (branche HIT).

**Problème** : sur le chemin HIT (snapshot valide), `fillMoviesPool` n'est jamais appelé. Si `MOVIES_SNAPSHOT_TTL_HOURS > MOVIES_SESSION_TTL_HOURS` (ou si les deux expirent dans un ordre différent), `getOrCreateMoviesSession` crée une nouvelle session. Le `nextCursor` signé pointe vers cette nouvelle session vide. Quand le frontend suit ce curseur, `serveMoviesBatch` ne trouve aucun shelf en pool et retourne `hasMore: false` — la pagination infinie est cassée.

Même avec les deux TTL à 24h par défaut, toute configuration divergente expose ce bug (ex. `MOVIES_SNAPSHOT_TTL_HOURS=48, MOVIES_SESSION_TTL_HOURS=24`).

**Correction** : déclencher `fillMoviesPool` dans le chemin HIT :
```ts
if (snapshot && isMoviesSnapshotValid(snapshot)) {
  const shelves = await reconstructMoviesShelves(snapshot.declaredShelfInstanceIds)
  const hasMore = session.cursorReference !== 'exhausted'
  const nextPosition = snapshot.declaredShelfInstanceIds.length
  fillMoviesPool(session.id, profileId, MOVIES_POOL_TARGET)  // ← ajouter
  return { sessionId: session.id, shelves, nextCursor: ... }
}
```

---

### [MEDIUM 3] — `isMoviesSnapshotStale` ignore `invalidatedAt`

**Fichier** : `movies-snapshot-service.ts`, ligne 47.

Un snapshot `invalidatedAt !== null AND expiresAt < now` passe par la branche STALE (sert les données + regénère async) plutôt que MISS (regénère immédiatement). Contenu explicitement invalidé servi brièvement.

**Correction** :
```ts
export function isMoviesSnapshotStale(snapshot: MoviesSnapshot): boolean {
  if (snapshot.invalidatedAt !== null) return false
  return snapshot.expiresAt < new Date()
}
```

---

### [MEDIUM 4] — "Nouveautés pour toi" utilise `movies.createdAt` au lieu de la date de sortie

**Fichier** : `movies-pool-service.ts`, `getFreshMovieIds` (ligne 342).

`movies.createdAt` est la date d'insertion en base. Dans un catalogue TMDB-synced, des films anciens importés en lot apparaîtront comme "nouveautés". Le plan dit `freshnessPolicy=NEW_RELEASES`. Si le schéma `movies` dispose d'une colonne `releaseDate` ou `releaseYear`, elle devrait être utilisée à la place.

---

### [MINEUR 5] — Paramètre `sessionId` inutilisé dans `selectThematicMovieConcept`

**Fichier** : `movies-pool-service.ts`, ligne 409.

`sessionId` est passé en paramètre mais non utilisé dans la requête SQL. Seul le set in-memory `usedConceptIds` assure la déduplication. Supprimer le paramètre ou l'utiliser réellement.

---

### [MINEUR 6] — `moviesSessions.expiresAt` nullable dans le schéma Drizzle

**Fichier** : `movies-sessions.ts`, ligne 10.

La colonne est déclarée sans `.notNull()`. Une session insérée sans `expiresAt` aurait un NULL qui ne matcherait jamais le filtre `expiresAt > now`, créant une session fantôme non récupérable. Ajouter `.notNull()` pour correspondre à l'invariant réel.

---

## Risques éventuels

- **Concurrent STALE regeneration** : plusieurs requêtes simultanées pendant la fenêtre STALE peuvent déclencher plusieurs `_regenerateMoviesSnapshot` concurrents, créant des `shelf_instances` orphelines (celles de la première regénération abandonnée). L'upsert `onConflictDoUpdate` protège le snapshot lui-même, mais les rows orphelins s'accumulent. Risque de croissance DB sur les profils actifs pendant les fenêtres de renouvellement.
- **Pool fill sans attente** : `fillMoviesPool` fire-and-forget ; une erreur non prévue est swallowed avec `console.error`. Acceptable selon la politique de l'implémentation actuelle.

---

## Décision

REQUEST_CHANGES

## Actions demandées

1. **[BLOQUANT]** Ajouter `shelfConcepts.desiredMediaTypes @> '["MOVIE"]'::jsonb` dans les WHERE de `selectThematicMovieConcept`, `selectExplorationMovieConcept`, et la requête `conceptRows` de `_fillMoviesPoolAsync`.
2. **[BLOQUANT]** Ajouter `fillMoviesPool(session.id, profileId, MOVIES_POOL_TARGET)` dans la branche HIT de `buildMoviesPage` (après `reconstructMoviesShelves`, avant le return).
3. **[MEDIUM]** Corriger `isMoviesSnapshotStale` pour retourner `false` si `invalidatedAt !== null`.
4. **[MEDIUM]** Vérifier si `movies` dispose d'une colonne de date de sortie ; si oui, l'utiliser dans `getFreshMovieIds` plutôt que `createdAt`.
5. **[MINEUR]** Supprimer le paramètre `sessionId` de `selectThematicMovieConcept` ou l'intégrer dans la requête SQL.
6. **[MINEUR]** Ajouter `.notNull()` sur `moviesSessions.expiresAt` dans le schéma Drizzle.

IMPLEMENTATION_FIX_REQUIRED

---

## Instructions de fix

# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T128/reviews/implementation-review.md
- generated at: 2026-08-24T13:34:42Z

---

I have a complete picture of the implementation. Writing the review now.

---

# PR Review — T128: Build personalized Movies page

## Résumé

L'implémentation est architecturalement solide et fidèle au plan : trois nouvelles tables DB, trois nouveaux services backend, un hook React et un composant page, avec 30 tests unitaires. Le flux HIT/STALE/MISS, la déduplication cross-shelf, l'isolation d'erreur par rail, et la contrainte movie-only au niveau de l'engine sont correctement implémentés.

Deux problèmes bloquants sont détectés : le filtre `desiredMediaTypes` absent dans la sélection des concepts, et l'absence de `fillMoviesPool` sur le chemin HIT quand la session est nouvelle.

---

## Vérifications effectuées

- Lecture complète des 3 services backend (`movies-service.ts`, `movies-pool-service.ts`, `movies-snapshot-service.ts`)
- Route (`profiles-movies.ts`) et enregistrement dans `index.ts`
- Schémas DB et migration SQL (`0051_t128_movies_tables.sql`)
- Contrat API (`packages/api-contracts/src/movies.ts`)
- Frontend complet (`MoviesPage.tsx`, `useInfiniteMovies.ts`)
- Tests (`movies-pool-service.test.ts` — 13 cas, `movies-snapshot-service.test.ts` — 17 cas)
- Plan (`runs/T128/plan.md`)
- Colonne `desiredMediaTypes` dans `shelf-concepts.ts` (JSONB)
- Enregistrement de la route dans le groupe `authenticate` protégé JWT (ligne 156 de `index.ts`)

---

## Points validés

- **Contrainte movie-only** : tous les chemins filtrent `c.mediaType === 'MOVIE'` à la sortie de l'engine et sur le fallback `rankRecommendations`. Pas de fuite série.
- **Snapshot HIT/STALE/MISS** : logique correcte, STALE sert les données existantes + déclenche une regénération async sans bloquer la réponse.
- **Déduplication cross-shelf** : `excludedMediaIds` accumulé correctement sur toute la séquence de rails déclarés, et repris à chaque appel `fillMoviesPool` (via la requête `servedItems`).
- **Ratio 75/25** : géré dans les rails déclarés (3 PERSONALIZED / 1 EXPLORATION / 2 SYSTEM_DECLARED) et dans `fillMoviesPool` via `MOVIES_EXPLORATION_RATIO`. Le test `fillMoviesPoolAsync` vérifie le ratio sur 20 slots.
- **Exploration non-aléatoire** : les concepts EXPLORATION/DISCOVERY viennent du pipeline de concepts de profil ; le test vérifie des `semanticScore > 0` pour les items de l'exploration shelf.
- **Session indépendante du Home** : table `movies_sessions` distincte, TTL et curseurs indépendants.
- **Isolation d'erreur** : chaque rail déclaré est dans un try/catch, le `ShelfErrorBoundary` côté frontend couvre les erreurs de rendu.
- **Route sécurisée** : enregistrée dans le scope `protectedApp` avec hook `authenticate` preHandler — `request.account!` est sûr.
- **Fallback populaire** : `buildMoviesFallbackShelf` active si les rails déclarés et l'engine échouent tous.
- **Contrat API propre** : `MoviesPageResponse` sans champ `hero`, réutilise `ShelfResponse`/`ShelfItem` existants.
- **Frontend conforme** : `useInfiniteMovies` miroir de `useInfiniteHome`, 3 retries exponentiels, IntersectionObserver 400px, `ShelfRow` réutilisé.
- **Scope respecté** : pas de modification Home, pas de déduplication cross-page, pas de feedback collection.

---

## Problèmes détectés

### [BLOQUANT 1] — Concepts non filtrés par `desiredMediaTypes`

**Fichier** : `movies-pool-service.ts`, fonctions `selectThematicMovieConcept` (ligne 408), `selectExplorationMovieConcept` (ligne 440), et `_fillMoviesPoolAsync` (ligne 179).

**Problème** : les requêtes sur `shelfConcepts` ne filtrent pas par `desiredMediaTypes contains 'MOVIE'`. La colonne est de type JSONB et peut contenir `['SERIES']`, `['MOVIE']` ou `['MOVIE', 'SERIES']`. Un concept PERSONALIZED ou EXPLORATION destiné aux séries (`desiredMediaTypes: ['SERIES']`) peut être sélectionné pour une shelf films, introduisant un `semanticIntent` et un titre orientés séries dans une page películas. L'engine filtre quand même les candidats MOVIE, mais la qualité de la query et le titre de la shelf seront incorrects.

**Plan explicite** : `selectExplorationMovieConcept(profileId, usedConceptIds)` — *"picks EXPLORATION/DISCOVERY concept filtered to MOVIE"*. La sélection doit filtrer par `desiredMediaTypes` inclut MOVIE.

**Correction** : ajouter à chacune des trois requêtes :
```ts
sql`${shelfConcepts.desiredMediaTypes} @> '["MOVIE"]'::jsonb`
```
(opérateur de containment JSONB PostgreSQL). Adapter en Drizzle si un helper est disponible.

---

### [BLOQUANT 2] — HIT path ne déclenche pas `fillMoviesPool`

**Fichier** : `movies-service.ts`, lignes 75–85 (branche HIT).

**Problème** : sur le chemin HIT (snapshot valide), `fillMoviesPool` n'est jamais appelé. Si `MOVIES_SNAPSHOT_TTL_HOURS > MOVIES_SESSION_TTL_HOURS` (ou si les deux expirent dans un ordre différent), `getOrCreateMoviesSession` crée une nouvelle session. Le `nextCursor` signé pointe vers cette nouvelle session vide. Quand le frontend suit ce curseur, `serveMoviesBatch` ne trouve aucun shelf en pool et retourne `hasMore: false` — la pagination infinie est cassée.

Même avec les deux TTL à 24h par défaut, toute configuration divergente expose ce bug (ex. `MOVIES_SNAPSHOT_TTL_HOURS=48, MOVIES_SESSION_TTL_HOURS=24`).

**Correction** : déclencher `fillMoviesPool` dans le chemin HIT :
```ts
if (snapshot && isMoviesSnapshotValid(snapshot)) {
  const shelves = await reconstructMoviesShelves(snapshot.declaredShelfInstanceIds)
  const hasMore = session.cursorReference !== 'exhausted'
  const nextPosition = snapshot.declaredShelfInstanceIds.length
  fillMoviesPool(session.id, profileId, MOVIES_POOL_TARGET)  // ← ajouter
  return { sessionId: session.id, shelves, nextCursor: ... }
}
```

---

### [MEDIUM 3] — `isMoviesSnapshotStale` ignore `invalidatedAt`

**Fichier** : `movies-snapshot-service.ts`, ligne 47.

Un snapshot `invalidatedAt !== null AND expiresAt < now` passe par la branche STALE (sert les données + regénère async) plutôt que MISS (regénère immédiatement). Contenu explicitement invalidé servi brièvement.

**Correction** :
```ts
export function isMoviesSnapshotStale(snapshot: MoviesSnapshot): boolean {
  if (snapshot.invalidatedAt !== null) return false
  return snapshot.expiresAt < new Date()
}
```

---

### [MEDIUM 4] — "Nouveautés pour toi" utilise `movies.createdAt` au lieu de la date de sortie

**Fichier** : `movies-pool-service.ts`, `getFreshMovieIds` (ligne 342).

`movies.createdAt` est la date d'insertion en base. Dans un catalogue TMDB-synced, des films anciens importés en lot apparaîtront comme "nouveautés". Le plan dit `freshnessPolicy=NEW_RELEASES`. Si le schéma `movies` dispose d'une colonne `releaseDate` ou `releaseYear`, elle devrait être utilisée à la place.

---

### [MINEUR 5] — Paramètre `sessionId` inutilisé dans `selectThematicMovieConcept`

**Fichier** : `movies-pool-service.ts`, ligne 409.

`sessionId` est passé en paramètre mais non utilisé dans la requête SQL. Seul le set in-memory `usedConceptIds` assure la déduplication. Supprimer le paramètre ou l'utiliser réellement.

---

### [MINEUR 6] — `moviesSessions.expiresAt` nullable dans le schéma Drizzle

**Fichier** : `movies-sessions.ts`, ligne 10.

La colonne est déclarée sans `.notNull()`. Une session insérée sans `expiresAt` aurait un NULL qui ne matcherait jamais le filtre `expiresAt > now`, créant une session fantôme non récupérable. Ajouter `.notNull()` pour correspondre à l'invariant réel.

---

## Risques éventuels

- **Concurrent STALE regeneration** : plusieurs requêtes simultanées pendant la fenêtre STALE peuvent déclencher plusieurs `_regenerateMoviesSnapshot` concurrents, créant des `shelf_instances` orphelines (celles de la première regénération abandonnée). L'upsert `onConflictDoUpdate` protège le snapshot lui-même, mais les rows orphelins s'accumulent. Risque de croissance DB sur les profils actifs pendant les fenêtres de renouvellement.
- **Pool fill sans attente** : `fillMoviesPool` fire-and-forget ; une erreur non prévue est swallowed avec `console.error`. Acceptable selon la politique de l'implémentation actuelle.

---

## Décision

REQUEST_CHANGES

## Actions demandées

1. **[BLOQUANT]** Ajouter `shelfConcepts.desiredMediaTypes @> '["MOVIE"]'::jsonb` dans les WHERE de `selectThematicMovieConcept`, `selectExplorationMovieConcept`, et la requête `conceptRows` de `_fillMoviesPoolAsync`.
2. **[BLOQUANT]** Ajouter `fillMoviesPool(session.id, profileId, MOVIES_POOL_TARGET)` dans la branche HIT de `buildMoviesPage` (après `reconstructMoviesShelves`, avant le return).
3. **[MEDIUM]** Corriger `isMoviesSnapshotStale` pour retourner `false` si `invalidatedAt !== null`.
4. **[MEDIUM]** Vérifier si `movies` dispose d'une colonne de date de sortie ; si oui, l'utiliser dans `getFreshMovieIds` plutôt que `createdAt`.
5. **[MINEUR]** Supprimer le paramètre `sessionId` de `selectThematicMovieConcept` ou l'intégrer dans la requête SQL.
6. **[MINEUR]** Ajouter `.notNull()` sur `moviesSessions.expiresAt` dans le schéma Drizzle.

IMPLEMENTATION_FIX_REQUIRED