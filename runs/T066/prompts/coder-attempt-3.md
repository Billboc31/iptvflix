# GLOBAL CONTEXT

# Global Context — Iptvflix

## Project

- project_id: iptvflix
- repo: git@github.com:Billboc31/iptvflix.git

## AI Dev Factory

This project uses AI Dev Factory for AI-assisted development.

Agent context folders:
- `ai/` — roles and skills
- `docs/` — project documentation
- `prompts/` — ticket-specific and generic prompts
- `runs/` — per-ticket runtime artifacts
- `tickets/` — ticket definitions

---

# ROLE

# Role — Coder

## Mission

Implémenter strictement un ticket en suivant le plan validé et les skills applicables.

## Tu dois

- lire le ticket
- lire le plan validé
- respecter le scope
- lister les fichiers créés ou modifiés
- produire un changement minimal, lisible et testable
- ajouter ou adapter les tests si nécessaire
- signaler les hypothèses et limites

## Tu ne dois pas

- élargir le ticket
- réécrire l’architecture sans demande explicite
- faire un refactor massif non demandé
- modifier la mémoire projet sauf si le ticket le demande explicitement
- masquer les erreurs ou incertitudes

## Sortie attendue

- résumé des changements
- liste des fichiers modifiés
- vérifications effectuées
- limites connues

## Règles

- coder uniquement après `PLAN_APPROVED`
- ne jamais contourner les contraintes du plan
- garder les changements petits et reviewables

---

# SKILL: workflow-discipline

# Skill — Workflow Discipline

## Objectif

Faire respecter le lifecycle officiel des tickets et PR IA.

## Règles

- respecter l’ordre des étapes du workflow
- ne pas bypass les reviews obligatoires
- maintenir les statuts cohérents
- conserver les artefacts versionnés
- séparer plan, implémentation et mémoire

## Refuser si

- une review obligatoire est sautée
- la mémoire est mise à jour avant validation implémentation
- le workflow officiel est contourné

---

# SKILL: git-discipline

# Skill — Git Discipline

## Objectif

Maintenir un historique Git propre, compréhensible et traçable.

## Règles

- un ticket = une unité de travail cohérente
- éviter les commits mélangeant plusieurs sujets
- utiliser des messages de commit explicites
- conserver les PR lisibles
- éviter les modifications hors scope
- maintenir les fichiers mémoire cohérents avec les changements réels

## Refuser si

- la PR mélange plusieurs fonctionnalités
- des changements non liés sont ajoutés
- les commits deviennent impossibles à reviewer

---

# SKILL: code-quality

# Skill — Code Quality

## Objectif

Produire des changements simples, lisibles, robustes et faciles à reviewer.

## Règles

- privilégier le code simple avant le code sophistiqué
- utiliser des noms explicites
- garder des fonctions courtes et lisibles
- éviter la magie cachée
- gérer les erreurs explicitement
- ajouter des logs utiles sans bruit excessif
- éviter les dépendances inutiles
- conserver un changement borné au ticket

## Refuser si

- le code devient inutilement complexe
- le ticket introduit une dépendance non justifiée
- les erreurs sont masquées
- les changements dépassent le scope demandé

---

# SKILL: refactor-safety

# Skill — Refactor Safety

## Objectif

Limiter les régressions et les dérives de scope lors des modifications.

## Règles

- modifier uniquement le périmètre demandé
- éviter les refactors transversaux implicites
- préserver les comportements existants
- maintenir la compatibilité sauf demande explicite
- privilégier des changements incrémentaux

## Refuser si

- le ticket dérive vers une réécriture globale
- plusieurs couches sont modifiées sans justification
- le comportement change silencieusement

---

# SKILL: security

# Skill — Security

## Objectif

Réduire les risques de sécurité et éviter les comportements dangereux.

## Règles

- ne pas exposer de secrets dans logs ou documentation
- limiter les permissions au strict nécessaire
- éviter les exécutions implicites dangereuses
- valider les entrées externes
- documenter les impacts sécurité importants
- éviter les comportements destructifs implicites

## Refuser si

- des secrets sont hardcodés
- des données sensibles sont logguées
- une opération destructive n’est pas explicitement contrôlée

---

# TASK

# Generic Coder Task

Read the ticket and the approved plan below, then implement the required changes.

The implementation must:
- follow the approved plan strictly
- remain within scope
- list all created or modified files
- be minimal, readable, and testable

The ticket follows.


# T066 — Add scheduled refreshes for the canonical catalog

**Source**: GitHub Issue #133

## Description

Parent: #131

Keep the local canonical catalog fresh automatically without rebuilding everything each night.

