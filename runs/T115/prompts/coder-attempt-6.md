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

No TypeScript errors. The fix is clean.

**What changed** — one file, two locations in `catalog-enrich-missing-service.ts`:

- **`countEligible()` (line 104–108)**: replaced the `force ? isNotNull(...) : and(...)` ternary with a single unified `and(...)` expression that always includes `eq(table.matchStatus, 'MATCHED')` and conditionally omits the stale-threshold check when `force=true`.

- **`execute()` (line 204–209)**: same pattern — unified `and(...)` keeping `matchStatus = 'MATCHED'` unconditionally, stale threshold gated by `force`.

**Why not touching `enrichWithRetry`**: the current code already handles the optional concern correctly — `enrichMovie`/`enrichSeries` already return `'terminal-failed'` (not `'provider-failed'`) for non-transient errors, and `enrichWithRetry`'s `if (result !== 'provider-failed') return result` guard exits immediately on `'terminal-failed'`. No retries occur on non-transient failures.

**Remaining blocker** (non-code): the production run artifact (`POST /admin/catalog-enrich-missing` → before/after stats + failure list) still needs to be executed and deposited in `runs/T115/`. That requires access to the production environment.

---

## Review

I have a complete picture of the current state. Let me write the review.

---

# PR Review — T115: Complete catalog enrichment and make refresh failures resumable/observable

## Résumé

Ceci est la 5ème review (attempt 5). Les deux blockers identifiés lors de la review précédente ont été traités différemment : le bug de code `force=true` supprimant le filtre `matchStatus = 'MATCHED'` a été corrigé et vérifié dans le code actuel. L'item optionnel (`terminal-failed` vs `provider-failed`) a également été implémenté. **La condition bloquante de completion rule (exécution production) reste non satisfaite**, aucun artefact de run réel n'étant présent dans `runs/T115/`.

## Vérifications effectuées

- `apps/api/src/providers/metadata/tmdb/client.ts` — normalisations `mapMovieDetail()` / `mapSeriesDetail()`
- `apps/api/src/db/schema/enrichment-failures.ts` + migrations `0045` et `0046`
- `apps/api/src/services/metadata-enrichment-service.ts` — `classifyError`, `persistFailure`, `clearFailure`, `enrichMovie`, `enrichSeries`
- `apps/api/src/services/catalog-enrich-missing-service.ts` — curseur keyset, retry, checkpoint, `countEligible`, `execute`, `retryFailures`
- `apps/api/src/routes/catalog-enrich-missing.ts` — 4 routes admin
- `apps/api/src/routes/catalog-stats.ts` — nouvelles métriques
- `apps/api/src/services/embedding-eligibility.ts`
- `runs/T115/` — artefacts d'exécution

## Points validés

**Normalisation TMDB** (`client.ts:53,58,59,94-95`)
- `raw.runtime || null` → `durationMinutes: null` pour runtime=0 ✓
- `raw.imdb_id || null` → `imdbId: null` pour chaîne vide ✓
- `raw.overview?.trim() || null` → `synopsis: null` pour overview blanc, dans les deux mappers ✓

**Fix bloquant review 4 — `force=true` préserve `matchStatus = 'MATCHED'`**

`catalog-enrich-missing-service.ts:104–108` (`countEligible`) et `204–209` (`execute`) :
```typescript
const where = and(
  isNotNull(table.tmdbId),
  eq(table.matchStatus, 'MATCHED'),            // ← présent inconditionnellement ✓
  force ? undefined : or(isNull(table.metadataEnrichedAt), lt(table.metadataEnrichedAt, threshold)),
)
```
Les items `PENDING` / `UNMATCHED` sont correctement exclus, que `force=true` ou non. ✓

**Fix optionnel review 4 — distinction `terminal-failed` / `provider-failed`**

- `persistFailure()` retourne `{ retryable: boolean }` ✓
- `enrichMovie` / `enrichSeries` retournent `'terminal-failed'` pour les erreurs non-transientes, `'provider-failed'` pour les transientes ✓
- `enrichWithRetry` court-circuite immédiatement sur `'terminal-failed'` via le guard `if (result !== 'provider-failed') return result` ✓ — aucun appel supplémentaire inutile

