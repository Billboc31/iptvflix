---

# PR Review — T031: Enforce provider item uniqueness for episode availabilities

## Résumé

Ajout du contrainte `UNIQUE(provider_id, provider_item_id)` sur `episode_availabilities`, identique à ce qui existe pour `movie_availabilities` et `series_availabilities`. Inclut une migration sûre avec déduplication, une mise à jour du chemin de sync pour gérer les conflits explicitement, et des tests DB + intégration.

## Vérifications effectuées

- Lecture complète du ticket, du plan, du diff complet
- Lecture de `availabilities.ts`, `0014_episode_availability_provider_uniqueness.sql`, `catalog-sync-service.ts` (726 lignes), `catalog-constraints.test.ts`, `catalog-sync-service.test.ts` (1 030 lignes)
- Vérification de la logique de tracking `seenEpisodeProviderItemIds` dans les trois branches du bloc de sync épisode
- Vérification de la cohérence plan ↔ implémentation

## Points validés

**Schéma (`availabilities.ts`)**
- `unique().on(t.providerId, t.providerItemId)` ajouté à `episodeAvailabilities` en position identique à `movieAvailabilities` et `seriesAvailabilities`. ✅
- La contrainte composée `(episodeId, providerId, providerItemId)` est conservée. ✅

**Migration (`0014_episode_availability_provider_uniqueness.sql`)**
- DELETE avec `DISTINCT ON (provider_id, provider_item_id) ORDER BY first_seen_at ASC, id ASC` — conserve le plus ancien, brise les ex-aequo de manière déterministe. ✅
- `ALTER TABLE ADD CONSTRAINT` conforme à la convention de nommage des autres tables. ✅
- Drizzle `migrate()` wrap chaque migration dans une transaction → si le `ALTER` échoue, le `DELETE` est rollback. ✅

**Sync service (`catalog-sync-service.ts` lignes 554–587)**
- Lookup par `(providerId, providerItemId)` seulement — deux phases correctes. ✅
- Branche CONFLICT (`existing.episodeId !== episodeId`) : warn + `seenEpisodeProviderItemIds.add()` + `continue`. L'item est compté comme "vu" donc ne sera pas marqué UNAVAILABLE — comportement correct. ✅
- Branche INSERT et UPDATE : tombent sur `seenEpisodeProviderItemIds.add(ep.providerItemId)` ligne 586. Aucune duplication de tracking. ✅
- `console.warn` ne log que des IDs opaques — aucun secret ou donnée sensible. ✅

**Tests — contraintes DB (`catalog-constraints.test.ts`)**
- Test ligne 216 : rejette le même `(provider_id, provider_item_id)` sur deux épisodes distincts. ✅
- Test ligne 254 : vérifie que deux providers différents peuvent avoir le même `provider_item_id` sur le même épisode — couverture de la protection cross-provider. ✅

**Tests — sync intégration (`catalog-sync-service.test.ts`)**
- Test ligne 642 : remappage de `ep-conflict-1` de S01E01 vers S01E02 → skip, l'assignation originale est préservée. ✅
- Test ligne 577 : multi-source sur le même épisode canonique (deux sources, deux `providerItemId` distincts). ✅
- Cycle complet : create / repeat / disappear / reappear / UNAVAILABLE restoration — couverts. ✅

**Scope**
- Aucun changement sur `movie_availabilities` ni `series_availabilities`. ✅
- Aucune surface API ou UI touchée. ✅
- 378 tests passent. ✅

## Problèmes détectés

Aucun problème bloquant.

## Risques éventuels

**Observation mineure — test "multi-variant" (ligne 254, `catalog-constraints.test.ts`)**

Le test `allows multiple distinct provider items to map to the same canonical episode` insère deux lignes avec le même `providerItemId: 'ep-multi-1'` mais deux `providerId` différents (`xtream:server1` vs `xtream:server2`). Il valide bien que la contrainte autorise ce cas, mais ne teste pas directement le scénario décrit par le critère d'acceptation : deux `providerItemId` différents d'un même provider vers le même épisode.

Ce scénario est implicitement permis par la contrainte (aucune règle DB ne l'interdit), mais l'absence d'un test positif direct est une légère lacune de couverture. Non bloquant.

## Décision

- APPROVED

Tous les critères d'acceptation du ticket sont satisfaits. L'implémentation est parfaitement bornée au scope, suit le pattern existant, gère les conflits de manière déterministe et inclut une couverture de tests solide.

IMPLEMENTATION_APPROVED
