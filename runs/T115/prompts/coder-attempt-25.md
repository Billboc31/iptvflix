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

The situation is clear and requires my direct assessment: **there is no code fix to apply here.**

---

## Situation — coder-attempt-24

L'implémentation technique de T115 est **complète et correcte**. La review-attempt-24 a validé tous les points techniques et n'a trouvé aucune régression. Le seul blocage restant est le **Completion Rule** du ticket — une exigence opérationnelle qui ne peut pas être résolue par du code.

**Ce qui est bloqué :** Le ticket exige explicitement un run contre le catalogue de production réel (~60k films / ~5k séries) avec publication des résultats avant/après. Ce run nécessite un accès Fly.io authentifié qui n'est pas disponible pour l'agent IA.

**Ce qui a déjà été livré (complet) :**
- Service `CatalogEnrichMissingService` — enrichissement complet, resumable, idempotent
- Route `POST /admin/catalog-enrich-missing` + `GET /admin/catalog-enrich-missing/status`
- Route `GET /admin/catalog-enrich-missing/failures` + `POST /admin/catalog-enrich-missing/retry-failures`
- Capture réelle des erreurs PostgreSQL/TMDB (errorClass, errorCode, errorMessage)
- Normalisation des valeurs TMDB invalides (runtime 0, imdb_id "", overview vide)
- Catalogue stats enrichi (neverEnriched, partiallyEnriched, fullyEnriched, failedLastEnrichment, embeddingEligible, embeddingPending)
- 33 tests unitaires passants
- Stats dans `retryFailures()` sauvegardées dans checkpoint
- Commentaire `retryCount` dans le schéma
- Playbook opérationnel complet à `runs/T115/production-run-playbook.md`

---

## Action requise — humaine

Pour débloquer le ticket, exécuter le playbook contre la production :

```bash
# 1. Vérifier les migrations (0044–0047)
psql $DATABASE_URL -c "SELECT tag FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 10;"

# 2. Stats avant
curl -s -u admin:$ADMIN_PASSWORD https://api.iptvflix.com/admin/catalog-stats | jq .

# 3. Lancer l'enrichissement
curl -s -X POST \
  -u admin:$ADMIN_PASSWORD \
  -H "Content-Type: application/json" \
  -d '{"batchSize": 50, "concurrency": 3, "throttleMs": 500}' \
  https://api.iptvflix.com/admin/catalog-enrich-missing | jq .

# 4. Surveiller jusqu'à COMPLETED
watch -n 30 'curl -s -u admin:$ADMIN_PASSWORD https://api.iptvflix.com/admin/catalog-enrich-missing/status | jq .'

# 5. Stats après + failures
curl -s -u admin:$ADMIN_PASSWORD https://api.iptvflix.com/admin/catalog-stats | jq .
curl -s -u admin:$ADMIN_PASSWORD "https://api.iptvflix.com/admin/catalog-enrich-missing/failures?limit=200" | jq .
```

Puis créer `runs/T115/production-run-20260820.md` avec les résultats (template dans le playbook).

---

Aucun changement de code n'est effectué dans cet attempt — l'implémentation est finalisée depuis coder-attempt-23. Le workflow est bloqué sur une gate opérationnelle qui requiert ton accès Fly.io.

---

## Review

I now have a complete picture of the implementation. Let me write the review.

---

# PR Review — T115: Complete Catalog Enrichment and Make Refresh Failures Resumable/Observable

## Résumé

Après 25 cycles de review/fix, l'implémentation est techniquement complète, propre et bien structurée. 33 tests passent. Un seul blocage persiste, identique depuis la review-24 : le **Completion Rule** du ticket n'est pas satisfait — le run de production n'a pas été exécuté sur le vrai catalogue. Ce blocage ne peut pas être résolu par un cycle AI supplémentaire — il requiert une action humaine avec accès Fly.io.

---

## Vérifications effectuées

