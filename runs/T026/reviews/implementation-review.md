All the information I need is now in scope. Let me write the review.

---

# PR Review — T026: Fix dynamic Shelf availability filtering and unsupported rule semantics (attempt 2)

## Résumé

Cette review couvre la correction appliquée suite au premier `IMPLEMENTATION_FIX_REQUIRED`. La seule action demandée était l'ajout de deux tests d'évaluation GET pour `availableToMe: true` (movies et series). Le commit `a060fdd` livre exactement cela — un seul fichier de production modifié : `shelves.test.ts`.

## Vérifications effectuées

- Lecture du commit de fix (`a060fdd`) — seul `shelves.test.ts` est modifié (+ artefacts runs/)
- Lecture complète du `shelves.test.ts` final (613 lignes)
- Relecture de `shelf-service.ts` (évaluation tri-state, validation `watchState`)
- Vérification de la couverture complète des critères d'acceptation

## Points validés

### Correction demandée — deux tests `availableToMe: true` ajoutés

Les deux tests sont présents aux lignes 588–612 :

| Test | Lignes | Mock chain | Assertion |
|------|--------|-----------|-----------|
| `availableToMe: true for movies` | 588–599 | `setupSelectFromWhere({})` (inArray subquery) + `setupSelectWhereOrderLimit([movieAvailable])` | `items[0].mediaId === 'movie-live'` |
| `availableToMe: true for series` | 601–612 | `setupSelectFromWhere({})` (inArray subquery) + `setupSelectWhereOrderLimit([seriesAvailable])` | `items[0].mediaId === 'series-live'` |

Les deux tests suivent exactement le pattern des tests `false` existants. La chaîne de mocks est cohérente avec ce que le service émet : d'abord la sous-requête `inArray` (non-Promise), puis la requête principale avec `orderBy().limit()`.

### Couverture complète des critères d'acceptation

| Critère ticket | Couvert |
|----------------|---------|
| `availableToMe=true` → seulement AVAILABLE (movies) | ✅ ligne 588 |
| `availableToMe=true` → seulement AVAILABLE (series) | ✅ ligne 601 |
| `availableToMe=false` → aucun AVAILABLE (movies) | ✅ ligne 540 |
| `availableToMe=false` → aucun AVAILABLE (series) | ✅ ligne 564 |
| `availableToMe` omis → pas de filtre (movies) | ✅ ligne 553 |
| `availableToMe` omis → pas de filtre (series) | ✅ ligne 577 |
| `watchState` + SERIES → 400 | ✅ lignes 208–213, 329–337 |
| `watchState` sans `mediaType` → 400 | ✅ lignes 214–219, 339–347 |
| `watchState` + MOVIE → 201 | ✅ lignes 220–224, 349–364 |

### Implémentation `shelf-service.ts` — confirmée correcte

- **`validateDynamicRules()`** (lignes 148–156) : garde `result.mediaType !== 'MOVIE'` correctement placée après la validation de valeur. Couvre `SERIES` explicite et `mediaType` absent.
- **`evaluateMovies()`** (lignes 175–191) : tri-state `=== true` / `=== false` / `undefined` strict. `notInArray` inclut bien les Media sans aucune ligne de disponibilité.
- **`evaluateSeries()`** (lignes 263–279) : pattern symétrique identique.

### Scope

Périmètre identique au premier commit : uniquement `shelf-service.ts` + `shelves.test.ts`. Pas de dérive. Pas de modification de `api-contracts`. Pas de changements front-end.

## Problèmes détectés

Aucun. La correction est exactement ce qui était demandé, ni plus ni moins.

## Décision

L'unique blocage de la review précédente est résolu. L'ensemble des critères d'acceptation est couvert par les tests. L'implémentation est correcte, bornée et cohérente.

IMPLEMENTATION_APPROVED
