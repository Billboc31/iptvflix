I have enough information to write the complete review. Let me compile it now.

---

# PR Review — T064: Pivot IPTVFlix to a TMDB-first canonical catalog

## Résumé

Implémentation d'une extension du schéma canonique TMDB-first couvrant : migration `0029_tmdb_first_catalog.sql`, schémas Drizzle mis à jour, types TMDB enrichis, client TMDB avec `append_to_response`, service d'enrichissement, contrats API et routes catalog. L'implémentation est globalement correcte et sûre.

## Vérifications effectuées

- Migration SQL complète (colonnes, contraintes, FK)
- Schémas Drizzle pour `movies`, `series`, `seasons`, `episodes`, `genres`, nouveau `collections`
- Types TMDB dans `types.ts` et interfaces `ExternalMovieMetadata` / `ExternalSeriesMetadata`
- Client TMDB : `append_to_response`, mappeurs, `fetchCollection`
- Service d'enrichissement : upsert collection, champs enrichis, `tmdbSyncedAt`, genres avec `tmdbId`, sync seasons/épisodes
- Contrats API : `MovieResponse`, `SeriesResponse`, `SeriesDetailResponse`, `EpisodeResponse`
- Routes `catalog.ts` : detail movies, detail series, épisodes
- Service `catalog-service.ts` : list/search mappers

## Points validés

- **Migration sûre** : tous les nouveaux champs sont `nullable`, aucune donnée existante n'est affectée. Numérotation `0029` correcte (le plan disait `0020`, adaptation légitime au vrai état du projet).
- **Contrainte `UNIQUE` sur `seasons.tmdb_id` nullable** : PostgreSQL autorise plusieurs `NULL` dans une contrainte UNIQUE ; comportement correct.
- **Collections** : table créée, FK `movies.collection_id → collections.id` présente, upsert par `tmdb_id` avec `onConflictDoUpdate` dans le service d'enrichissement.
- **`tmdbSyncedAt`** : assigné à `new Date()` à la fin de chaque enrichissement réussi, pour movies et series.
- **Genres avec `tmdbId`** : `upsertGenres` met à jour `tmdb_id` via `onConflictDoUpdate({ target: genres.slug, set: { tmdbId: sql\`EXCLUDED.tmdb_id\` } })`.
- **Route `GET /movies/:id`** : récupère la collection depuis `collections` si `collectionId` est défini, retourne tous les nouveaux champs.
- **Route `GET /series/:id`** : retourne tous les nouveaux champs series.
- **Route épisodes** : retourne `tmdbId`, `posterPath`, `voteAverage`, `voteCount`.
- **Contrats API** : `MovieResponse`, `SeriesResponse`, `EpisodeResponse`, `SeriesDetailResponse` tous mis à jour conformément au plan.
- **Scope respecté** : tables user state (`watchlist`, `progress`, `feedback`, `shelves`) intouchées. Provider adapters non modifiés. Auth/playback non touchés.
- **Pas de secrets hardcodés** ni de log de données sensibles.

## Problèmes détectés

### Mineur — `collection: null` hardcodé dans les vues liste et search

Dans `catalog-service.ts`, les fonctions `listMovies()`, `getMovie()` et `searchContent()` hardcodent `collection: null` dans la réponse. Or `MovieResponse` déclare `collection` comme `{ tmdbId: number; name: string; ... } | null`.

Le champ est présent dans le type mais toujours `null` hors du detail endpoint. C'est un trade-off intentionnel (éviter un JOIN ou N+1 pour les listes), mais cela crée une incohérence de contrat : un client qui inspecte `collection` sur un item de liste obtiendra toujours `null` même si le film appartient à une collection. Si ce comportement est volontaire, il devrait être documenté ou le type devrait être restreint.

**Impact** : cosmétique / expérience développeur frontend. Non bloquant.

### Mineur — `releaseStatus` et `status` coexistent dans les types intermédiaires

`ExternalMovieMetadata` déclare à la fois `releaseStatus?: string | null` et `status?: string | null` (idem pour series). Dans `mapMovieDetail()`, `raw.status` est mappé aux deux. Dans `enrichMovie()` : `status: metadata.status ?? metadata.releaseStatus ?? null`. Cette duplication est une légère dette de conception introduite ici (ou amplifiée), mais pas bloquante.

### Observation — `fetchCollection` ajouté mais jamais appelé

La méthode `TmdbClient.fetchCollection()` est implémentée (plan section 4) mais n'est jamais appelée : l'enrichissement utilise directement `belongs_to_collection` inclus dans le détail du film. Méthode correcte mais mort code pour l'instant. Non bloquant.

### Observation — Cast `externalIds` via `as unknown as Record<...>`

```ts
externalIds: raw.external_ids
  ? (raw.external_ids as unknown as Record<string, string | number | null>)
  : null
```

Le double cast contourne la vérification de type. `TmdbExternalIds` a des champs typés précisément ; une conversion explicite par `Object.fromEntries(...)` serait plus safe. Non bloquant à ce stade, mais à surveiller si de nouveaux types sont ajoutés à `TmdbExternalIds`.

## Risques éventuels

- **`seasons_tmdb_id_unique` + enrichissement partiel** : si une saison est enrichie deux fois avec le même `tmdbId`, l'`UPDATE` ne posera pas de problème de contrainte car c'est une mise à jour et non un insert. Risque réel : si deux saisons *différentes* se voient assigner le même `tmdbId` TMDB par erreur de mapping. Peu probable mais à surveiller.
- **Enrichissement séries silencieux** : `enrichSeriesSeasons` est appelé dans un try-catch qui n'émet qu'un `console.warn`. Les erreurs d'enrichissement épisode ne remontent pas. Acceptable pour une première itération.

## Décision

L'implémentation est correcte, dans le scope, sûre pour la migration, et répond à tous les critères d'acceptation. Les observations sont mineures et ne justifient pas un blocage.

- APPROVED

## Actions demandées

Aucune action bloquante. Recommendations optionnelles pour un ticket de suivi :
1. Documenter (ou restreindre via le type) que `collection` est toujours `null` dans les réponses liste.
2. Consolider `releaseStatus`/`status` dans les types intermédiaires.
3. Supprimer ou utiliser `fetchCollection()` dans `TmdbClient`.

---

IMPLEMENTATION_APPROVED
