# PR Review — T131: Canonicalize and deduplicate Live TV channels

## Résumé

L'implémentation couvre tous les axes du ticket : schéma DB (`channels` + `channel_sources`), pipeline de déduplication par confiance, normalisation des noms et catégories, sélection de source, routes API, et tests unitaires + E2E. L'architecture est propre et cohérente avec le reste du codebase. Deux tests unitaires échoueront à cause d'un désaccord entre le comportement réel de la normalisation et les assertions.

## Vérifications effectuées

- Schema DB (`channels.ts`, `channel-sources.ts`, migration SQL)
- Module de normalisation (`channel-normalizer.ts`)
- Mapper de catégories (`category-mapper.ts`)
- Sélecteur de source (`source-selector.ts`)
- Service de sync canaux (`channel-sync-service.ts`)
- Intégration dans `catalog-sync-service.ts` (M3U + Xtream)
- Enrichissement Xtream dans `sync-runs-service.ts`
- Routes API (`routes/channels.ts`, `packages/api-contracts/src/channels.ts`)
- Enregistrement des routes dans `index.ts`
- Types M3U et Xtream étendus
- Tests unitaires : `channel-normalizer.test.ts`, `category-mapper.test.ts`, `channel-sync-service.test.ts`
- Test E2E : `live-tv-sync.spec.ts` + fixture `m3u-server.ts` + `global-setup.ts`

## Points validés

- **Schema correct** : `UNIQUE(source_id, provider_item_id)` garantit l'idempotence au niveau DB ; `match_confidence` et `match_provenance` NOT NULL ; FK avec CASCADE.
- **Normalisation générique** : aucun hardcoding de chaînes spécifiques, règles data-driven.
- **Seuil de confiance** : 0.75 préserve correctement les faux positifs — correspondance sur le `tvgId` seul (0.6) ne suffit pas, il faut également le nom normalisé ou vice-versa.
- **Ambiguïté** : `scoredCandidates.length > 1` → nouvelle chaîne créée sans fusion, ce qui est le bon comportement.
- **Index en mémoire** : `channelsByTvgId` + `channelsByNormalizedName` évitent le N+1 par entrée.
- **Lifecycle** : les sources absentes du snapshot sont correctement marquées `UNAVAILABLE` avec `unavailableAt`.
- **Logo** : la `logoUrl` du canal est mise à jour si une source en apporte une et que la valeur courante est null.
- **Sélecteur source** : tri AVAILABLE → priority desc → lastSeenAt desc, fonction pure.
- **Routes** : `GET /channels` filtre sur au moins une source AVAILABLE ; `GET /channels/:id/stream` délègue à `selectPreferredSources`.
- **Enregistrement des routes** : `channelsRoutes` est bien importé et enregistré dans `index.ts:219`.
- **Intégration Xtream** : `getLiveCategories` et `getLiveStreams` sont appelés en parallèle dans le snapshot, avec degradation gracieuse sur erreur (`catch → []`).
- **Intégration M3U** : `liveChannels` du snapshot sont correctement mappés vers `LiveChannelEntry` et passés à `ChannelSyncService`.
- **Fixture E2E** : `LIVE_CHANNELS_PLAYLIST` avec 5 entrées (3 tvg-id TF1 partagé + France 2 + France 3) est cohérent avec les assertions E2E.
- **Pas de hardcoding** de TF1, France 2, etc. dans le code source (uniquement dans les données de test).

## Problèmes détectés

### BLOQUANT — Deux tests unitaires échoueront

**1. Test `normalizeChannelName('M.6')` → attendu `m.6`, reçu `m 6`**

`channel-normalizer.ts:29` exécute `raw.replace(/[._]/g, ' ')`, ce qui transforme le point `.` en espace. `M.6` → `M 6` → après collapse → `m 6`. Le test attend `m.6`.

Il y a un désaccord entre l'implémentation et l'assertion. Deux corrections possibles :
- **Option A** (recommandée) : changer le regex pour ne remplacer que les underscores : `raw.replace(/_/g, ' ')`. Le point dans un nom de chaîne (`M.6`, `C+`) est généralement significatif.
- **Option B** : corriger le test pour attendre `m 6` si le comportement dot→space est intentionnel.

**2. Test `normalizeChannelName('  BFM  TV  ')` → attendu `bfm  tv`, reçu `bfm tv`**

`replace(/\s+/g, ' ').trim()` collapse tous les espaces multiples en un seul. Le résultat réel est `bfm tv` (un espace), mais le test attend `bfm  tv` (deux espaces). Si l'intention est de tester que les espaces en début/fin sont supprimés mais que les espaces internes sont préservés, le regex est mal choisi. Si l'intention est de tester le collapse, l'assertion est incorrecte.

Correction suggérée : corriger l'assertion du test pour `bfm tv` (collapse intentionnel et cohérent avec la déduplication normalisée).

## Risques éventuels

- **Compteur `sourcesCreated` légèrement inexact** : quand `onConflictDoNothing` s'applique silencieusement (source déjà existante non détectée dans `existingSourcesByItemId`), `result.sourcesCreated++` est quand même incrémenté. Impact : compteur de diagnostic incorrect, pas de corruption de données.

- **M3U `providerItemId` = `streamUrl`** : pour des providers dont les URLs contiennent des tokens de session changeants entre syncs, chaque sync créerait une nouvelle source plutôt que de mettre à jour l'existante. Acceptable pour les URLs stables, mais à surveiller. Utiliser `entry.tvgId ?? entry.streamUrl` comme dans le path movie M3U réduirait ce risque.

- **Full table scan `channels`** : `syncLiveChannels` charge l'intégralité de la table `channels` en mémoire à chaque sync. Acceptable pour les volumes actuels, scalabilité à surveiller au-delà de ~50k canaux.

- **`GET /channels/:id/stream` retourne `{ streamUrl: '' }` en 404** : renvoyer un body qui correspond au schéma de succès avec une chaîne vide est trompeur pour les clients. Mineur mais risque de confusion côté frontend.

## Décision

REQUEST_CHANGES

## Actions demandées

1. **(Bloquant)** Corriger le désaccord test/implémentation sur `normalizeChannelName('M.6')` — soit changer `replace(/[._]/g, ' ')` en `replace(/_/g, ' ')` dans `channel-normalizer.ts:29`, soit corriger l'assertion du test.
2. **(Bloquant)** Corriger l'assertion du test `collapses extra whitespace` : le résultat réel est `bfm tv` (un espace), pas `bfm  tv` (deux espaces).
