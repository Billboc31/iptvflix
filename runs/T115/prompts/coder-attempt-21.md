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

All changes committed. Here's a summary of the situation:

---

## Summary

**Two minor code fixes applied:**

1. **`retryFailures` with 0 failures** (`catalog-enrich-missing-service.ts`): Previously inserted a COMPLETED run record even when no failures matched the filter. Now returns `{ runId: null, queued: 0 }` without polluting the run log.

2. **Stat ambiguity for series with season failures** (`catalog-stats.ts`): A series can appear in both `enriched` (main metadata present, `metadataEnrichedAt` set) and `failedLastEnrichment` (season enrichment failed). Now exposes `enrichedWithSeasonFailures: N` in the series section to make this overlap explicit and diagnosable.

**What was already in the code (fixed in previous runs):**
- `retryFailures` filtered by `retryable=true` by default — ✅
- Season failures persisted in `enrichment_failures` with `stage: 'seasons'` — ✅  
- `persistFrenchLocalization` logs warnings on failure — ✅
- Collection upsert catch logs warnings — ✅
- `fullyEnriched` definition documented in code comments — ✅
- All 8 T115 tests pass — ✅

**Blocking — requires human operator action:**

The production run cannot be executed by the AI agent: `flyctl auth login` is required. The playbook at `runs/T115/production-run-playbook.md` contains exact curl commands. Once `flyctl auth login` is done, run the playbook to capture before/after catalog stats and the real failure list for the ~60k movie catalog — that's the final acceptance criterion.

---

## Review

---

# PR Review — T115 — Complete catalog enrichment and make refresh failures resumable/observable

## Résumé

L'implémentation est complète au niveau du code. Les deux majeurs de la review précédente (filtrage `retryFailures` sur `retryable=true` par défaut, persistance des échecs de saisons) ont été corrigés. Tous les mineurs également. Le seul bloquant restant est opérationnel et non-code : la completion rule du ticket exige un passage sur le catalogue de production, qui nécessite une authentification `flyctl` que l'agent IA ne peut pas effectuer.

---

## Vérifications effectuées

- Relecture complète de `catalog-enrich-missing-service.ts` (429 lignes), `metadata-enrichment-service.ts`, `catalog-stats.ts`, `catalog-enrich-missing.ts`, `embedding-eligibility.ts`, `enrichment-failures.ts` (schema).
- Vérification des corrections des deux majeurs de review-20 : filtrage `retryFailures` (ligne 381) et persistance `enrichSeriesSeasons` (lignes 437-452).
- Vérification des mineurs corrigés : log `persistFrenchLocalization` (ligne 770), run vide `retryFailures` (retour anticipé ligne 386-388), commentaires `fullyEnriched`, champ `enrichedWithSeasonFailures`.
- Vérification du rapport de run local (`production-run-20260819.md`) et de `implementation-output.md`.
- Vérification du playbook de run production (`production-run-playbook.md`).

---

## Points validés

**Failure observability (AC1)**
- `classifyError()` capture correctement le nom du constructeur (`PostgresError`), le code driver (`23502`), et le message — plus de "Failed query: update...".
- `persistFailure()` upsert idempotent sur `(media_type, media_id)`, incrémente `retryCount`.
- Stages `fetch`, `map`, `db_update`, `seasons` correctement distingués.
- `clearFailure()` appelée sur succès pour chaque media.
- Test unitaire vérifie la capture de `PostgresError` avec `errorClass`, `errorCode`, `errorMessage`.

**Corrections des majeurs review-20**
- `retryFailures` : filtre `retryable=true` par défaut (ligne 381), `force=true` pour inclure les terminaux. La route passe bien `force: body?.force`.
- `enrichSeriesSeasons` : l'échec est maintenant persisté avec `stage: 'seasons'`, `seasonsFailed=true` → retour `'terminal-failed'`.

**Corrections des mineurs review-20**
- `retryFailures` avec 0 échecs : retourne `{ runId: null, queued: 0 }` sans créer de run COMPLETED.
- `persistFrenchLocalization` : émet `console.warn` sur échec avec `mediaType` et `mediaId`.
- `fullyEnriched` : commentaire explicatif dans `catalog-stats.ts` (lignes 47-53, 69-76).
- `enrichedWithSeasonFailures` : champ ajouté dans les stats séries pour documenter le chevauchement "enriched AND failedLastEnrichment".

