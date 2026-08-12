# PR Review — T041: Deterministic Personalized Recommendation Ranking

## Résumé

Implémentation d'un service de ranking de recommandations déterministe pour les profils IPTVFlix. Le service score les candidats locaux (films, séries) et les candidats de découverte via le modèle de goût existant, expose un endpoint REST Fastify, et fournit un fallback cold-start basé sur la popularité. 6 fichiers modifiés/créés, 12 tests unitaires.

## Vérifications effectuées

- Lecture complète du ticket, du plan et de tous les fichiers créés/modifiés
- Vérification des schemas DB réels : `profile_taste`, `discovery_candidates`, `viewing_progress`, `movie_availabilities`, `series_availabilities`
- Confrontation des types de données entre `profile-taste-service.ts` (écriture) et `recommendation-ranking-service.ts` (lecture) pour `genreScores` et `genreMeta`
- Vérification de la logique de déduplication locale/discovery pour les cas limites (mediaType filtre + canonicalId)
- Vérification de l'enum `progressMediaTypeEnum` (`['MOVIE', 'EPISODE']`) vs le filtre appliqué dans le service
- Revue de couverture de tests : 9 scénarios du plan vs 12 tests (certains scénarios ont 2 cas)
- Contrôle sécurité : injection SQL, exposition de données sensibles

## Points validés

**Critères d'acceptation — tous satisfaits :**

- ✅ Candidats ordonnés par score DESC, mediaId ASC (déterminisme garanti)
- ✅ `availableToMe=true` filtre correctement via `movie_availabilities` / `series_availabilities` avec `status = 'AVAILABLE'`
- ✅ `negativeMediaIds` exclut les candidats avant scoring (hard exclusion)
- ✅ Films complétés (≥ 90 % de progression) pénalisés de -10.0, absents sauf si `includeSeen=true`
- ✅ Cold-start : `signalCount === 0` → tri par `popularity × voteAverage`, `coldStart: true`, `reasons: ["popular pick"]`
- ✅ Chaque candidat retourné a un `reasons[]` non vide
- ✅ Candidats non disponibles inclus par défaut (filtre optionnel uniquement)

**Cohérence schemas DB confirmée :**

- `genreScores` stocké comme `Record<string, number>` par `profile-taste-service.ts` (ligne 147) → lecture correcte dans le service de ranking comme `Record<string, number>`
- `genreMeta` stocké comme `Record<string, { slug: string; name: string }>` (ligne 148) → lecture correcte
- `viewingProgress.mediaType` est un enum `['MOVIE', 'EPISODE']` — le filtre `eq(viewingProgress.mediaType, 'MOVIE')` est valide et correct (les séries n'ont pas de progression par épisode agrégée, conformément au plan)
- Tous les champs `discoveryCandidate` utilisés (`popularity`, `voteAverage`, `canonicalMovieId`, `canonicalSeriesId`, `expiresAt`) existent dans le schema réel

**Sécurité :**

- Aucun secret hardcodé
- Requêtes Drizzle ORM paramétrées — pas d'injection SQL possible
- Le champ `score` exposé dans la réponse est un float calculé, non une donnée sensible

**Scope :**

- Aucun refactor transversal, modifications limitées aux fichiers du plan
- Pas de filtrage collaboratif, pas d'appels LLM, pas de shelf — exclusions respectées

## Problèmes détectés

Aucun bug bloquant identifié.

### Observations mineures (non bloquantes)

**1. Coercition implicite des booléens query string**

`availableToMe` et `includeSeen` sont truthy uniquement si la valeur est exactement la chaîne `'true'`. Les valeurs `'1'`, `'yes'`, `'TRUE'` sont silencieusement traitées comme `false`. Ce comportement n'est pas documenté dans le handler. Acceptable mais peut surprendre les consommateurs de l'API.

**2. seenPenalty non appliquée en cold-start**

En cold-start, un film complété obtient son score plein (`popularity × voteAverage`) sans pénalité. Conforme au plan (la pénalité est dans le branch `else`), mais non documenté explicitement dans le code. À signaler pour éviter une confusion future.

**3. Full table scans non bornés**

Le service récupère la totalité des `movies`, `series`, `movieGenres`, `seriesGenres`, `movieAvailabilities`, `seriesAvailabilities` sans limit DB. Problématique à grande échelle. Hors scope T041 (pagination explicitement exclue), mais dette technique à noter.

**4. Validation UUID absente sur `profileId`**

Un `profileId` invalide (non-UUID) peut produire une erreur DB plutôt qu'un 400. Le handler attrape `NotFoundError` et retourne 404 — mais un format invalide pourrait lever une erreur DB non capturée selon le driver. Risque faible en pratique.

**5. Fragilité du mock dans les tests**

Les tests dépendent de l'ordre exact des 10 requêtes dans le `Promise.all`. Si cet ordre change dans le service, tous les tests se cassent sans indication claire. Pattern courant avec Vitest/mocks, acceptable dans ce contexte.

## Risques éventuels

- **Passage à l'échelle** : à partir de quelques milliers de films/séries, la récupération non bornée de toutes les lignes de genre et disponibilité devient un goulot. Non bloquant pour T041 mais à adresser dans un ticket de suivi.
- **Compatibilité future du schema genreScores** : si T080 évolue vers un format objet `{ score, confidence }` dans le JSONB, le cast `as Record<string, number>` masquera le changement silencieusement. Le code devrait idéalement valider ou utiliser un type Zod.

## Décision

APPROVED — Toutes les exigences du ticket sont satisfaites. Les schemas DB sont vérifiés et cohérents. Les 12 tests couvrent l'ensemble des 9 scénarios prévus par le plan. Aucun bug bloquant, aucune dérive de scope.

## Actions demandées

Aucune correction bloquante. Les observations ci-dessus sont des recommandations pour des tickets de suivi :
- Pagination/streaming des candidats (scalabilité)
- Validation Zod du type JSONB `genreScores` lors de la lecture
