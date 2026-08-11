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


# T013 — Add canonical catalog search and discovery filters

**Source**: GitHub Issue #22

## Description

## Objective

Make the IPTVFlix catalog quickly explorable through fast search and useful discovery filters over canonical/enriched media data.

## Context / Problem

A large IPTV catalog is unusable if users can only browse broad provider categories. Search and filtering must operate on the normalized canonical catalog so the experience remains provider-independent and can later feed recommendation/discovery features.

## Included

- Add backend search/query capabilities over canonical Movies and Series.
- Support at least title text search and filters for media type, genre, release year/range and availability state when data exists.
- Support additional useful filters such as runtime/rating only when the current canonical metadata model can provide them reliably.
- Define deterministic sorting options suitable for the current product, including relevance for text search and recent IPTV availability where applicable.
- Add web search/discovery UI consistent with the validated IPTVFlix design board.
- Preserve user-entered search/filter state during normal navigation where practical.
- Handle incomplete/unmatched metadata gracefully rather than excluding media unnecessarily.
- Ensure query inputs are validated server-side and cannot generate unsafe arbitrary database expressions.

## Acceptance Criteria

- [ ] Users can search Movies and Series by title through the canonical API/web UI.
- [ ] Users can filter by media type, genre and release period when those fields are available.
- [ ] Search does not depend on Xtream provider DTOs/categories directly.
- [ ] Recent availability can be used as a discovery/sort signal using persisted availability lifecycle data.
- [ ] Unmatched/partially enriched items remain searchable using their available canonical/source title information.
- [ ] Empty/no-result, loading and API-error states are handled clearly in the UI.
- [ ] Search/filter parameters are validated on the backend.
- [ ] Automated tests cover representative queries, combinations, no-results and invalid inputs.

## Excluded / Out of scope

- Natural-language/LLM search.
- Personalized recommendation ranking.
- Cinema radar.
- Full-text search infrastructure such as Elasticsearch/OpenSearch unless repository-scale evidence demonstrates it is necessary.

## Dependencies

Uses the canonical Batch 1 catalog. Enriched filters benefit from #19/#20 but basic search can be developed in parallel using existing canonical fields.

---

## Contexte de retry injecté par run_ticket.py

## Output précédent

All tests pass and TypeScript is clean. Here's a summary of everything implemented:

---

## Implementation complete

### Files created (11)
| File | Purpose |
|---|---|
| `apps/api/src/services/catalog-service.ts` | Drizzle query functions: `listMovies`, `getMovie`, `listSeries`, `getSeries`, `searchContent`, `listGenres` |
| `apps/api/src/routes/movies.ts` | `GET /movies` (validated filters) + `GET /movies/:id` |
| `apps/api/src/routes/series.ts` | `GET /series` (validated filters) + `GET /series/:id` |
| `apps/api/src/routes/search.ts` | `GET /search?q=` with 400 for missing/empty/too-long q |
| `apps/api/src/routes/genres.ts` | `GET /genres` |
| `apps/api/src/routes/movies.test.ts` | 17 tests: list, filters, invalid inputs, 404 |
| `apps/api/src/routes/series.test.ts` | 14 tests: same pattern |
| `apps/api/src/routes/search.test.ts` | 7 tests: valid query, empty results, missing/empty/long q, no Xtream fields |
| `apps/api/src/routes/genres.test.ts` | 3 tests: array shape, empty list, ordering |
| `apps/web/src/hooks/useGenres.ts` | Hook wrapping `listGenres()` via `useApi` |

