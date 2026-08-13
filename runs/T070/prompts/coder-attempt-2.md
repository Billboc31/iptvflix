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


# T070 — Drive Movies and Series discovery shelves from the canonical catalog

**Source**: GitHub Issue #137

## Description

Parent: #131

Once the canonical catalog exists, Films/Séries discovery must no longer be limited to provider availability.

Build automatic shelves from canonical metadata: popular, trending/recent, upcoming, genres, language/country where useful, collections/franchises, critically/audience-rated signals, and other useful discovery groupings supported by persisted metadata.

Cards with zero sources must still render normally and open a detail page. Availability is a separate state/badge/action. Provide a clear way to distinguish/filter `All catalog` vs `Available now` without making availability define the catalog.

The hero and shelf candidates should be selected from clean canonical metadata, not raw Xtream names. Existing personalized/custom shelf work should consume the same canonical identities.

Acceptance criteria:
- Movies/Series pages remain rich with zero providers connected.
- Multiple automatic shelves are generated from local canonical metadata.
- Upcoming/unavailable titles can appear and be added to My List.
- Available titles expose playable variants without duplicate cards.
- Users can discover/filter content based on availability when desired.
- Hero/cards always use canonical titles/artwork/metadata.
- Shelf APIs are performant against the large local catalog.

---

## Contexte de retry injecté par run_ticket.py

## Output précédent

All tasks complete. Here's a summary of every file created or modified:

---

## Files modified

### `packages/api-contracts/src/catalog.ts`
- Extended `MovieFilters.sortBy` and `SeriesFilters.sortBy` to `'title' | 'year' | 'recentAvailability' | 'popularity' | 'voteAverage'`
- Added `upcoming?: boolean` to both filter types

### `apps/api/src/routes/movies.ts` + `series.ts`
- Accepts `popularity` and `voteAverage` as valid `sortBy` values
- Parses and validates `upcoming` query param (`'true'` → `true`, anything else → 400)

### `apps/api/src/services/catalog-service.ts`
- `listMovies`: adds `popularity` (`DESC NULLS LAST`) and `voteAverage` sort branches; adds `upcoming=true` → WHERE clause filtering on release date / status
- `listSeries`: same, with `in_production` / status condition for upcoming

### `apps/api/src/db/schema/movies.ts` + `series.ts`
- Added `index` import from `drizzle-orm/pg-core`
- Added `index('movies_popularity_idx')` + `index('movies_vote_average_idx')` to `movies` table definition
- Same for `series`

### `apps/api/migrations/0033_t070_discovery_indexes.sql` _(new)_
- Creates `movies_vote_average_idx` and `series_vote_average_idx` (the popularity indexes already existed from migration 0030)

### `apps/api/migrations/meta/_journal.json`
- Added entries for `0032_catalog_refresh` and `0033_t070_discovery_indexes` (0032 was missing from the journal)

### `apps/web/src/lib/api.ts`
- Extended `toQuery` to accept `boolean` values (for `upcoming`)

### `apps/web/src/pages/MoviesPage.tsx`
- Extracted `MovieShelf` helper component (hides itself when empty after loading)
- Hero now queries `sortBy='popularity'`, no availability gate
- Added "Tout le catalogue / Disponible maintenant" toggle pill
- Default (`all`) mode: Populaires, Les mieux notés, Sorties récentes, À venir shelves — all canonical, no availability gate
- `available` mode: prepends a "Disponibles" shelf and adds `availability='AVAILABLE'` to all other shelves

### `apps/web/src/pages/SeriesPage.tsx`
- Identical restructuring to MoviesPage

---

## Review

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

---

## Instructions de fix

# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T070/reviews/implementation-review.md
- generated at: 2026-08-13T19:29:10Z

---

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