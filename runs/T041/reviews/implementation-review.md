# PR Review — T041: Deterministic Personalized Recommendation Ranking

## Résumé

Implémentation d'un service de ranking de recommandations déterministe. 6 fichiers créés/modifiés, 12 tests unitaires couvrant les 9 scénarios du plan.

## Vérifications effectuées

- Lecture complète du ticket, plan, et tous les fichiers implémentés
- Vérification croisée des schemas DB réels (`profile_taste`, `discovery_candidates`, `viewing_progress`, `movie_availabilities`, `series_availabilities`)
- Confrontation des types entre `profile-taste-service.ts` (écriture) et `recommendation-ranking-service.ts` (lecture) pour `genreScores` et `genreMeta`
- Logique de déduplication locale/discovery pour les cas limites
- Couverture de tests vs scénarios du plan

## Points validés

**Critères d'acceptation — tous satisfaits :**
- Candidats ordonnés `score DESC, mediaId ASC` (déterminisme garanti)
- `availableToMe=true` filtre via les tables d'availability avec `status='AVAILABLE'`
- `negativeMediaIds` → exclusion hard avant scoring
- Films complétés ≥ 90% pénalisés de -10.0, absents sauf `includeSeen=true`
- Cold-start : tri par `popularity × voteAverage`, `coldStart: true`, `reasons: ["popular pick"]`
- Chaque candidat a un `reasons[]` non vide

**Cohérence schemas DB confirmée :**
- `genreScores` est bien stocké comme `Record<string, number>` par `profile-taste-service` → lecture correcte dans le ranking service
- `genreMeta` est bien `Record<string, { slug, name }>` → cohérent
- `viewingProgress.mediaType` enum `['MOVIE', 'EPISODE']` — filtre `'MOVIE'` valide
- Tous les champs `discoveryCandidate` utilisés existent dans le schema réel

**Sécurité :** Requêtes Drizzle paramétrées, aucun secret, pas de données sensibles loguées.

**Scope :** Aucun refactor transversal. Exclusions du ticket respectées (pas de filtrage collaboratif, pas de LLM).

## Problèmes détectés

Aucun bug bloquant.

**Observations mineures :**
1. Coercition booléenne implicite : `availableToMe=1` ou `availableToMe=yes` traitées comme `false` sans erreur ni documentation
2. `seenPenalty` non appliquée en cold-start (conforme au plan, mais non documenté dans le code)
3. Full table scans non bornés — dette technique à adresser dans un ticket de suivi dédié à la pagination
4. Pas de validation UUID sur `profileId` — risque faible mais réel selon le comportement du driver DB

## Risques éventuels

- Scalabilité : récupération de toutes les lignes movies/series/genres sans limit DB — non bloquant pour T041 (pagination explicitement hors scope)
- Si T080 fait évoluer le format JSONB de `genreScores`, le cast `as Record<string, number>` masquera le changement silencieusement

## Décision

**APPROVED** — Toutes les exigences du ticket sont satisfaites. Les schemas DB sont vérifiés et cohérents avec l'implémentation. Les 12 tests couvrent les 9 scénarios du plan. Aucun bug bloquant ni dérive de scope.

---

IMPLEMENTATION_APPROVED