- Lecture directe de tous les fichiers source modifiés : `tmdb/client.ts`, `metadata-enrichment-service.ts`, `catalog-enrich-missing-service.ts`, `catalog-enrich-missing.ts`, `catalog-stats.ts`, `embedding-eligibility.ts`, `enrichment-failures.ts` (schema), `catalog-refresh-runs.ts`, `index.ts`
- Lecture des migrations SQL (0047, 0048)
- Lecture de `runs/T115/production-run-20260819.md` et `runs/T115/production-run-playbook.md`
- Lecture du plan (`runs/T115/plan.md`) et du contexte du dernier cycle (`context-20260820T210234Z.md`)
- Lecture de la review précédente (`review-attempt-24`) — position inchangée sur le blocage

---

## Points validés

**Normalisation TMDB (`tmdb/client.ts`)**
- `raw.runtime || null` → `runtime=0` produit `runtimeMinutes: null` — correct
- `raw.imdb_id || null` → `imdb_id=""` produit `imdbId: null` — correct
- `raw.overview?.trim() || null` → synopsis whitespace-only produit `null` — correct
- `mapSeriesDetail` applique les mêmes gardes — cohérent avec `mapMovieDetail`
- Deux `try/catch` distincts pour la désérialisation JSON et le mapping — permet la discrimination `fetch` vs `map` dans `persistFailure`

**Persistance des échecs (`MetadataEnrichmentService`)**
- `classifyError()` extrait `errorClass` (constructeur réel), `errorCode` (code PostgreSQL), `errorMessage` (message brut) — fini le `"Failed query: update ... params ..."`
- Transient : `Network*`, `RateLimit*`, `ECONNRESET`, `ETIMEDOUT`, `ECONNREFUSED` → `retryable: true` ; tout autre erreur → `retryable: false` — classification correcte
- `persistFailure()` fait un upsert sur `(media_type, media_id)`, incrémente `retry_count` via `${enrichmentFailures.retryCount} + 1` — correct et atomique
- `clearFailure()` appelé en cas de succès — nettoyage propre
- `stage: 'seasons'` distingue l'échec d'enrichissement épisodes de l'échec metadata principale

**`CatalogEnrichMissingService`**
- Pagination keyset `WHERE id > :lastId ORDER BY id ASC LIMIT n` — non sensible au drift offset, reproductible
- Checkpoint JSONB persisté après chaque batch (`saveCheckpoint()`) — survie au crash/restart
- Double protection concurrence : `checkNoRunningConflict()` + catch 23505 sur l'INSERT
- `enrichWithRetry()` ne retente que `'provider-failed'` (transient), pas `'terminal-failed'` — logique correcte
- `resumeRunId` charge le checkpoint du run précédent, reprend depuis le bon curseur
- `retryFailures()` : filtrage `retryable=true` par défaut, `force=true` inclut les terminaux — fix de la route (coder-12) appliqué et vérifié dans le rapport

**Routes admin (`catalog-enrich-missing.ts`)**
- `POST /admin/catalog-enrich-missing` : validation batchSize [1-500], concurrency [1-20], throttleMs ≥ 0, mediaTypes enum — correcte
- `POST … /retry-failures` : `force` passé depuis le body au service — fix confirmé
- HTTP 202 pour démarrage async, 409 conflit run, 404 aucun run — cohérents

**Catalog-stats (`catalog-stats.ts`)**
- 13 requêtes parallèles ; mock de test mis à jour à 13 slots (fix coder-23) — les 33 tests passent
- `embeddingPending` calculé via `NOT EXISTS (SELECT 1 FROM media_embeddings ...)` — plus de `0` hardcodé
- `EMBEDDING_ELIGIBLE_SQL_PREDICATE` source unique partagée entre stats et backfill — pas de duplication inline
- `enrichedWithSeasonFailures` exposé pour les séries dont la metadata principale est enrichie mais les épisodes ont échoué

**Politique d'éligibilité embedding (`embedding-eligibility.ts`)**
- `isEmbeddingEligible` : `metadataEnrichedAt IS NOT NULL` — documenté, extensible
- `EMBEDDING_ELIGIBLE_SQL_PREDICATE` et `embeddingEligibleCondition` en cohérence avec la fonction — sync explicitement documentée dans les commentaires

