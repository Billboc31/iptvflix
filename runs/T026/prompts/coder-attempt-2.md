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


# T026 — Fix dynamic Shelf availability filtering and unsupported rule semantics

**Source**: GitHub Issue #51

## Description

## Objective

Make dynamic Shelf rules deterministic for both positive and negative availability filters, and prevent explicitly requested rules from being silently ignored.

## Context / Problem

The current Shelf evaluator only applies the availability predicate when `availableToMe` is truthy. Therefore a dynamic Shelf configured with `availableToMe: false` behaves as if no availability filter was supplied, mixing available and unavailable Media.

The Series evaluator also silently ignores `watchState`, even though the rule validator accepts it. A user-defined rule must either be implemented with documented semantics or rejected explicitly; silently ignoring it makes Shelves misleading.

## Included

- Treat `availableToMe` as a tri-state rule:
  - undefined = no availability filter;
  - true = at least one current AVAILABLE availability;
  - false = no current AVAILABLE availability.
- Apply the same semantics consistently to Movies and Series.
- Ensure zero-availability/upcoming canonical Media can participate in `availableToMe=false` Shelves.
- Review accepted dynamic Shelf rules so every validated rule has deterministic behavior for the selected media type.
- For `watchState` on Series, either implement a well-defined Series-level derivation from Episode progress or reject the unsupported combination server-side; do not silently ignore it.
- Keep all rule evaluation backend-controlled and parameterized through the existing constrained rule model.

## Acceptance Criteria

- [ ] `availableToMe=true` returns only Media with at least one current AVAILABLE availability.
- [ ] `availableToMe=false` returns only Media with no current AVAILABLE availability, including zero-availability Media.
- [ ] Omitting `availableToMe` leaves availability unrestricted.
- [ ] Movie and Series rules use consistent availability semantics.
- [ ] An explicitly supplied `watchState` for Series is either correctly evaluated or rejected with a clear validation error; it is never silently ignored.
- [ ] Dynamic Shelf results refresh correctly when availability changes.
- [ ] Automated tests cover true/false/undefined availability filters for Movies and Series plus Series `watchState` behavior.

## Excluded / Out of scope

- Natural-language Shelf creation.
- Recommendation ranking.
- New complex Shelf rule types.

## Dependencies

Builds on the existing Shelf and canonical Availability implementations.

---

## Contexte de retry injecté par run_ticket.py

## Output précédent

All 359 tests pass. Here's a summary of the changes:

---

## Changes

### `apps/api/src/services/shelf-service.ts`

**`validateDynamicRules()`** — after validating the watchState value, a new guard rejects the combination when `mediaType` is not `'MOVIE'` (covers both `SERIES` and omitted):
```
if (result.mediaType !== 'MOVIE') throw ValidationError("watchState is only supported when mediaType is 'MOVIE'")
```

**`evaluateMovies()`** — replaced the truthy `rules.availableToMe ? inArray(...) : undefined` with an explicit three-branch check:
- `=== true` → `inArray(movies.id, subquery WHERE status='AVAILABLE')`
- `=== false` → `notInArray(movies.id, subquery WHERE status='AVAILABLE')`
- `=== undefined` → no filter

**`evaluateSeries()`** — identical three-branch pattern applied using `seriesAvailabilities`; removed the now-dead `// watchState is not supported for series — gracefully ignored` comment.

### `apps/api/src/routes/__tests__/shelves.test.ts`

Added 11 new test cases across two describe blocks:

- `validateDynamicRules`: rejects `watchState` with `SERIES`, rejects without `mediaType`, accepts with `MOVIE`
- `POST /shelves`: route-level validation returning 400 with the correct error message for those two reject cases + regression guard for the MOVIE accept case
- `GET /shelves/:id dynamic availability evaluation`: `availableToMe: false` for movies, `availableToMe: undefined` for movies, `availableToMe: false` for series, `availableToMe: undefined` for series

---

## Review

Now I have a complete picture of the implementation. Let me write the review.

---

# PR Review — T026: Fix dynamic Shelf availability filtering and unsupported rule semantics

## Résumé

L'implémentation porte sur deux fichiers : `shelf-service.ts` (+28 lignes) et `shelves.test.ts` (+132 lignes). Le scope est parfaitement borné au ticket. La logique principale est correcte.

## Vérifications effectuées

- Lecture complète du diff T026 (`git show b0bb607`)
- Lecture du `shelf-service.ts` final (541 lignes)
- Lecture du `shelves.test.ts` final (587 lignes)
- Comparaison avec les critères d'acceptation du ticket

## Points validés

**`validateDynamicRules()` — rejet `watchState` non-MOVIE** (lignes 148–156)

La garde `if (result.mediaType !== 'MOVIE')` est placée après la validation de la valeur, avant l'assignation. Le cas `mediaType` omis (`undefined !== 'MOVIE'`) est correctement rejeté. Les deux cas du plan sont couverts : `SERIES` explicite et `mediaType` absent.