**TMDB normalization (AC2)**
- `runtime: 0` → `null`, `imdb_id: ""` → `null`, `overview: "   "` → `null`.
- `MetadataMappingError` distingue erreur de mapping vs erreur réseau.

**Enrich-missing mode (AC3/AC4)**
- Pagination curseur `WHERE id > lastId ORDER BY id LIMIT batchSize` — aucun drift d'offset.
- Checkpoint JSONB persisté après chaque batch — resumable sur crash.
- Idempotence : titres frais sautés par défaut.
- `countEligible` correct pour le total eligible de départ.

**Terminal failure persistence (AC5)**
- Table `enrichment_failures` : tous les champs du ticket présents (mediaType, mediaId, tmdbId, title, stage, errorClass, errorCode, errorMessage, retryCount, occurredAt, retryable).
- API : `GET /failures?page=&limit=&mediaType=&retryable=`, `POST /retry-failures`.

**Catalog stats (AC6)**
- Champs : neverEnriched, partiallyEnriched, fullyEnriched, stale, failedLastEnrichment, enrichedWithSeasonFailures, embeddingEligible, embeddingBlocked, embeddingPending.
- `embeddingPending` calculé par `NOT EXISTS (SELECT 1 FROM media_embeddings ...)` réel.

**Embedding eligibility (AC8)**
- `embedding-eligibility.ts` : politique documentée — `metadataEnrichedAt IS NOT NULL` = condition minimale, champs préférés listés mais non bloquants.
- Cohérence des trois représentations (fonction TS, SQL brut, Drizzle condition) documentée.

---

## Problèmes détectés

### [BLOQUANT] — Completion rule non satisfaite : run production non exécuté

Le ticket est explicite et non-négociable :
> "Do not close after unit tests. Run the new enrichment mode against production (or an equivalent restored production snapshot), publish before/after counts, and show the remaining terminal failures with their real causes."

Et le dernier acceptance criteria :
> "Run against the real production catalog and demonstrate meaningful reduction of incomplete titles and successful retry/fix of the previous failure population."

Le run local de `production-run-20260819.md` porte sur **6 films de dev** (dont 1 avec TMDB ID fictif). Il ne constitue pas une production run au sens du ticket. Le `production-run-playbook.md` est prêt mais non exécuté.

**Cause** : `flyctl auth login` requis, DNS production non résolvable depuis l'environnement de l'agent IA. Action humaine obligatoire.

**Action requise** : Un opérateur humain doit exécuter le playbook `runs/T115/production-run-playbook.md` — authentification Fly.io, migrations vérifiées, stats avant/après, liste des failures avec vraies causes — et publier les résultats dans un artefact `runs/T115/production-run-YYYYMMDD.md`.

---

### [MINEUR] — Échecs de saisons retryables non retentés par `enrichWithRetry`

Dans `enrichSeries`, la valeur de `retryable` calculée par `persistFailure` (ligne 443) est **ignorée** — la fonction retourne toujours `'terminal-failed'` sur échec de saisons. En conséquence, `enrichWithRetry` dans `execute()` ne tente pas de relancer le traitement (elle ne rejoue que sur `'provider-failed'`). Un échec réseau transitoire sur `enrichSeriesSeasons` n'est donc pas retenté automatiquement dans le batch courant.

Ce cas est couvert par `POST /retry-failures` (qui sélectionne les `retryable=true`), mais l'opérateur doit le déclencher manuellement. Comportement acceptable en l'état, mais à documenter si ce gap cause de la confusion.

---

## Risques éventuels

- **Ghost run** : si un run ENRICH_MISSING reste en statut RUNNING indéfiniment (crash sans update), aucun nouveau run ne peut démarrer. Pas de timeout/cleanup automatique. Risque opérationnel faible mais réel en production.
- **Rate limit TMDB** : backoff 250/500/1000ms peut être insuffisant en cas de 429 soutenu sur un catalogue de 60k titres. Le `throttleMs` entre batches atténue, mais pas garantie.
- **`mediaType` non contraint en DB** : colonne `text` dans `enrichment_failures`, pas de CHECK CONSTRAINT. TypeScript protège mais un bug applicatif passerait inaperçu.

---

## Décision

L'implémentation code est complète et correcte. Tous les problèmes des reviews précédentes sont résolus. Le seul bloquant restant est opérationnel : le ticket impose explicitement un run sur le catalogue de production, que l'agent IA ne peut pas exécuter sans authentification Fly.io humaine.

La review ne peut pas approuver sans cet artefact de validation production.

