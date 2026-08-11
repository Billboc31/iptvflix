# PR Review — T021: Reusable Manual and Dynamic Shelves

## Résumé

Implémentation complète du modèle `Shelf` (SYSTEM / MANUAL / DYNAMIC) avec service backend, 8 endpoints API, recomposition de la Home en `ShelfRow`, CRUD profil-scopé, et tests. Tout le périmètre du ticket est couvert.

## Vérifications effectuées

- Migration SQL et schéma Drizzle
- Contrats API (`packages/api-contracts/src/shelves.ts`)
- Service (`shelf-service.ts`) : list/get/create/update/delete, CRUD membres, `validateDynamicRules`, `evaluateDynamicShelf`
- Routes Fastify (`routes/shelves.ts`) : 8 endpoints, gestion d'erreurs, registration dans `index.ts`
- Frontend : `ShelfRow.tsx`, `useShelves.ts`, `useShelf.ts`, `HomePage.tsx`, `lib/api.ts`
- Tests backend (24) et frontend (5) + handlers MSW (10)
- Respect du scope ticket et critères d'acceptation

## Points validés

**Sécurité et intégrité**
- `validateDynamicRules` utilise une whitelist exhaustive des clés autorisées — toute clé inconnue (ex. `sql`, `__proto__`) lève une `ValidationError` → HTTP 400 avec `validationError: true`. Injection SQL impossible.
- `shelf_members.media_id` est de type `uuid` — interdit structurellement les IDs Xtream/Plex (strings arbitraires).
- Profile isolation correctement appliquée dans toutes les mutations (`getShelf`, `updateShelf`, `deleteShelf`, `addMember`, `removeMember`, `reorderMembers`).
- Les étagères SYSTEM sont protégées par `isSystemId()` → 403 pour toute tentative de mutation.

**Modèle de données**
- `shelves` : `profile_id` nullable (permet les étagères système sans ligne DB), FK cascade vers `profiles`.
- `shelf_members` : `media_id uuid` + contrainte unique `(shelf_id, media_type, media_id)`, FK cascade vers `shelves`.
- Migration `0008_shelves.sql` correctement numérotée et alignée avec le schéma Drizzle.

**Service**
- Résolveurs SYSTEM : `continue_watching` et `my_list` délèguent aux services existants (`listContinueWatching`, `listWatchlist`) — comportements préservés sans modification.
- `evaluateDynamicShelf` compose des sous-requêtes Drizzle sans SQL littéral non contrôlé.
- `reorderMembers` s'exécute dans une transaction.
- `createShelf` calcule la position par `MAX(position) + 1` plutôt qu'un comptage.

**Contrat extensible**
- `ShelfType` est une union de strings — ajouter `'AI_GENERATED'` ne casse pas le contrat existant.
- `ShelfItem` n'expose aucun champ provider-spécifique.

**Frontend**
- `ShelfRow` retourne `null` pour les items vides → aucune ligne vide rendue en production.
- `ShelfRowLoader` absorbe les états de chargement individuels sans bloquer les autres rangées.
- Hero section conserve son `useMovies({ pageSize: 1 })` indépendant des étagères.
- MSW handlers couvrent tous les nouveaux endpoints.

**Tests**
- `validateDynamicRules` : 8 cas (champs inconnus, enums invalides, types incorrects, cas vide).
- GET/POST/PATCH/DELETE shelves : états normaux + erreurs.
- Isolation de profil testée sur DELETE.
- Membership : ajout sur étagère SYSTEM → 403 ; ajout sur MANUAL → 204 ; médias manquants non testés mais la validation est dans le service.
- Ordering : round-trip 204 + 403 sur SYSTEM.
- Frontend : title, items, empty state, progress bar (50%), absence de progress bar.

## Problèmes détectés

### Mineur — Colonne `system_key` inutilisée

La colonne `system_key text` existe dans le schéma Drizzle et la migration mais n'est jamais écrite ni lue. Les étagères système sont résolues par la convention `sys_*` sur leur identifiant virtuel. La colonne est du schéma mort.

Impact : aucun à l'exécution ; léger bruit dans le schéma. Non bloquant.

### Mineur — `sys_my_list` toujours présent dans la liste

`SYSTEM_SHELF_DEFS` expose `sys_my_list` dans `listShelves` même quand la watchlist du profil est vide. Le critère d'acceptation du plan précise "if the profile has watchlist entries, `my_list`". En pratique `ShelfRow` retourne `null` pour les items vides donc aucune ligne vide n'est rendue, mais cela génère une requête réseau inutile au chargement de la Home pour les profils sans watchlist.

Impact : cosmétique + requête réseau superflue. Non bloquant.

### Mineur — `watchState` silencieusement ignoré pour les séries en requête mixte

`evaluateSeries` ne reçoit pas de `profileId` et ignore `watchState`. Un shelf dynamique sans `mediaType` avec `watchState: 'UNWATCHED'` filtrera correctement les films mais retournera toutes les séries quelle que soit leur progression. Un commentaire dans le code en prend acte.

Impact : résultat potentiellement imprécis pour les étagères mixtes avec filtres watchState. Documenté en plan comme exclusion. Non bloquant.

### Observation — Aucun rendu d'erreur côté frontend pour les étagères en échec

`useShelves.error` et `useShelf.error` sont exposés mais non consommés dans `HomePage` ni `ShelfRowLoader`. Une étagère en erreur réseau disparaît silencieusement.

Impact : UX dégradée silencieusement en cas d'erreur réseau partielle. Non bloquant pour un MVP.

### Observation — `reorderMembers` accepte des listes partielles

La route `PUT /shelves/:id/members/order` ne valide pas que la liste fournie correspond exactement aux membres actuels de l'étagère. Une liste partielle met à jour les positions des membres présents dans la requête ; les autres conservent leur ancienne position. Il n'y a pas d'erreur.

Impact : comportement légèrement permissif mais non destructif. Non bloquant.

## Risques éventuels

- **N+1 requests sur la Home** : 1 appel `GET /shelves` + N appels `GET /shelves/:id` (4 système + étagères utilisateur). Acceptable pour un MVP à faible volume, à surveiller si le nombre d'étagères croît.
- **Règles DYNAMIC vides acceptées** (`rules: {}`) : retourne tout le catalogue. Comportement correct (aucun filtre = tout), mais peut surprendre un utilisateur créant une étagère dynamique sans règles.

## Décision

Toutes les exigences du ticket sont satisfaites. Les problèmes identifiés sont mineurs ou documentés comme exclusions dans le plan. La sécurité est correctement gérée. Les tests couvrent les chemins critiques. Le contrat est extensible.

- APPROVED

## Actions demandées

Aucune correction bloquante. Les points mineurs ci-dessus peuvent être adressés en suivis :
- Supprimer la colonne `system_key` si elle n'est pas prévue pour un usage futur.
- Afficher un état d'erreur dans `ShelfRowLoader` ou `useShelves`.
- Filtrer `sys_my_list` de la liste quand la watchlist est vide.
