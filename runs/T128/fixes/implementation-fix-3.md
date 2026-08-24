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
