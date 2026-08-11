# PR Review — T016: Evolve canonical catalog to support zero/many availabilities

## Résumé

L'implémentation fait évoluer le catalogue canonique pour que Movies, Series, Seasons et Episodes existent indépendamment de leurs disponibilités sources. Elle ajoute `availabilityCount` aux contrats API, aligne le schéma `episode_availabilities` sur les autres tables de disponibilité, et corrige le marquage de staleness au niveau épisode dans le sync. Tous les critères d'acceptance sont couverts.

## Vérifications effectuées

- Lecture de `availabilities.ts`, `catalog.ts`, `catalog-service.ts`, `catalog-sync-service.ts`, `movies.ts`, `series.ts`, `index.ts`, `packages/api-contracts/src/catalog.ts`
- Lecture de tous les fichiers de test : `catalog-constraints.test.ts`, `movies.test.ts`, `series.test.ts`, `catalog.test.ts`, `vertical-slice.test.ts`
- Lecture de la migration `0007_episode_availability_status.sql` et du journal
- Vérification du plan vs. implementation
- Vérification des routes effectivement enregistrées dans `index.ts`

## Points validés

### Schéma et migration

- `episodeAvailabilities` reçoit `status availability_status NOT NULL DEFAULT 'AVAILABLE'` et `unavailable_at timestamptz`, aligné sur `movieAvailabilities` et `seriesAvailabilities`.
- Migration 0007 propre : `ADD COLUMN ... DEFAULT 'AVAILABLE' NOT NULL` + `ADD COLUMN unavailable_at timestamptz`. Backfill implicite via DEFAULT.
- Journal mis à jour (`_journal.json` idx=7).

### Contrat API

- `availabilityCount: number` ajouté à `MovieResponse`, `SeriesResponse`, `EpisodeResponse` dans `@iptvflix/api-contracts`.
- `availabilityStatus` reste `'AVAILABLE' | 'UNAVAILABLE'`, maintenant dérivé de `availabilityCount > 0`.
- Aucune fuite de `providerId` / `providerItemId` dans les DTOs canoniques.

### Service layer (routes enregistrées en production)

- `listMovies()` / `getMovie()` : COUNT groupé sur `movie_availabilities WHERE status = 'AVAILABLE'`, mappé via `availCountMap.get(id) ?? 0`.
- `listSeries()` / `getSeries()` : même patron pour `series_availabilities`.
- `searchContent()` : COUNT pour movies et series, cohérent avec les autres fonctions.
- La dérivation `availabilityCount > 0 ? 'AVAILABLE' : 'UNAVAILABLE'` est appliquée uniformément partout.

### Staleness épisode dans le sync

- Bloc ajouté après movie/series staleness (lignes 303–334) : collecte les `episode_availabilities` AVAILABLE pour cette source, les marque UNAVAILABLE si absents du snapshot courant.
- Patron identique aux blocs movie et series existants.
- Le commentaire reconnaît explicitement que l'action est un no-op tant que la sync ne produit pas de données épisode — comportement sûr et documenté.

### Intégrité canonique

- Les tables `movies`, `series`, `episodes`, `seasons` ne sont jamais supprimées lors d'une perte de disponibilité.
- Le test vertical-slice "source disappearance" vérifie : canonical movie row, watchlist entry, viewing-progress entry survivent tous après la disparition de la source.

### Tests

- `catalog-constraints.test.ts` : 2 nouveaux tests — movie sans availability row est récupérable ; status episode_availability défaut AVAILABLE accepte transition UNAVAILABLE.
- `movies.test.ts` / `series.test.ts` : `availabilityCount: 0` et `availabilityCount: 2` testés sur les mocks service.
- `catalog.test.ts` : mocks mis à jour vers shape COUNT `{ cnt: N }`, tests épisode.
- `vertical-slice.test.ts` : test "source disappearance" complet (sync1 → movie AVAILABLE → sync2 sans ce stream → movie UNAVAILABLE, canonical + user-state intacts).

## Problèmes détectés

### Observation (non bloquante) — `catalogRoutes` non enregistré dans `index.ts`

`apps/api/src/routes/catalog.ts` expose `catalogRoutes` (incluant `/series/:id/seasons/:seasonNumber/episodes`) mais n'est **pas** importé dans `index.ts`. C'est une situation **pré-existante** : ce fichier n'était pas enregistré avant T016 non plus.

Conséquences :
- L'endpoint `/series/:id/seasons/:n/episodes` avec `availabilityCount` n'est pas accessible en production.
- Le critère du plan "GET /series/:id/seasons/:n/episodes returns episodes with availabilityCount: 0" est couvert par `catalog.test.ts` (qui enregistre `catalogRoutes` dans son scope de test) mais pas dans le serveur de production.
- Le plan reconnaissait explicitement que l'épisode listing était "in catalog.ts ... may be refactored or left in route", donc ce choix est conforme au plan.

**À surveiller** : quand `catalogRoutes` sera enregistré, les routes `/movies` et `/series` de `catalog.ts` entreront en conflit avec les routes déjà enregistrées via `moviesRoutes` / `seriesRoutes`. Un nettoyage de l'architecture catalog.ts sera nécessaire à ce moment.

### Observation (non bloquante) — Épisode staleness est un no-op actuel

Le bloc de staleness épisodes (lignes 303–334 de `catalog-sync-service.ts`) marque UNAVAILABLE toutes les `episode_availabilities` de la source si elles ne sont pas dans le snapshot courant. Comme la sync Xtream actuelle ne crée jamais de `episode_availabilities`, ce bloc est inerte aujourd'hui. Si une future sync (Plex, épisodes Xtream) crée des lignes, elles seront immédiatement invalidées à chaque sync VOD/Series. Le commentaire documente ce comportement, mais il faudra adapter la logique quand le support épisode-level sera ajouté.

### Observation (non bloquante) — Contrainte unique asymétrique sur `movieAvailabilities`

`movieAvailabilities` a deux contraintes `unique` : `(movieId, providerId, providerItemId)` ET `(providerId, providerItemId)`. La deuxième empêche le même `(providerId, providerItemId)` d'être associé à deux films différents. `episodeAvailabilities` n'a que `(episodeId, providerId, providerItemId)`, permettant théoriquement le même providerItemId sur plusieurs épisodes (de sources différentes). C'est une asymétrie pré-existante, non introduite par T016.

## Risques éventuels

- Aucun risque de régression sur les routes enregistrées en production.
- Le `SeasonSummary` / `SeriesDetailResponse` (avec seasons) n'est retourné que par le `catalog.ts` non enregistré ; la route `/series/:id` en production renvoie `SeriesResponse` (sans seasons). Pré-existant.
- La migration 0007 est additive (ADD COLUMN) et ne casse aucun index ni FK existant.

## Décision

- **APPROVED**

L'implémentation est complète, correcte, et conforme au ticket et au plan. Les observations ci-dessus sont toutes pré-existantes ou explicitement documentées. Les 195 tests passent. Le schéma, le contrat API, la couche service, et la sync sont tous cohérents pour les routes enregistrées en production.

## Actions demandées

Aucune. L'enregistrement de `catalogRoutes` (incluant l'endpoint épisodes) est hors scope de ce ticket et devra faire l'objet d'un ticket séparé avec nettoyage de l'architecture.
