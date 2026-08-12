Now I have enough context. Let me write the review.

---

# PR Review — T019: Universal External Catalog Discovery

## Résumé

L'implémentation ajoute une découverte externe via TMDB en fallback du search local, matérialise des enregistrements canoniques sans disponibilité, et expose les résultats dans l'UI avec des badges distinctifs. Le périmètre est respecté, l'architecture est propre.

## Vérifications effectuées

- Contrat API (`api-contracts/src/catalog.ts`) — types et `SearchResponse` étendus
- `ExternalDiscoveryService` — cache TTL, déduplication, isolation provider
- `search.ts` — logique de threshold, calls parallèles, fallback propre
- `discovery.ts` — POST /discovery/movies et /discovery/series, validation tmdbId
- `index.ts` — branchement conditionnel sur `TMDB_API_KEY`
- TMDB client — mapping `status`/`release_date`/`first_air_date`
- Schéma DB — contrainte UNIQUE sur `tmdb_id` dans `movies` et `series`
- `SearchPage.tsx` — section externe, badges, click → materialize → navigate
- `PosterCard.tsx` — prop `badge` avec variantes `unavailable`/`upcoming`
- `Badge.tsx` — variantes `unavailable` (gris) et `upcoming` (ambre) présentes
- Tests unitaires `ExternalDiscoveryService` — 16 cas couvrant cache, dédup, erreur provider, idempotence
- Tests d'intégration — 6 tests discovery : external-only, déduplication, zero availabilities, idempotence, provider failure, invalid tmdbId

## Points validés

- **Tous les critères d'acceptance API sont couverts** : recherche externe, zéro disponibilité, idempotence materialize, déduplication, isolation provider failure, threshold/cap.
- **Cache in-memory TTL 60s** correctement implémenté : le résultat brut est mis en cache avant filtrage; le filtrage par `excludeTmdbIds` s'applique à chaque appel depuis le cache — design correct.
- **Contrainte UNIQUE DB** présente sur `tmdb_id` dans les deux tables : `materializeMovie`/`materializeSeries` ne peuvent pas créer de doublons même en cas de race.
- **Isolation des erreurs provider** : le `try/catch` retourne `[]` sans re-throw, la recherche locale est préservée.
- **Branchement conditionnel** sur `TMDB_API_KEY` dans `index.ts` : pas de discovery sans clé, le `discoveryService` est `null` et les routes retournent `503`.
- **`releaseStatus !== 'Released'` → badge "À venir"** : logique correcte et cohérente avec les données TMDB search (date-dérivé) et detail (champ `status` natif).
- **Scope respecté** : aucun import en masse, aucune notification de release, aucun ranking.

## Problèmes détectés

### Mineur — Échec silencieux au clic sur un résultat externe

Dans `SearchPage.tsx:70-86` :

```tsx
async function handleExternalMovieClick(candidate: ExternalMovieCandidate) {
  try {
    const { id } = await materializeMovie(candidate.tmdbId)
    navigate(`/movies/${id}`)
  } catch {
    // silently ignore — user can retry
  }
}
```

Si `materializeMovie` échoue (timeout, 503, 5xx), **rien ne se passe visuellement**. L'utilisateur clique sur la carte, l'app reste figée sur la page de recherche sans indication d'erreur ni invitation à réessayer. Le commentaire dit "user can retry" mais rien ne leur signale qu'il faut le faire.

**Correction suggérée** : Exposer un état d'erreur local `externalError` ou appeler le setter `setError` déjà existant pour afficher l'`ErrorState` (ou un message inline).

### Mineur — Pas de test web pour la section "résultats externes"

Les tests `SearchPage.test.tsx` couvrent empty state, error state et retry, mais **aucun test ne vérifie** :
- que la section "Aussi trouvé en dehors de votre catalogue" s'affiche quand `externalMovies` est non-vide
- que les badges "Non disponible" / "À venir" apparaissent sur les cartes externes
- que la distinction UI "non disponible vs non trouvé" est correcte

Le critère d'acceptance dit explicitement : *"The UI clearly distinguishes `not available to me` from `not found`."* Ce comportement n'est validé que côté API.

**Correction suggérée** : Ajouter un test avec un mock retournant `externalMovies: [{ tmdbId: '999', title: '...', releaseStatus: 'In Production', ... }]` et vérifier que le heading "Aussi trouvé" et le badge "À venir" s'affichent.

### Observation — Race condition TOCTOU dans `materializeMovie`/`materializeSeries`

Le pattern SELECT → INSERT sans transaction est théoriquement sujet à une race. En pratique, la contrainte UNIQUE sur `tmdb_id` protège de la corruption : le second INSERT concurrent échouera avec une erreur de contrainte (→ HTTP 500 plutôt qu'idempotence). Pour un usage interactif mono-utilisateur, le risque est négligeable. À documenter ou corriger vers `INSERT ... ON CONFLICT DO NOTHING` si la montée en charge est envisagée.

### Observation — `releaseStatus` non exposé dans `MovieDetailResponse`

Après matérialisation d'un titre "In Production", la page détail (`MovieDetailResponse`) n'expose pas `releaseStatus`/`releaseDate`. L'utilisateur voit le titre avec `availabilityStatus: 'UNAVAILABLE'` mais pas le statut "En production". Le ticket dit "a useful detail page" — les métadonnées de base (titre, synopsis, poster, année) sont présentes, donc le critère est rempli. Mais l'information "Upcoming" disparaît au-delà de la SearchPage.

### Observation — Cache sans éviction des clés expirées

Le `Map` en mémoire accumule les entrées sans jamais les supprimer (TTL lazy-only). Avec suffisamment de requêtes distinctes, le cache grossit indéfiniment. Acceptable pour le scope actuel.

## Risques éventuels

- Clé TMDB configurée comme API key v3 (`?api_key=...`) vs Bearer v4 : le client utilise `Authorization: Bearer`. Si l'opérateur configure une clé v3, les appels TMDB échoueront silencieusement (→ `externalMovies: []`). Le comportement est dégradé sans cassure, mais la découverte ne fonctionne pas.
- Le threshold `localTotal <= 5` inclut le cas `localTotal === 5` : avec exactement 5 résultats locaux, l'external discovery est quand même déclenché. Cohérent avec la constante nommée `LOCAL_RESULTS_THRESHOLD = 5` mais pourrait surprendre.

## Décision

L'implémentation est fonctionnellement correcte, architecturalement propre et le périmètre est respecté. Les tests API et intégration couvrent l'essentiel des critères d'acceptance. Deux points méritent correction avant validation finale :

1. **L'échec silencieux au clic externe** — UX bloquant pour l'utilisateur (AC : "The UI clearly distinguishes `not available to me` from `not found`" implique aussi que le flux de navigation soit fiable ou signale clairement son échec).
2. **L'absence de test web pour la section externe** — couverture insuffisante d'un AC explicite.

IMPLEMENTATION_FIX_REQUIRED