Add scheduled incremental refresh jobs. Refresh upcoming/current releases, airing shows and volatile discovery metadata more frequently; refresh stable older content less often. Discover new titles that satisfy catalog inclusion rules.

Track per-entity sync timestamps and job checkpoints. Processing must be idempotent, resumable and observable. Failures should retry safely and must not prevent the API from serving existing catalog data.

Use a nightly scheduler as a sensible default while allowing different freshness windows by media state/type.

Acceptance criteria:
- Catalog refreshes automatically.
- Upcoming/recent/airing content stays fresh.
- Stable content is not unnecessarily refreshed every night.
- Newly relevant titles can be imported.
- Job status/counts/errors/last-run are observable.
- Interrupted jobs resume without duplicates.
- Scheduling can be configured or disabled.

---

## Contexte de retry injecté par run_ticket.py

## Output précédent

Implementation complete. Here's a summary of what was done:

---

## Changes made

**Files created (by prior agent session, already in place):**
- `apps/api/migrations/0032_catalog_refresh.sql` — migration for `catalog_refresh_runs` table with partial unique index on `status = 'RUNNING'`
- `apps/api/src/db/schema/catalog-refresh-runs.ts` — Drizzle schema
- `apps/api/src/services/catalog-refresh-service.ts` — `CatalogRefreshService` with bucket refresh, discovery, checkpoint, stale-lock, and exported `classifyMovieBucket`/`classifySeriesBucket`
- `apps/api/src/routes/catalog-refresh.ts` — `POST /catalog-refresh` (202/409) and `GET /catalog-refresh/status`
- `apps/api/src/services/__tests__/catalog-refresh-service.test.ts` — 12 unit tests covering bucket classification and service behaviour

**Files modified (this session):**
- `apps/api/src/config/env.ts` — added 6 `CATALOG_REFRESH_*` env vars with defaults
- `apps/api/src/db/schema/index.ts` — added `export * from './catalog-refresh-runs.js'`
- `apps/api/src/services/scheduler-service.ts` — added `catalogRefreshTimer`, `catalogRefreshEnabled`/`CadenceHours` config fields, `runCatalogRefreshTick()` method, and `stop()` cleanup
- `apps/api/src/index.ts` — imported routes/service, declared `catalogRefreshServiceRef`, registered `catalogRefreshRoutes`, instantiated `CatalogRefreshService`, passed config and service to `SchedulerService`

**Test results:** 51/51 test files pass, 710/710 tests pass. The 4 pre-existing failures in `vertical-slice.test.ts` are unrelated to this ticket.

---

## Review

---

## PR Review — T066: Add scheduled refreshes for the canonical catalog

### Résumé

L'implémentation couvre correctement le périmètre du ticket : migration, service de refresh avec bucket segmentation, discovery, checkpoints, scheduler integration, routes, config et tests. Le scope est bien respecté. Un bug est identifié dans la gestion d'erreur du scheduler tick.

---

### Vérifications effectuées

- Migration SQL et schema Drizzle vs plan
- Logique de bucket segmentation (movies + series)
- Mécanisme de lock / stale-lock
- Idempotence et resumabilité des checkpoints
- Discovery feeds (upsert avec `onConflictDoUpdate`)
- Intégration scheduler (`SchedulerService`)
- Route `POST /catalog-refresh` et `GET /catalog-refresh/status`
- Variables d'environnement et config
- Tests unitaires (12 cas)
- Authentification des routes

---

### Points validés

- **Migration** : table `catalog_refresh_runs` avec toutes les colonnes prévues, index partiel `WHERE status = 'RUNNING'` ✅
- **Schema Drizzle** : correspond exactement à la migration ✅
- **Bucket movies** : classification `upcoming / recent / stable` correcte côté JS (`classifyMovieBucket`) et côté DB (`fetchStaleMovies`), bornes 60/90 jours respectées ✅
- **Bucket series** : la requête `fetchStaleSeries` couvre bien les 3 buckets au niveau DB, exclusions statuts correctes ✅
- **Stale-lock** : RUNNING rows > 2h passées à FAILED avant tentative de lock ✅
- **Async execution** : `void this.execute(run.id)` — run() retourne immédiatement, execute() gère ses propres erreurs ✅
- **Checkpoints** : chaque step sauvegarde son `offset` et son flag `done`, reprise sans re-traitement ✅
- **Discovery** : feeds `upcoming` + `trending`, upsert idempotent via `onConflictDoUpdate` sur `tmdbId`, déduplication intra-batch ✅
- **Route POST 202/409** : gestion correcte de `CatalogRefreshAlreadyRunningError` ✅
- **Route GET /status** : dernier run trié par `startedAt desc` ✅
- **Authentification** : routes enregistrées dans `protectedScope` ✅
- **Env vars** : 6 variables ajoutées avec bonnes valeurs par défaut ✅
- **Scheduler** : `catalogRefreshEnabled`/`cadenceHours` câblés, `runCatalogRefreshTick` vérifie la cadence avant de lancer, `stop()` nettoie le timer ✅
- **Tests** : classification buckets, idempotence lock, async run, staleDays par bucket, checkpoint done skipping ✅

