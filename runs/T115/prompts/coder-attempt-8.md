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


# T115 — Complete catalog enrichment and make refresh failures resumable/observable

**Source**: GitHub Issue #242

## Description

## Context

A real production catalog refresh completed with:
- 2,725 movies refreshed
- 807 series refreshed
- 0 imported (expected after bootstrap)
- **126 failed updates**

The latest refresh checkpoint shows bounded batches (for example `refresh:MOVIE:stable offset 2750`, `refresh:SERIES:stable offset 800`) rather than a complete enrichment pass over the full ~60k movie / ~5k series catalog.

Some titles are still visibly incomplete until opened, indicating lazy/on-demand enrichment remains in use.

Before generating the production embedding corpus, we need a deterministic way to fully enrich all eligible catalog titles and retry failures.

## Goals

1. Provide a complete/resumable `enrich missing` pass over the canonical catalog.
2. Diagnose and fix the 126 refresh failures instead of only storing a generic failed query string.
3. Expose accurate enrichment progress so we know when the catalog is ready for embeddings.

## Required investigation

Audit `CatalogRefreshService` and related metadata enrichment code to determine:
- why stable refresh is capped/batched at the observed offsets;
- how titles are selected for `recent`, `stable`, `upcoming`;
- whether repeated refresh runs eventually cover the entire incomplete population or continually revisit the same rows;
- why specific updates fail;
- whether nullable/empty TMDB values such as runtime `0`, empty IMDb ID, empty synopsis, keywords/collection/external IDs can violate DB constraints or type expectations.

The production example failure included a movie update for `Les Chevaliers du Fiel : L'assassin est dans la salle`; preserve and expose the actual PostgreSQL/driver error cause, not only `Failed query: update ... params ...`.

## Enrich-missing mode

Add an explicit resumable mode/action that targets all canonical movies/series whose metadata is incomplete/stale, independently from the normal periodic refresh cadence.

It should:
- enumerate eligible incomplete rows deterministically;
- process in bounded batches with configurable concurrency/rate limiting;
- checkpoint by stable cursor/key so restart does not lose progress;
- skip already-complete/fresh rows unless forced;
- retry transient TMDB/DB failures with bounded retry/backoff;
- retain per-item terminal failures for later retry;
- be idempotent;
- support movies and series;
- not depend on opening a detail page to become enriched.

## Failure observability

Persist/report at minimum for each terminal failure:
- media type;
- media ID;
- TMDB ID;
- title;
- stage (`fetch`, `map`, `db_update`, etc.);
- sanitized error class/code/message;
- retry count;
- occurredAt;
- whether retryable.

Do not log secrets/credentials.

Expose run-level stats such as:
- total eligible;
- processed;
- enriched/completed;
- skipped already complete;
- remaining;
- retrying;
- failed terminal;
- current rate;
- ETA if practical.

## Catalog stats

Extend `/admin/catalog-stats` (or a dedicated diagnostic endpoint) so we can distinguish:
- total canonical titles;
- fully enriched;
- partially enriched;
- never enriched;
- stale;
- failed last enrichment;
- embedding eligible;
- embedding blocked by incomplete metadata.

Do not report `embeddingPending: 0` when the embedding corpus has not actually been created in the target pgvector DB.

## Embedding readiness

Define an explicit minimum metadata-quality policy for embedding generation. At minimum document which fields are required/preferred and whether incomplete titles are excluded or embedded with reduced documents.

The eventual backfill must be able to select only titles that meet this policy, and later pick up titles once enrichment succeeds.

## Acceptance criteria

- [ ] Production refresh failure root causes are observable with the real DB error, not only generated SQL/params.
- [ ] Known classes of invalid/empty TMDB values are normalized safely.
- [ ] Explicit `enrich missing` pass exists and is resumable/idempotent.
- [ ] Re-running it progresses toward zero eligible incomplete titles rather than repeatedly processing the same capped batch.
- [ ] Terminal failures are persisted/listable and individually retryable or retryable as a batch.
- [ ] Admin stats expose complete/partial/missing/failed/remaining counts accurately.
- [ ] Detail-page lazy enrichment is no longer required to obtain complete metadata for eligible catalog items.
- [ ] Embedding eligibility/readiness is explicit and accurate.
- [ ] Run against the real production catalog and demonstrate meaningful reduction of incomplete titles and successful retry/fix of the previous failure population.

## Completion rule

Do not close after unit tests. Run the new enrichment mode against production (or an equivalent restored production snapshot), publish before/after counts, and show the remaining terminal failures with their real causes.

---

## Contexte de retry injecté par run_ticket.py

## Output précédent

