All 594 tests pass. Here is the full review.

---

# PR Review — T049: M3U Catalog Ingestion (Attempt 2)

## Résumé

Les deux problèmes bloquants identifiés lors de la review précédente ont été corrigés. L'implémentation est complète, correcte et conforme au ticket et au plan.

## Vérifications effectuées

- Présence et contenu de `e2e/fixtures/m3u-server.ts`
- Mise à jour de `e2e/global-setup.ts` et `e2e/fixtures/index.ts`
- Tests e2e dans `e2e/tests/m3u-sync.spec.ts`
- Gestion des erreurs dans `sync-runs-service.ts` (`triggerSync`)
- Sanitisation des messages d'erreur dans le run record `FAILED`
- Vérification de la chaîne HTTP 201 pour un run `FAILED` (triggerSync retourne, ne throw pas)
- Schéma `sync-runs` — champ `startedAt` avec `.defaultNow()` (insert FAILED sans startedAt est valide)
- Cohérence des types et interfaces M3U (`types.ts`, `errors.ts`, `parser.ts`, `client.ts`)
- Tous les 594 tests unitaires passent

## Corrections apportées par rapport à la review précédente

### Fix #1 — `e2e/fixtures/m3u-server.ts` créé ✅

Le fichier implémente les 4 modes demandés : `happy` (2 movies + 1 épisode), `auth-fail` (HTTP 401), `empty` (header M3U valide, pas d'entrées), `malformed` (body HTML non-M3U).

`e2e/global-setup.ts` démarre 4 serveurs M3U (ports 9995–9992) et écrit les URLs dans `.fake-servers.json`. `e2e/fixtures/index.ts` expose `m3uHappy`, `m3uAuthFail`, `m3uEmpty`, `m3uMalformed`.

3 tests e2e dans `m3u-sync.spec.ts` couvrent :
- happy path → `status: DONE`, `moviesAdded > 0`
- idempotence → second sync avec `moviesAdded === 0`
- malformed → `status: FAILED`, `error` non nul (et le route retourne bien HTTP 201 puisque `triggerSync` retourne un run FAILED sans throw)

### Fix #2 — Run record `FAILED` créé lors des erreurs de fetch ✅

`triggerSync` encapsule `fetchM3USnapshot` dans un try/catch qui, en cas de `M3UAuthError | M3UNetworkError | M3UParseError`, insère un run record `FAILED` en base et retourne immédiatement. Le champ `errorMessage` reçoit `(fetchErr as Error).message` qui est déjà sanitisé : `M3UNetworkError` utilise `sanitizeUrl()`, `M3UAuthError` ne contient que le status HTTP, `M3UParseError` un message statique.

## Points validés

- **Architecture** : `M3UClient → M3UCatalogSnapshot → syncM3UCatalog → syncNormalized` — aucune donnée M3U dans le domaine canonique ✅
- **Classification conservatrice** : `movie|film|vod` sans SxxExx → movie ; `series|show|episode` + SxxExx → episode ; tout le reste → unclassified non persisté ✅
- **Idempotence** : contraintes unique `(providerId, providerItemId)` garantissent le comportement re-sync ✅
- **Sécurité credentials** : `sanitizeUrl()` rédige `username=`, `password=`, `token=` et HTTP Basic auth ; credentials jamais dans les logs ni dans les messages d'erreur ✅
- **Tous les 594 tests unitaires passent** ✅
- **Tests e2e** : 3 nouveaux tests couvrant les AC critiques ✅

## Observations mineures (non bloquantes, inchangées)

- Double timeout possible dans `testConnection()` (range + fallback full fetch = jusqu'à 2 × 60 s)
- `source-service.ts` instancie `M3UClient` sans `timeoutMs`, ignorant `M3U_FETCH_TIMEOUT_MS`
- Le `HAPPY_PLAYLIST` du fixture a 1 épisode (au lieu de 2 mentionnés dans le plan) ; les tests passent correctement

## Décision

Les deux livrables manquants sont implémentés et corrects. Aucun nouveau problème bloquant détecté.

IMPLEMENTATION_APPROVED
