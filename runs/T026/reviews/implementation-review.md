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
