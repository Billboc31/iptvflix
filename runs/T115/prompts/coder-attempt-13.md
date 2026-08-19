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

## Summary

**Code fix done and committed** (commit `26046f48`):

**Bug** — `POST /admin/catalog-enrich-missing/retry-failures` never forwarded `force` from the request body to the service. The body type had no `force` field, so sending `{"force": true}` was silently discarded — the service always ran with `force=false` and filtered to `retryable=true` only. Result: a terminal failure with `retryable: false` was always excluded → `queued: 0`.

**Fix** — Added `force?: boolean` to the route body type and passed `force: body?.force` to `service.retryFailures()`.

**Verified locally**: with the 1 existing terminal failure (`retryable: false`), `POST retry-failures {"force": true}` now correctly returns `{"queued": 1}`.

---

**Production run — still blocked** (hard dependency on human):

Neither Railway CLI nor production `DATABASE_URL` credentials are available in this environment. The review's completion rule requires running against production or a restored production snapshot with ~60k movies. To unblock this:

1. Provide the production `DATABASE_URL` from Railway so I can run `pg_dump` and restore it locally, **or**
2. Run `fly auth login` / `railway login` in your terminal and let me proceed from there, **or**
3. Run the playbook manually: `runs/T115/production-run-playbook.md` has all the exact commands.

---

## Review

## PR Review — T115

**Révision** : #13 (review-attempt-13.md). Aucun changement de code depuis la révision #12 — seul l'artefact `production-run-20260819.md` est nouveau.

---

## Vérifications effectuées

- Code des 8 composants du plan (TMDB client, metadata-enrichment-service, catalog-enrich-missing-service, routes, catalog-stats, embedding-eligibility, schéma DB, migrations 0046+0047)
- Artefacts de run locaux (`local-validation-run-20260819.md`, `production-run-20260819.md`)
- Fix coder-12 (commit `26046f48`) — `force` param sur `/retry-failures`
- Completion rule du ticket

---

## Points validés

- **Normalisation TMDB** — `runtime === 0 → null`, `imdb_id === "" → null`, `overview?.trim() || null` appliqués dans `mapMovieDetail` et `mapSeriesDetail`. ✅
- **`classifyError()`** — extrait le vrai `constructor.name`, `.code`, `.message`. Pas de "Failed query: …" ✅
- **`persistFailure()` / `clearFailure()`** — upsert sur `(media_type, media_id)`, incrémente `retry_count`, nettoyage sur succès. ✅
- **Keyset cursor** — `WHERE id > lastId ORDER BY id ASC` — pas de drift d'offset, idempotent. ✅
- **Fix coder-12 confirmé** — `POST /retry-failures {"force": true}` retourne `{"queued": 1}` pour une failure `retryable: false`. ✅
- **Migrations 0046 + 0047** — `IF NOT EXISTS` safe, journal mis à jour, pas de conflit avec T114. ✅
- **Catalog-stats** — `neverEnriched`, `partiallyEnriched`, `fullyEnriched`, `stale`, `failedLastEnrichment`, `embeddingPending` (NOT EXISTS réel). ✅
- **`embedding-eligibility.ts`** — source de vérité unique (`isEmbeddingEligible`, `EMBEDDING_ELIGIBLE_SQL_PREDICATE`, `embeddingEligibleCondition`). ✅
- **Run local** — 5 films, 39 séries, 444 épisodes traités ; 0 failures ; idempotence confirmée (re-run skip les lignes enrichies). ✅
- **Observabilité des failures** — `stage: "fetch"`, `errorClass`, `errorMessage`, `retryCount`, `occurredAt`, `retryable` présents dans la réponse JSON. ✅

---

## Problèmes détectés

### 🔴 BLOQUANT — Completion rule non satisfaite (13e cycle)

Le ticket stipule explicitement :

> *"Do not close after unit tests. Run the new enrichment mode against production (or an equivalent restored production snapshot), publish before/after counts, and show the remaining terminal failures with their real causes."*

L'artefact `production-run-20260819.md` documente un run sur **6 films en base locale** avec un TMDB ID synthétique (99999999). Ce n'est pas un run sur le catalogue de production (~60k films, ~5k séries). Les 126 vraies failures de production restent indiagnostiquées, et aucun `before/after count` réel n'est publié.

**Ce blocker est exclusivement environnemental** : l'IA n'a pas accès à `DATABASE_URL` production, ni à Fly.io/Railway. Le code lui-même est correct et approuvable sur la base technique.

---

### 🟡 Observations non bloquantes (identiques aux reviews précédentes)

- **`retrying` stat** — accumulateur incrémental sans décrément ; sémantique légèrement trompeuse mais non bloquant.
- **Test cursor pagination** — valide uniquement `countEligible`, pas le comportement `WHERE id > lastId`.
- **Seuil staleness hardcodé** — `30 * 86_400_000` ms dupliqué dans le service et catalog-stats ; centralisation possible mais hors scope du ticket.

---

## Risques éventuels

Aucun risque de régression code détecté. Les migrations sont idempotentes. Le rollback en cas de problème production se fait en ignorant les nouvelles routes (elles ne remplacent pas les routes existantes).

---

## Décision