**Persistance des échecs** (`metadata-enrichment-service.ts:48–135`)
- `classifyError()` extrait le vrai `error.constructor.name`, `.code`, `.message` — plus de SQL généré ✓
- Upsert `ON CONFLICT` incrémente `retryCount` et met à jour `occurredAt` ✓
- `clearFailure()` appelé sur succès pour movies (`line:288`) et series ✓

**Service enrich-missing**
- Keyset cursor `WHERE id > :lastId ORDER BY id LIMIT batchSize` — aucun drift, 100% resumable ✓
- `checkNoRunningConflict()` appelé dans `start()` et `retryFailures()` — conflit 409 systématique ✓
- `retryFailures()` utilise `runWithConcurrency` ✓
- Checkpoint JSONB sauvegardé après chaque batch ✓

**Catalog stats** (`catalog-stats.ts`)
- 8 nouvelles métriques : `neverEnriched`, `partiallyEnriched`, `fullyEnriched`, `stale`, `failedLastEnrichment`, `embeddingEligible`, `embeddingBlocked`, `embeddingPending` ✓
- `embeddingPending` via `NOT EXISTS (SELECT 1 FROM media_embeddings ...)` — plus de 0 hardcodé ✓
- `EMBEDDING_ELIGIBLE_SQL_PREDICATE` importé depuis `embedding-eligibility.ts` — source unique ✓

**Migrations**
- `0045_t115_enrichment_failures.sql` — table + unique index `(media_type, media_id)` ✓
- `0046_t115_catalog_refresh_runs_type.sql` — colonne `type` avec DEFAULT `'REFRESH'`, idempotent ✓

## Problème bloquant

### BLOQUANT — Completion rule non satisfaite (inchangée depuis review 4)

Le ticket stipule explicitement, dans la section **Completion rule** ET dans les **Acceptance criteria** :

> **Do not close after unit tests. Run the new enrichment mode against production (or an equivalent restored production snapshot), publish before/after counts, and show the remaining terminal failures with their real causes.**

> - Run against the real production catalog and demonstrate meaningful reduction of incomplete titles and successful retry/fix of the previous failure population.

Aucun artefact de run réel n'est présent dans `runs/T115/`. L'ensemble des fichiers présents sont : ticket, plan, prompts/fixes de review, et un fichier `implementation-output.md` qui confirme explicitement que "le point bloquant restant" est l'exécution production.

Cette condition n'est pas une obligation de documentation optionnelle — elle est listée comme critère d'acceptance du ticket. Les tests unitaires existants (normalization, persistFailure, cursor pagination, enrichMovie failure) ne la remplacent pas.

**Action requise :** exécuter `POST /admin/catalog-enrich-missing` (ou déployer sur un snapshot production), capturer :
1. `GET /admin/catalog-stats` — before/after (neverEnriched, failedLastEnrichment, embeddingEligible)
2. `GET /admin/catalog-enrich-missing/status` — stats finales du run
3. `GET /admin/catalog-enrich-missing/failures` — liste des échecs terminaux avec causes réelles

Déposer ces artefacts JSON dans `runs/T115/production-run-YYYYMMDD.md` ou équivalent.

## Observations mineures

**`retrying` stat absente** — Le ticket demande cette métrique dans le run-level stats. `EnrichWithRetry` opère de façon synchrone au sein du batch ; la valeur serait toujours 0 entre deux snapshots checkpoint. La stat est structurellement non observable à ce niveau de granularité. Acceptable tel quel mais devrait être documenté comme limitation connue ou retiré de la spécification.

**`embeddingBlocked` structurellement 0** — La politique d'éligibilité embedding est `metadataEnrichedAt IS NOT NULL`, identique à la définition de "enriched". `embeddingBlocked = enrichedCount - eligibleCount` sera toujours 0 tant qu'aucun critère supplémentaire n'est ajouté. Un commentaire est présent dans `catalog-stats.ts` — suffisant pour l'instant.

## Risques