**`evaluateMovies()` — tri-state** (lignes 175–191)

Remplacement du guard truthy `rules.availableToMe ? inArray(...) : undefined` par une chaîne ternaire à trois branches (`=== true` / `=== false` / `undefined`). Sémantique correcte :
- `true` → `inArray` sur AVAILABLE
- `false` → `notInArray` sur AVAILABLE (inclut les Media sans aucune ligne de disponibilité)
- `undefined` → pas de filtre

**`evaluateSeries()` — tri-state symétrique** (lignes 263–279)

Pattern identique à `evaluateMovies()`, sur `seriesAvailabilities.seriesId`. Commentaire `// watchState is not supported for series — gracefully ignored` supprimé (il ne l'est plus silencieusement, il est rejeté au validateur).

**Scope**

Aucune modification hors périmètre. Le type `ShelfRuleDefinition` dans `api-contracts` n'est pas touché (conforme au plan : la contrainte reste server-side). Pas de régression sur les autres chemins.

**Tests — cas couverts**

| Cas | Couvert |
|-----|---------|
| `watchState` + `SERIES` → 400 | ✅ (unit + route) |
| `watchState` sans `mediaType` → 400 | ✅ (unit + route) |
| `watchState` + `MOVIE` → accepté | ✅ (unit + route) |
| `availableToMe: false` movies (GET) | ✅ |
| `availableToMe: undefined` movies (GET) | ✅ |
| `availableToMe: false` series (GET) | ✅ |
| `availableToMe: undefined` series (GET) | ✅ |

## Problèmes détectés

### 🔴 Critère d'acceptation non satisfait — tests manquants pour `availableToMe: true` (évaluation GET)

Le critère du ticket est explicite :

> Automated tests cover **true/false/undefined** availability filters for Movies and Series

Les tests d'évaluation (bloc `GET /shelves/:id dynamic availability evaluation`) couvrent `false` et `undefined` pour Movies et Series, mais **aucun test ne couvre le chemin `availableToMe: true`** en évaluation GET — ni pour les Movies, ni pour les Series.

Le chemin `inArray` (branche `true`) est le code qui existait avant la PR ; son comportement n'a pas changé, mais le critère exige sa couverture explicite et elle manque.

Le correctif est minimal : deux tests `it('availableToMe: true for movies ...')` et `it('availableToMe: true for series ...')` dans le bloc existant, suivant exactement le même pattern que les tests `false` (remplacer `setupSelectFromWhere({})` pour la sous-requête `inArray`, et ajuster les données retournées pour ne contenir que les Media disponibles).

## Risques éventuels

Aucun risque fonctionnel identifié. L'implémentation est correcte ; le seul gap est la couverture de test.

## Décision

- REQUEST_CHANGES

## Actions demandées

Ajouter dans le bloc `describe('GET /shelves/:id dynamic availability evaluation')` deux cas d'évaluation manquants :

```typescript
it('availableToMe: true for movies — returns only movies with an AVAILABLE record', async () => {
  setupSelectWhere([makeDynamicShelf({ mediaType: 'MOVIE', availableToMe: true })])
  setupSelectFromWhere({}) // inArray subquery
  setupSelectWhereOrderLimit([movieAvailable])

  const res = await app.inject({ method: 'GET', url: `/shelves/${DYNAMIC_SHELF_ID}` })

  expect(res.statusCode).toBe(200)
  const body = res.json() as { items: Array<{ mediaId: string }> }
  expect(body.items).toHaveLength(1)
  expect(body.items[0].mediaId).toBe('movie-live')
})

it('availableToMe: true for series — returns only series with an AVAILABLE record', async () => {
  setupSelectWhere([makeDynamicShelf({ mediaType: 'SERIES', availableToMe: true })])
  setupSelectFromWhere({}) // inArray subquery
  setupSelectWhereOrderLimit([seriesAvailable])

  const res = await app.inject({ method: 'GET', url: `/shelves/${DYNAMIC_SHELF_ID}` })

  expect(res.statusCode).toBe(200)
  const body = res.json() as { items: Array<{ mediaId: string }> }
  expect(body.items).toHaveLength(1)
  expect(body.items[0].mediaId).toBe('series-live')
})
```

Aucune modification de `shelf-service.ts` n'est requise.

IMPLEMENTATION_FIX_REQUIRED

---

## Instructions de fix

# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T026/reviews/implementation-review.md
- generated at: 2026-08-12T07:16:35Z

---

Now I have a complete picture of the implementation. Let me write the review.

---

# PR Review — T026: Fix dynamic Shelf availability filtering and unsupported rule semantics

## Résumé

L'implémentation porte sur deux fichiers : `shelf-service.ts` (+28 lignes) et `shelves.test.ts` (+132 lignes). Le scope est parfaitement borné au ticket. La logique principale est correcte.

## Vérifications effectuées

- Lecture complète du diff T026 (`git show b0bb607`)
- Lecture du `shelf-service.ts` final (541 lignes)
- Lecture du `shelves.test.ts` final (587 lignes)
- Comparaison avec les critères d'acceptation du ticket

## Points validés

**`validateDynamicRules()` — rejet `watchState` non-MOVIE** (lignes 148–156)

La garde `if (result.mediaType !== 'MOVIE')` est placée après la validation de la valeur, avant l'assignation. Le cas `mediaType` omis (`undefined !== 'MOVIE'`) est correctement rejeté. Les deux cas du plan sont couverts : `SERIES` explicite et `mediaType` absent.

**`evaluateMovies()` — tri-state** (lignes 175–191)

Remplacement du guard truthy `rules.availableToMe ? inArray(...) : undefined` par une chaîne ternaire à trois branches (`=== true` / `=== false` / `undefined`). Sémantique correcte :
- `true` → `inArray` sur AVAILABLE
- `false` → `notInArray` sur AVAILABLE (inclut les Media sans aucune ligne de disponibilité)
- `undefined` → pas de filtre

**`evaluateSeries()` — tri-state symétrique** (lignes 263–279)

Pattern identique à `evaluateMovies()`, sur `seriesAvailabilities.seriesId`. Commentaire `// watchState is not supported for series — gracefully ignored` supprimé (il ne l'est plus silencieusement, il est rejeté au validateur).

**Scope**

Aucune modification hors périmètre. Le type `ShelfRuleDefinition` dans `api-contracts` n'est pas touché (conforme au plan : la contrainte reste server-side). Pas de régression sur les autres chemins.

**Tests — cas couverts**

| Cas | Couvert |
|-----|---------|
| `watchState` + `SERIES` → 400 | ✅ (unit + route) |
| `watchState` sans `mediaType` → 400 | ✅ (unit + route) |
| `watchState` + `MOVIE` → accepté | ✅ (unit + route) |
| `availableToMe: false` movies (GET) | ✅ |
| `availableToMe: undefined` movies (GET) | ✅ |
| `availableToMe: false` series (GET) | ✅ |
| `availableToMe: undefined` series (GET) | ✅ |

## Problèmes détectés

### 🔴 Critère d'acceptation non satisfait — tests manquants pour `availableToMe: true` (évaluation GET)

Le critère du ticket est explicite :

> Automated tests cover **true/false/undefined** availability filters for Movies and Series

Les tests d'évaluation (bloc `GET /shelves/:id dynamic availability evaluation`) couvrent `false` et `undefined` pour Movies et Series, mais **aucun test ne couvre le chemin `availableToMe: true`** en évaluation GET — ni pour les Movies, ni pour les Series.

Le chemin `inArray` (branche `true`) est le code qui existait avant la PR ; son comportement n'a pas changé, mais le critère exige sa couverture explicite et elle manque.

Le correctif est minimal : deux tests `it('availableToMe: true for movies ...')` et `it('availableToMe: true for series ...')` dans le bloc existant, suivant exactement le même pattern que les tests `false` (remplacer `setupSelectFromWhere({})` pour la sous-requête `inArray`, et ajuster les données retournées pour ne contenir que les Media disponibles).

## Risques éventuels

Aucun risque fonctionnel identifié. L'implémentation est correcte ; le seul gap est la couverture de test.

## Décision

- REQUEST_CHANGES

## Actions demandées

Ajouter dans le bloc `describe('GET /shelves/:id dynamic availability evaluation')` deux cas d'évaluation manquants :

```typescript
it('availableToMe: true for movies — returns only movies with an AVAILABLE record', async () => {
  setupSelectWhere([makeDynamicShelf({ mediaType: 'MOVIE', availableToMe: true })])
  setupSelectFromWhere({}) // inArray subquery
  setupSelectWhereOrderLimit([movieAvailable])

  const res = await app.inject({ method: 'GET', url: `/shelves/${DYNAMIC_SHELF_ID}` })

  expect(res.statusCode).toBe(200)
  const body = res.json() as { items: Array<{ mediaId: string }> }
  expect(body.items).toHaveLength(1)
  expect(body.items[0].mediaId).toBe('movie-live')
})

it('availableToMe: true for series — returns only series with an AVAILABLE record', async () => {
  setupSelectWhere([makeDynamicShelf({ mediaType: 'SERIES', availableToMe: true })])
  setupSelectFromWhere({}) // inArray subquery
  setupSelectWhereOrderLimit([seriesAvailable])

  const res = await app.inject({ method: 'GET', url: `/shelves/${DYNAMIC_SHELF_ID}` })

  expect(res.statusCode).toBe(200)
  const body = res.json() as { items: Array<{ mediaId: string }> }
  expect(body.items).toHaveLength(1)
  expect(body.items[0].mediaId).toBe('series-live')
})
```

Aucune modification de `shelf-service.ts` n'est requise.

IMPLEMENTATION_FIX_REQUIRED