### Files modified (10)
| File | Change |
|---|---|
| `packages/api-contracts/src/catalog.ts` | Added `q`, `availability`, `sortBy` to `MovieFilters` and `SeriesFilters` |
| `apps/api/src/index.ts` | Registered 4 new route modules |
| `apps/web/src/lib/api.ts` | Added `listGenres()` |
| `apps/web/src/components/content/FilterBar.tsx` | Added availability and sortBy dropdowns; `role="alert"` on ErrorState |
| `apps/web/src/components/ui/ErrorState.tsx` | Added `role="alert"` for accessibility |
| `apps/web/src/pages/MoviesPage.tsx` | `useGenres` → FilterBar; pagination controls |
| `apps/web/src/pages/SeriesPage.tsx` | Same as MoviesPage |
| `apps/web/src/pages/SearchPage.tsx` | Replaced silent `.catch(() => {})` with `error` state + `<ErrorState>` |
| `apps/web/src/test/handlers.ts` | Added `GET /api/genres` MSW handler and `MOCK_GENRES` |
| `apps/web/src/pages/MoviesPage.test.tsx` | Added genre population, availability/sort, error state, pagination tests |
| `apps/web/src/pages/SearchPage.test.tsx` | Added empty-results and error-state tests |

**Results:** 81 backend route tests pass, 32 frontend tests pass, web typecheck clean. The 2 pre-existing API failures require a live database and are unrelated to this ticket.

---

## Review

---

# PR Review — T013: Add canonical catalog search and discovery filters

## Résumé

L'implémentation couvre correctement le périmètre du ticket : backend de requêtes sur le catalogue canonique, validation des inputs, nouveaux endpoints REST, UI de recherche/filtrage et couverture de tests. La qualité générale est bonne — architecture claire, pas de N+1, TypeScript strict, bons tests unitaires.

Deux problèmes bloquants identifiés ; plusieurs observations mineures.

---

## Vérifications effectuées

- Contrats API (`packages/api-contracts/src/catalog.ts`)
- Service catalog (`apps/api/src/services/catalog-service.ts`) — logique de filtrage, tri, pagination, dérivation de disponibilité
- Routes backend : `movies.ts`, `series.ts`, `search.ts`, `genres.ts` — validation des query params
- Entry point `apps/api/src/index.ts` — enregistrement des routes, gestion d'erreurs globale
- Tests backend : `movies.test.ts` (17), `series.test.ts` (14), `search.test.ts` (7), `genres.test.ts` (3)
- Frontend : `FilterBar.tsx`, `MoviesPage.tsx`, `SeriesPage.tsx`, `SearchPage.tsx`, `useGenres.ts`
- Critères d'acceptance du ticket

---

## Points validés

- **Recherche titre** : ILIKE sur `title` et `originalTitle` → items partiellement enrichis restent cherchables. ✓
- **Filtres** : genre (UUID validé), année (bornes 1888–2100), disponibilité (enum strict), sortBy (enum strict), pagination (1–100). ✓
- **Indépendance Xtream** : aucun champ DTO Xtream dans les réponses (testé explicitement dans `search.test.ts`). ✓
- **Tri recentAvailability** : `MAX(last_seen_at) DESC NULLS LAST` — items sans disponibilité tombent en bas, jamais exclus. ✓
- **Items partiellement enrichis** : `quality: null`, `year: null`, `synopsis: null` tous acceptés dans les types contrat. ✓
- **Injections SQL** : `q` via `ilike()` ORM (paramétré), `genreId` via `sql\`...\`` template Drizzle (paramétré), `sortBy` statique validé en amont — aucune injection possible. ✓
- **États UI** : loading (skeleton), empty state, error state présents sur MoviesPage, SeriesPage, SearchPage. ✓
- **Filtres URL SearchPage** : `useSearchParams` synchronise la query dans l'URL. ✓
- **Qualité no-op** : accepté par le plan, documenté dans le contrat (`quality?: string` en input, `quality: null` toujours en output). ✓
- **Tests** : 41 tests backend (happy paths, boundary values, invalid inputs, no-results). ✓

---

## Problèmes détectés

### [BLOQUANT 1] — Path params `:id` non validés → 500 au lieu de 404

**Fichiers** : `apps/api/src/routes/movies.ts:84`, `apps/api/src/routes/series.ts:84`