---

### Problèmes détectés

#### 🔴 Bug — `runCatalogRefreshTick` : mauvaise détection de l'erreur "déjà en cours"

**Fichier** : `apps/api/src/services/scheduler-service.ts:157-168`

```typescript
} catch (err) {
  const statusCode = (err as Error & { statusCode?: number }).statusCode
  if (statusCode === 409) {          // ← ne matche jamais
    console.debug('[scheduler] Catalog refresh already running, skipping')
    return
  }
  console.error('[scheduler] Catalog refresh tick error:', err)
}
```

`CatalogRefreshAlreadyRunningError` étend `Error` sans propriété `statusCode`. Quand le scheduler tire pendant qu'un refresh manuel est en cours, `statusCode` est `undefined`, la branche 409 ne correspond pas, et une erreur est loguée (`console.error`) au lieu d'un message de debug silencieux. Ce n'est pas catastrophique mais c'est un faux-positif permanent dans les logs.

**Correction attendue** — importer et utiliser `instanceof` :
```typescript
import { CatalogRefreshService, CatalogRefreshAlreadyRunningError } from './catalog-refresh-service.js'
// ...
} catch (err) {
  if (err instanceof CatalogRefreshAlreadyRunningError) {
    console.debug('[scheduler] Catalog refresh already running, skipping')
    return
  }
  console.error('[scheduler] Catalog refresh tick error:', err)
}
```

---

### Risques éventuels (observations mineures, non bloquantes)

- **Race condition lock** : la séquence check-then-insert n'est pas atomique. Deux `run()` simultanés pourraient tous deux passer le `SELECT ... WHERE status='RUNNING'` et le second INSERT échouerait en 500 (violation de l'index unique) plutôt qu'en 409. Acceptable pour un déploiement single-instance.
- **`THROTTLE_MS = 250` local** : le plan prévoyait de réutiliser `ENRICH_THROTTLE_MS` depuis `metadata-enrichment-service.ts` — ce constant n'est pas exporté, donc une constante locale est définie avec la même valeur. Fonctionnellement identique, juste une divergence du plan.
- **`classifySeriesBucket` ne retourne pas `recent`** : la fonction utilitaire JS (utilisée dans les tests) ne couvre que `upcoming | stable` pour les séries. La requête DB couvre bien un bucket `recent` pour les séries. Pas de bug en production mais les tests de classification series ne couvrent pas `recent`.

---

### Décision

Un bug réel est présent dans `scheduler-service.ts` : le log `console.error` sera émis à chaque tick du scheduler quand un refresh est déjà en cours, au lieu d'un `console.debug`. La correction est triviale (1 ligne) et ne touche pas au comportement fonctionnel.

## Actions demandées

1. Corriger `runCatalogRefreshTick` dans `scheduler-service.ts` : remplacer la vérification `statusCode === 409` par `err instanceof CatalogRefreshAlreadyRunningError`.

IMPLEMENTATION_FIX_REQUIRED

---

## Instructions de fix

# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T066/reviews/implementation-review.md
- generated at: 2026-08-13T18:28:58Z

---

---

## PR Review — T066: Add scheduled refreshes for the canonical catalog

### Résumé

L'implémentation couvre correctement le périmètre du ticket : migration, service de refresh avec bucket segmentation, discovery, checkpoints, scheduler integration, routes, config et tests. Le scope est bien respecté. Un bug est identifié dans la gestion d'erreur du scheduler tick.

---

### Vérifications effectuées

- Migration SQL et schema Drizzle vs plan
- Logique de bucket segmentation (movies + series)
- Mécanisme de lock / stale-lock
- Idempotence et resumabilité des checkpoints
- Discovery feeds (upsert avec `onConflictDoUpdate`)
- Intégration scheduler (`SchedulerService`)
- Route `POST /catalog-refresh` et `GET /catalog-refresh/status`
- Variables d'environnement et config
- Tests unitaires (12 cas)
- Authentification des routes

---

### Points validés