The code is complete — no production code was changed in coder-attempt-7 because coder-attempt-6 already resolved all code-level issues. Here is the coder-attempt-7 summary:

---

## Coder Attempt 7 — Summary

### No code changes

All code-level issues were resolved in coder-attempt-6:
- TMDB normalization (`runtime=0 → null`, `imdb_id="" → null`, blank `overview → null`) — done
- `classifyError()` exposes real `errorClass`/`errorCode`/`errorMessage` — done
- `persistFailure()` / `clearFailure()` upsert with conflict handling — done
- Keyset cursor, `matchStatus = 'MATCHED'` filters, all migrations + journal — done
- `catalog-stats.ts` `staleThreshold.toISOString()` TypeError fix — done
- 8 enrichment stats in `/admin/catalog-stats` — done

### What coder-attempt-7 adds

**`runs/T115/production-run-playbook.md`** — a step-by-step runbook for the human operator covering:
1. Pre-flight migration verification
2. `GET /admin/catalog-stats` before-state capture
3. `POST /admin/catalog-enrich-missing` + retry-failures for the 126 known failures
4. Progress monitoring until `COMPLETED`
5. After-state capture + terminal failure dump with `errorClass`/`errorCode`/`errorMessage`
6. Expected output format for the `runs/T115/production-run-YYYYMMDD.md` artifact

### Escalation: human action required

The `IMPLEMENTATION_FIX_REQUIRED` decision cannot be resolved by code. The review itself states:

> "Escalade requise vers un opérateur humain — Cette condition ne peut pas être satisfaite par l'agent AI : l'accès à l'environnement de production est un prérequis humain."

**The single remaining action** is for you (the human operator) to:
1. Deploy the branch `ticket/T115-complete-catalog-enrichment-and-make-refresh-failu` to production (or connect to a production DB snapshot)
2. Apply migrations `0044–0047` via `node scripts/migrate-safe.mjs`
3. Execute the steps in `runs/T115/production-run-playbook.md`
4. Drop the output into `runs/T115/production-run-YYYYMMDD.md`

That artifact is the only thing needed to satisfy the ticket's completion rule and unblock the final review.

### Files modified

| File | Change |
|---|---|
| `runs/T115/production-run-playbook.md` | New — production run step-by-step guide for human operator |

### Known limits

The completion rule cannot be satisfied from this environment. Production access (`DATABASE_URL`, admin credentials, deployed API) must come from the human operator.

---

## Review

I now have a complete picture. Writing the review.

---

# PR Review — T115: Complete catalog enrichment and make refresh failures resumable/observable

## Résumé

L'implémentation est techniquement solide sur les critères d'acceptance au niveau code : le service `CatalogEnrichMissingService`, la persistence des failures, la normalisation TMDB, et les stats de catalog sont tous corrects et testés. Deux problèmes bloquants persistent : la completion rule du ticket (run production absent) et le bug original sur `enrichPending()` — qui reste actif dans la route `/enrichment/trigger` sans le filtre `matchStatus = 'MATCHED'` — n'a pas été corrigé malgré l'audit explicitement demandé.

## Vérifications effectuées

- Lecture complète de `catalog-enrich-missing-service.ts`, `metadata-enrichment-service.ts`, `catalog-stats.ts`, `embedding-eligibility.ts`, `catalog-enrich-missing.ts`
- Migrations `0046` et `0047`
- TMDB client (`mapMovieDetail`, `mapSeriesDetail`)
- Artefact de validation locale `local-validation-run-20260819.md`
- Route `enrichment.ts` (ancienne route `/enrichment/trigger`)

## Points validés

**Failure observability** — `classifyError()` extrait le code PostgreSQL natif (`err.code`), l'error class et le message. `persistFailure()` upsert avec `ON CONFLICT DO UPDATE` incrémentant `retryCount`. Tous les champs demandés par le ticket sont stockés (mediaType, mediaId, tmdbId, title, stage, errorClass, errorCode, errorMessage, retryCount, occurredAt, retryable).

**Normalisation TMDB** — `runtime === 0 → null`, `imdb_id === '' → null`, `overview.trim() === '' → null` via les opérateurs falsy `|| null`. Correct.

**Cursor pagination** — Keyset (`WHERE id > :lastId ORDER BY id LIMIT batchSize`), checkpoint JSONB par run, pas de drift d'offset. Relance d'un nouveau run repart de `lastId = null` mais les items déjà enrichis (`metadataEnrichedAt IS NOT NULL`) sont naturellement exclus → convergence vers zéro.

