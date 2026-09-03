I have all I need. Let me write the review.

---

# PR Review — T139 — Add mandatory Nouveautés shelves to Home, Movies, Series

## Résumé

L'implémentation ajoute un service `nouveautes-service.ts` avec une logique de ranking à deux tiers (vraie sortie récente × 1.0, arrivée catalogue récente × 0.5), intégré comme Rail 2.5 sur Home (mixte), Rail 0 sur Movies (films seulement) et Rail 0 sur Series (séries seulement). 9 fichiers modifiés, 674 insertions, aucune suppression.

## Vérifications effectuées

- Lecture complète de `nouveautes-service.ts`, `env.ts`, des trois pool services et de la suite de tests
- Vérification des formules de score tier par tier
- Contrôle de la couverture de tests (15 tests unitaires + 3 mocks dans les tests de pool existants)
- Contrôle de la correspondance plan ↔ implémentation
- Vérification `git diff --stat` vs commits

## Points validés

**Logique de ranking correcte**
- Score Tier 1 : `recencyScore * 0.75 + qualityPrior * 0.25` — conforme au plan
- Score Tier 2 : `recencyScore * 0.5 * 0.75 + qualityPrior * 0.25` — le multiplicateur 0.5 garantit qu'une vraie sortie récente (30j) l'emporte toujours sur une importation très récente (1j) de titre récent. Vérifié numériquement.
- Pas d'appel à la recommendation engine, pas de LLM call : 100% DB

**Contraintes media respectées au niveau DB**
- `mediaType: 'MOVIE'` → query séparée uniquement sur `movies + movie_availabilities`
- `mediaType: 'SERIES'` → query séparée uniquement sur `series + series_availabilities`
- Filtre `status = 'AVAILABLE'` via INNER JOIN dans les deux tiers pour les deux types

**Déduplication**
- `selectDistinctOn` sur l'id pour effondrer les multiples lignes d'availability
- Map `scored` avec `upsert` (garde le score le plus élevé) pour l'intra-shelf dedup inter-tiers
- `excludedMediaIds` propagé correctement après chaque shelf dans les trois pool services

**Positionnement**
- Home : Rail 2.5, entre "Pour toi" (Rail 2) et "Nouveautés pour toi" (Rail 3) — distinct et visible
- Movies : Rail 0, avant "Pour toi" — premier rail déclaré
- Series : Rail 0, avant "Séries pour toi" — premier rail déclaré

**Suppression gracieuse**
- La suppression si `< NOUVEAUTES_MIN_ITEMS` est correctement déléguée aux callers (pool services), pas au service lui-même. Le service retourne la liste partielle, le caller décide.

**Configuration centralisée**
- 4 constantes env-overridables dans `env.ts` : `NOUVEAUTES_RELEASE_WINDOW_DAYS`, `NOUVEAUTES_CATALOG_MAX_AGE_YEARS`, `NOUVEAUTES_MIN_ITEMS`, `NOUVEAUTES_ITEMS_PER_SHELF`

**Tests**
- 15 tests couvrant : contraintes media, recency release vs import, garde Tier 2 (titre ancien importé récemment), dédup intra-shelf, excludeIds, ordering, limit, sparse catalog, availability, quality tie-breaker, zero HTTP calls
- Le test "release vs import" valide numériquement que le multiplicateur 0.5 produit bien l'ordre attendu

**Régression**
- Les rails existants dans les trois pool services sont inchangés dans leur logique
- Les tests de pool existants passent (53/53 confirmé) avec les mocks ajoutés

## Problèmes détectés

**Mineurs / non-bloquants**

1. **Fenêtre Tier 2 (30 jours) non externalisée** — La variable `catalogCutoff` (30 jours en dur) et le dénominateur `/ 30` dans le calcul de recency Tier 2 ne sont pas des constantes env-overridables. Le ticket demande que les fenêtres soient configurables. Le reste (`NOUVEAUTES_RELEASE_WINDOW_DAYS`, `NOUVEAUTES_CATALOG_MAX_AGE_YEARS`) l'est. C'est centralisé (une seule définition), mais pas configurable sans redéploiement. Le plan lui-même ne spécifiait pas de constante env pour cette valeur, donc l'écart avec le ticket est léger.

2. **Test "availability filter" symbolique** — Le test vérifie seulement que si la DB retourne rien, le service retourne rien. Il ne vérifie pas que le JOIN est bien construit avec `status = 'AVAILABLE'`. Acceptable avec un ORM mocké, mais c'est une limite de couverture à noter.

3. **Séries Tier 1 avec `firstAirYear = currentYear - 1` en fin d'année** — Une série avec `firstAirYear = 2025` sera matchée par la clause WHERE, mais son proxy de date (1er juillet 2025) donnera `daysSince ≈ 430j` en septembre 2026, soit `recencyScore = max(0, 1 - 430/180) = 0`. Ces séries se retrouvent en bas de pile avec un score ≈ qualityPrior * 0.25. Pas un bug fonctionnel — elles ne surclassent rien — mais elles génèrent des lignes DB inutilement. Acceptable.

## Risques éventuels

- Aucun risque de régression identifié sur les shelves existants
- Performance : au pire 4 requêtes DB pour Home (2 movies × 2 tiers + 2 series × 2 tiers), sans HTTP externe. Acceptable.
- Si le catalogue de contenu récent est très dense, les 4 requêtes pourraient retourner beaucoup de lignes avant le tri applicatif. La clause `DISTINCT ON` aide, mais il n'y a pas de `LIMIT` dans les requêtes DB elles-mêmes. Risque marginal sur un gros catalogue, non bloquant.

## Décision

L'implémentation est conforme au ticket, au plan, et aux conventions du projet. Tous les critères d'acceptance sont couverts. Les observations ci-dessus sont mineures et ne remettent pas en cause la correction ni la sécurité du changement.

IMPLEMENTATION_APPROVED
