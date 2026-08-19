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

No type errors in the modified files. Here's a summary of all changes made:

---

## Changes implemented

**5 files modified**, addressing all 5 code-fixable issues from the review:

### `apps/api/src/db/schema/catalog-refresh-runs.ts`
- Removed the `RefreshCheckpoint` type (which was specific to REFRESH runs, not ENRICH_MISSING)
- Changed `checkpoint` column type from `$type<RefreshCheckpoint>()` to `$type<unknown>()` — honest about the fact that REFRESH and ENRICH_MISSING write structurally different checkpoint objects

### `apps/api/src/services/catalog-enrich-missing-service.ts`
- **`resumeRunId` option**: Added `resumeRunId?: string` to `EnrichMissingOptions`. When provided, `start()` reads the previous run's checkpoint and initializes `lastId` from it, so the cursor resumes from where the interrupted run left off
- **Race condition fix**: Wrapped the `INSERT ... RETURNING` in `start()` and `retryFailures()` in a try/catch for Postgres error code `23505` (unique constraint), translating it to a `RUN_CONFLICT` error → HTTP 409 instead of 500
- **Type**: Removed `as any` cast on `set({ checkpoint })` — now valid since the column type is `unknown`
- **`retrying` doc**: Added JSDoc clarifying it counts retry *attempts*, not unique items

### `apps/api/src/routes/catalog-enrich-missing.ts`
- Added `resumeRunId?: string` to the POST body type and passes it through to `service.start()`

### `apps/api/src/services/__tests__/t115-enrichment.test.ts`
- Renamed the misleading "cursor pagination" test to accurately reflect it tests `countEligible`
- Added a **genuine cursor pagination test** that actually runs `start()`, waits for async execute to complete (via the COMPLETED status update), and verifies two batch queries were made with `enrichMovie` called for each item in the first batch

### `apps/api/scripts/diagnose-db.mjs`
- Added `enrichment_failures` to the `tables` row-count list

---

## Review

Now I have all the information needed for a comprehensive review. Let me write it.

---

# PR Review — T115 Complete catalog enrichment / failure observability (attempt 15)

## Résumé

Depuis la review 14, le coder a adressé tous les points code identifiés comme bloquants ou significatifs : le `resumeRunId` implémente un vrai resume de curseur, la race condition est catchée pour renvoyer 409, le type `checkpoint` est `unknown`, le test de pagination est réel, `diagnose-db.mjs` inclut `enrichment_failures`. Le code est maintenant complet et correct.

**L'unique point bloquant restant est invariant depuis 13 cycles** : la règle de clôture du ticket exige une exécution contre le catalogue de production (~60k films / ~5k séries). Cet accès n'est pas disponible dans l'environnement de l'agent IA.

---

## Vérifications effectuées (diff commit 38b5d547)

### Fichiers modifiés dans le dernier commit

**`catalog-refresh-runs.ts`** — `checkpoint` passe de `$type<RefreshCheckpoint>()` à `$type<unknown>()`. Correct : REFRESH et ENRICH_MISSING écrivent des structures différentes ; `unknown` est honnête.

**`catalog-enrich-missing-service.ts`** :
- `resumeRunId?: string` dans `EnrichMissingOptions` (ligne 22)  
- `start()` ligne 155–170 : lit le checkpoint du run précédent par `resumeRunId`, initialise `lastId` depuis `prev.movies.lastId` / `prev.series.lastId`. C'est un resume réel de curseur — ✅ la limitation write-only est résolue
- Race condition : catch `23505` dans les deux blocs `INSERT ... RETURNING` (lignes 139–145, 401–408) → `RUN_CONFLICT` → HTTP 409. Correct
- JSDoc sur `retrying` clarifiée — ✅

**`catalog-enrich-missing.ts`** — `resumeRunId?: string` ajouté au body type et transmis au service — ✅

**`t115-enrichment.test.ts`** — test `countEligible` renommé correctement + vrai test de pagination curseur avec `start()` + attente COMPLETED + vérification des 2 batches et 2 appels `enrichMovie` — ✅ substantiel

**`diagnose-db.mjs`** — `enrichment_failures` ajouté à la liste des tables — ✅

---

## État des acceptance criteria (code)

