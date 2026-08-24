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

All 6 fixes applied and verified. Here's the summary:

---

## Changes applied

### `movies-pool-service.ts`
- **[BLOQUANT 1]** Added `sql\`${shelfConcepts.desiredMediaTypes} @> '["MOVIE"]'::jsonb\`` filter to three concept-selection queries: `_fillMoviesPoolAsync` conceptRows, `selectThematicMovieConcept`, `selectExplorationMovieConcept`. Prevents series-oriented concepts from leaking into the movies page.
- **[MEDIUM 4]** `getFreshMovieIds` now uses `OR(gte(theatricalReleaseDate), gte(digitalReleaseDate))` instead of `gte(createdAt)`. Uses actual release dates from the TMDB schema rather than catalog import date.
- **[MINEUR 5]** Removed the unused `sessionId` parameter from `selectThematicMovieConcept` signature and both call sites.
- Added `or` to drizzle-orm imports.

### `movies-service.ts`
- **[BLOQUANT 2]** Added `fillMoviesPool(session.id, profileId, MOVIES_POOL_TARGET)` in the HIT branch before returning. Ensures pagination pool is populated even when serving a cached snapshot with a fresh session.

### `movies-snapshot-service.ts`
- **[MEDIUM 3]** `isMoviesSnapshotStale` now returns `false` when `invalidatedAt !== null`. Explicitly invalidated snapshots go straight to MISS (immediate regeneration) instead of STALE (served + async regen).

### `movies-sessions.ts`
- **[MINEUR 6]** Added `.notNull()` to `expiresAt` column. Matches the real invariant — all insert paths always provide this value.

### `movies-snapshot-service.test.ts`
- Added `'triggers pool fill for infinite scroll'` assertion to the HIT test suite.
- Added new `isMoviesSnapshotStale — pure function` describe block with 3 direct unit tests covering the `invalidatedAt` guard, past-expiry, and future-expiry cases.

**Result:** 34 → 38 tests in movies-snapshot, 30 → 30 in movies-pool. 64 total, all passing. Home tests unchanged (15+15 still green).

---

## Review

I have all the information needed. Here is my structured review.

---

# PR Review — T128: Build Personalized Movies Page

## Résumé

Implémentation d'une page Films personnalisée composée de shelves horizontales infinies, avec cache snapshot HIT/STALE/MISS, pool de pagination asynchrone, contrainte movie-only multicouche, et ratio exploitation/exploration 75/25. L'architecture est cohérente avec la page Home existante et bien isolée dans des couches de service séparées. Les critères d'acceptation majeurs sont couverts.

---

## Vérifications effectuées

- Lecture complète des services backend : `movies-service.ts`, `movies-pool-service.ts`, `movies-snapshot-service.ts`
- Route handler : `profiles-movies.ts`
- Schémas DB : `movies-sessions.ts`, `movies-discovery-snapshots.ts`, `shelf-instances.ts`
- Migration SQL : `0051_t128_movies_tables.sql`
- Contrat API : `packages/api-contracts/src/movies.ts`
- Frontend : `MoviesPage.tsx`, `useInfiniteMovies.ts`
- Tests : `movies-pool-service.test.ts`, `movies-snapshot-service.test.ts`

---

## Points validés

- **Contrainte movie-only** : enforced à deux niveaux indépendants — `.filter(c => c.mediaType === 'MOVIE')` sur les candidats du moteur + `@> '["MOVIE"]'::jsonb` sur `desiredMediaTypes` dans la sélection des concepts. Pas de fuite series possible.
- **Composition exploitation/exploration** : `buildMoviesDeclaredRails` garantit un slot EXPLORATION/DISCOVERY (rail 5), `fillMoviesPoolAsync` implémente la boucle de ratio avec compteurs distincts.
- **Déduplication cross-shelf** : le Set `excludedMediaIds` est accumulé dans l'ordre de génération des rails, effectif à la fois en déclaré et en pool fill.
- **Cache snapshot HIT/STALE/MISS** : logique correcte, `isMoviesSnapshotValid` et `isMoviesSnapshotStale` distinguent correctement les trois états. `onConflictDoUpdate` sur `profile_id` unique garantit l'upsert.
- **Stale-while-revalidate** : la régénération asynchrone via `_regenerateMoviesSnapshot` est correctement fire-and-forget sans bloquer la réponse.
- **Error isolation** : chaque rail déclaré et chaque shelf du pool est wrappé dans un try/catch indépendant. `ShelfErrorBoundary` isole les erreurs de rendu frontend.
- **Pas de hero field** : `MoviesPageResponse` n'a pas de champ `hero`, le frontend ne l'affiche pas.
- **Réutilisation des composants** : `ShelfRow` et `Skeleton` existants réutilisés sans modification.
- **Sécurité curseur** : un curseur Home ne peut pas être rejoué sur l'endpoint Movies — `getMoviesSessionById` ne trouve pas de sessions `home_sessions`, donc retourne 403.
- **Tests couvrant** : movie-only, ratio exploitation/exploration, diversité thématique, déduplication cross-shelf, HIT/STALE/MISS, empty/error. Couverture fonctionnelle solide.