**Schéma et migrations**
- `enrichment_failures` : tous les champs requis par le ticket présents, UNIQUE INDEX sur `(media_type, media_id)` — correct
- Migration 0047 : `ALTER TABLE catalog_refresh_runs ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'REFRESH'` — rétrocompatible
- Migration 0048 : création table + unique index — correct

---

## Problèmes détectés

### [BLOQUANT] Completion Rule non respectée — run production non exécuté

Le ticket stipule explicitement :

> **Completion rule** : Do not close after unit tests. Run the new enrichment mode against production (or an equivalent restored production snapshot), publish before/after counts, and show the remaining terminal failures with their real causes.

Le rapport `runs/T115/production-run-20260819.md` documente un run sur une base locale de **6 films** (3 enrichis, 2 sans tmdbId, 1 avec TMDB ID fictif `99999999`). Ce run ne constitue pas une validation au sens du Completion Rule. Les critères non démontrés restent :

- Réduction mesurable de `neverEnriched` sur le catalogue réel (~60k films / ~5k séries)
- Causes réelles des 126 échecs de production (notamment le vrai TMDB ID de `Les Chevaliers du Fiel : L'assassin est dans la salle`)
- Comportement du checkpoint/pagination à volume réel
- Application de la migration 0047 sur la table `catalog_refresh_runs` de production non vide

**Ce blocage ne peut pas être résolu par un cycle AI supplémentaire.** L'accès Fly.io (`flyctl auth login`) est requis. Le `production-run-playbook.md` est prêt. L'action requise est une escalade vers un opérateur humain disposant de l'accès production.

### [Mineur] `retryFailures()` sans stats en temps réel

`retryFailures()` ne persiste pas de checkpoint intermédiaire pendant le run. `GET /status` retourne `"stats": null` pendant toute la durée d'un batch retry. Comportement documenté dans le rapport de run mais peut surprendre un opérateur qui surveille un large batch de retries.

### [Mineur] `retryCount: 0` ambigu

À la première insertion dans `enrichment_failures`, `retry_count = 0`. Le commentaire `-- 0 = initial failure, no retry attempted; incremented on each subsequent retry` existe dans le schema Drizzle (vérifié) — suffisant.

---

## Risques éventuels

1. **Scalabilité des 13 queries agrégées** : sur 60k lignes en production sans cache, `GET /admin/catalog-stats` peut dépasser 200ms. Pas bloquant — endpoint admin, trafic faible.

2. **Index partiel `status='RUNNING'`** : un seul run simultané (REFRESH ou ENRICH_MISSING). Un refresh planifié en cours bloque le démarrage manuel d'un enrich-missing → 409. Comportement correct, documenté dans le playbook.

3. **Rate limiting TMDB à grande échelle** : double 429 → `TmdbRateLimitError` → transient → 3 retries avec délais courts. À monitorer sur 60k films. Le playbook recommande `throttleMs ≥ 500`.

---

## Décision

L'implémentation est techniquement correcte et complète. 33 tests passent. Le code répond à tous les critères de qualité, scope, sécurité et architecture. **La seule raison de ne pas approuver est le Completion Rule non honoré**, identique depuis la review-24.

Ce blocage requiert une escalade humaine — pas un nouveau cycle AI. **Action requise** : un opérateur humain avec accès Fly.io doit exécuter le `production-run-playbook.md`, attacher les compteurs avant/après et la liste des failures réelles, puis cette review sera réexaminée.

---

IMPLEMENTATION_FIX_REQUIRED

---

## Instructions de fix

# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T115/reviews/implementation-review.md
- generated at: 2026-08-20T21:14:47Z

---

I now have a complete picture of the implementation. Let me write the review.

---

# PR Review — T115: Complete Catalog Enrichment and Make Refresh Failures Resumable/Observable

## Résumé

