I now have a complete picture of the full implementation including the applied fixes. Let me write the final review.

---

# PR Review — T019: Universal External Catalog Discovery (Attempt 2, post-fix)

## Résumé

Cette review porte sur l'implémentation après correction des deux points bloquants identifiés lors de la review précédente (`IMPLEMENTATION_FIX_REQUIRED`). Les deux fixes ont été correctement appliqués. L'implémentation complète est vérifiée contre tous les critères d'acceptance du ticket.

## Vérifications effectuées

- `SearchPage.tsx` — `externalError` state, handlers corrigés, rendu inline `role="alert"`
- `SearchPage.test.tsx` — 3 nouveaux tests (badge "À venir", badge "Non disponible", erreur materialize)
- `packages/api-contracts/src/catalog.ts` — types `ExternalMovieCandidate`, `ExternalSeriesCandidate`, `SearchResponse` étendu
- `ExternalDiscoveryService` — cache TTL 60s, déduplication, isolation erreur provider, idempotence materialize
- `apps/api/src/routes/search.ts` — threshold `<= 5`, appels parallèles, fallback propre
- `apps/api/src/routes/discovery.ts` — POST /discovery/movies et /discovery/series, validation tmdbId, graceful 503 sans clé
- `apps/api/src/index.ts` — branchement conditionnel `TMDB_API_KEY`, enregistrement `discoveryRoutes`
- `apps/api/src/providers/metadata/tmdb/client.ts` — mapping `status`, `release_date`, `first_air_date` ; `deriveReleaseStatus` sur résultats search
- `apps/web/src/components/content/PosterCard.tsx` — prop `badge` avec variantes
- `apps/web/src/components/ui/Badge.tsx` — variantes `unavailable` (gris) et `upcoming` (ambre) présentes
- `apps/web/src/lib/api.ts` — `materializeMovie`, `materializeSeries` ajoutés
- Tests unitaires `ExternalDiscoveryService` — 16 cas
- Tests d'intégration — 6 tests discovery dans `vertical-slice.test.ts`

## Points validés

**Fix 1 — Échec silencieux au clic externe : CORRIGÉ**
- `externalError` state ajouté (`SearchPage.tsx:30`)
- Les deux handlers (`handleExternalMovieClick`, `handleExternalSeriesClick`) appellent `setExternalError(null)` en entrée et `setExternalError("Impossible d'ouvrir ce titre. Veuillez réessayer.")` dans le catch
- `externalError` est affiché via `<p role="alert">` dans la section externe (`SearchPage.tsx:189-191`)
- `externalError` est nettoyé sur nouvelle recherche (`SearchPage.tsx:40`)

**Fix 2 — Tests web section externe : CORRIGÉS**
- Test "upcoming badge": mock retournant `releaseStatus: 'In Production'` → vérifie le heading "Aussi trouvé en dehors de votre catalogue" et le badge "À venir" (`SearchPage.test.tsx:86-117`)
- Test "Non disponible badge": mock `releaseStatus: 'Released'` → vérifie le badge "Non disponible" et le heading, couvre directement l'AC *"UI clearly distinguishes not available to me from not found"* (`SearchPage.test.tsx:119-150`)
- Test "materialize failure": mock `POST /api/discovery/movies` → 503, click sur la carte → vérifie `role="alert"` et le message d'erreur attendu (`SearchPage.test.tsx:152-191`)

**Critères d'acceptance — tous couverts**

| AC | Status | Evidence |
|---|---|---|
| Recherche externe retourne un résultat hors catalogue local | ✅ | `search.ts` threshold + integration test |
| Ouverture crée un enregistrement canonique avec zéro disponibilités | ✅ | `materializeMovie` + integration test zero availabilities |
| Titre upcoming a une page de détail utile | ✅ | Métadonnées de base (titre, synopsis, poster, année) présentes ; unit test upcoming |
| Pas de doublon local/externe pour même tmdbId | ✅ | `getMovieTmdbIds` + integration test déduplication |
| Échec provider n'affecte pas la recherche locale | ✅ | try/catch retournant `[]` + integration test TMDB 500 |
| UI distingue "non disponible" vs "non trouvé" | ✅ | Badges "Non disponible"/"À venir" + EmptyState + web tests |
| Appels provider bornés/cachés | ✅ | Cap 5, TTL 60s, threshold local ≤ 5 + unit test cache |
| Tests couvrent tous les scénarios AC | ✅ | 16 unit tests + 6 integration tests + 3 nouveaux web tests |

**Architecture et scope**
- Aucun import en masse dans la DB (scope respecté)
- No-op propre quand `TMDB_API_KEY` absent (503 sur discovery, `[]` sur search)
- Code simple et lisible — aucune abstraction superflue introduite
- Contrat API backward-compatible (les nouveaux champs `externalMovies`/`externalSeries` ont des valeurs par défaut défensives côté web)

## Problèmes détectés

Aucun problème bloquant. Les deux points requireing correction de la review précédente sont correctement résolus.

## Observations conservées (non bloquantes, connues)

- **TOCTOU `materializeMovie`/`materializeSeries`** : SELECT → INSERT sans transaction, protégé par UNIQUE constraint mais retournerait HTTP 500 au lieu d'idempotence en cas de race concurrent. Risque négligeable en usage interactif.
- **`releaseStatus` absent de `MovieDetailResponse`** : le badge "À venir" disparaît après navigation vers la page de détail. L'AC "useful detail page" est rempli (titre, synopsis, poster, année présents). Acceptable dans le scope actuel.
- **Cache sans éviction active** : le `Map` grossit indéfiniment (TTL lazy-only). Acceptable pour le volume d'usage attendu.
- **Clé TMDB Bearer v4 vs v3** : si l'opérateur configure une clé v3, les appels échoueront silencieusement (`externalMovies: []`). Dégradation gracieuse, non bloquant.

## Risques éventuels

Aucun risque additionnel identifié au-delà des observations ci-dessus, toutes déjà documentées lors de la review précédente.

## Décision

Les deux corrections requises sont proprement implémentées. Tous les critères d'acceptance du ticket T019 sont couverts — fonctionnellement, architecturalement et par les tests. Le scope est respecté, le code est lisible, la sécurité est maintenue.

IMPLEMENTATION_APPROVED