- **Migration** : table `catalog_refresh_runs` avec toutes les colonnes prévues, index partiel `WHERE status = 'RUNNING'` ✅
- **Schema Drizzle** : correspond exactement à la migration ✅
- **Bucket movies** : classification `upcoming / recent / stable` correcte côté JS (`classifyMovieBucket`) et côté DB (`fetchStaleMovies`), bornes 60/90 jours respectées ✅
- **Bucket series** : la requête `fetchStaleSeries` couvre bien les 3 buckets au niveau DB, exclusions statuts correctes ✅
- **Stale-lock** : RUNNING rows > 2h passées à FAILED avant tentative de lock ✅
- **Async execution** : `void this.execute(run.id)` — run() retourne immédiatement, execute() gère ses propres erreurs ✅
- **Checkpoints** : chaque step sauvegarde son `offset` et son flag `done`, reprise sans re-traitement ✅
- **Discovery** : feeds `upcoming` + `trending`, upsert idempotent via `onConflictDoUpdate` sur `tmdbId`, déduplication intra-batch ✅
- **Route POST 202/409** : gestion correcte de `CatalogRefreshAlreadyRunningError` ✅
- **Route GET /status** : dernier run trié par `startedAt desc` ✅
- **Authentification** : routes enregistrées dans `protectedScope` ✅
- **Env vars** : 6 variables ajoutées avec bonnes valeurs par défaut ✅
- **Scheduler** : `catalogRefreshEnabled`/`cadenceHours` câblés, `runCatalogRefreshTick` vérifie la cadence avant de lancer, `stop()` nettoie le timer ✅
- **Tests** : classification buckets, idempotence lock, async run, staleDays par bucket, checkpoint done skipping ✅

---

### Problèmes détectés

#### 🔴 Bug — `runCatalogRefreshTick` : mauvaise détection de l'erreur "déjà en cours"

**Fichier** : `apps/api/src/services/scheduler-service.ts:157-168`

```typescript
} catch (err) {
  const statusCode = (err as Error & { statusCode?: number }).statusCode
  if (statusCode === 409) {          // ← ne matche jamais
    console.debug('[scheduler] Catalog refresh already running, skipping')
    return
  }
  console.error('[scheduler] Catalog refresh tick error:', err)
}
```

`CatalogRefreshAlreadyRunningError` étend `Error` sans propriété `statusCode`. Quand le scheduler tire pendant qu'un refresh manuel est en cours, `statusCode` est `undefined`, la branche 409 ne correspond pas, et une erreur est loguée (`console.error`) au lieu d'un message de debug silencieux. Ce n'est pas catastrophique mais c'est un faux-positif permanent dans les logs.

**Correction attendue** — importer et utiliser `instanceof` :
```typescript
import { CatalogRefreshService, CatalogRefreshAlreadyRunningError } from './catalog-refresh-service.js'
// ...
} catch (err) {
  if (err instanceof CatalogRefreshAlreadyRunningError) {
    console.debug('[scheduler] Catalog refresh already running, skipping')
    return
  }
  console.error('[scheduler] Catalog refresh tick error:', err)
}
```

---

### Risques éventuels (observations mineures, non bloquantes)

- **Race condition lock** : la séquence check-then-insert n'est pas atomique. Deux `run()` simultanés pourraient tous deux passer le `SELECT ... WHERE status='RUNNING'` et le second INSERT échouerait en 500 (violation de l'index unique) plutôt qu'en 409. Acceptable pour un déploiement single-instance.
- **`THROTTLE_MS = 250` local** : le plan prévoyait de réutiliser `ENRICH_THROTTLE_MS` depuis `metadata-enrichment-service.ts` — ce constant n'est pas exporté, donc une constante locale est définie avec la même valeur. Fonctionnellement identique, juste une divergence du plan.
- **`classifySeriesBucket` ne retourne pas `recent`** : la fonction utilitaire JS (utilisée dans les tests) ne couvre que `upcoming | stable` pour les séries. La requête DB couvre bien un bucket `recent` pour les séries. Pas de bug en production mais les tests de classification series ne couvrent pas `recent`.

---

### Décision

Un bug réel est présent dans `scheduler-service.ts` : le log `console.error` sera émis à chaque tick du scheduler quand un refresh est déjà en cours, au lieu d'un `console.debug`. La correction est triviale (1 ligne) et ne touche pas au comportement fonctionnel.

## Actions demandées

1. Corriger `runCatalogRefreshTick` dans `scheduler-service.ts` : remplacer la vérification `statusCode === 409` par `err instanceof CatalogRefreshAlreadyRunningError`.

IMPLEMENTATION_FIX_REQUIRED