L'implémentation technique est complète, correcte et conforme au plan. Elle satisfait tous les critères d'acceptance **sauf le dernier** qui exige une démonstration sur le catalogue de production réel.

**Action requise — humain uniquement** :

1. Fournir `DATABASE_URL` production (Railway/Fly.io) pour un restore local, **ou**
2. Exécuter `fly auth login` / `railway login` dans ce terminal, **ou**
3. Exécuter manuellement le playbook `runs/T115/production-run-playbook.md` depuis un accès production.

Sans cette action, la completion rule du ticket ne peut pas être satisfaite par l'IA dans cet environnement.

IMPLEMENTATION_FIX_REQUIRED

---

## Instructions de fix

# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T115/reviews/implementation-review.md
- generated at: 2026-08-19T15:45:05Z

---

## PR Review — T115

**Révision** : #13 (review-attempt-13.md). Aucun changement de code depuis la révision #12 — seul l'artefact `production-run-20260819.md` est nouveau.

---

## Vérifications effectuées

- Code des 8 composants du plan (TMDB client, metadata-enrichment-service, catalog-enrich-missing-service, routes, catalog-stats, embedding-eligibility, schéma DB, migrations 0046+0047)
- Artefacts de run locaux (`local-validation-run-20260819.md`, `production-run-20260819.md`)
- Fix coder-12 (commit `26046f48`) — `force` param sur `/retry-failures`
- Completion rule du ticket

---

## Points validés

- **Normalisation TMDB** — `runtime === 0 → null`, `imdb_id === "" → null`, `overview?.trim() || null` appliqués dans `mapMovieDetail` et `mapSeriesDetail`. ✅
- **`classifyError()`** — extrait le vrai `constructor.name`, `.code`, `.message`. Pas de "Failed query: …" ✅
- **`persistFailure()` / `clearFailure()`** — upsert sur `(media_type, media_id)`, incrémente `retry_count`, nettoyage sur succès. ✅
- **Keyset cursor** — `WHERE id > lastId ORDER BY id ASC` — pas de drift d'offset, idempotent. ✅
- **Fix coder-12 confirmé** — `POST /retry-failures {"force": true}` retourne `{"queued": 1}` pour une failure `retryable: false`. ✅
- **Migrations 0046 + 0047** — `IF NOT EXISTS` safe, journal mis à jour, pas de conflit avec T114. ✅
- **Catalog-stats** — `neverEnriched`, `partiallyEnriched`, `fullyEnriched`, `stale`, `failedLastEnrichment`, `embeddingPending` (NOT EXISTS réel). ✅
- **`embedding-eligibility.ts`** — source de vérité unique (`isEmbeddingEligible`, `EMBEDDING_ELIGIBLE_SQL_PREDICATE`, `embeddingEligibleCondition`). ✅
- **Run local** — 5 films, 39 séries, 444 épisodes traités ; 0 failures ; idempotence confirmée (re-run skip les lignes enrichies). ✅
- **Observabilité des failures** — `stage: "fetch"`, `errorClass`, `errorMessage`, `retryCount`, `occurredAt`, `retryable` présents dans la réponse JSON. ✅

---

## Problèmes détectés

### 🔴 BLOQUANT — Completion rule non satisfaite (13e cycle)

Le ticket stipule explicitement :

> *"Do not close after unit tests. Run the new enrichment mode against production (or an equivalent restored production snapshot), publish before/after counts, and show the remaining terminal failures with their real causes."*

L'artefact `production-run-20260819.md` documente un run sur **6 films en base locale** avec un TMDB ID synthétique (99999999). Ce n'est pas un run sur le catalogue de production (~60k films, ~5k séries). Les 126 vraies failures de production restent indiagnostiquées, et aucun `before/after count` réel n'est publié.

**Ce blocker est exclusivement environnemental** : l'IA n'a pas accès à `DATABASE_URL` production, ni à Fly.io/Railway. Le code lui-même est correct et approuvable sur la base technique.

---

### 🟡 Observations non bloquantes (identiques aux reviews précédentes)

- **`retrying` stat** — accumulateur incrémental sans décrément ; sémantique légèrement trompeuse mais non bloquant.
- **Test cursor pagination** — valide uniquement `countEligible`, pas le comportement `WHERE id > lastId`.
- **Seuil staleness hardcodé** — `30 * 86_400_000` ms dupliqué dans le service et catalog-stats ; centralisation possible mais hors scope du ticket.

---

## Risques éventuels

Aucun risque de régression code détecté. Les migrations sont idempotentes. Le rollback en cas de problème production se fait en ignorant les nouvelles routes (elles ne remplacent pas les routes existantes).

---

## Décision

L'implémentation technique est complète, correcte et conforme au plan. Elle satisfait tous les critères d'acceptance **sauf le dernier** qui exige une démonstration sur le catalogue de production réel.

**Action requise — humain uniquement** :

1. Fournir `DATABASE_URL` production (Railway/Fly.io) pour un restore local, **ou**
2. Exécuter `fly auth login` / `railway login` dans ce terminal, **ou**
3. Exécuter manuellement le playbook `runs/T115/production-run-playbook.md` depuis un accès production.

Sans cette action, la completion rule du ticket ne peut pas être satisfaite par l'IA dans cet environnement.

IMPLEMENTATION_FIX_REQUIRED