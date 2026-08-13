# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T068/reviews/implementation-review.md
- generated at: 2026-08-13T19:36:53Z

---

I now have a full picture of the implementation. Let me write the review.

---

# PR Review — T068: Hybrid local + TMDB search with automatic catalog enrichment

## Résumé

L'implémentation délivre les fonctionnalités core du ticket : séparation local/distant, recherche de titres en français, dégradation gracieuse, déduplication par tmdbId et matérialisation à la sélection. Deux problèmes bloquants sont identifiés.

---

## Vérifications effectuées

- Plan lu et comparé au diff complet (`git diff main`)
- Tous les fichiers modifiés lus dans leur intégralité
- Fichiers de tests lus (search.test.ts, external-discovery-service.test.ts, vertical-slice.test.ts)
- Contrats d'API comparés entre main et la branche T068
- Vérification de la présence des tests requis par le plan

---

## Points validés

**Architecture de base**
- `GET /search` ne fait plus d'appel TMDB — retourne uniquement les résultats locaux, valide le critère "fast offline".
- `GET /search/remote` retourne `{ externalMovies, externalSeries }` excluant les TMDB IDs locaux connus.
- Le tri sur `local_results_threshold` a bien été supprimé — la section externe s'affiche dès le début.
- La déduplication est correcte : `getMovieTmdbIds` / `getSeriesTmdbIds` retournent des `Set<string>` filtrés avant l'appel TMDB.
- Dégradation gracieuse : si `discoveryService` est absent ou TMDB lève une exception, retour 200 avec tableaux vides — local non affecté.

**Recherche en français**
- `searchContent()` étend correctement la clause `WHERE` avec `${movies.localizations}->'fr'->>'title' ILIKE ${pattern}` (requête paramétrée — pas d'injection SQL).
- Idem pour series.

**Frontend**
- Deux appels parallèles indépendants dans `useEffect` : `searchContent` settle en premier → résultats locaux visibles immédiatement.
- `externalLoading` est un état propre et indépendant.
- `showExternal = hasExternal || externalLoading` — correct, la section externe apparaît dès l'envoi de la requête TMDB.
- Erreurs de matérialisation isolées dans `externalError`; erreurs TMDB silencieusement avalées → section externe vide sans polluer la section locale.
- `retryCount` redéclenche les deux requêtes — cohérent.

**Tests**
- 14 tests route (`search.test.ts`) : validation input, shape, exclusion TMDB IDs, graceful degradation — bonne couverture.
- 16 tests `ExternalDiscoveryService` : mapping, cache TTL, exclusion, matérialisation, placeholder title — complets.

---

## Problèmes détectés

### 🔴 BLOQUANT 1 — Scope creep : expansion non planifiée de `MovieResponse`, `SeriesResponse`, `EpisodeResponse`

**Fichier** : `packages/api-contracts/src/catalog.ts`

Le plan T068 ne prévoit qu'une seule modification des contrats :
> "Remove `externalMovies` and `externalSeries` from `SearchResponse`. Add `DiscoverResponse`."

L'implémentation a aussi **étendu** trois types partagés par tous les endpoints catalog :

| Type | Champs ajoutés |
|---|---|
| `MovieResponse` | `popularity`, `voteCount`, `originalLanguage`, `spokenLanguages`, `productionCountries`, `tagline`, `status`, `keywords`, `collection`, `externalIds` |
| `SeriesResponse` | `popularity`, `voteCount`, `originalLanguage`, `spokenLanguages`, `productionCountries`, `tagline`, `keywords`, `externalIds`, `inProduction`, `networks`, `createdBy`, `numberOfSeasons`, `numberOfEpisodes` |
| `EpisodeResponse` | `tmdbId`, `posterPath`, `voteAverage`, `voteCount` |

Cela a cascadé sur `listMovies`, `getMovie`, `listSeries`, `getSeries` dans `catalog-service.ts` (4 fonctions hors scope). L'`EpisodeResponse` est totalement hors périmètre T068.

Ces changements :
- Affectent **tous** les endpoints catalog, pas seulement la recherche
- N'étaient pas dans le plan, ni dans les acceptance criteria
- Constituent probablement un reste de T064 qui aurait dû avoir son propre ticket

**Action requise** : révertir ces expansions de types à la forme présente dans `main` (`MovieResponse` sans les 10 champs supplémentaires, etc.). Les corrections nécessaires liées à T068 se limitent à `DiscoverResponse`. Si ces champs sont jugés nécessaires, ouvrir un ticket séparé.

---

### 🔴 BLOQUANT 2 — Test manquant pour la recherche par titre localisé (fr)

**Plan, section "Tests"** :
> "`services/catalog-service.ts`: add case where the match is only in `localizations.fr.title` and assert the entity is returned."

Ce test est absent. Il n'existe pas de fichier `catalog-service.test.ts`. La recherche en français est une feature centrale de T068 (critère d'acceptance : "French/localized titles plus original/alternate titles"). Tester uniquement via le mock de `searchContent` dans `search.test.ts` ne valide pas la logique SQL réelle.

**Action requise** : créer un test unitaire ou d'intégration qui insère un film avec un titre stocké uniquement dans `localizations.fr.title` et vérifie que `searchContent` le retourne.

---

## Risques éventuels

- **Race condition frontend** : deux appels parallèles sans `AbortController` peuvent provoquer des states-updates parasites si l'utilisateur modifie la query rapidement. Pattern pre-existant, non introduit par T068, acceptable.
- **Spinner externe après clear** : si le champ est vidé pendant que `searchDiscover` est in-flight, la section externe reste visible (spinner) jusqu'à settlement. Mineur.
- **`/search/remote` appelle `searchContent()` en doublon** : le handler appelle `searchContent()` pour construire les TMDB ID à exclure, alors que `GET /search` a déjà fait cet appel côté client. Doublon DB intentionnel selon le plan — pas un bug, mais un coût à connaître.

---

## Décision

Les deux problèmes bloquants (scope creep sur les contrats partagés + test manquant) doivent être corrigés avant merge.

IMPLEMENTATION_FIX_REQUIRED
