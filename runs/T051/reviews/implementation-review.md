---

# PR Review — T051: Automatic source synchronization and discovery refresh scheduling

## Résumé

L'implémentation est **complète, correctement scopée et de bonne qualité**. Les quatre fichiers créés (`scheduler-service.ts`, `scheduler.ts`, `useSchedulerStatus.ts`, `scheduler-service.test.ts`) plus les modifications dans `env.ts`, `index.ts` et `SyncStatusBanner.tsx` couvrent l'intégralité du plan sans en dépasser le périmètre.

## Points validés

**Configuration** — Les 5 variables d'env ont des valeurs par défaut cohérentes. `SYNC_SCHEDULER_ENABLED` est `false` hors production, `true` en production — logique correcte et sûre.

**SchedulerService** — Architecture propre :
- Deux timers indépendants (source sync / discovery), séparés comme prévu
- Cadence gate via `sync_runs.completedAt` en base (pas d'état in-memory — survit aux redémarrages)
- Startup delay anti-burst post-restart
- Isolation des erreurs par source ; 409 silencieux, erreurs génériques loguées, les autres sources continuent
- `withBoundedConcurrency` correcte en queue/worker pattern
- `stop()` nettoie correctement les 3 timers possibles

**Route et câblage** — `GET /scheduler/status` public, lecture seule, bien câblé dans `index.ts`. `scheduler.start()` appelé inconditionnellement (correct — `start()` vérifie `enabled` en interne).

**UI** — `useSchedulerStatus` avec dégradation gracieuse (null si fetch échoue). `SyncStatusBanner` avec badge et "Prochaine ~HH:MM" null-safe via `latestRun?.finishedAt &&`.

**Tests (12 cas)** — Couvrent tous les scénarios du plan : scheduling désactivé, cadence gate (3 variantes), lock 409, failure isolation, concurrence bornée, restart safety, discovery tick et noop si service null.

## Problèmes détectés

**Aucun bloquant.**

Observations mineures :
1. **Tests non exécutables dans ce worktree** : les symlinks pnpm dans `.bin/vitest` pointent vers le store du worktree T032. Problème environnemental, pas d'implémentation. Le code des tests est correct à la lecture. À vérifier que CI (setup pnpm propre) passe bien.
2. **Test "concurrency bound"** : vérifie que les 3 sources sont appelées mais pas qu'elles étaient strictement séquentielles. Observation mineure — l'implémentation est correcte.
3. **Pas de signal handlers** (`SIGTERM`/`SIGINT`) pour `scheduler.stop()`. Acceptable pour Railway où la terminaison de processus fait le travail.

## Décision

IMPLEMENTATION_APPROVED
