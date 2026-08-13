# PR Review — T049: M3U Catalog Ingestion

## Résumé

L'implémentation du provider M3U est globalement solide : l'architecture respecte la frontière provider-indépendante établie par Xtream et Plex, la sécurité des credentials est correctement traitée, la classification est conservative, et les tests unitaires sont complets pour le périmètre implémenté. Deux écarts bloquants par rapport au plan sont détectés.

## Vérifications effectuées

- Lecture complète des fichiers du module M3U (`types.ts`, `errors.ts`, `parser.ts`, `client.ts`, `index.ts`)
- Lecture des tests unitaires (`parser.test.ts`, `client.test.ts`)
- Vérification de l'intégration dans `catalog-sync-service.ts` (`syncM3UCatalog`)
- Vérification de `sync-runs-service.ts` (`fetchM3USnapshot`, `triggerSync`)
- Vérification de `source-service.ts` (`testSourceConnection`)
- Vérification des tests d'intégration dans `routes/sources.test.ts`
- Vérification du répertoire `e2e/fixtures/`
- Analyse de la chaîne de propagation d'erreurs de `fetchSnapshot` → `triggerSync` → `POST /sync-runs`
- Vérification de la cohérence entre `seriesKey`, `providerItemId` et `seriesProviderItemId`

## Points validés

- **Architecture** : `M3UClient → M3UCatalogSnapshot → syncM3UCatalog → syncNormalized` respecte strictement la frontière provider-indépendante ; aucune donnée M3U n'est introduite dans le domaine canonique.
- **Parsing** : validateur de header `#EXTM3U`, extraction des attributs `tvg-id/tvg-name/tvg-logo/group-title` par regex, `rawTitle` extrait de la queue comma, pairs orphelines silencieusement ignorées.
- **Classification conservatrice** : group `movie|film|vod` sans `SxxExx` → movie ; group `series|show|episode` ET `SxxExx` → episode ; tout le reste → `unclassified` (non persisté). Live TV et entrées ambiguës ne créent aucune donnée canonique.
- **Idempotence** : les contraintes unique `(providerId, providerItemId)` de `syncNormalized` garantissent le comportement re-sync. Les series sont dédupliquées par `seriesKey`.
- **Cohérence series/episode IDs** : `seriesMap.key = ep.seriesKey ?? ep.streamUrl` === `NormalizedSeriesItem.providerItemId` === `NormalizedEpisodeItem.seriesProviderItemId` — la liaison est stable.
- **Sécurité credentials** : substitution `{username}/{password}` à la construction, jamais dans les logs. `sanitizeUrl()` rédige `username=`, `password=`, `token=` et HTTP Basic auth. Vérifié par les tests client (credentials jamais dans les messages d'erreur).
- **testConnection** : range request avec fallback 416, validation header `#EXTM3U`, messages d'erreur sanitisés.
- **Config** : `M3U_FETCH_TIMEOUT_MS` avec défaut 60 000 ms.
- **Tests unitaires** : 8 tests parser + 8 tests client couvrant happy path, 401, timeout, host unreachable, 416 fallback, substitution de credentials, body non-M3U.
- **Tests routes** : 3 cas M3U dans `sources.test.ts` (happy path, 401, network error sans credentials).
- **Tous les 594 tests passent.**

## Problèmes détectés

### Bloquant #1 — `e2e/fixtures/m3u-server.ts` absent

**Plan** : fichier `e2e/fixtures/m3u-server.ts` listé comme nouvelle livraison avec modes `happy`, `auth-fail`, `empty`, `malformed`.

**Réalité** : le répertoire `e2e/fixtures/` contient uniquement `index.ts` et `xtream-server.ts`. Aucun fixture M3U, aucun test e2e M3U.

**Impact** : les acceptance criteria suivants du plan ne sont pas couverts au niveau intégration :
- `POST /sync-runs` pour une source M3U valide complète avec statut `COMPLETED` et `moviesCreated > 0`
- Un deuxième sync est idempotent sans doublons
- Un body non-M3U fait terminer le run en `FAILED` avec message sanitisé

### Bloquant #2 — Les erreurs de fetch M3U ne produisent pas de run record `FAILED`

**Plan AC** (explicite) : _"Fetching a URL that returns non-M3U content does not crash the sync run; the run record ends with status FAILED and a sanitized error message."_

**Chemin d'exécution actuel** :
```
POST /sync-runs
  → triggerSync()
    → fetchM3USnapshot()
      → M3UClient.fetchSnapshot()
        → parseM3U()      ← lève M3UParseError (body non-M3U)
        ← M3UParseError propagée
      ← M3UParseError propagée
    ← M3UParseError propagée (aucun run record créé, aucun FAILED enregistré)
  ← catch: M3UParseError n'est ni NotFoundError ni une erreur avec statusCode 4xx
    → throw err
← Fastify default handler → HTTP 500
```

`syncNormalized` (qui crée le run record et gère `FAILED`) n'est jamais atteinte. Résultat : aucune trace en base, HTTP 500 brut. Même comportement pour `M3UNetworkError` et `M3UAuthError`.

**Correction recommandée** : dans `triggerSync`, envelopper les erreurs de fetch M3U en créant/mettant à jour un run record `FAILED` avant de propager, ou déplacer la création du run record avant l'appel au fetch (cohérent avec l'intention du plan).

Option minimale :
```typescript
} else if (source.type === 'M3U') {
  let snapshot: M3UCatalogSnapshot
  try {
    snapshot = await fetchM3USnapshot(source)
  } catch (err) {
    // Create a FAILED run record so callers can inspect the outcome
    const [run] = await db.insert(syncRuns).values({ sourceId: source.id, status: 'FAILED', errorMessage: sanitizeSyncError(err), completedAt: new Date() }).returning()
    const [row] = await db.select().from(syncRuns).where(eq(syncRuns.id, run.id))
    return toResponse(row!)
  }
  result = await CatalogSyncService.syncM3UCatalog(source.id, snapshot)
}
```

## Risques éventuels

- **Double timeout dans `testConnection()`** : range request + fallback full fetch utilisent chacun `AbortSignal.timeout(this.timeoutMs)`. La durée maximale est `2 × timeoutMs` (120 s par défaut). Acceptable pour un test de connexion mais documentable.
- **Attributs variants de série** : `variantAttributes` est extrait du titre du premier épisode de chaque série. Si les épisodes d'une même série varient en langue, les attributs de la série parent seront ceux du premier épisode traité. Limitation inhérente à la qualité des métadonnées M3U, non bloquante.
- **`testConnection` ignorant `M3U_FETCH_TIMEOUT_MS`** : `source-service.ts` instancie `M3UClient` sans `timeoutMs`, donc 60 s hardcodé. Cohérence mineure à améliorer mais non bloquante.

## Décision

REQUEST_CHANGES — deux livrables explicitement définis dans le plan sont absents ou non conformes.

## Actions demandées

1. **Créer `e2e/fixtures/m3u-server.ts`** avec au minimum les modes `happy` (2 movies + 1 série avec 2 épisodes) et `malformed` (body sans `#EXTM3U`). Ajouter un test e2e couvrant sync M3U avec COMPLETED status et idempotence.

2. **Corriger la gestion des erreurs de fetch dans `triggerSync`** pour que les erreurs `M3UParseError`, `M3UNetworkError` et `M3UAuthError` créent un run record `FAILED` en base avec un message sanitisé plutôt que de propager un HTTP 500 non tracé.

IMPLEMENTATION_FIX_REQUIRED