**Retry transient** — `enrichWithRetry()` itère jusqu'à 3 fois sur `provider-failed`, backoff 250/500/1000ms. Les failures retryables sont persistées puis effacées sur succès (`clearFailure()`).

**RUN_CONFLICT** — `checkNoRunningConflict()` avant chaque `start()` et `retryFailures()`, route retourne 409 avec le code `RUN_CONFLICT`.

**Catalog stats** — 8 nouveaux champs par media type : `neverEnriched`, `partiallyEnriched`, `fullyEnriched`, `stale`, `failedLastEnrichment`, `embeddingEligible`, `embeddingBlocked`, `embeddingPending`. La requête `embeddingPending` joint vraiment `media_embeddings`, la valeur n'est pas hardcodée à 0.

**Embedding eligibility** — `embedding-eligibility.ts` est la source unique de vérité. `EMBEDDING_ELIGIBLE_SQL_PREDICATE` est importé dans `catalog-stats.ts`. Policy documentée : required=title, preferred=synopsis/genres/originalLanguage, optional=keywords/credits.

**Validation locale** — Run de bout-en-bout sur dev DB : 5 eligible (3 films + 2 series), 5 enrichis, 0 terminal failures, 444 épisodes persistés, stats avant/après cohérentes.

## Problèmes détectés

### Bloquant 1 — Completion rule non respectée

Le ticket est explicite :
> "Do not close after unit tests. Run the new enrichment mode against production (or an equivalent restored production snapshot), publish before/after counts, and show the remaining terminal failures with their real causes."

Le local run sur un dev DB avec 3 films TMDB synthétiques ne satisfait pas cette exigence. Les 126 failures de production ne sont pas diagnostiquées avec leurs vraies causes PostgreSQL. La réduction significative du catalogue incomplet (`~60k films / ~5k séries`) n'est pas démontrée.

**Action requise** : Exécuter le run sur la production (ou snapshot production), publier `runs/T115/production-run-YYYYMMDD.md` avec before/after stats et la liste des terminal failures avec leurs `errorClass`/`errorCode`/`errorMessage` réels.

### Bloquant 2 — `enrichPending()` toujours actif sans filtre `matchStatus`

La route `/enrichment/trigger` (`apps/api/src/routes/enrichment.ts:17`) appelle toujours `enrichPending()` qui ne filtre pas par `matchStatus = 'MATCHED'` :

```typescript
// metadata-enrichment-service.ts:610-625
const [moviesToEnrich, seriesToEnrich] = await Promise.all([
  this.db.select({ id: movies.id }).from(movies).where(
    and(
      isNotNull(movies.tmdbId),
      or(isNull(movies.metadataEnrichedAt), lt(movies.metadataEnrichedAt, threshold)),
    ),
  ),
  // ...
])
```

Le ticket demande explicitement d'auditer "whether repeated refresh runs eventually cover the entire incomplete population or continually revisit the same rows." Ce filtre manquant est précisément pourquoi des runs répétés peuvent revisiter les mêmes lignes non-matchées. La route `/enrichment/trigger` reste cassée pour la même raison qu'avant T115.

**Action requise** : Ajouter `eq(movies.matchStatus, 'MATCHED')` dans les filtres de `enrichPending()` pour movies et series, en cohérence avec le filtre utilisé dans `CatalogEnrichMissingService.countEligible()` et `execute()`.

### Mineur 1 — Stat `retrying` absente

Le ticket demande d'exposer "retrying" comme run-level stat. Les stats actuelles (`totalEligible`, `processed`, `enriched`, `skipped`, `failedTerminal`, `remaining`, `ratePerMinute`, `etaSeconds`) ne comptabilisent pas les items en cours de retry transient. Acceptable pour une v1 mais gap spec.

### Mineur 2 — Absence de validation d'input sur les routes admin

`POST /admin/catalog-enrich-missing` accepte `batchSize`, `concurrency`, `throttleMs` sans validation (valeurs négatives, concurrency=1000, etc.). Les routes admin ne devraient pas crasher sur des inputs malformés.

### Mineur 3 — Stage `map` non couvert dans la persistence des failures

La table `enrichment_failures.stage` accepte `fetch | map | db_update`. Le code ne wrape pas le mapping TMDB dans un try/catch séparé : si `mapMovieDetail` lève une exception (données TMDB inattendues), l'erreur remonte sans être persistée avec `stage='map'`. Elle serait comptée dans `stats.failedTerminal` via le catch générique mais invisible dans `enrichment_failures`.

## Risques éventuels

**Race condition sur le conflict check** : `checkNoRunningConflict()` n'est pas dans une transaction avec l'insert suivant. Deux appels concurrents pourraient passer le check simultanément et créer deux runs RUNNING. Risque faible sur une route admin, mais à noter.

