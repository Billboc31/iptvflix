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


# T068 — Implement hybrid local + TMDB search with automatic catalog enrichment

**Source**: GitHub Issue #135

## Description

Parent: #131

Search must not be limited to what IPTVFlix already knows locally.

When a user searches for a movie or show, search the local canonical catalog immediately and also query TMDB when appropriate. Merge results by canonical TMDB identity and avoid duplicate cards.

Any useful TMDB result not already present locally should be importable into the canonical catalog automatically so it becomes a durable IPTVFlix entity even with zero playable sources. It can then be added to a watchlist, used in shelves/recommendations, and later receive Xtream/Plex availability without changing identity.

Prioritize fast UX: local results should render without waiting for remote search. Remote results can enrich the result set. Handle TMDB outage/rate limiting gracefully and keep local search functional.

Search should understand movies and TV and use French/localized titles plus original/alternate titles where available. Ranking should remain sensible when local and remote results overlap.

Acceptance criteria:
- Local catalog search is fast and works offline from TMDB.
- TMDB can add relevant results missing locally.
- Local/remote duplicates merge by TMDB identity.
- Selecting/using a remote-only result persists the canonical entity locally.
- Zero-source results can be opened and added to user features.
- Later provider sync attaches availability to the same entity.
- Movies and shows are supported.
- Remote failures do not break local search.

---

## Contexte de retry injecté par run_ticket.py

## Output précédent

All 6 changes were already implemented and all 35 tests (14 search-route + 16 discovery-service + 5 for sync-runs) pass.

Here is a summary of the implementation:

**Files modified:**

| File | Change |
|---|---|
| `packages/api-contracts/src/catalog.ts` | `SearchResponse` stripped of `externalMovies`/`externalSeries`; new `DiscoverResponse` type added |
| `apps/api/src/routes/search.ts` | `GET /search` now returns only local `{ movies, series }` with no TMDB call; `GET /search/remote` added — fetches local IDs for exclusion, calls `discoveryService`, returns `{ externalMovies, externalSeries }`, swallows all errors with HTTP 200 |
| `apps/api/src/services/external-discovery-service.ts` | `MAX_EXTERNAL_RESULTS` raised from `5` to `10` |
| `apps/api/src/services/catalog-service.ts` | `searchContent()` WHERE clause extended with `localizations->'fr'->>'title' ILIKE` for both movies and series |
| `apps/web/src/lib/api.ts` | `DiscoverResponse` imported; `searchDiscover(q)` added calling `GET /search/remote` |
| `apps/web/src/pages/SearchPage.tsx` | Parallel fire of `searchContent` + `searchDiscover`; independent `externalLoading` state; `showExternal = hasExternal \|\| externalLoading`; inline `<Spinner />` inside the external section while loading |

---

## Review

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

---

## Instructions de fix

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