| Critère | État |
|---|---|
| Real DB/API error capturé (pas "Failed query:...") | ✅ `persistFailure()` avec `errorClass`, `errorCode`, `errorMessage` réels |
| Normalisation TMDB (runtime=0, imdb_id="", overview whitespace) | ✅ `mapMovieDetail`/`mapSeriesDetail`, tests unitaires |
| Passe `enrich missing` explicite et resumable | ✅ `resumeRunId` implémenté, cursor GT-id, checkpoint par batch |
| Re-run progresse vers zéro (pas capped) | ✅ curseur `gt(table.id, lastId)` ORDER BY ASC, pas d'offset fixe |
| Terminal failures persistées/listables/retryables | ✅ table `enrichment_failures`, endpoints GET + POST retry |
| Admin stats complètes (complete/partial/missing/failed/remaining) | ✅ `catalog-stats.ts` : neverEnriched, partiallyEnriched, fullyEnriched, stale, failedLastEnrichment, embeddingEligible, embeddingPending |
| `embeddingPending` non hardcodé à 0 | ✅ NOT EXISTS réel sur `media_embeddings` |
| Eligibilité embedding explicite | ✅ `embedding-eligibility.ts` documenté |
| **Run sur catalogue production** | ❌ Exécution sur DB dev locale (6 films) uniquement |

---

## Problème restant

### 🔴 Bloquant — Production run non exécutée (inchangé depuis review 1)

La completion rule du ticket est explicite :

> *"Do not close after unit tests. Run the new enrichment mode against production (or an equivalent restored production snapshot), publish before/after counts, and show the remaining terminal failures with their real causes."*

Le fichier `production-run-20260819.md` (inchangé) documente un run sur 6 films locaux. L'artefact reconnaît que l'API de production (`api.iptvflix.com`) n'est pas joignable depuis l'environnement de l'agent, et que Fly.io n'est pas authentifié.

**Ce blocage est 100% infra/accès, pas code.** Tous les problèmes code ont été résolus.

**Pour débloquer** (trois options) :

- **Option A** : Fournir `DATABASE_URL` production → l'agent peut faire un `pg_dump`/restore local et exécuter le playbook
- **Option B** : `fly auth login` dans le terminal → l'agent peut faire `fly proxy` et exécuter directement
- **Option C** : Exécuter manuellement le playbook (`runs/T115/production-run-playbook.md`, 5 commandes) et coller la sortie — l'agent génère l'artefact

---

## Risques

- **Secrets** : non exposés dans les logs ou la documentation — ✅  
- **Destructivité** : `clearFailure()` efface les rows au succès — comportement attendu et documenté — ✅  
- **Rate limiting TMDB** : `fetchWithRetry` gère le 429 avec `Retry-After` — ✅

---

## Décision

L'implémentation est techniquement correcte et complète. Le seul bloquant est la validation finale sur le catalogue de production, requise par la completion rule du ticket. Ce blocage est un problème d'accès infrastructure, non résolvable par l'agent IA sans intervention humaine.

IMPLEMENTATION_FIX_REQUIRED

---

## Instructions de fix

# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T115/reviews/implementation-review.md
- generated at: 2026-08-19T16:05:26Z

---

Now I have all the information needed for a comprehensive review. Let me write it.

---

# PR Review — T115 Complete catalog enrichment / failure observability (attempt 15)

## Résumé

Depuis la review 14, le coder a adressé tous les points code identifiés comme bloquants ou significatifs : le `resumeRunId` implémente un vrai resume de curseur, la race condition est catchée pour renvoyer 409, le type `checkpoint` est `unknown`, le test de pagination est réel, `diagnose-db.mjs` inclut `enrichment_failures`. Le code est maintenant complet et correct.

**L'unique point bloquant restant est invariant depuis 13 cycles** : la règle de clôture du ticket exige une exécution contre le catalogue de production (~60k films / ~5k séries). Cet accès n'est pas disponible dans l'environnement de l'agent IA.

---

## Vérifications effectuées (diff commit 38b5d547)

### Fichiers modifiés dans le dernier commit

**`catalog-refresh-runs.ts`** — `checkpoint` passe de `$type<RefreshCheckpoint>()` à `$type<unknown>()`. Correct : REFRESH et ENRICH_MISSING écrivent des structures différentes ; `unknown` est honnête.