`/movies/:id` et `/series/:id` passent l'`id` brut (non validé) directement à `getMovie()` / `getSeries()`. Si l'appelant envoie un id non-UUID (ex. `/movies/not-a-uuid`), PostgreSQL lève une exception de cast (`invalid input syntax for type uuid`) qui remonte comme exception non gérée. Fastify retourne un 500 avec le message d'erreur DB dans la réponse — fuite d'information interne.

Le ticket exige : *"Ensure query inputs are validated server-side."*

**Correction attendue** : valider le format UUID sur le path param avant d'appeler le service, et retourner 404 si invalide.

```typescript
// movies.ts
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-...-[0-9a-f]{12}$/i  // déjà défini dans ce fichier
app.get<{ Params: { id: string } }>('/movies/:id', async (request, reply) => {
  if (!UUID_RE.test(request.params.id)) {
    return reply.status(404).send({ error: `Movie ${request.params.id} not found` })
  }
  const movie = await getMovie(request.params.id)
  ...
})
```

---

### [BLOQUANT 2] — Bouton "Réessayer" de `SearchPage` non fonctionnel

**Fichier** : `apps/web/src/pages/SearchPage.tsx:74-80`

```tsx
onRetry={() => {
  setError(null)
  setQuery((q) => q)   // ← ne change pas la valeur
}}
```

`setQuery((q) => q)` retourne la même chaîne : React 18 bail out, aucune re-render sur `query`. Le `useEffect` sur `debouncedQuery` ne se re-déclenche pas. Résultat : l'erreur disparaît mais la recherche ne se relance pas — l'utilisateur voit l'état vide au lieu des résultats. Le critère *"API-error states are handled clearly in the UI"* n'est pas satisfait.

**Correction attendue** : utiliser un compteur de forçage ou vider puis remettre la query.

```tsx
const [retryCount, setRetryCount] = useState(0)

// Dans useEffect, ajouter retryCount comme dépendance
useEffect(() => {
  if (!debouncedQuery.trim()) { ... return }
  setLoading(true)
  setError(null)
  searchContent(debouncedQuery)
    ...
}, [debouncedQuery, retryCount])  // ← ajouter retryCount

onRetry={() => {
  setError(null)
  setRetryCount((c) => c + 1)   // ← force le re-run
}}
```

---

## Risques éventuels

### [MINEUR] — Pas de gestionnaire d'erreurs global Fastify

**Fichier** : `apps/api/src/index.ts`

Aucun `app.setErrorHandler()`. Toute exception inattendue dans les routes (ex. perte de connexion DB pendant un `listMovies`) renvoie un 500 avec le message d'erreur brut Fastify. Pour les deux bugs bloquants ci-dessus, le problème est amplifié. Un handler global loggant l'erreur et retournant `{ error: 'Internal Server Error' }` générique améliorerait la sécurité et la cohérence.

### [MINEUR] — Filtre qualité rendu mais toujours inactif

**Fichier** : `apps/web/src/components/content/FilterBar.tsx:88-102`

Le sélecteur qualité est affiché (quand `showQuality=true`) et envoie la valeur au backend, qui l'ignore silencieusement. Comportement documenté dans le plan comme temporaire, mais un utilisateur qui sélectionne "HD" sans observer de différence risque de penser que le filtre est cassé. Acceptable si la roadmap d'enrichissement est proche, à monitorer via feedback.

### [MINEUR] — Option par défaut "Tri : titre" redondante avec l'option "Titre"

**Fichier** : `apps/web/src/components/content/FilterBar.tsx:82-84`

L'option vide `""` mappe sur `undefined` → tri par titre (défaut service). L'option explicite `"title"` envoie `sortBy=title`. Les deux produisent le même résultat. Pas de bug fonctionnel mais crée une confusion dans l'UI.

---

## Décision

REQUEST_CHANGES — deux bugs bloquants à corriger :
1. Validation UUID sur les path params `:id` des routes movies et series
2. Logique de retry sur `SearchPage` (déclenchement effectif de la recherche)

## Actions demandées