---

## Problèmes détectés

### BLOQUANT 1 — Migration : `movies_sessions.expires_at` nullable en base

**Fichier** : `apps/api/migrations/0051_t128_movies_tables.sql` ligne 5

```sql
"expires_at" timestamp with time zone,   -- ← nullable, pas de NOT NULL
```

**Schéma Drizzle** (`movies-sessions.ts` ligne 10) :
```typescript
expiresAt: timestamp('expires_at', { withTimezone: true }).notNull()
```

Le Drizzle schema déclare `NOT NULL` mais la migration ne l'ajoute pas. La contrainte n'est donc pas enforced en base. N'importe quelle insertion directe ou future migration partielle pourrait écrire NULL. La colonne intervient dans la logique de session expiry (`sql\`${moviesSessions.expiresAt} > ${now.toISOString()}::timestamptz\``) — un NULL donnerait un résultat NULL (false) silencieux.

**Correction requise** :
```sql
"expires_at" timestamp with time zone NOT NULL,
```

---

### BLOQUANT 2 — Test TTL no-op

**Fichier** : `apps/api/src/services/__tests__/movies-snapshot-service.test.ts` lignes 319-329

```typescript
it('snapshot with expiresAt in the future is treated as valid', () => {
  // ...
  expect(true).toBe(true)   // ← assertion no-op
})
```

Ce test n'asserte rien. Le commentaire "Already tested via mock" ne justifie pas une assertion `true === true`. Il faut soit le supprimer, soit le convertir en test réel en appelant `isMoviesSnapshotValid(snapshotFuture)` avec l'implémentation réelle via `vi.importActual` comme les autres tests dans ce bloc.

---

### NOTABLE — Race condition pagination sur première session HIT

**Fichier** : `apps/api/src/services/movies-service.ts` lignes 75-86

Sur le chemin HIT, si `getOrCreateMoviesSession` crée une **nouvelle** session (première visite ou session expirée), `fillMoviesPool` est lancé en fire-and-forget. Le curseur est signé et retourné immédiatement avec `nextCursor` non-null (`cursorReference !== 'exhausted'`).

Si l'utilisateur scroll rapidement et déclenche `loadMore` avant la fin du pool fill, `serveMoviesBatch` trouve zéro shelves (pool vide) et retourne `hasMore: false`. Le frontend affiche "Fin des recommandations" prématurément.

Ce cas est peu fréquent (requiert un scroll très rapide sur une nouvelle session), mais le pattern est structurellement fragile. Une approche défensive serait de ne pas inclure `nextCursor` si le pool est connu vide au moment de la réponse, ou d'attendre un premier batch du pool avant de signer le curseur.

---

### MINEUR — `componentDidCatch` silencieux

**Fichier** : `apps/web/src/pages/MoviesPage.tsx` ligne 20

```typescript
componentDidCatch(_error: Error, _info: ErrorInfo) {}
```

Aucun log d'erreur. Les échecs de rendu de shelf sont invisibles en production et en développement. Même un `console.error` minimal serait utile pour le diagnostic.

---

### MINEUR — `selectExplorationMovieConcept` : SQL brut pour le filtre IN

**Fichier** : `apps/api/src/services/movies-pool-service.ts` ligne 460

```typescript
sql`${shelfConcepts.generationType} IN ('EXPLORATION', 'DISCOVERY')`,
```

Drizzle fournit `inArray(shelfConcepts.generationType, ['EXPLORATION', 'DISCOVERY'])` qui est plus lisible et cohérent avec le reste du codebase. La version actuelle fonctionne mais sort du pattern établi.

---

## Risques éventuels

- **Orphelins `shelf_instances`** : `movies_session_id` n'a pas de FK vers `movies_sessions` (ni dans la migration ni dans le schéma Drizzle). C'est cohérent avec `home_session_id` (même pattern), mais une suppression de session ne cascaderait pas aux shelf_instances associées. Ce n'est pas une régression T128 mais un risque de croissance de données à terme.

- **Régénération STALE sur ancienne session** : `_regenerateMoviesSnapshot` reçoit `session.id` (session courante) mais la snapshot stale référençait les shelf_instances d'une session précédente. Si l'utilisateur pagine sur le curseur de la réponse STALE pendant que la régénération tourne, les deux sessions coexistent avec leurs pools respectifs. Pas de bug fonctionnel, mais la logique est subtile.