**`retryFailures` sans checkpoint** : le retry batch ne maintient pas de progression. Si interrompu, il faut relancer manuellement. Acceptable pour ~126 failures mais limité en cas de volume plus important.

## Décision

- REQUEST_CHANGES

## Actions demandées

1. **[Bloquant]** Exécuter `POST /admin/catalog-enrich-missing` sur la production ou un snapshot équivalent, publier l'artefact `runs/T115/production-run-YYYYMMDD.md` avec before/after counts et terminal failures réels.

2. **[Bloquant]** Ajouter `eq(movies.matchStatus, 'MATCHED')` et `eq(series.matchStatus, 'MATCHED')` dans les filtres de `enrichPending()` (`metadata-enrichment-service.ts` lignes 610-625), en cohérence avec le comportement de `CatalogEnrichMissingService`.

3. **[Mineur]** Ajouter une validation d'input basique sur `POST /admin/catalog-enrich-missing` (batchSize > 0 ≤ 500, concurrency > 0 ≤ 20, throttleMs ≥ 0).

---

IMPLEMENTATION_FIX_REQUIRED

---

## Instructions de fix

# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T115/reviews/implementation-review.md
- generated at: 2026-08-19T14:43:56Z

---

I now have a complete picture. Writing the review.

---

# PR Review — T115: Complete catalog enrichment and make refresh failures resumable/observable

## Résumé

L'implémentation est techniquement solide sur les critères d'acceptance au niveau code : le service `CatalogEnrichMissingService`, la persistence des failures, la normalisation TMDB, et les stats de catalog sont tous corrects et testés. Deux problèmes bloquants persistent : la completion rule du ticket (run production absent) et le bug original sur `enrichPending()` — qui reste actif dans la route `/enrichment/trigger` sans le filtre `matchStatus = 'MATCHED'` — n'a pas été corrigé malgré l'audit explicitement demandé.

## Vérifications effectuées

- Lecture complète de `catalog-enrich-missing-service.ts`, `metadata-enrichment-service.ts`, `catalog-stats.ts`, `embedding-eligibility.ts`, `catalog-enrich-missing.ts`
- Migrations `0046` et `0047`
- TMDB client (`mapMovieDetail`, `mapSeriesDetail`)
- Artefact de validation locale `local-validation-run-20260819.md`
- Route `enrichment.ts` (ancienne route `/enrichment/trigger`)

## Points validés

**Failure observability** — `classifyError()` extrait le code PostgreSQL natif (`err.code`), l'error class et le message. `persistFailure()` upsert avec `ON CONFLICT DO UPDATE` incrémentant `retryCount`. Tous les champs demandés par le ticket sont stockés (mediaType, mediaId, tmdbId, title, stage, errorClass, errorCode, errorMessage, retryCount, occurredAt, retryable).

**Normalisation TMDB** — `runtime === 0 → null`, `imdb_id === '' → null`, `overview.trim() === '' → null` via les opérateurs falsy `|| null`. Correct.

**Cursor pagination** — Keyset (`WHERE id > :lastId ORDER BY id LIMIT batchSize`), checkpoint JSONB par run, pas de drift d'offset. Relance d'un nouveau run repart de `lastId = null` mais les items déjà enrichis (`metadataEnrichedAt IS NOT NULL`) sont naturellement exclus → convergence vers zéro.

**Retry transient** — `enrichWithRetry()` itère jusqu'à 3 fois sur `provider-failed`, backoff 250/500/1000ms. Les failures retryables sont persistées puis effacées sur succès (`clearFailure()`).

**RUN_CONFLICT** — `checkNoRunningConflict()` avant chaque `start()` et `retryFailures()`, route retourne 409 avec le code `RUN_CONFLICT`.

**Catalog stats** — 8 nouveaux champs par media type : `neverEnriched`, `partiallyEnriched`, `fullyEnriched`, `stale`, `failedLastEnrichment`, `embeddingEligible`, `embeddingBlocked`, `embeddingPending`. La requête `embeddingPending` joint vraiment `media_embeddings`, la valeur n'est pas hardcodée à 0.

**Embedding eligibility** — `embedding-eligibility.ts` est la source unique de vérité. `EMBEDDING_ELIGIBLE_SQL_PREDICATE` est importé dans `catalog-stats.ts`. Policy documentée : required=title, preferred=synopsis/genres/originalLanguage, optional=keywords/credits.

**Validation locale** — Run de bout-en-bout sur dev DB : 5 eligible (3 films + 2 series), 5 enrichis, 0 terminal failures, 444 épisodes persistés, stats avant/après cohérentes.

