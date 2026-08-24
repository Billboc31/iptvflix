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
