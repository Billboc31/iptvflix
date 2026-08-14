# PR Review — T075: Similar-title recommendations (Attempt 3)

## Résumé

Deuxième passe coder après IMPLEMENTATION_FIX_REQUIRED. Les deux problèmes bloquants et les deux problèmes moyens identifiés dans la review précédente ont été adressés. L'implémentation est maintenant conforme au ticket, au plan, et aux conventions du projet.

## Vérifications effectuées

- `git diff main --name-only` — 10 fichiers applicatifs + artefacts de run uniquement, aucun fichier hors scope
- Lecture complète de `similar-titles-service.ts`, `client.ts`, `movies.ts`, `series.ts`, `index.ts`, `not-found-error.ts`, `parse-year.ts`
- Lecture des deux suites de tests (12 cas unitaires + 13 cas intégration)
- Exécution de `vitest run` : **754/758 tests passent ; 4 échecs pré-existants dans `vertical-slice.test.ts`**, aucun test T075 en échec

## Points validés

1. **Scope propre** — Les 6 fichiers hors-scope (`catalog.ts`, `catalog.test.ts`, `MovieDetailPage.tsx`, `SeriesDetailPage.tsx`, `SeasonSelector.tsx`, `SeasonSelector.test.tsx`) ont été revertés. Le diff ne contient que les fichiers prévus par le plan.

2. **Métadonnées des cards depuis le catalogue local** — `resolveMovieCandidates` et `resolveSeriesCandidates` sélectionnent `title`, `posterPath`, `year`, `voteAverage` depuis les tables `movies`/`series`. `title` est toujours pris du catalogue local (`notNull` en schéma) ; `posterPath`/`year`/`voteAverage` utilisent local en priorité, candidat TMDB en fallback. Conformité ticket : *"same canonical card metadata used elsewhere"*.

3. **Genres matérialisés** — `materializeMovie` et `materializeSeries` utilisent `.returning({ id })` puis appellent `upsertMovieGenres`/`upsertSeriesGenres` quand le payload TMDB contient des genres. Les entrées matérialisées participent désormais au fallback genre.

4. **`parseYear` non dupliquée** — extraite dans `apps/api/src/lib/parse-year.ts`, importée dans `client.ts` et `similar-titles-service.ts`.

5. **Déduplication et exclusion source** — `mergeCandidates` maintient un `Set<number>` initialisé avec `sourceTmdbId` ; le filtre final `card.id !== sourceId` capture aussi les cas où le film source serait localement résolu sous un id différent.

6. **Cache in-memory** — TTL 5 min, clé `movie:{tmdbId}` / `series:{tmdbId}` ; vérifié en test (TMDB non rappelé sur hit).

7. **Cap matérialisation** — `toMaterialize = missingTmdbIds.slice(0, MAX_MATERIALIZATIONS)` ; erreurs individuelles swallowées, les suivantes continuent. Vérifié en test.

8. **Fallback gracieux** — `isTmdbError` capture `TmdbNetworkError` et `TmdbRateLimitError` ; la requête genre locale est retournée sans lever d'exception.

9. **API** — `GET /movies/:id/similar` et `GET /series/:id/similar` retournent `{ items: SimilarTitleCard[] }` en 200. Validation UUID (400), limit 1–40 (400), inconnu (404). DI via options de route, cohérent avec `discoveryRoutes`.

10. **Tests** — 25 tests T075 tous verts. 4 échecs `vertical-slice.test.ts` pré-existants à la branche (status `RUNNING` vs `DONE` sur sync async), non causés par T075.

## Points mineurs résiduels (non bloquants)

**M1 — `TmdbRateLimitError` via `err.name` plutôt qu'`instanceof`** (`similar-titles-service.ts:511`)

```ts
return err instanceof TmdbNetworkError || (err instanceof Error && err.name === 'TmdbRateLimitError')
```

Fonctionnel — le constructeur pose `this.name = 'TmdbRateLimitError'` explicitement. Non bloquant, ticket de nettoyage si souhaité.

**M2 — Race condition dans `materializeMovie`/`materializeSeries`**

Pattern check-then-insert sans `ON CONFLICT DO NOTHING`. Protégé par try/catch individuel ; une violation de contrainte UNIQUE serait swallowée. Acceptable pour le volume attendu, mais un `onConflictDoNothing()` sur l'insert serait plus robuste.

## Critères d'acceptance

| Critère | Statut |
|---|---|
| Tout Movie canonical peut retourner une liste similaire | ✅ |
| Toute Series canonique peut retourner une liste similaire | ✅ |
| Résultats basés sur identités canoniques, dédupliqués | ✅ |
| Résultats non limités aux titres jouables | ✅ |
| Titres sans source / upcoming présents avec `isAvailable: false` | ✅ |
| Infrastructure recommendation existante réutilisée | ✅ |
| Titres TMDB manquants enrichissent le catalogue localement (borné à 5) | ✅ |
| API réutilisable par T150 | ✅ |
| Panne TMDB → dégradation gracieuse | ✅ |
| Appels répétés → cache in-memory 5 min | ✅ |
| Tests automatisés : Movies, Series, déduplication, zéro-source, fallback | ✅ |

## Décision

Les problèmes bloquants et moyens de la review précédente sont tous résolus. Le scope est propre, les métadonnées des cards sont correctes, les genres sont matérialisés, et `parseYear` est factorisée. Les deux points résiduels sont mineurs et fonctionnellement non bloquants.

IMPLEMENTATION_APPROVED