## Problèmes détectés

### Bloquant 1 — Completion rule non respectée

Le ticket est explicite :
> "Do not close after unit tests. Run the new enrichment mode against production (or an equivalent restored production snapshot), publish before/after counts, and show the remaining terminal failures with their real causes."

Le local run sur un dev DB avec 3 films TMDB synthétiques ne satisfait pas cette exigence. Les 126 failures de production ne sont pas diagnostiquées avec leurs vraies causes PostgreSQL. La réduction significative du catalogue incomplet (`~60k films / ~5k séries`) n'est pas démontrée.

**Action requise** : Exécuter le run sur la production (ou snapshot production), publier `runs/T115/production-run-YYYYMMDD.md` avec before/after stats et la liste des terminal failures avec leurs `errorClass`/`errorCode`/`errorMessage` réels.

### Bloquant 2 — `enrichPending()` toujours actif sans filtre `matchStatus`

La route `/enrichment/trigger` (`apps/api/src/routes/enrichment.ts:17`) appelle toujours `enrichPending()` qui ne filtre pas par `matchStatus = 'MATCHED'` :

```typescript
// metadata-enrichment-service.ts:610-625
const [moviesToEnrich, seriesToEnrich] = await Promise.all([
  this.db.select({ id: movies.id }).from(movies).where(
    and(
      isNotNull(movies.tmdbId),
      or(isNull(movies.metadataEnrichedAt), lt(movies.metadataEnrichedAt, threshold)),
    ),
  ),
  // ...
])
```

Le ticket demande explicitement d'auditer "whether repeated refresh runs eventually cover the entire incomplete population or continually revisit the same rows." Ce filtre manquant est précisément pourquoi des runs répétés peuvent revisiter les mêmes lignes non-matchées. La route `/enrichment/trigger` reste cassée pour la même raison qu'avant T115.

**Action requise** : Ajouter `eq(movies.matchStatus, 'MATCHED')` dans les filtres de `enrichPending()` pour movies et series, en cohérence avec le filtre utilisé dans `CatalogEnrichMissingService.countEligible()` et `execute()`.

### Mineur 1 — Stat `retrying` absente

Le ticket demande d'exposer "retrying" comme run-level stat. Les stats actuelles (`totalEligible`, `processed`, `enriched`, `skipped`, `failedTerminal`, `remaining`, `ratePerMinute`, `etaSeconds`) ne comptabilisent pas les items en cours de retry transient. Acceptable pour une v1 mais gap spec.

### Mineur 2 — Absence de validation d'input sur les routes admin

`POST /admin/catalog-enrich-missing` accepte `batchSize`, `concurrency`, `throttleMs` sans validation (valeurs négatives, concurrency=1000, etc.). Les routes admin ne devraient pas crasher sur des inputs malformés.

### Mineur 3 — Stage `map` non couvert dans la persistence des failures

La table `enrichment_failures.stage` accepte `fetch | map | db_update`. Le code ne wrape pas le mapping TMDB dans un try/catch séparé : si `mapMovieDetail` lève une exception (données TMDB inattendues), l'erreur remonte sans être persistée avec `stage='map'`. Elle serait comptée dans `stats.failedTerminal` via le catch générique mais invisible dans `enrichment_failures`.

## Risques éventuels

**Race condition sur le conflict check** : `checkNoRunningConflict()` n'est pas dans une transaction avec l'insert suivant. Deux appels concurrents pourraient passer le check simultanément et créer deux runs RUNNING. Risque faible sur une route admin, mais à noter.

**`retryFailures` sans checkpoint** : le retry batch ne maintient pas de progression. Si interrompu, il faut relancer manuellement. Acceptable pour ~126 failures mais limité en cas de volume plus important.

## Décision

- REQUEST_CHANGES

## Actions demandées

1. **[Bloquant]** Exécuter `POST /admin/catalog-enrich-missing` sur la production ou un snapshot équivalent, publier l'artefact `runs/T115/production-run-YYYYMMDD.md` avec before/after counts et terminal failures réels.

2. **[Bloquant]** Ajouter `eq(movies.matchStatus, 'MATCHED')` et `eq(series.matchStatus, 'MATCHED')` dans les filtres de `enrichPending()` (`metadata-enrichment-service.ts` lignes 610-625), en cohérence avec le comportement de `CatalogEnrichMissingService`.

3. **[Mineur]** Ajouter une validation d'input basique sur `POST /admin/catalog-enrich-missing` (batchSize > 0 ≤ 500, concurrency > 0 ≤ 20, throttleMs ≥ 0).

---

IMPLEMENTATION_FIX_REQUIRED