- `totalEligible` figé au démarrage : si de nouvelles rows deviennent éligibles pendant l'exécution, l'ETA dérive. Acceptable pour un estimatif.
- La migration `0045` entre en conflit avec `0045_t114_...` (deux fichiers avec le même préfixe `0045`). À vérifier que l'outil de migration gère correctement la numérotation — si non, une renommage de `0045_t115_enrichment_failures.sql` en `0047_t115_enrichment_failures.sql` serait nécessaire.

## Décision

Le code est correct sur tous les points techniques. Un seul blocker subsiste : l'exécution réelle contre la production n'a pas été réalisée, ce qui est un critère d'acceptance explicite du ticket.

IMPLEMENTATION_FIX_REQUIRED

---

## Instructions de fix

# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T115/reviews/implementation-review.md
- generated at: 2026-08-19T14:18:08Z

---

I have a complete picture of the current state. Let me write the review.

---

# PR Review — T115: Complete catalog enrichment and make refresh failures resumable/observable

## Résumé

Ceci est la 5ème review (attempt 5). Les deux blockers identifiés lors de la review précédente ont été traités différemment : le bug de code `force=true` supprimant le filtre `matchStatus = 'MATCHED'` a été corrigé et vérifié dans le code actuel. L'item optionnel (`terminal-failed` vs `provider-failed`) a également été implémenté. **La condition bloquante de completion rule (exécution production) reste non satisfaite**, aucun artefact de run réel n'étant présent dans `runs/T115/`.

## Vérifications effectuées

- `apps/api/src/providers/metadata/tmdb/client.ts` — normalisations `mapMovieDetail()` / `mapSeriesDetail()`
- `apps/api/src/db/schema/enrichment-failures.ts` + migrations `0045` et `0046`
- `apps/api/src/services/metadata-enrichment-service.ts` — `classifyError`, `persistFailure`, `clearFailure`, `enrichMovie`, `enrichSeries`
- `apps/api/src/services/catalog-enrich-missing-service.ts` — curseur keyset, retry, checkpoint, `countEligible`, `execute`, `retryFailures`
- `apps/api/src/routes/catalog-enrich-missing.ts` — 4 routes admin
- `apps/api/src/routes/catalog-stats.ts` — nouvelles métriques
- `apps/api/src/services/embedding-eligibility.ts`
- `runs/T115/` — artefacts d'exécution

## Points validés

**Normalisation TMDB** (`client.ts:53,58,59,94-95`)
- `raw.runtime || null` → `durationMinutes: null` pour runtime=0 ✓
- `raw.imdb_id || null` → `imdbId: null` pour chaîne vide ✓
- `raw.overview?.trim() || null` → `synopsis: null` pour overview blanc, dans les deux mappers ✓

**Fix bloquant review 4 — `force=true` préserve `matchStatus = 'MATCHED'`**

`catalog-enrich-missing-service.ts:104–108` (`countEligible`) et `204–209` (`execute`) :
```typescript
const where = and(
  isNotNull(table.tmdbId),
  eq(table.matchStatus, 'MATCHED'),            // ← présent inconditionnellement ✓
  force ? undefined : or(isNull(table.metadataEnrichedAt), lt(table.metadataEnrichedAt, threshold)),
)
```
Les items `PENDING` / `UNMATCHED` sont correctement exclus, que `force=true` ou non. ✓

**Fix optionnel review 4 — distinction `terminal-failed` / `provider-failed`**

- `persistFailure()` retourne `{ retryable: boolean }` ✓
- `enrichMovie` / `enrichSeries` retournent `'terminal-failed'` pour les erreurs non-transientes, `'provider-failed'` pour les transientes ✓
- `enrichWithRetry` court-circuite immédiatement sur `'terminal-failed'` via le guard `if (result !== 'provider-failed') return result` ✓ — aucun appel supplémentaire inutile

**Persistance des échecs** (`metadata-enrichment-service.ts:48–135`)
- `classifyError()` extrait le vrai `error.constructor.name`, `.code`, `.message` — plus de SQL généré ✓
- Upsert `ON CONFLICT` incrémente `retryCount` et met à jour `occurredAt` ✓
- `clearFailure()` appelé sur succès pour movies (`line:288`) et series ✓

