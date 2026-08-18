I have all the information needed for the second review. Let me write it.

---

## PR Review — T108: Expand TMDB Discovery Catalog (Attempt 2)

## Résumé

La review précédente avait bloqué sur un cross-mapping dans le client TMDB : `fetchMovieFeed` acheminait `airing_today` vers `/tv/airing_today` et `fetchSeriesFeed` acheminait `now_playing` vers `/movie/now_playing`. Le coder a corrigé ce bug. Cette review-ci vérifie que la correction est correcte et que le reste de l'implémentation est sain.

---

## Fix du bug bloquant — Validé ✓

**`apps/api/src/providers/metadata/tmdb/client.ts`, lignes 465–531**

```ts
// fetchMovieFeed — ligne 466
if (feed === 'airing_today') throw new Error('airing_today is a series-only feed')
// paths ne contient plus 'airing_today'

// fetchSeriesFeed — ligne 500
if (feed === 'now_playing') throw new Error('now_playing is a movie-only feed')
// paths ne contient plus 'now_playing'
```

- La garde est en entrée de fonction — fail-fast avant tout accès réseau.
- Le type est passé à `Partial<Record<DiscoveryFeed, string>>` avec null-guard, donc un feed inattendu lève également une erreur.
- Les chemins côté `fetchMovieFeed` (`popular`, `trending`, `upcoming`, `now_playing`) et côté `fetchSeriesFeed` (`popular`, `trending`, `upcoming`, `airing_today`) sont maintenant disjoint et corrects.

---

## Vérifications effectuées sur le reste de l'implémentation

### Bootstrap — `catalog-bootstrap-service.ts` ✓

`buildSteps()` ajoute bien `now_playing` (MOVIE) et `airing_today` (SERIES). Quality floor appliqué uniquement aux steps genre/discover, pas aux feed steps (curatés par TMDB). Checkpoint persisté page par page. Upsert sur `tmdbId` via `onConflictDoUpdate`.

### Variables d'env — `config/env.ts` ✓

Toutes les variables attendues par le plan sont présentes avec les bons défauts :
- `CATALOG_BOOTSTRAP_MAX_PAGES_PER_FEED`: 50
- `CATALOG_BOOTSTRAP_MAX_PAGES_PER_GENRE`: 20
- `CATALOG_BOOTSTRAP_MAX_PAGES_NOW_PLAYING`: 10
- `CATALOG_BOOTSTRAP_QUALITY_MIN_VOTE_COUNT`: 50
- `CATALOG_BOOTSTRAP_QUALITY_MIN_POPULARITY`: 5.0
- `DISCOVERY_POOL_MAX_PAGES_PER_FEED`: 5

### Endpoint catalog-stats — `routes/catalog-stats.ts` ✓

8 requêtes en parallèle. Shape de réponse conforme au plan. `withoutAvailability = total - withAvailability` calculé côté API. Stub `embeddingPending: 0` documenté. Les imports schema (lignes 7-11) utilisent des objets Drizzle pour les counts simples.

**Observation persistante (non bloquante)** : les sous-requêtes EXISTS aux lignes 27-28 et 38-39 utilisent des noms de tables hardcodés (`movie_availabilities`, `series_availabilities`) dans du SQL brut. Signalé en review 1, toujours présent. Risque mineur si renommage de tables.

### Endpoint embedding-backfill — `routes/embedding-backfill.ts` ✓

Retourne HTTP 501 avec `eligibleMovies`/`eligibleSeries` (count sur `metadataEnrichedAt IS NOT NULL`). Integration point explicite pour #205.

### AvailabilityPolicy — `services/recommendation-ranking-service.ts` ✓

```ts
if (availabilityPolicy === 'WATCH_NOW') {
  visible = scored.filter((c) => c.available)
} else if (availabilityPolicy === 'UPCOMING') {
  visible = scored.filter((c) => c.status != null && UPCOMING_STATUSES.has(c.status))
} else {
  // ALL, DISCOVERY, undefined — fall back to legacy availableToMe flag
  visible = availableToMe ? scored.filter((c) => c.available) : scored
}
```

- `WATCH_NOW` : filtre correct sur availability.
- `UPCOMING` : filtre correct sur statuts (`Rumored`, `Planned`, `In Production`, `Post Production`).
- `DISCOVERY`/`ALL` sans `availableToMe` → retourne tout le catalogue — comportement attendu.
- Note d'implémentation : si un client envoie simultanément `policy=DISCOVERY&availableToMe=true`, les titres non-disponibles seraient filtrés, ce qui est sémantiquement incorrect. C'est un edge-case de paramètres contradictoires non couvert par les tests, mais pas une régression du comportement normal de l'application.

### Route recommendations — `routes/recommendations.ts` ✓

Validation du param `policy` contre `VALID_POLICIES`. Passage correct comme `availabilityPolicy` au service. `availableToMe` parsé de string via `=== 'true'` — comportement attendu.

### Suites de tests — toutes présentes ✓

| Suite | Fichier | Couvre |
|---|---|---|
| catalog-bootstrap | `services/__tests__/catalog-bootstrap-service.test.ts` | upsert idempotency, dedup intra-batch |
| catalog-sync | `services/__tests__/catalog-sync.test.ts` | canonical identity sur conflit |
| catalog-stats | `routes/__tests__/catalog-stats.test.ts` | shape, withoutAvailability > 0 |
| recommendation-ranking | `services/__tests__/recommendation-ranking-service.test.ts` | scénario 10 : WATCH_NOW, DISCOVERY, UPCOMING, ALL |
| profile-unavailable | `routes/__tests__/profile-unavailable.test.ts` | POST/GET/DELETE watchlist pour titre zéro-availability |
| embedding-backfill | `routes/__tests__/embedding-backfill.test.ts` | 501 + eligible counts |

---

## Observations mineures résiduelles (non bloquantes)

1. **SQL hardcodé dans `catalog-stats.ts` (lignes 27-28, 38-39)** — déjà signalé en review 1, toujours non adressé. Cosmétique ; les noms de tables sont stables dans ce projet.

2. **Test d'intégration bootstrap→sync manquant** — la review 1 l'avait noté comme optionnel. `catalog-sync.test.ts` couvre l'upsert canonical identity mais pas le flux complet "movie bootstrappé (0 availability) + sync Xtream → 1 movie row + 1 availability row". Acceptable per plan exclusions.

3. **`rankRecommendations` charge tout le catalogue en mémoire** — explicitement exclu du scope T108 par le plan. À tracker séparément.

4. **Migration T093 dans le diff T108** — risque de conflit de merge uniquement ; T108 n'est pas responsable de ce fichier.

---

## Décision

Le seul bug bloquant identifié en review 1 est corrigé correctement. Les 6 suites de tests requises par le plan existent et couvrent les scénarios critiques du ticket. L'implémentation est conforme au plan et au ticket.

IMPLEMENTATION_APPROVED
