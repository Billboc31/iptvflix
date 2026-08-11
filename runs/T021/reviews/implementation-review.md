# PR Review — T021: Reusable Manual and Dynamic Shelves

## Résumé

L'implémentation est complète et couvre l'ensemble du périmètre du ticket. Tous les critères d'acceptation sont satisfaits.

## Points validés

**Sécurité**
- `validateDynamicRules` utilise une whitelist exhaustive — toute clé inconnue (ex. `sql`, `__proto__`) lève immédiatement une `ValidationError` → HTTP 400. Injection SQL structurellement impossible.
- `shelf_members.media_id` est de type `uuid` — les IDs Xtream/Plex (strings non-UUID) sont rejetés par la base.
- L'isolation de profil est appliquée sur toutes les mutations. Les étagères SYSTEM sont protégées par 403 systématique.

**Modèle**
- Migration `0008_shelves.sql` correcte. Unique constraint `(shelf_id, media_type, media_id)`, FK cascade cohérentes.
- `listContinueWatching` et `listWatchlist` délègent aux services existants — aucun comportement préexistant modifié.
- Contrat extensible : `ShelfType` est une union string, `ShelfItem` n'expose aucun champ provider-spécifique.

**Tests**
- 24 tests backend (validation, CRUD, isolation profil, ordering).
- 5 tests frontend ShelfRow (title, items, empty state, progress bar, absence de progress bar).
- MSW handlers couvrant tous les nouveaux endpoints.

## Problèmes détectés (non bloquants)

| # | Sévérité | Description |
|---|---|---|
| 1 | Mineur | `system_key` dans le schéma DB n'est jamais écrit ni lu — colonne morte |
| 2 | Mineur | `sys_my_list` toujours inclus dans `listShelves` même si watchlist vide (génère une requête réseau inutile ; `ShelfRow` retourne `null` donc rien n'est rendu) |
| 3 | Mineur | `watchState` ignoré pour les séries en requête mixte — documenté par un commentaire dans le code, conforme aux exclusions du plan |
| 4 | Observation | Erreurs réseau de `useShelf`/`useShelves` non surfacées dans l'UI — disparition silencieuse |
| 5 | Observation | `reorderMembers` accepte une liste partielle sans erreur — comportement permissif mais non destructif |

## Décision

Aucun problème bloquant. La sécurité est correcte, le contrat est respecté, les tests couvrent les chemins critiques.

IMPLEMENTATION_APPROVED