Après 25 cycles de review/fix, l'implémentation est techniquement complète, propre et bien structurée. 33 tests passent. Un seul blocage persiste, identique depuis la review-24 : le **Completion Rule** du ticket n'est pas satisfait — le run de production n'a pas été exécuté sur le vrai catalogue. Ce blocage ne peut pas être résolu par un cycle AI supplémentaire — il requiert une action humaine avec accès Fly.io.

---

## Vérifications effectuées

- Lecture directe de tous les fichiers source modifiés : `tmdb/client.ts`, `metadata-enrichment-service.ts`, `catalog-enrich-missing-service.ts`, `catalog-enrich-missing.ts`, `catalog-stats.ts`, `embedding-eligibility.ts`, `enrichment-failures.ts` (schema), `catalog-refresh-runs.ts`, `index.ts`
- Lecture des migrations SQL (0047, 0048)
- Lecture de `runs/T115/production-run-20260819.md` et `runs/T115/production-run-playbook.md`
- Lecture du plan (`runs/T115/plan.md`) et du contexte du dernier cycle (`context-20260820T210234Z.md`)
- Lecture de la review précédente (`review-attempt-24`) — position inchangée sur le blocage

---

## Points validés

**Normalisation TMDB (`tmdb/client.ts`)**
- `raw.runtime || null` → `runtime=0` produit `runtimeMinutes: null` — correct
- `raw.imdb_id || null` → `imdb_id=""` produit `imdbId: null` — correct
- `raw.overview?.trim() || null` → synopsis whitespace-only produit `null` — correct
- `mapSeriesDetail` applique les mêmes gardes — cohérent avec `mapMovieDetail`
- Deux `try/catch` distincts pour la désérialisation JSON et le mapping — permet la discrimination `fetch` vs `map` dans `persistFailure`

**Persistance des échecs (`MetadataEnrichmentService`)**
- `classifyError()` extrait `errorClass` (constructeur réel), `errorCode` (code PostgreSQL), `errorMessage` (message brut) — fini le `"Failed query: update ... params ..."`
- Transient : `Network*`, `RateLimit*`, `ECONNRESET`, `ETIMEDOUT`, `ECONNREFUSED` → `retryable: true` ; tout autre erreur → `retryable: false` — classification correcte
- `persistFailure()` fait un upsert sur `(media_type, media_id)`, incrémente `retry_count` via `${enrichmentFailures.retryCount} + 1` — correct et atomique
- `clearFailure()` appelé en cas de succès — nettoyage propre
- `stage: 'seasons'` distingue l'échec d'enrichissement épisodes de l'échec metadata principale

**`CatalogEnrichMissingService`**
- Pagination keyset `WHERE id > :lastId ORDER BY id ASC LIMIT n` — non sensible au drift offset, reproductible
- Checkpoint JSONB persisté après chaque batch (`saveCheckpoint()`) — survie au crash/restart
- Double protection concurrence : `checkNoRunningConflict()` + catch 23505 sur l'INSERT
- `enrichWithRetry()` ne retente que `'provider-failed'` (transient), pas `'terminal-failed'` — logique correcte
- `resumeRunId` charge le checkpoint du run précédent, reprend depuis le bon curseur
- `retryFailures()` : filtrage `retryable=true` par défaut, `force=true` inclut les terminaux — fix de la route (coder-12) appliqué et vérifié dans le rapport

**Routes admin (`catalog-enrich-missing.ts`)**
- `POST /admin/catalog-enrich-missing` : validation batchSize [1-500], concurrency [1-20], throttleMs ≥ 0, mediaTypes enum — correcte
- `POST … /retry-failures` : `force` passé depuis le body au service — fix confirmé
- HTTP 202 pour démarrage async, 409 conflit run, 404 aucun run — cohérents

**Catalog-stats (`catalog-stats.ts`)**
- 13 requêtes parallèles ; mock de test mis à jour à 13 slots (fix coder-23) — les 33 tests passent
- `embeddingPending` calculé via `NOT EXISTS (SELECT 1 FROM media_embeddings ...)` — plus de `0` hardcodé
- `EMBEDDING_ELIGIBLE_SQL_PREDICATE` source unique partagée entre stats et backfill — pas de duplication inline
- `enrichedWithSeasonFailures` exposé pour les séries dont la metadata principale est enrichie mais les épisodes ont échoué

