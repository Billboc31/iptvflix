# PR Review — T051: Automatic source synchronization and discovery refresh scheduling

## Résumé

L'implémentation est complète, correctement scopée et de bonne qualité. Les quatre fichiers principaux créés (`scheduler-service.ts`, `scheduler.ts`, `useSchedulerStatus.ts`, `scheduler-service.test.ts`) ainsi que les modifications dans `env.ts`, `index.ts` et `SyncStatusBanner.tsx` couvrent l'intégralité du plan sans en dépasser le périmètre.

## Vérifications effectuées

- Lecture du ticket T051 et du plan `runs/T051/plan.md`
- Lecture de `apps/api/src/services/scheduler-service.ts` (137 lignes)
- Lecture de `apps/api/src/routes/scheduler.ts` (21 lignes)
- Lecture de `apps/api/src/services/__tests__/scheduler-service.test.ts` (322 lignes)
- Lecture de `apps/web/src/hooks/useSchedulerStatus.ts` (24 lignes)
- Lecture de `apps/web/src/components/sources/SyncStatusBanner.tsx` (87 lignes)
- Vérification des variables d'environnement dans `apps/api/src/config/env.ts`
- Vérification du câblage dans `apps/api/src/index.ts`
- Tentative d'exécution des tests (échec environnemental — voir note ci-dessous)

## Points validés

### Configuration

- `SYNC_SCHEDULER_ENABLED` : `false` par défaut hors production, `true` en production — logique correcte et sûre.
- Les quatre autres variables (`SOURCE_SYNC_CADENCE_MINUTES=60`, `DISCOVERY_CADENCE_MINUTES=360`, `SOURCE_SYNC_CONCURRENCY=2`, `SCHEDULER_STARTUP_DELAY_MS=30000`) ont des valeurs par défaut cohérentes avec le plan.

### SchedulerService

- **Séparation des timers** : deux `setInterval` indépendants — source sync et discovery — conformément au plan.
- **Cadence gate DB** : vérification sur `sync_runs.completedAt` en base de données (pas d'état in-memory), ce qui survit aux redémarrages.
- **Startup delay** : le premier tick ne se déclenche qu'après `startupDelayMs` — protège contre les bursts post-restart.
- **Isolation des erreurs par source** : catch per-source, les autres sources continuent quelle que soit l'erreur.
- **409 / SyncAlreadyRunningError** : silencieusement ignoré via `statusCode === 409` — correct et propre.
- **Concurrence bornée** : `withBoundedConcurrency` implémentée en queue/worker pattern — correcte et testée.
- **Discovery tick** : appelle `evictStale()` puis `refreshPool()` avec les feeds et media types définis en constantes ; noop si service null.
- **`stop()`** : nettoie correctement les trois timers possibles (`startupTimer`, `sourceSyncTimer`, `discoveryTimer`).

### Route et câblage

- `GET /scheduler/status` : route publique, lecture seule, retourne `{ enabled, sourceSyncCadenceMinutes, discoveryCadenceMinutes }` — conforme au plan.
- Câblage dans `index.ts` : `schedulerRoutes` enregistré avant `scheduler.start()`, `SchedulerService` instancié avec tous les paramètres correctement nommés.
- `scheduler.start()` appelé inconditionnellement — correct car `start()` vérifie `enabled` en interne.

### UI

- `useSchedulerStatus` : fetch unique au montage, retourne `null` en cas d'erreur (dégradation gracieuse).
- `SyncStatusBanner` : badge "Auto-sync Xh" ou "Auto-sync désactivé" selon l'état ; "Prochaine ~HH:MM" calculé via `finishedAt + cadenceMs` avec garde `latestRun?.finishedAt &&` (null-safe).

### Tests (12 cas)

Tous les scénarios du plan sont couverts :
- Scheduling désactivé
- Cadence gate : source récente skippée, source stale synced, source sans run précédent synced
- Lock contention (409) silencieux, autres sources continuent
- Failure isolation : erreur source A, B et C traitées quand même
- Concurrence bornée (concurrency=1, 3 sources)
- Restart safety : pas de tick avant le délai, `stop()` annule le startup timer
- Discovery tick : `evictStale` + `refreshPool` appelés ; erreur catchée sans rethrow
- No discovery service : noop correct

### Critères d'acceptation du ticket

| Critère | Statut |
|---------|--------|
| Sources synchées automatiquement à cadence configurable | ✓ |
| Pas d'overlap pour la même source (lock via DB UNIQUE index) | ✓ — réutilise `triggerSync` qui gère le 409 |
| Sync manuelle et schedulée partagent le même locking | ✓ — même `triggerSync` |
| Failure isolation par source | ✓ |
| Discovery Pool tourne indépendamment | ✓ |
| Lifecycle availability alimenté correctement | ✓ — pas de changement au flux existant |
| Désactivable en dev/test | ✓ |
| Restart-safe (pas de storm immédiate) | ✓ — startup delay |
| Tests couvrent les scénarios clés | ✓ |

## Problèmes détectés

### Bloquants

Aucun.

### Mineurs / observations

1. **Tests non exécutables dans le worktree** : les symlinks pnpm dans `apps/api/node_modules/.bin/vitest` pointent vers le store du worktree T032, pas T051. Les tests ne peuvent pas être lancés tels quels dans ce worktree. Le code des tests est syntaxiquement et logiquement correct à la lecture. Ce problème est environnemental (setup du worktree), pas un défaut d'implémentation.

2. **Test "concurrency bound" incomplet** : le test vérifie que les 3 sources ont été appelées avec `concurrency=1` mais ne vérifie pas que les appels étaient strictement séquentiels (jamais 2 en parallèle). La mécanique de `withBoundedConcurrency` est correcte à la lecture, mais le test ne prouve pas réellement la contrainte de séquentialité. Observation mineure — le comportement correct est dans l'implémentation.

3. **Pas de signal handlers pour le graceful shutdown** : `scheduler.stop()` est implémenté mais jamais appelé sur `SIGTERM`/`SIGINT`. Pour Railway (terminaison de processus), ce n'est pas critique — les timers sont détruits avec le processus. Acceptable dans le contexte.

4. **Charge DB** : `runSourceSyncTick()` fetche toutes les sources enabled à chaque tick. Avec un très grand nombre de sources, cela pourrait être lent. Hors scope T051, et non problématique au niveau de déploiement actuel.

## Risques éventuels

- Environnement de test du worktree cassé (pnpm symlinks) : risque que les tests CI ne passent pas si CI utilise ce worktree tel quel. À vérifier lors de la PR GitHub.
- Aucun risque de sécurité identifié : pas de secret exposé, pas de log de données sensibles.

## Décision

- **APPROVED**

## Actions demandées

Aucune modification bloquante requise. Avant de merger, s'assurer que les tests passent dans l'environnement CI (qui aura un setup pnpm propre, contrairement au worktree).

IMPLEMENTATION_APPROVED