## Actions demandées

1. **[BLOQUANT]** Exécuter `runs/T115/production-run-playbook.md` sur le catalogue de production avec un opérateur authentifié. Publier dans `runs/T115/production-run-YYYYMMDD.md` : stats before/after (`/admin/catalog-stats`), liste des failures avec vraies causes (`/admin/catalog-enrich-missing/failures`), réduction observable du nombre de titres incomplets.
2. **[MINEUR, optionnel]** Documenter dans `production-run-playbook.md` ou dans `enrichSeries` que les échecs de saisons transitoires nécessitent un appel manuel à `retry-failures` pour être retraités.

IMPLEMENTATION_FIX_REQUIRED

---

## Instructions de fix

# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T115/reviews/implementation-review.md
- generated at: 2026-08-20T20:41:49Z

---

---

# PR Review — T115 — Complete catalog enrichment and make refresh failures resumable/observable

## Résumé

L'implémentation est complète au niveau du code. Les deux majeurs de la review précédente (filtrage `retryFailures` sur `retryable=true` par défaut, persistance des échecs de saisons) ont été corrigés. Tous les mineurs également. Le seul bloquant restant est opérationnel et non-code : la completion rule du ticket exige un passage sur le catalogue de production, qui nécessite une authentification `flyctl` que l'agent IA ne peut pas effectuer.

---

## Vérifications effectuées

- Relecture complète de `catalog-enrich-missing-service.ts` (429 lignes), `metadata-enrichment-service.ts`, `catalog-stats.ts`, `catalog-enrich-missing.ts`, `embedding-eligibility.ts`, `enrichment-failures.ts` (schema).
- Vérification des corrections des deux majeurs de review-20 : filtrage `retryFailures` (ligne 381) et persistance `enrichSeriesSeasons` (lignes 437-452).
- Vérification des mineurs corrigés : log `persistFrenchLocalization` (ligne 770), run vide `retryFailures` (retour anticipé ligne 386-388), commentaires `fullyEnriched`, champ `enrichedWithSeasonFailures`.
- Vérification du rapport de run local (`production-run-20260819.md`) et de `implementation-output.md`.
- Vérification du playbook de run production (`production-run-playbook.md`).

---

## Points validés

**Failure observability (AC1)**
- `classifyError()` capture correctement le nom du constructeur (`PostgresError`), le code driver (`23502`), et le message — plus de "Failed query: update...".
- `persistFailure()` upsert idempotent sur `(media_type, media_id)`, incrémente `retryCount`.
- Stages `fetch`, `map`, `db_update`, `seasons` correctement distingués.
- `clearFailure()` appelée sur succès pour chaque media.
- Test unitaire vérifie la capture de `PostgresError` avec `errorClass`, `errorCode`, `errorMessage`.

**Corrections des majeurs review-20**
- `retryFailures` : filtre `retryable=true` par défaut (ligne 381), `force=true` pour inclure les terminaux. La route passe bien `force: body?.force`.
- `enrichSeriesSeasons` : l'échec est maintenant persisté avec `stage: 'seasons'`, `seasonsFailed=true` → retour `'terminal-failed'`.

**Corrections des mineurs review-20**
- `retryFailures` avec 0 échecs : retourne `{ runId: null, queued: 0 }` sans créer de run COMPLETED.
- `persistFrenchLocalization` : émet `console.warn` sur échec avec `mediaType` et `mediaId`.
- `fullyEnriched` : commentaire explicatif dans `catalog-stats.ts` (lignes 47-53, 69-76).
- `enrichedWithSeasonFailures` : champ ajouté dans les stats séries pour documenter le chevauchement "enriched AND failedLastEnrichment".

**TMDB normalization (AC2)**
- `runtime: 0` → `null`, `imdb_id: ""` → `null`, `overview: "   "` → `null`.
- `MetadataMappingError` distingue erreur de mapping vs erreur réseau.

**Enrich-missing mode (AC3/AC4)**
- Pagination curseur `WHERE id > lastId ORDER BY id LIMIT batchSize` — aucun drift d'offset.
- Checkpoint JSONB persisté après chaque batch — resumable sur crash.
- Idempotence : titres frais sautés par défaut.
- `countEligible` correct pour le total eligible de départ.

**Terminal failure persistence (AC5)**
- Table `enrichment_failures` : tous les champs du ticket présents (mediaType, mediaId, tmdbId, title, stage, errorClass, errorCode, errorMessage, retryCount, occurredAt, retryable).
- API : `GET /failures?page=&limit=&mediaType=&retryable=`, `POST /retry-failures`.