**Politique d'éligibilité embedding (`embedding-eligibility.ts`)**
- `isEmbeddingEligible` : `metadataEnrichedAt IS NOT NULL` — documenté, extensible
- `EMBEDDING_ELIGIBLE_SQL_PREDICATE` et `embeddingEligibleCondition` en cohérence avec la fonction — sync explicitement documentée dans les commentaires

**Schéma et migrations**
- `enrichment_failures` : tous les champs requis par le ticket présents, UNIQUE INDEX sur `(media_type, media_id)` — correct
- Migration 0047 : `ALTER TABLE catalog_refresh_runs ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'REFRESH'` — rétrocompatible
- Migration 0048 : création table + unique index — correct

---

## Problèmes détectés

### [BLOQUANT] Completion Rule non respectée — run production non exécuté

Le ticket stipule explicitement :

> **Completion rule** : Do not close after unit tests. Run the new enrichment mode against production (or an equivalent restored production snapshot), publish before/after counts, and show the remaining terminal failures with their real causes.

Le rapport `runs/T115/production-run-20260819.md` documente un run sur une base locale de **6 films** (3 enrichis, 2 sans tmdbId, 1 avec TMDB ID fictif `99999999`). Ce run ne constitue pas une validation au sens du Completion Rule. Les critères non démontrés restent :

- Réduction mesurable de `neverEnriched` sur le catalogue réel (~60k films / ~5k séries)
- Causes réelles des 126 échecs de production (notamment le vrai TMDB ID de `Les Chevaliers du Fiel : L'assassin est dans la salle`)
- Comportement du checkpoint/pagination à volume réel
- Application de la migration 0047 sur la table `catalog_refresh_runs` de production non vide

**Ce blocage ne peut pas être résolu par un cycle AI supplémentaire.** L'accès Fly.io (`flyctl auth login`) est requis. Le `production-run-playbook.md` est prêt. L'action requise est une escalade vers un opérateur humain disposant de l'accès production.

### [Mineur] `retryFailures()` sans stats en temps réel

`retryFailures()` ne persiste pas de checkpoint intermédiaire pendant le run. `GET /status` retourne `"stats": null` pendant toute la durée d'un batch retry. Comportement documenté dans le rapport de run mais peut surprendre un opérateur qui surveille un large batch de retries.

### [Mineur] `retryCount: 0` ambigu

À la première insertion dans `enrichment_failures`, `retry_count = 0`. Le commentaire `-- 0 = initial failure, no retry attempted; incremented on each subsequent retry` existe dans le schema Drizzle (vérifié) — suffisant.

---

## Risques éventuels

1. **Scalabilité des 13 queries agrégées** : sur 60k lignes en production sans cache, `GET /admin/catalog-stats` peut dépasser 200ms. Pas bloquant — endpoint admin, trafic faible.

2. **Index partiel `status='RUNNING'`** : un seul run simultané (REFRESH ou ENRICH_MISSING). Un refresh planifié en cours bloque le démarrage manuel d'un enrich-missing → 409. Comportement correct, documenté dans le playbook.

3. **Rate limiting TMDB à grande échelle** : double 429 → `TmdbRateLimitError` → transient → 3 retries avec délais courts. À monitorer sur 60k films. Le playbook recommande `throttleMs ≥ 500`.

---

## Décision

L'implémentation est techniquement correcte et complète. 33 tests passent. Le code répond à tous les critères de qualité, scope, sécurité et architecture. **La seule raison de ne pas approuver est le Completion Rule non honoré**, identique depuis la review-24.

Ce blocage requiert une escalade humaine — pas un nouveau cycle AI. **Action requise** : un opérateur humain avec accès Fly.io doit exécuter le `production-run-playbook.md`, attacher les compteurs avant/après et la liste des failures réelles, puis cette review sera réexaminée.

---

IMPLEMENTATION_FIX_REQUIRED