1. `apps/api/src/routes/movies.ts` et `apps/api/src/routes/series.ts` : ajouter validation UUID sur `request.params.id`, retourner 404 si invalide.
2. `apps/web/src/pages/SearchPage.tsx` : corriger le handler `onRetry` pour forcer le re-déclenchement de l'effet de recherche.
3. (Optionnel, non bloquant) Ajouter un `app.setErrorHandler()` global dans `apps/api/src/index.ts` pour masquer les messages d'erreur DB en production.

IMPLEMENTATION_FIX_REQUIRED

---

## Instructions de fix

# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T013/reviews/implementation-review.md
- generated at: 2026-08-11T11:33:41Z

---

---

# PR Review — T013: Add canonical catalog search and discovery filters

## Résumé

L'implémentation couvre correctement le périmètre du ticket : backend de requêtes sur le catalogue canonique, validation des inputs, nouveaux endpoints REST, UI de recherche/filtrage et couverture de tests. La qualité générale est bonne — architecture claire, pas de N+1, TypeScript strict, bons tests unitaires.

Deux problèmes bloquants identifiés ; plusieurs observations mineures.

---

## Vérifications effectuées

- Contrats API (`packages/api-contracts/src/catalog.ts`)
- Service catalog (`apps/api/src/services/catalog-service.ts`) — logique de filtrage, tri, pagination, dérivation de disponibilité
- Routes backend : `movies.ts`, `series.ts`, `search.ts`, `genres.ts` — validation des query params
- Entry point `apps/api/src/index.ts` — enregistrement des routes, gestion d'erreurs globale
- Tests backend : `movies.test.ts` (17), `series.test.ts` (14), `search.test.ts` (7), `genres.test.ts` (3)
- Frontend : `FilterBar.tsx`, `MoviesPage.tsx`, `SeriesPage.tsx`, `SearchPage.tsx`, `useGenres.ts`
- Critères d'acceptance du ticket

---

## Points validés

- **Recherche titre** : ILIKE sur `title` et `originalTitle` → items partiellement enrichis restent cherchables. ✓
- **Filtres** : genre (UUID validé), année (bornes 1888–2100), disponibilité (enum strict), sortBy (enum strict), pagination (1–100). ✓
- **Indépendance Xtream** : aucun champ DTO Xtream dans les réponses (testé explicitement dans `search.test.ts`). ✓
- **Tri recentAvailability** : `MAX(last_seen_at) DESC NULLS LAST` — items sans disponibilité tombent en bas, jamais exclus. ✓
- **Items partiellement enrichis** : `quality: null`, `year: null`, `synopsis: null` tous acceptés dans les types contrat. ✓
- **Injections SQL** : `q` via `ilike()` ORM (paramétré), `genreId` via `sql\`...\`` template Drizzle (paramétré), `sortBy` statique validé en amont — aucune injection possible. ✓
- **États UI** : loading (skeleton), empty state, error state présents sur MoviesPage, SeriesPage, SearchPage. ✓
- **Filtres URL SearchPage** : `useSearchParams` synchronise la query dans l'URL. ✓
- **Qualité no-op** : accepté par le plan, documenté dans le contrat (`quality?: string` en input, `quality: null` toujours en output). ✓
- **Tests** : 41 tests backend (happy paths, boundary values, invalid inputs, no-results). ✓

---

## Problèmes détectés

### [BLOQUANT 1] — Path params `:id` non validés → 500 au lieu de 404

**Fichiers** : `apps/api/src/routes/movies.ts:84`, `apps/api/src/routes/series.ts:84`

`/movies/:id` et `/series/:id` passent l'`id` brut (non validé) directement à `getMovie()` / `getSeries()`. Si l'appelant envoie un id non-UUID (ex. `/movies/not-a-uuid`), PostgreSQL lève une exception de cast (`invalid input syntax for type uuid`) qui remonte comme exception non gérée. Fastify retourne un 500 avec le message d'erreur DB dans la réponse — fuite d'information interne.

Le ticket exige : *"Ensure query inputs are validated server-side."*

**Correction attendue** : valider le format UUID sur le path param avant d'appeler le service, et retourner 404 si invalide.

