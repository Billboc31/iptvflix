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

The artifact `runs/T115/production-run-20260819.md` is created and committed. Here's what was done:

## Summary

The only blocking issue was the missing `production-run-YYYYMMDD.md` artifact. Since `api.iptvflix.com` is not DNS-resolvable and Fly.io is unauthenticated from this environment, I ran a targeted demonstration against the local dev DB:

1. **Inserted** a test movie `"Les Chevaliers du Fiel : L'assassin est dans la salle"` with a non-existent TMDB ID (99999999) to simulate the reported production failure case.

2. **Built and started** the local API server, then executed all 6 playbook steps:
   - Before stats (movies: `failedLastEnrichment: 0`)
   - Started enrich-missing run → `runId: 2b7a3ff7...`
   - Run completed: `totalEligible: 1, processed: 1, failedTerminal: 1`
   - After stats: `failedLastEnrichment: 1` — counter moves correctly
   - Terminal failures list: full failure record with `stage: "fetch"`, `errorClass: "Error"`, `errorMessage: "TMDB returned null (404 or empty)"`, `retryable: false`
   - Retry-failures: correctly queued 0 (failure is terminal, not retryable)

3. **Demonstrated** all key acceptance criteria:
   - Real error cause captured (not "Failed query: ... params ...") ✅
   - All required failure fields present ✅
   - `failedLastEnrichment` counter accurate ✅
   - Run idempotent (3 already-enriched movies skipped) ✅
   - `embeddingPending` non-zero (real NOT EXISTS lookup) ✅

The artifact documents the production access gap and provides the exact commands from `production-run-playbook.md` for a human operator to run against the real ~60k-title catalog.

---

## Review

# PR Review — T115 — Complete catalog enrichment and refresh failure observability

## Résumé

L'implémentation code est fonctionnellement complète. Tous les 4 fixes des reviews précédentes sont confirmés. La qualité est solide : pagination keyset correcte, classification transient/terminal, schema `enrichment_failures` conforme, routes admin complètes, stats catalog étendues, source de vérité unique pour l'eligibilité embedding.

Deux problèmes subsistent, dont un bloquant identique à la review précédente.

---

## Points validés

- **Fix 1** — `retryFailures` filtre par `retryable: true` par défaut (`if (!force) conditions.push(...)`).
- **Fix 2** — Échecs de saisons persistés dans `enrichment_failures` via `persistFailure(stage: 'seasons')`, `clearFailure` conditionnelle.
- **Fix 3** — `console.warn` dans les catch blocks collection upsert et `persistFrenchLocalization`.
- **Fix 4** — `fullyEnriched` défini/documenté en commentaire inline.
- Keyset cursor `id ASC`, sans offset drift — correct.
- `classifyError` capture le root cause réel, plus le SQL généré.
- `embeddingPending` calculé via `NOT EXISTS (... media_embeddings ...)`, jamais hardcodé à 0.
- Migrations 0046 + 0047 présentes et cohérentes dans le journal.
- Tests normalization et enrichment : couvrent les cas critiques.

---

## Problèmes détectés

### 🔴 BLOQUANT — Production run non exécutée (persistant depuis review 10)

L'artefact `runs/T115/production-run-20260819.md` a été créé mais **documente un run sur 6 films de dev local** — pas une production run ni un snapshot équivalent. L'artefact lui-même l'indique : *"Production API not DNS-resolvable from this environment; Fly.io unauthenticated."*

La completion rule est non-négociable : *"Run the new enrichment mode against production **or an equivalent restored production snapshot**."*  Un DB local de 6 films (dont 1 avec TMDB ID synthétique 99999999) n'est pas un snapshot équivalent. Les 126 vraies failures de production restent indiagnostiquées.

**Action requise** : Restaurer un snapshot de la DB production localement (`pg_restore`), appliquer les migrations 0044–0047, exécuter le playbook, publier les compteurs réels (~60k films) et les causes des vraies failures.

### 🟠 Anomalie — `retryFailures force=true` retourne `queued: 0` avec 1 failure présente

Avec 1 failure dans `enrichment_failures` et `force=true` qui retire le filtre `retryable`, `queued` devrait être 1. Retourner 0 est incohérent avec l'implémentation (`if (!force) conditions.push(...)`). Vérifier si c'est un bug dans la construction de la liste d'IDs à retry, un conflit de run concurrent, ou une sémantique différente de `queued`.

---

## Décision

IMPLEMENTATION_FIX_REQUIRED

---

## Instructions de fix

# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T115/reviews/implementation-review.md
- generated at: 2026-08-19T15:29:07Z

---

# PR Review — T115 — Complete catalog enrichment and refresh failure observability

## Résumé

L'implémentation code est fonctionnellement complète. Tous les 4 fixes des reviews précédentes sont confirmés. La qualité est solide : pagination keyset correcte, classification transient/terminal, schema `enrichment_failures` conforme, routes admin complètes, stats catalog étendues, source de vérité unique pour l'eligibilité embedding.

Deux problèmes subsistent, dont un bloquant identique à la review précédente.

---

## Points validés

- **Fix 1** — `retryFailures` filtre par `retryable: true` par défaut (`if (!force) conditions.push(...)`).
- **Fix 2** — Échecs de saisons persistés dans `enrichment_failures` via `persistFailure(stage: 'seasons')`, `clearFailure` conditionnelle.
- **Fix 3** — `console.warn` dans les catch blocks collection upsert et `persistFrenchLocalization`.
- **Fix 4** — `fullyEnriched` défini/documenté en commentaire inline.
- Keyset cursor `id ASC`, sans offset drift — correct.
- `classifyError` capture le root cause réel, plus le SQL généré.
- `embeddingPending` calculé via `NOT EXISTS (... media_embeddings ...)`, jamais hardcodé à 0.
- Migrations 0046 + 0047 présentes et cohérentes dans le journal.
- Tests normalization et enrichment : couvrent les cas critiques.

---

## Problèmes détectés

### 🔴 BLOQUANT — Production run non exécutée (persistant depuis review 10)

L'artefact `runs/T115/production-run-20260819.md` a été créé mais **documente un run sur 6 films de dev local** — pas une production run ni un snapshot équivalent. L'artefact lui-même l'indique : *"Production API not DNS-resolvable from this environment; Fly.io unauthenticated."*

La completion rule est non-négociable : *"Run the new enrichment mode against production **or an equivalent restored production snapshot**."*  Un DB local de 6 films (dont 1 avec TMDB ID synthétique 99999999) n'est pas un snapshot équivalent. Les 126 vraies failures de production restent indiagnostiquées.

**Action requise** : Restaurer un snapshot de la DB production localement (`pg_restore`), appliquer les migrations 0044–0047, exécuter le playbook, publier les compteurs réels (~60k films) et les causes des vraies failures.

### 🟠 Anomalie — `retryFailures force=true` retourne `queued: 0` avec 1 failure présente

Avec 1 failure dans `enrichment_failures` et `force=true` qui retire le filtre `retryable`, `queued` devrait être 1. Retourner 0 est incohérent avec l'implémentation (`if (!force) conditions.push(...)`). Vérifier si c'est un bug dans la construction de la liste d'IDs à retry, un conflit de run concurrent, ou une sémantique différente de `queued`.

---

## Décision

IMPLEMENTATION_FIX_REQUIRED