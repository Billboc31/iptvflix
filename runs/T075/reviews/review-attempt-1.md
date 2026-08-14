# PR Review — T075: Add canonical similar-title recommendations

## Résumé

Implémentation d'un service `SimilarTitlesService` et de deux endpoints publics `GET /movies/:id/similar` et `GET /series/:id/similar`. Le périmètre est conforme au ticket et au plan. Les 25 nouveaux tests passent ; les 4 échecs de `vertical-slice.test.ts` sont pré-existants à cette branche.

## Vérifications effectuées

- Lecture du plan (`runs/T075/plan.md`) et comparaison avec l'implémentation réelle
- Lecture de l'ensemble des fichiers modifiés/créés (9 fichiers)
- Vérification des types TMDB, du mécanisme de cache, de la logique de déduplication, du fallback genre, des matérialisations
- Exécution de `pnpm vitest run` : 752 + 4 tests de T075 = 756 total ; 4 échecs pré-existants ; **25 tests T075 : tous verts**
- Vérification de la présence de la colonne `popularity` dans les schémas `movies` et `series`
- Vérification que les défauts de `vertical-slice.test.ts` précèdent la branche T075

## Points validés

1. **API correcte** — `GET /movies/:id/similar` et `GET /series/:id/similar` retournent `{ items: SimilarTitleCard[] }` en 200 avec les 7 champs attendus (`id`, `tmdbId`, `title`, `posterPath`, `year`, `voteAverage`, `isAvailable`).
2. **Déduplication TMDB** — `mergeCandidates` maintient un `Set<number>` des ids vus ; le film/série source est exclu dès l'entrée.
3. **Titres sans source** — `isAvailable` est calculé via jointure `movie_availabilities`/`series_availabilities` ; les titres sans ligne d'availability passent avec `isAvailable: false`.
4. **Fallback gracieux** — `TmdbNetworkError` et `TmdbRateLimitError` capturés par `isTmdbError`, déclenchent une requête genre locale sans lever d'exception.
5. **Cache in-memory** — TTL 5 min, clé `"movie:{tmdbId}"` / `"series:{tmdbId}"` ; la seconde requête dans la fenêtre ne rappelle pas TMDB (vérifié en test).
6. **Cap matérialisation** — au plus `MAX_MATERIALIZATIONS = 5` inserts par requête ; les erreurs par entrée sont swallowed individuellement, les suivantes continuent.
7. **Validation entrées** — UUID requis (400), `limit` entier 1–40 (400), ID inconnu (404).
8. **Pas de régression** — les tests pré-existants passants restent verts.
9. **Extraction `NotFoundError`** — découplage propre, évite l'import circulaire DB dans les tests unitaires.
10. **DI cohérente** — `SimilarTitlesService` injecté dans `moviesRoutes`/`seriesRoutes` via options, même pattern que `discoveryRoutes`.

## Problèmes détectés

### Mineurs (non bloquants)

**M1 — `TmdbRateLimitError` détecté par `err.name` au lieu de `instanceof`**

`similar-titles-service.ts:427` importe `TmdbNetworkError` mais pas `TmdbRateLimitError`. La détection se fait via :

```ts
return err instanceof TmdbNetworkError || (err instanceof Error && err.name === 'TmdbRateLimitError')
```

Fonctionnel (le constructeur pose `this.name = 'TmdbRateLimitError'` explicitement), mais le pattern est incohérent avec le check `instanceof` juste à côté et reste fragile à un rename de classe. Solution triviale : ajouter l'import et utiliser `instanceof TmdbRateLimitError`.

**M2 — `parseYear` dupliquée**

La fonction `parseYear` est définie à l'identique dans `client.ts:42` et `similar-titles-service.ts:430`. Pas de risque de divergence immédiate, mais un module utilitaire partagé serait plus propre.

**M3 — Trois instances `TmdbClient` dans `index.ts`**

`MetadataEnrichmentService`, `ExternalDiscoveryService` et `SimilarTitlesService` instancient chacun leur propre `TmdbClient`. Pattern cohérent avec l'existant (pas une régression introduite par T075), mais chaque client a son propre timeout et son propre compteur de retry.

**M4 — Matérialisations sans genres**

`materializeMovie`/`materializeSeries` insèrent uniquement les champs de base (title, year, poster, tmdbId…). Les genres ne sont pas peuplés dans `movie_genres`/`series_genres`. Conséquence : si un titre matérialisé par T075 devient à son tour source d'une requête similar, et que TMDB est indisponible, son fallback genre renverra une liste vide. Acceptable selon le plan ("safely and avoid turning every page open into an uncontrolled large import"), mais à noter pour une future évolution vers une matérialisation enrichie.

## Risques éventuels

- **Race condition sur INSERT** : deux requêtes simultanées pour le même tmdbId manquant pourraient toutes deux tenter l'INSERT. Le try/catch individuel par tmdbId dans `resolveMovieCandidates` capture l'éventuelle violation de contrainte unique ; le risque est géré mais non éliminé à la source (un `ON CONFLICT DO NOTHING` serait plus robuste).
- **503 si TMDB_API_KEY absent** : les endpoints retournent 503 quand le service n'est pas configuré. Ce n'est pas un problème à l'exécution (fallback genre actif), uniquement quand la clé est entièrement absente de l'environnement.

## Décision

- ~~REQUEST_CHANGES~~
- **APPROVED**

Les problèmes identifiés sont tous mineurs et non bloquants. Les critères d'acceptance du ticket sont remplis, les tests couvrent les scénarios exigés, et l'implémentation est dans le périmètre défini par le plan.

## Actions demandées

Aucune correction bloquante. Les points M1 (import `instanceof`) et M2 (`parseYear` dupliquée) peuvent être adressés dans un ticket de nettoyage ou en fix rapide avant merge selon la politique de qualité du projet.

IMPLEMENTATION_APPROVED