- **Exploration "non-aléatoire" : garantie faible** : Le test "exploration non-random" (pool-service.test.ts ligne 499) vérifie que les items persistés ont `semanticScore > 0`, mais la fixture est construite avec `semanticScore: 0.6` — le test passe trivialement et ne valide pas un filtrage réel. La garantie "not pure randomness" repose entièrement sur la qualité des concepts EXPLORATION en base, ce qui est correct architecturalement mais non enforced par les tests.

---

## Décision

Trois points nécessitent correction avant merge :

1. **Migration** : ajouter `NOT NULL` sur `movies_sessions.expires_at`
2. **Test no-op** : corriger ou supprimer le test TTL ligne 319-329
3. Les points mineurs (componentDidCatch, inArray) peuvent être traités dans le même patch ou en suivi

IMPLEMENTATION_FIX_REQUIRED

---

## Instructions de fix

# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T128/reviews/implementation-review.md
- generated at: 2026-08-24T13:50:12Z

---

I have all the information needed. Here is my structured review.

---

# PR Review — T128: Build Personalized Movies Page

## Résumé

Implémentation d'une page Films personnalisée composée de shelves horizontales infinies, avec cache snapshot HIT/STALE/MISS, pool de pagination asynchrone, contrainte movie-only multicouche, et ratio exploitation/exploration 75/25. L'architecture est cohérente avec la page Home existante et bien isolée dans des couches de service séparées. Les critères d'acceptation majeurs sont couverts.

---

## Vérifications effectuées

- Lecture complète des services backend : `movies-service.ts`, `movies-pool-service.ts`, `movies-snapshot-service.ts`
- Route handler : `profiles-movies.ts`
- Schémas DB : `movies-sessions.ts`, `movies-discovery-snapshots.ts`, `shelf-instances.ts`
- Migration SQL : `0051_t128_movies_tables.sql`
- Contrat API : `packages/api-contracts/src/movies.ts`
- Frontend : `MoviesPage.tsx`, `useInfiniteMovies.ts`
- Tests : `movies-pool-service.test.ts`, `movies-snapshot-service.test.ts`

---

## Points validés

- **Contrainte movie-only** : enforced à deux niveaux indépendants — `.filter(c => c.mediaType === 'MOVIE')` sur les candidats du moteur + `@> '["MOVIE"]'::jsonb` sur `desiredMediaTypes` dans la sélection des concepts. Pas de fuite series possible.
- **Composition exploitation/exploration** : `buildMoviesDeclaredRails` garantit un slot EXPLORATION/DISCOVERY (rail 5), `fillMoviesPoolAsync` implémente la boucle de ratio avec compteurs distincts.
- **Déduplication cross-shelf** : le Set `excludedMediaIds` est accumulé dans l'ordre de génération des rails, effectif à la fois en déclaré et en pool fill.
- **Cache snapshot HIT/STALE/MISS** : logique correcte, `isMoviesSnapshotValid` et `isMoviesSnapshotStale` distinguent correctement les trois états. `onConflictDoUpdate` sur `profile_id` unique garantit l'upsert.
- **Stale-while-revalidate** : la régénération asynchrone via `_regenerateMoviesSnapshot` est correctement fire-and-forget sans bloquer la réponse.
- **Error isolation** : chaque rail déclaré et chaque shelf du pool est wrappé dans un try/catch indépendant. `ShelfErrorBoundary` isole les erreurs de rendu frontend.
- **Pas de hero field** : `MoviesPageResponse` n'a pas de champ `hero`, le frontend ne l'affiche pas.
- **Réutilisation des composants** : `ShelfRow` et `Skeleton` existants réutilisés sans modification.
- **Sécurité curseur** : un curseur Home ne peut pas être rejoué sur l'endpoint Movies — `getMoviesSessionById` ne trouve pas de sessions `home_sessions`, donc retourne 403.
- **Tests couvrant** : movie-only, ratio exploitation/exploration, diversité thématique, déduplication cross-shelf, HIT/STALE/MISS, empty/error. Couverture fonctionnelle solide.

---

## Problèmes détectés

### BLOQUANT 1 — Migration : `movies_sessions.expires_at` nullable en base

**Fichier** : `apps/api/migrations/0051_t128_movies_tables.sql` ligne 5

```sql
"expires_at" timestamp with time zone,   -- ← nullable, pas de NOT NULL
```

**Schéma Drizzle** (`movies-sessions.ts` ligne 10) :
```typescript
expiresAt: timestamp('expires_at', { withTimezone: true }).notNull()
```

