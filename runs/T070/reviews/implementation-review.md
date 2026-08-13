---

# PR Review — T070: Drive Movies and Series discovery shelves from the canonical catalog

## Résumé

L'implémentation est structurellement conforme au plan et au ticket. Contrat API, routes, service, schéma, migration, hooks et pages frontend sont tous produits. Un **bug bloquant** invalide les deux shelves canoniques les plus importantes (Populaires et Les mieux notés).

## Points validés

- **Contrat API** : `sortBy` étendu (`popularity | voteAverage`), `upcoming?: boolean` ajouté dans `MovieFilters` et `SeriesFilters`.
- **Validation des routes** : `upcoming='true'→true`, `upcoming='false'→false`, toute autre valeur → 400. Correct.
- **Filtres de service** : `upcoming=true` sur movies utilise `theatricalReleaseDate > NOW() OR status IN (...)` ; sur series, `inProduction = true OR status IN (...)`. Conformes au plan.
- **Indexes** : 0030 crée `popularity` indexes, 0033 crée `vote_average` indexes — les 4 colonnes sont couvertes.
- **Hero canonique** : query `sortBy='popularity'` sans filtre availability — correct sur les deux pages.
- **Toggle** et shelves frontend : logique d'availability mode, genre override, shelf "À venir" auto-masquée si vide. Conformes.
- **`toQuery`** : accepte déjà `boolean`, `String(v)` sérialise en `'true'`/`'false'`. Correct.
- **Scope** : aucune dérive (collections, langue, persistance, Home page).

## Problème bloquant

### SQL invalide — `sortBy=popularity` et `sortBy=voteAverage` (`catalog-service.ts` lignes 91, 93, 293, 295)

```typescript
// ❌ Génère : "popularity" NULLS LAST DESC  → syntax error PostgreSQL
orderByClause = [desc(sql`${movies.popularity} NULLS LAST`), asc(movies.title)]
```

`desc()` de Drizzle appende ` DESC` **après** l'expression fournie. La clause produite est `"popularity" NULLS LAST DESC`, ce qui est une erreur de syntaxe PostgreSQL (`NULLS LAST` doit suivre `ASC/DESC`, pas le précéder).

**Impact** : les shelves "Populaires" et "Les mieux notés" lèvent une erreur base de données. Sans providers, la page ne montre rien d'utile — l'objectif principal du ticket n'est pas atteint.

**Correction** (4 occurrences dans `listMovies` et `listSeries`) :

```typescript
// ✅ Pattern déjà correct sur recentAvailability
sql`${movies.popularity} DESC NULLS LAST`   // au lieu de desc(sql`... NULLS LAST`)
sql`${movies.voteAverage} DESC NULLS LAST`
sql`${series.popularity} DESC NULLS LAST`
sql`${series.voteAverage} DESC NULLS LAST`
```

## Actions demandées

1. **[OBLIGATOIRE]** Corriger les 4 occurrences dans `apps/api/src/services/catalog-service.ts` — remplacer `desc(sql`${...} NULLS LAST`)` par `sql`${...} DESC NULLS LAST``.

IMPLEMENTATION_FIX_REQUIRED
