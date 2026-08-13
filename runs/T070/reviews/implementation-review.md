I now have everything needed for a complete review. Let me write it.

---

## PR Review — T070 — Drive Movies and Series Discovery Shelves from the Canonical Catalog

## Résumé

L'implémentation remplace les deux pages Films et Séries par des pages pilotées par le catalogue canonique : 4 rayons automatiques (Populaires, Les mieux notés, Sorties récentes, À venir), un toggle "Tout le catalogue / Disponible maintenant", et un héros sélectionné par popularité canonique. Un bug SQL (`NULLS LAST` mal positionné) identifié en review précédente a été corrigé dans le code courant.

---

## Vérifications effectuées

- Contrats API (`packages/api-contracts/src/catalog.ts`) — types `sortBy` et `upcoming`
- Validation des routes (`apps/api/src/routes/movies.ts`, `series.ts`)
- Logique de service (`apps/api/src/services/catalog-service.ts`) — filtres et tris
- Migrations (0030, 0033) — présence des 4 index
- Frontend (`MoviesPage.tsx`, `SeriesPage.tsx`) — rayons, toggle, héros, genre override
- Client API (`apps/web/src/lib/api.ts`) — sérialisation des paramètres booléens

---

## Points validés

**API Contracts**
- `sortBy` étendu à `'title' | 'year' | 'recentAvailability' | 'popularity' | 'voteAverage'` sur `MovieFilters` et `SeriesFilters`
- `upcoming?: boolean` présent sur les deux types de filtres

**Routes**
- Les 5 valeurs de `sortBy` sont validées, retour 400 pour valeur inconnue
- `upcoming` accepte strictement `'true'` / `'false'`, rejette toute autre valeur avec 400
- Validation existante (page, pageSize, year, availability, genreId) inchangée

**Service**
- `sortBy=popularity` → `sql\`${movies.popularity} DESC NULLS LAST\`` ✅ (bug précédemment corrigé)
- `sortBy=voteAverage` → `sql\`${movies.voteAverage} DESC NULLS LAST\`` ✅
- `upcoming=true` films : `(theatricalReleaseDate > NOW() OR status IN ('Rumored','Planned','In Production','Post Production'))` — conforme au plan
- `upcoming=true` séries : `(inProduction = true OR status IN ('In Production', 'Planned'))` — conforme au plan
- Toutes les variantes SQL `NULLS LAST` sont syntaxiquement correctes

**Index DB**
- Migration 0030 : `movies_popularity_idx`, `series_popularity_idx` (DESC NULLS LAST) ✅
- Migration 0033 : `movies_vote_average_idx`, `series_vote_average_idx` (DESC NULLS LAST) ✅
- Les 4 index requis par le plan sont présents

**Frontend**
- `toQuery()` accepte les booléens et les sérialise en `'true'`/`'false'` via `String(v)` ✅
- Toggle "Tout le catalogue" / "Disponible maintenant" fonctionnel
- Héros : `sortBy='popularity'` sans filtre de disponibilité — sélection canonique ✅
- Rayon "À venir" : se masque automatiquement quand `data?.items.length === 0` ✅
- Mode "Disponible maintenant" : prepend "Disponibles" + filtre `availability='AVAILABLE'` sur tous les rayons ✅
- Genre chip override : préserve le comportement existant ✅
- Click sur les cards : navigue vers la page détail (`/movies/:id`, `/series/:id`) ✅

**Scope**
- Pas de rayons collections/franchises (exclu explicitement)
- Pas de filtres langue/pays (exclu explicitement)
- Home page inchangée
- Shelf generation service inchangé

---

## Problèmes détectés

### Observation mineure 1 : filtre `upcoming + availability='AVAILABLE'` sémantiquement contradictoire

Dans le mode "Disponible maintenant", le rayon "À venir" reçoit :
```tsx
<MovieShelf title="À venir" upcoming={true} availability={avail} />
// en mode 'available' : upcoming=true AND availability='AVAILABLE'
```

Ces deux filtres sont mutuellement exclusifs (un titre à venir n'a pas de source disponible). En pratique, le rayon retourne 0 résultats et se masque automatiquement. Le comportement observable est correct. C'est néanmoins une combinaison de filtres incohérente qui pourrait surprendre à la lecture.

**Impact** : aucun. Non bloquant.

### Observation mineure 2 : skeleton unique pour un rayon de 20 éléments

```tsx
{loading && (
  <Skeleton className="shrink-0 w-28 md:w-32 lg:w-36 aspect-[2/3] rounded-lg" />
)}
```

Un seul placeholder skeleton s'affiche quelle que soit la taille du rayon (`pageSize=20`). Légère discontinuité visuelle au chargement. Comportement probablement pré-existant, hors scope du ticket.

### Observation mineure 3 : `voteAverage` absent du type `MovieResponse` liste

Le tri par `voteAverage` fonctionne côté DB mais le champ n'est pas exposé dans `MovieResponse` (uniquement dans `MovieDetailResponse`). Les cards des rayons ne peuvent donc pas afficher de badge de note sans fetch supplémentaire. Pré-existant, hors scope du ticket.

---

## Risques éventuels

- **Charge sur les tables `movies`/`series` sans les index** : les 4 index sont présents dans les migrations, risque atténué.
- **Catalogues vides** : le rayon se masque via `return null` — pas de shelf vide visible, comportement conforme au critère d'acceptance.
- **Combinaison `upcoming=true + year`** : les deux filtres sont additionnel (AND), ce qui peut retourner 0 résultats si l'utilisateur filtre par une année passée — comportement correct, non bloquant.

---

## Critères d'acceptance — Statut

| Critère | Statut |
|---|---|
| Pages Films/Séries riches sans provider | ✅ |
| ≥ 3 rayons canoniques | ✅ (4 rayons) |
| Rayon "À venir" masqué si vide | ✅ |
| Mode "Disponible maintenant" fonctionnel | ✅ |
| Héros depuis popularité canonique | ✅ |
| API retourne résultats triés correctement | ✅ |
| `upcoming` non-booléen → 400 | ✅ |
| 4 index DB présents | ✅ |
| Card titre indisponible → page détail | ✅ |

---

## Décision

- **APPROVED**

L'implémentation est conforme au ticket et au plan. Le bug SQL critique identifié en review précédente est corrigé. Les observations mineures n'affectent pas les critères d'acceptance. Aucune dérive de scope.

IMPLEMENTATION_APPROVED
