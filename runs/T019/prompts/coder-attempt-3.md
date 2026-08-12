# GLOBAL CONTEXT

# Global Context — Iptvflix

## Project

- project_id: iptvflix
- repo: git@github.com:Billboc31/iptvflix.git

## AI Dev Factory

This project uses AI Dev Factory for AI-assisted development.

Agent context folders:
- `ai/` — roles and skills
- `docs/` — project documentation
- `prompts/` — ticket-specific and generic prompts
- `runs/` — per-ticket runtime artifacts
- `tickets/` — ticket definitions

---

# ROLE

# Role — Coder

## Mission

Implémenter strictement un ticket en suivant le plan validé et les skills applicables.

## Tu dois

- lire le ticket
- lire le plan validé
- respecter le scope
- lister les fichiers créés ou modifiés
- produire un changement minimal, lisible et testable
- ajouter ou adapter les tests si nécessaire
- signaler les hypothèses et limites

## Tu ne dois pas

- élargir le ticket
- réécrire l’architecture sans demande explicite
- faire un refactor massif non demandé
- modifier la mémoire projet sauf si le ticket le demande explicitement
- masquer les erreurs ou incertitudes

## Sortie attendue

- résumé des changements
- liste des fichiers modifiés
- vérifications effectuées
- limites connues

## Règles

- coder uniquement après `PLAN_APPROVED`
- ne jamais contourner les contraintes du plan
- garder les changements petits et reviewables

---

# SKILL: workflow-discipline

# Skill — Workflow Discipline

## Objectif

Faire respecter le lifecycle officiel des tickets et PR IA.

## Règles

- respecter l’ordre des étapes du workflow
- ne pas bypass les reviews obligatoires
- maintenir les statuts cohérents
- conserver les artefacts versionnés
- séparer plan, implémentation et mémoire

## Refuser si

- une review obligatoire est sautée
- la mémoire est mise à jour avant validation implémentation
- le workflow officiel est contourné

---

# SKILL: git-discipline

# Skill — Git Discipline

## Objectif

Maintenir un historique Git propre, compréhensible et traçable.

## Règles

- un ticket = une unité de travail cohérente
- éviter les commits mélangeant plusieurs sujets
- utiliser des messages de commit explicites
- conserver les PR lisibles
- éviter les modifications hors scope
- maintenir les fichiers mémoire cohérents avec les changements réels

## Refuser si

- la PR mélange plusieurs fonctionnalités
- des changements non liés sont ajoutés
- les commits deviennent impossibles à reviewer

---

# SKILL: code-quality

# Skill — Code Quality

## Objectif

Produire des changements simples, lisibles, robustes et faciles à reviewer.

## Règles

- privilégier le code simple avant le code sophistiqué
- utiliser des noms explicites
- garder des fonctions courtes et lisibles
- éviter la magie cachée
- gérer les erreurs explicitement
- ajouter des logs utiles sans bruit excessif
- éviter les dépendances inutiles
- conserver un changement borné au ticket

## Refuser si

- le code devient inutilement complexe
- le ticket introduit une dépendance non justifiée
- les erreurs sont masquées
- les changements dépassent le scope demandé

---

# SKILL: refactor-safety

# Skill — Refactor Safety

## Objectif

Limiter les régressions et les dérives de scope lors des modifications.

## Règles

- modifier uniquement le périmètre demandé
- éviter les refactors transversaux implicites
- préserver les comportements existants
- maintenir la compatibilité sauf demande explicite
- privilégier des changements incrémentaux

## Refuser si

- le ticket dérive vers une réécriture globale
- plusieurs couches sont modifiées sans justification
- le comportement change silencieusement

---

# SKILL: security

# Skill — Security

## Objectif

Réduire les risques de sécurité et éviter les comportements dangereux.

## Règles

- ne pas exposer de secrets dans logs ou documentation
- limiter les permissions au strict nécessaire
- éviter les exécutions implicites dangereuses
- valider les entrées externes
- documenter les impacts sécurité importants
- éviter les comportements destructifs implicites

## Refuser si

- des secrets sont hardcodés
- des données sensibles sont logguées
- une opération destructive n’est pas explicitement contrôlée

---

# TASK

# Generic Coder Task

Read the ticket and the approved plan below, then implement the required changes.

The implementation must:
- follow the approved plan strictly
- remain within scope
- list all created or modified files
- be minimal, readable, and testable

The ticket follows.


# T019 — Add universal external catalog discovery for unavailable and upcoming media

**Source**: GitHub Issue #36

## Description

## Objective

Allow users to discover and open canonical Movies/Series that are not currently present on any configured source, including announced/upcoming titles, instead of treating the configured IPTV catalog as the universe of searchable content.

## Context / Problem

IPTVFlix should answer a search for a known upcoming movie even when it has no IPTV/Plex availability. Users need to be able to discover the work, inspect its metadata/release information and later track it. The existing search operates over the local canonical catalog and should remain fast while gaining an external discovery fallback.

## Included