**`catalog-enrich-missing-service.ts`** :
- `resumeRunId?: string` dans `EnrichMissingOptions` (ligne 22)  
- `start()` ligne 155–170 : lit le checkpoint du run précédent par `resumeRunId`, initialise `lastId` depuis `prev.movies.lastId` / `prev.series.lastId`. C'est un resume réel de curseur — ✅ la limitation write-only est résolue
- Race condition : catch `23505` dans les deux blocs `INSERT ... RETURNING` (lignes 139–145, 401–408) → `RUN_CONFLICT` → HTTP 409. Correct
- JSDoc sur `retrying` clarifiée — ✅

**`catalog-enrich-missing.ts`** — `resumeRunId?: string` ajouté au body type et transmis au service — ✅

**`t115-enrichment.test.ts`** — test `countEligible` renommé correctement + vrai test de pagination curseur avec `start()` + attente COMPLETED + vérification des 2 batches et 2 appels `enrichMovie` — ✅ substantiel

**`diagnose-db.mjs`** — `enrichment_failures` ajouté à la liste des tables — ✅

---

## État des acceptance criteria (code)

| Critère | État |
|---|---|
| Real DB/API error capturé (pas "Failed query:...") | ✅ `persistFailure()` avec `errorClass`, `errorCode`, `errorMessage` réels |
| Normalisation TMDB (runtime=0, imdb_id="", overview whitespace) | ✅ `mapMovieDetail`/`mapSeriesDetail`, tests unitaires |
| Passe `enrich missing` explicite et resumable | ✅ `resumeRunId` implémenté, cursor GT-id, checkpoint par batch |
| Re-run progresse vers zéro (pas capped) | ✅ curseur `gt(table.id, lastId)` ORDER BY ASC, pas d'offset fixe |
| Terminal failures persistées/listables/retryables | ✅ table `enrichment_failures`, endpoints GET + POST retry |
| Admin stats complètes (complete/partial/missing/failed/remaining) | ✅ `catalog-stats.ts` : neverEnriched, partiallyEnriched, fullyEnriched, stale, failedLastEnrichment, embeddingEligible, embeddingPending |
| `embeddingPending` non hardcodé à 0 | ✅ NOT EXISTS réel sur `media_embeddings` |
| Eligibilité embedding explicite | ✅ `embedding-eligibility.ts` documenté |
| **Run sur catalogue production** | ❌ Exécution sur DB dev locale (6 films) uniquement |

---

## Problème restant

### 🔴 Bloquant — Production run non exécutée (inchangé depuis review 1)

La completion rule du ticket est explicite :

> *"Do not close after unit tests. Run the new enrichment mode against production (or an equivalent restored production snapshot), publish before/after counts, and show the remaining terminal failures with their real causes."*

Le fichier `production-run-20260819.md` (inchangé) documente un run sur 6 films locaux. L'artefact reconnaît que l'API de production (`api.iptvflix.com`) n'est pas joignable depuis l'environnement de l'agent, et que Fly.io n'est pas authentifié.

**Ce blocage est 100% infra/accès, pas code.** Tous les problèmes code ont été résolus.

**Pour débloquer** (trois options) :

- **Option A** : Fournir `DATABASE_URL` production → l'agent peut faire un `pg_dump`/restore local et exécuter le playbook
- **Option B** : `fly auth login` dans le terminal → l'agent peut faire `fly proxy` et exécuter directement
- **Option C** : Exécuter manuellement le playbook (`runs/T115/production-run-playbook.md`, 5 commandes) et coller la sortie — l'agent génère l'artefact

---

## Risques

- **Secrets** : non exposés dans les logs ou la documentation — ✅  
- **Destructivité** : `clearFailure()` efface les rows au succès — comportement attendu et documenté — ✅  
- **Rate limiting TMDB** : `fetchWithRetry` gère le 429 avec `Retry-After` — ✅

---

## Décision

L'implémentation est techniquement correcte et complète. Le seul bloquant est la validation finale sur le catalogue de production, requise par la completion rule du ticket. Ce blocage est un problème d'accès infrastructure, non résolvable par l'agent IA sans intervention humaine.

IMPLEMENTATION_FIX_REQUIRED