**Catalog stats (AC6)**
- Champs : neverEnriched, partiallyEnriched, fullyEnriched, stale, failedLastEnrichment, enrichedWithSeasonFailures, embeddingEligible, embeddingBlocked, embeddingPending.
- `embeddingPending` calculé par `NOT EXISTS (SELECT 1 FROM media_embeddings ...)` réel.

**Embedding eligibility (AC8)**
- `embedding-eligibility.ts` : politique documentée — `metadataEnrichedAt IS NOT NULL` = condition minimale, champs préférés listés mais non bloquants.
- Cohérence des trois représentations (fonction TS, SQL brut, Drizzle condition) documentée.

---

## Problèmes détectés

### [BLOQUANT] — Completion rule non satisfaite : run production non exécuté

Le ticket est explicite et non-négociable :
> "Do not close after unit tests. Run the new enrichment mode against production (or an equivalent restored production snapshot), publish before/after counts, and show the remaining terminal failures with their real causes."

Et le dernier acceptance criteria :
> "Run against the real production catalog and demonstrate meaningful reduction of incomplete titles and successful retry/fix of the previous failure population."

Le run local de `production-run-20260819.md` porte sur **6 films de dev** (dont 1 avec TMDB ID fictif). Il ne constitue pas une production run au sens du ticket. Le `production-run-playbook.md` est prêt mais non exécuté.

**Cause** : `flyctl auth login` requis, DNS production non résolvable depuis l'environnement de l'agent IA. Action humaine obligatoire.

**Action requise** : Un opérateur humain doit exécuter le playbook `runs/T115/production-run-playbook.md` — authentification Fly.io, migrations vérifiées, stats avant/après, liste des failures avec vraies causes — et publier les résultats dans un artefact `runs/T115/production-run-YYYYMMDD.md`.

---

### [MINEUR] — Échecs de saisons retryables non retentés par `enrichWithRetry`

Dans `enrichSeries`, la valeur de `retryable` calculée par `persistFailure` (ligne 443) est **ignorée** — la fonction retourne toujours `'terminal-failed'` sur échec de saisons. En conséquence, `enrichWithRetry` dans `execute()` ne tente pas de relancer le traitement (elle ne rejoue que sur `'provider-failed'`). Un échec réseau transitoire sur `enrichSeriesSeasons` n'est donc pas retenté automatiquement dans le batch courant.

Ce cas est couvert par `POST /retry-failures` (qui sélectionne les `retryable=true`), mais l'opérateur doit le déclencher manuellement. Comportement acceptable en l'état, mais à documenter si ce gap cause de la confusion.

---

## Risques éventuels

- **Ghost run** : si un run ENRICH_MISSING reste en statut RUNNING indéfiniment (crash sans update), aucun nouveau run ne peut démarrer. Pas de timeout/cleanup automatique. Risque opérationnel faible mais réel en production.
- **Rate limit TMDB** : backoff 250/500/1000ms peut être insuffisant en cas de 429 soutenu sur un catalogue de 60k titres. Le `throttleMs` entre batches atténue, mais pas garantie.
- **`mediaType` non contraint en DB** : colonne `text` dans `enrichment_failures`, pas de CHECK CONSTRAINT. TypeScript protège mais un bug applicatif passerait inaperçu.

---

## Décision

L'implémentation code est complète et correcte. Tous les problèmes des reviews précédentes sont résolus. Le seul bloquant restant est opérationnel : le ticket impose explicitement un run sur le catalogue de production, que l'agent IA ne peut pas exécuter sans authentification Fly.io humaine.

La review ne peut pas approuver sans cet artefact de validation production.

## Actions demandées

1. **[BLOQUANT]** Exécuter `runs/T115/production-run-playbook.md` sur le catalogue de production avec un opérateur authentifié. Publier dans `runs/T115/production-run-YYYYMMDD.md` : stats before/after (`/admin/catalog-stats`), liste des failures avec vraies causes (`/admin/catalog-enrich-missing/failures`), réduction observable du nombre de titres incomplets.
2. **[MINEUR, optionnel]** Documenter dans `production-run-playbook.md` ou dans `enrichSeries` que les échecs de saisons transitoires nécessitent un appel manuel à `retry-failures` pour être retraités.

IMPLEMENTATION_FIX_REQUIRED