- Add an external-catalog discovery boundary using the existing metadata provider abstraction where appropriate.
- When local canonical search has insufficient/no results, allow discovery of external Movies/Series not yet persisted locally.
- Materialize/persist a canonical Media record when the user opens, saves or otherwise needs to track an external result, without fabricating an availability.
- Represent `availableToMe=false` / zero availabilities clearly in API and web UI.
- Support upcoming/announced media metadata and known release dates/status when the metadata provider exposes them.
- Keep local search results and externally discovered results deduplicated by canonical/external identity.
- Avoid turning ordinary search into an uncontrolled full-database import or excessive provider API usage.
- Handle metadata provider failure/rate limiting without breaking local catalog search.

## Acceptance Criteria

- [ ] Searching for a known Movie not present on any configured source can return an external discovery result.
- [ ] Opening/saving that result can create/reuse one canonical Media with zero availabilities.
- [ ] A future/upcoming title can have a useful detail page even when it is not yet released or available to the user.
- [ ] Local and external results for the same canonical work are not displayed as duplicates.
- [ ] External provider failure still leaves local catalog search usable.
- [ ] The UI clearly distinguishes `not available to me` from `not found`.
- [ ] Provider API calls are bounded/cached appropriately for interactive search.
- [ ] Automated tests cover local hit, external-only hit, upcoming title, deduplication, zero availability and provider failure.

## Excluded / Out of scope

- Importing every external movie/series into the local database.
- Release-follow notifications.
- Recommendation ranking.
- Availability on commercial streaming services not configured as sources.

## Dependencies

Requires the zero-availability canonical model from #33 and uses the existing external metadata provider/enrichment boundary.

---

## Contexte de retry injecté par run_ticket.py

## Output précédent

# Implementation Output — T019

## Status

IMPLEMENTATION_COMPLETE

## Summary

All files required by the approved plan were already implemented in a prior session that hit rate limits before recording output. This session verified the implementation, fixed two test bugs, and confirmed all tests pass.

## Files Modified / Created

### New files
- `apps/api/src/services/external-discovery-service.ts` — ExternalDiscoveryService with discoverMovies, discoverSeries, materializeMovie, materializeSeries; 60s TTL in-memory cache; provider error isolation
- `apps/api/src/routes/discovery.ts` — POST /discovery/movies and POST /discovery/series endpoints
- `apps/api/src/services/__tests__/external-discovery-service.test.ts` — 16 unit tests

### Modified files
- `packages/api-contracts/src/catalog.ts` — Added ExternalMovieCandidate, ExternalSeriesCandidate types; extended SearchResponse with externalMovies/externalSeries
- `apps/api/src/providers/metadata/types.ts` — Added releaseStatus?, releaseDate?, firstAirDate? to ExternalMovieMetadata, ExternalSeriesMetadata, MetadataCandidate; added NoopMetadataProvider
- `apps/api/src/providers/metadata/tmdb/client.ts` — Maps TMDB status/release_date/first_air_date into extended types
- `apps/api/src/services/catalog-service.ts` — Added getMovieTmdbIds() and getSeriesTmdbIds() helpers for deduplication
- `apps/api/src/routes/search.ts` — Local-first search with external discovery fallback (threshold ≤5)
- `apps/api/src/index.ts` — Registers discoveryRoutes; creates ExternalDiscoveryService conditional on TMDB_API_KEY
- `apps/web/src/lib/api.ts` — Added materializeMovie() and materializeSeries() client calls
- `apps/web/src/pages/SearchPage.tsx` — External results section with badge rendering and materialization on click; defensive defaults for externalMovies/externalSeries
- `apps/web/src/components/content/PosterCard.tsx` — Added badge prop with unavailable/upcoming variants
- `apps/api/src/__tests__/integration/vertical-slice.test.ts` — Added 6 discovery integration tests; fixed duplicate mswServer.listen() across describe blocks; fixed cache-bleed in provider-failure test
- `apps/web/src/test/handlers.ts` — Added externalMovies/externalSeries to mock search response
- `apps/web/src/pages/SearchPage.test.tsx` — Updated test mock overrides to include new search response fields

## Test Results

- API unit tests: 218 passed / 0 failed (21 test files)
- Web component tests: 53 passed / 0 failed (11 test files)

## Bugs Fixed During Implementation

1. **Duplicate mswServer.listen()** in vertical-slice.test.ts: the second describe block called `mswServer.listen()` again while the file-level `beforeAll` already had MSW running. Removed the redundant listen/close pair from the second describe's hooks.

2. **Cache bleed in provider-failure test**: the "GET /search succeeds when TMDB returns 500" test used the same query string as a prior test whose result was still cached (60s TTL). Changed to a distinct query string so the test actually reaches the provider (which returns 500).

3. **Undefined externalMovies in web mocks**: test overrides and the default handler didn't include `externalMovies`/`externalSeries`, causing SearchPage to crash on `.length`. Added defensive `?? []` defaults in SearchPage and updated all mock handlers.

## Known Limits

- In-memory cache is cleared on API restart (not persistent across restarts). This is per-spec.
- External discovery is capped at 5 results per type — no pagination.
- `materializeMovie` / `materializeSeries` call `getMovieMetadata` synchronously on first access rather than queuing async enrichment; acceptable given the plan's scope.

---

## Review

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

---

## Instructions de fix

# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T019/reviews/implementation-review.md
- generated at: 2026-08-12T00:35:06Z

---

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