```typescript
// movies.ts
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-...-[0-9a-f]{12}$/i  // déjà défini dans ce fichier
app.get<{ Params: { id: string } }>('/movies/:id', async (request, reply) => {
  if (!UUID_RE.test(request.params.id)) {
    return reply.status(404).send({ error: `Movie ${request.params.id} not found` })
  }
  const movie = await getMovie(request.params.id)
  ...
})
```

---

### [BLOQUANT 2] — Bouton "Réessayer" de `SearchPage` non fonctionnel

**Fichier** : `apps/web/src/pages/SearchPage.tsx:74-80`

```tsx
onRetry={() => {
  setError(null)
  setQuery((q) => q)   // ← ne change pas la valeur
}}
```

`setQuery((q) => q)` retourne la même chaîne : React 18 bail out, aucune re-render sur `query`. Le `useEffect` sur `debouncedQuery` ne se re-déclenche pas. Résultat : l'erreur disparaît mais la recherche ne se relance pas — l'utilisateur voit l'état vide au lieu des résultats. Le critère *"API-error states are handled clearly in the UI"* n'est pas satisfait.

**Correction attendue** : utiliser un compteur de forçage ou vider puis remettre la query.

```tsx
const [retryCount, setRetryCount] = useState(0)

// Dans useEffect, ajouter retryCount comme dépendance
useEffect(() => {
  if (!debouncedQuery.trim()) { ... return }
  setLoading(true)
  setError(null)
  searchContent(debouncedQuery)
    ...
}, [debouncedQuery, retryCount])  // ← ajouter retryCount

onRetry={() => {
  setError(null)
  setRetryCount((c) => c + 1)   // ← force le re-run
}}
```

---

## Risques éventuels

### [MINEUR] — Pas de gestionnaire d'erreurs global Fastify

**Fichier** : `apps/api/src/index.ts`

Aucun `app.setErrorHandler()`. Toute exception inattendue dans les routes (ex. perte de connexion DB pendant un `listMovies`) renvoie un 500 avec le message d'erreur brut Fastify. Pour les deux bugs bloquants ci-dessus, le problème est amplifié. Un handler global loggant l'erreur et retournant `{ error: 'Internal Server Error' }` générique améliorerait la sécurité et la cohérence.

### [MINEUR] — Filtre qualité rendu mais toujours inactif

**Fichier** : `apps/web/src/components/content/FilterBar.tsx:88-102`

Le sélecteur qualité est affiché (quand `showQuality=true`) et envoie la valeur au backend, qui l'ignore silencieusement. Comportement documenté dans le plan comme temporaire, mais un utilisateur qui sélectionne "HD" sans observer de différence risque de penser que le filtre est cassé. Acceptable si la roadmap d'enrichissement est proche, à monitorer via feedback.

### [MINEUR] — Option par défaut "Tri : titre" redondante avec l'option "Titre"

**Fichier** : `apps/web/src/components/content/FilterBar.tsx:82-84`

L'option vide `""` mappe sur `undefined` → tri par titre (défaut service). L'option explicite `"title"` envoie `sortBy=title`. Les deux produisent le même résultat. Pas de bug fonctionnel mais crée une confusion dans l'UI.

---

## Décision

REQUEST_CHANGES — deux bugs bloquants à corriger :
1. Validation UUID sur les path params `:id` des routes movies et series
2. Logique de retry sur `SearchPage` (déclenchement effectif de la recherche)

## Actions demandées

1. `apps/api/src/routes/movies.ts` et `apps/api/src/routes/series.ts` : ajouter validation UUID sur `request.params.id`, retourner 404 si invalide.
2. `apps/web/src/pages/SearchPage.tsx` : corriger le handler `onRetry` pour forcer le re-déclenchement de l'effet de recherche.
3. (Optionnel, non bloquant) Ajouter un `app.setErrorHandler()` global dans `apps/api/src/index.ts` pour masquer les messages d'erreur DB en production.

IMPLEMENTATION_FIX_REQUIRED