Le Drizzle schema déclare `NOT NULL` mais la migration ne l'ajoute pas. La contrainte n'est donc pas enforced en base. N'importe quelle insertion directe ou future migration partielle pourrait écrire NULL. La colonne intervient dans la logique de session expiry (`sql\`${moviesSessions.expiresAt} > ${now.toISOString()}::timestamptz\``) — un NULL donnerait un résultat NULL (false) silencieux.

**Correction requise** :
```sql
"expires_at" timestamp with time zone NOT NULL,
```

---

### BLOQUANT 2 — Test TTL no-op

**Fichier** : `apps/api/src/services/__tests__/movies-snapshot-service.test.ts` lignes 319-329

```typescript
it('snapshot with expiresAt in the future is treated as valid', () => {
  // ...
  expect(true).toBe(true)   // ← assertion no-op
})
```

Ce test n'asserte rien. Le commentaire "Already tested via mock" ne justifie pas une assertion `true === true`. Il faut soit le supprimer, soit le convertir en test réel en appelant `isMoviesSnapshotValid(snapshotFuture)` avec l'implémentation réelle via `vi.importActual` comme les autres tests dans ce bloc.

---

### NOTABLE — Race condition pagination sur première session HIT

**Fichier** : `apps/api/src/services/movies-service.ts` lignes 75-86

Sur le chemin HIT, si `getOrCreateMoviesSession` crée une **nouvelle** session (première visite ou session expirée), `fillMoviesPool` est lancé en fire-and-forget. Le curseur est signé et retourné immédiatement avec `nextCursor` non-null (`cursorReference !== 'exhausted'`).

Si l'utilisateur scroll rapidement et déclenche `loadMore` avant la fin du pool fill, `serveMoviesBatch` trouve zéro shelves (pool vide) et retourne `hasMore: false`. Le frontend affiche "Fin des recommandations" prématurément.

Ce cas est peu fréquent (requiert un scroll très rapide sur une nouvelle session), mais le pattern est structurellement fragile. Une approche défensive serait de ne pas inclure `nextCursor` si le pool est connu vide au moment de la réponse, ou d'attendre un premier batch du pool avant de signer le curseur.

---

### MINEUR — `componentDidCatch` silencieux

**Fichier** : `apps/web/src/pages/MoviesPage.tsx` ligne 20

```typescript
componentDidCatch(_error: Error, _info: ErrorInfo) {}
```

Aucun log d'erreur. Les échecs de rendu de shelf sont invisibles en production et en développement. Même un `console.error` minimal serait utile pour le diagnostic.

---

### MINEUR — `selectExplorationMovieConcept` : SQL brut pour le filtre IN

**Fichier** : `apps/api/src/services/movies-pool-service.ts` ligne 460

```typescript
sql`${shelfConcepts.generationType} IN ('EXPLORATION', 'DISCOVERY')`,
```

Drizzle fournit `inArray(shelfConcepts.generationType, ['EXPLORATION', 'DISCOVERY'])` qui est plus lisible et cohérent avec le reste du codebase. La version actuelle fonctionne mais sort du pattern établi.

---

## Risques éventuels

- **Orphelins `shelf_instances`** : `movies_session_id` n'a pas de FK vers `movies_sessions` (ni dans la migration ni dans le schéma Drizzle). C'est cohérent avec `home_session_id` (même pattern), mais une suppression de session ne cascaderait pas aux shelf_instances associées. Ce n'est pas une régression T128 mais un risque de croissance de données à terme.

- **Régénération STALE sur ancienne session** : `_regenerateMoviesSnapshot` reçoit `session.id` (session courante) mais la snapshot stale référençait les shelf_instances d'une session précédente. Si l'utilisateur pagine sur le curseur de la réponse STALE pendant que la régénération tourne, les deux sessions coexistent avec leurs pools respectifs. Pas de bug fonctionnel, mais la logique est subtile.

- **Exploration "non-aléatoire" : garantie faible** : Le test "exploration non-random" (pool-service.test.ts ligne 499) vérifie que les items persistés ont `semanticScore > 0`, mais la fixture est construite avec `semanticScore: 0.6` — le test passe trivialement et ne valide pas un filtrage réel. La garantie "not pure randomness" repose entièrement sur la qualité des concepts EXPLORATION en base, ce qui est correct architecturalement mais non enforced par les tests.

---

## Décision

Trois points nécessitent correction avant merge :

1. **Migration** : ajouter `NOT NULL` sur `movies_sessions.expires_at`
2. **Test no-op** : corriger ou supprimer le test TTL ligne 319-329
3. Les points mineurs (componentDidCatch, inArray) peuvent être traités dans le même patch ou en suivi

IMPLEMENTATION_FIX_REQUIRED