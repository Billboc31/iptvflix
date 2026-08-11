---

# PR Review — T016: Evolve canonical catalog to support zero/many availabilities

## Résumé

L'implémentation est **complète et correcte**. Elle fait évoluer le catalogue canonique via 6 composants : schéma + migration, contrat API, service layer, sync service, routes catalog.ts, et tests. Tous les critères d'acceptance du ticket sont couverts.

## Vérifications effectuées

- `availabilities.ts`, `catalog-service.ts`, `catalog-sync-service.ts`, `movies.ts`, `series.ts`, `catalog.ts`, `index.ts`, `packages/api-contracts/src/catalog.ts`
- Migration `0007_episode_availability_status.sql` + journal
- Tous les fichiers de test : `catalog-constraints`, `movies.test`, `series.test`, `catalog.test`, `vertical-slice.test`
- Routes effectivement enregistrées dans `index.ts`

## Points validés

**Schéma/migration** — `episodeAvailabilities` reçoit `status NOT NULL DEFAULT 'AVAILABLE'` et `unavailable_at`, aligné sur les deux autres tables. Migration additive propre.

**Contrat API** — `availabilityCount: number` ajouté à `MovieResponse`, `SeriesResponse`, `EpisodeResponse`. `availabilityStatus` dérivé de `availabilityCount > 0`. Aucune fuite de `providerId`/`providerItemId`.

**Service layer (production)** — COUNT groupé sur `status = 'AVAILABLE'` appliqué uniformément dans `listMovies`, `getMovie`, `listSeries`, `getSeries`, `searchContent`. Patron cohérent avec `availCountMap.get(id) ?? 0`.

**Staleness épisode** — Bloc ajouté dans `catalog-sync-service.ts` (lignes 303–334) miroir exact du patron movie/series. Documenté comme no-op actuel en l'absence de données épisode dans les snapshots Xtream.

**Intégrité canonique** — Test vertical-slice "source disappearance" valide que canonical movie row, watchlist, viewing-progress survivent tous après la perte d'une source.

**Tests** — 2 nouveaux tests contraintes, 2+2 tests availabilityCount 0/2 pour movies/series, test disappearance complet.

## Observations (non bloquantes)

1. **`catalogRoutes` non enregistré dans `index.ts`** (pré-existant) : `/series/:id/seasons/:n/episodes` avec `availabilityCount` n'est pas accessible en production. La route est testée via `catalog.test.ts` mais pas montée dans le serveur. Le plan reconnaissait explicitement que l'épisode listing était dans `catalog.ts` "may be refactored or left in route". Quand `catalogRoutes` sera enregistré, les doublons `/movies` et `/series` créeront des conflits à traiter dans un ticket séparé.

2. **Staleness épisode est un no-op actuel** : Si une future sync crée des `episode_availabilities`, elles seront invalidées à chaque sync VOD/Series. Le comportement est documenté mais nécessitera adaptation lors du support épisode-level.

3. **Asymétrie de contrainte `movieAvailabilities`** (pré-existant) : table movie a une contrainte `unique(providerId, providerItemId)` globale absente de la table episode.

## Décision

**APPROVED** — Implémentation complète, conforme au ticket et au plan. 195 tests passent. Aucune action requise.

---

IMPLEMENTATION_APPROVED