**Service enrich-missing**
- Keyset cursor `WHERE id > :lastId ORDER BY id LIMIT batchSize` — aucun drift, 100% resumable ✓
- `checkNoRunningConflict()` appelé dans `start()` et `retryFailures()` — conflit 409 systématique ✓
- `retryFailures()` utilise `runWithConcurrency` ✓
- Checkpoint JSONB sauvegardé après chaque batch ✓

**Catalog stats** (`catalog-stats.ts`)
- 8 nouvelles métriques : `neverEnriched`, `partiallyEnriched`, `fullyEnriched`, `stale`, `failedLastEnrichment`, `embeddingEligible`, `embeddingBlocked`, `embeddingPending` ✓
- `embeddingPending` via `NOT EXISTS (SELECT 1 FROM media_embeddings ...)` — plus de 0 hardcodé ✓
- `EMBEDDING_ELIGIBLE_SQL_PREDICATE` importé depuis `embedding-eligibility.ts` — source unique ✓

**Migrations**
- `0045_t115_enrichment_failures.sql` — table + unique index `(media_type, media_id)` ✓
- `0046_t115_catalog_refresh_runs_type.sql` — colonne `type` avec DEFAULT `'REFRESH'`, idempotent ✓

## Problème bloquant

### BLOQUANT — Completion rule non satisfaite (inchangée depuis review 4)

Le ticket stipule explicitement, dans la section **Completion rule** ET dans les **Acceptance criteria** :

> **Do not close after unit tests. Run the new enrichment mode against production (or an equivalent restored production snapshot), publish before/after counts, and show the remaining terminal failures with their real causes.**

> - Run against the real production catalog and demonstrate meaningful reduction of incomplete titles and successful retry/fix of the previous failure population.

Aucun artefact de run réel n'est présent dans `runs/T115/`. L'ensemble des fichiers présents sont : ticket, plan, prompts/fixes de review, et un fichier `implementation-output.md` qui confirme explicitement que "le point bloquant restant" est l'exécution production.

Cette condition n'est pas une obligation de documentation optionnelle — elle est listée comme critère d'acceptance du ticket. Les tests unitaires existants (normalization, persistFailure, cursor pagination, enrichMovie failure) ne la remplacent pas.

**Action requise :** exécuter `POST /admin/catalog-enrich-missing` (ou déployer sur un snapshot production), capturer :
1. `GET /admin/catalog-stats` — before/after (neverEnriched, failedLastEnrichment, embeddingEligible)
2. `GET /admin/catalog-enrich-missing/status` — stats finales du run
3. `GET /admin/catalog-enrich-missing/failures` — liste des échecs terminaux avec causes réelles

Déposer ces artefacts JSON dans `runs/T115/production-run-YYYYMMDD.md` ou équivalent.

## Observations mineures

**`retrying` stat absente** — Le ticket demande cette métrique dans le run-level stats. `EnrichWithRetry` opère de façon synchrone au sein du batch ; la valeur serait toujours 0 entre deux snapshots checkpoint. La stat est structurellement non observable à ce niveau de granularité. Acceptable tel quel mais devrait être documenté comme limitation connue ou retiré de la spécification.

**`embeddingBlocked` structurellement 0** — La politique d'éligibilité embedding est `metadataEnrichedAt IS NOT NULL`, identique à la définition de "enriched". `embeddingBlocked = enrichedCount - eligibleCount` sera toujours 0 tant qu'aucun critère supplémentaire n'est ajouté. Un commentaire est présent dans `catalog-stats.ts` — suffisant pour l'instant.

## Risques

- `totalEligible` figé au démarrage : si de nouvelles rows deviennent éligibles pendant l'exécution, l'ETA dérive. Acceptable pour un estimatif.
- La migration `0045` entre en conflit avec `0045_t114_...` (deux fichiers avec le même préfixe `0045`). À vérifier que l'outil de migration gère correctement la numérotation — si non, une renommage de `0045_t115_enrichment_failures.sql` en `0047_t115_enrichment_failures.sql` serait nécessaire.

## Décision

Le code est correct sur tous les points techniques. Un seul blocker subsiste : l'exécution réelle contre la production n'a pas été réalisée, ce qui est un critère d'acceptance explicite du ticket.

IMPLEMENTATION_FIX_REQUIRED