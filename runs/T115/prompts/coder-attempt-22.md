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

The fix is clean and correct. Here's what was done:

**Code fix** (`metadata-enrichment-service.ts:437-459`): `enrichSeries` was ignoring the `retryable` return value from `persistFailure` on season failures, always returning `'terminal-failed'`. This meant `enrichWithRetry` could never retry transient network errors on season enrichment. Fixed by capturing `{ retryable }` and returning `'provider-failed'` for transient errors (triggering `enrichWithRetry`'s backoff loop) or `'terminal-failed'` for permanent ones.

**Documentation** (`production-run-playbook.md`): Added a "Season enrichment failures — retry behavior" section explaining that transient season failures now auto-retry (up to 3 attempts), terminal ones persist in `enrichment_failures` and require a manual `retry-failures` call, with the exact curl command.

All 27 T115 tests pass. The remaining blocker (production run requiring `flyctl auth login`) still requires human operator action as noted in the review.

---

## Review

I have a complete picture. Let me write the review.

---

# PR Review — T115 — Complete catalog enrichment and make refresh failures resumable/observable

## Résumé

L'implémentation code est entièrement correcte. Le mineur de la review-21 (retour `'provider-failed'` vs `'terminal-failed'` selon la valeur de `retryable` dans `enrichSeriesSeasons`) a été correctement corrigé par coder-21 ; la documentation playbook a également été mise à jour. Tous les problèmes code détectés sur 21 cycles de review sont résolus. Le seul bloquant restant est structurellement inchangé depuis review-21 : la completion rule du ticket impose un run sur catalogue de production, qui nécessite une authentification humaine (`flyctl auth login`).

---

## Vérifications effectuées

- Lecture de `metadata-enrichment-service.ts:437-459` — correction du retour conditionnel `'provider-failed'` / `'terminal-failed'` selon la valeur `retryable` issue de `persistFailure`.
- Lecture de `catalog-enrich-missing-service.ts:94-104` — confirmation que `enrichWithRetry` boucle bien sur `result === 'provider-failed'`.
- Lecture de `production-run-playbook.md` — section "Season enrichment failures — retry behavior" (lignes 175-188) présente, correcte.
- Lecture de `production-run-20260819.md` — run local sur 6 films dev, confirmé non-équivalent à un run production.
- Vérification de `catalog-enrich-missing-service.ts:370-428` — `retryFailures` avec `force=false` (défaut), `retryable=true` filtré, retour anticipé si 0 failures.
- 27 tests pass (rapporté par implementation-output.md).

---

## Points validés

**Fix du mineur review-21 (retour conditionnel season failures)**
- `metadata-enrichment-service.ts:451` : `seasonsFailureResult = retryable ? 'provider-failed' : 'terminal-failed'`
- Correct : transient → `enrichWithRetry` relance jusqu'à 3 fois ; permanent → `'terminal-failed'` immédiat.
- `enrichWithRetry` (ligne 94-104) : loop conditionnel sur `'provider-failed'` — comportement confirmé.

**Documentation playbook (fix mineur review-21)**
- Section "Season enrichment failures — retry behavior" présente avec commande `retry-failures` et explication `{"force": true}`.

**Tous les points de review-21 validés demeurent vrais**
- `classifyError()` capture `PostgresError` / code driver / message.
- Pagination curseur keyset, checkpoint JSONB, idempotence.
- `enrichment_failures` tous champs ticket présents.
- Stats catalog : neverEnriched, partiallyEnriched, fullyEnriched, stale, failedLastEnrichment, enrichedWithSeasonFailures, embeddingEligible, embeddingBlocked, embeddingPending (NOT EXISTS réel).
- `embedding-eligibility.ts` : politique documentée, source unique.

---

## Problèmes détectés

### [BLOQUANT] — Completion rule non satisfaite : run production non exécuté

Le ticket est explicite et non-négociable :
> "Do not close after unit tests. Run the new enrichment mode against production (or an equivalent restored production snapshot), publish before/after counts, and show the remaining terminal failures with their real causes."

Acceptance criteria #9 :
> "Run against the real production catalog and demonstrate meaningful reduction of incomplete titles and successful retry/fix of the previous failure population."

Le run `production-run-20260819.md` porte sur 6 films de dev avec un TMDB ID fictif. Il ne satisfait pas ces exigences. Le playbook est prêt mais non exécuté.

**Diagnostic** : Le coder ne peut pas résoudre ce point. `flyctl auth login` n'est pas disponible dans l'environnement IA et le DNS production (`api.iptvflix.com`) n'est pas résolvable. C'est un bloquant opérationnel pur, non un défaut de code.

**Action requise (humain uniquement)** : Exécuter `runs/T115/production-run-playbook.md` sur un environnement connecté à Fly.io :
1. Vérifier les migrations 0044-0047 appliquées.
2. Capturer `/admin/catalog-stats` **avant** (BEFORE snapshot sur ~60k films / ~5k séries).
3. `POST /admin/catalog-enrich-missing` avec `{"batchSize":50,"concurrency":3,"throttleMs":500}`.
4. Attendre `status: "COMPLETED"`.
5. Capturer `/admin/catalog-stats` **après** (AFTER snapshot).
6. `GET /admin/catalog-enrich-missing/failures?limit=200` — liste des failures avec `errorClass`, `errorCode`, `errorMessage` réels.
7. Publier dans `runs/T115/production-run-YYYYMMDD.md`.

---

## Risques résiduels (inchangés, non bloquants pour le code)

- **Ghost run** : un run ENRICH_MISSING bloqué en `RUNNING` empêche tout nouveau run. Pas de timeout automatique. Risque opérationnel faible.
- **Rate limit TMDB** : backoff 250/500/1000ms peut être insuffisant pour 60k titres en rafale soutenue. `throttleMs` atténue.
- **`mediaType` non contraint en DB** : colonne `text` sans CHECK CONSTRAINT ; TypeScript protège mais pas la couche DB.

---

## Décision

L'implémentation code est **complète et correcte**. Le fix de coder-21 sur le retour conditionnel des échecs de saisons est exact. Le cycle de review code est terminé.

Le ticket reste bloqué sur sa completion rule opérationnelle. Aucun changement de code ne peut débloquer cette situation. **L'action requise est humaine et unique** : exécuter le playbook production et publier l'artefact.

Si l'opérateur humain exécute le playbook et publie `runs/T115/production-run-YYYYMMDD.md`, la review suivante peut approuver.

## Actions demandées

1. **[BLOQUANT — HUMAIN REQUIS]** Exécuter `runs/T115/production-run-playbook.md` avec un accès Fly.io authentifié. Publier le rapport dans `runs/T115/production-run-YYYYMMDD.md`.

IMPLEMENTATION_FIX_REQUIRED

---

## Instructions de fix

# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T115/reviews/implementation-review.md
- generated at: 2026-08-20T20:49:32Z

---

I have a complete picture. Let me write the review.

---

# PR Review — T115 — Complete catalog enrichment and make refresh failures resumable/observable

## Résumé

L'implémentation code est entièrement correcte. Le mineur de la review-21 (retour `'provider-failed'` vs `'terminal-failed'` selon la valeur de `retryable` dans `enrichSeriesSeasons`) a été correctement corrigé par coder-21 ; la documentation playbook a également été mise à jour. Tous les problèmes code détectés sur 21 cycles de review sont résolus. Le seul bloquant restant est structurellement inchangé depuis review-21 : la completion rule du ticket impose un run sur catalogue de production, qui nécessite une authentification humaine (`flyctl auth login`).

---

## Vérifications effectuées

- Lecture de `metadata-enrichment-service.ts:437-459` — correction du retour conditionnel `'provider-failed'` / `'terminal-failed'` selon la valeur `retryable` issue de `persistFailure`.
- Lecture de `catalog-enrich-missing-service.ts:94-104` — confirmation que `enrichWithRetry` boucle bien sur `result === 'provider-failed'`.
- Lecture de `production-run-playbook.md` — section "Season enrichment failures — retry behavior" (lignes 175-188) présente, correcte.
- Lecture de `production-run-20260819.md` — run local sur 6 films dev, confirmé non-équivalent à un run production.
- Vérification de `catalog-enrich-missing-service.ts:370-428` — `retryFailures` avec `force=false` (défaut), `retryable=true` filtré, retour anticipé si 0 failures.
- 27 tests pass (rapporté par implementation-output.md).

---

## Points validés

**Fix du mineur review-21 (retour conditionnel season failures)**
- `metadata-enrichment-service.ts:451` : `seasonsFailureResult = retryable ? 'provider-failed' : 'terminal-failed'`
- Correct : transient → `enrichWithRetry` relance jusqu'à 3 fois ; permanent → `'terminal-failed'` immédiat.
- `enrichWithRetry` (ligne 94-104) : loop conditionnel sur `'provider-failed'` — comportement confirmé.

**Documentation playbook (fix mineur review-21)**
- Section "Season enrichment failures — retry behavior" présente avec commande `retry-failures` et explication `{"force": true}`.

**Tous les points de review-21 validés demeurent vrais**
- `classifyError()` capture `PostgresError` / code driver / message.
- Pagination curseur keyset, checkpoint JSONB, idempotence.
- `enrichment_failures` tous champs ticket présents.
- Stats catalog : neverEnriched, partiallyEnriched, fullyEnriched, stale, failedLastEnrichment, enrichedWithSeasonFailures, embeddingEligible, embeddingBlocked, embeddingPending (NOT EXISTS réel).
- `embedding-eligibility.ts` : politique documentée, source unique.

---

## Problèmes détectés

### [BLOQUANT] — Completion rule non satisfaite : run production non exécuté

Le ticket est explicite et non-négociable :
> "Do not close after unit tests. Run the new enrichment mode against production (or an equivalent restored production snapshot), publish before/after counts, and show the remaining terminal failures with their real causes."

Acceptance criteria #9 :
> "Run against the real production catalog and demonstrate meaningful reduction of incomplete titles and successful retry/fix of the previous failure population."

Le run `production-run-20260819.md` porte sur 6 films de dev avec un TMDB ID fictif. Il ne satisfait pas ces exigences. Le playbook est prêt mais non exécuté.

**Diagnostic** : Le coder ne peut pas résoudre ce point. `flyctl auth login` n'est pas disponible dans l'environnement IA et le DNS production (`api.iptvflix.com`) n'est pas résolvable. C'est un bloquant opérationnel pur, non un défaut de code.

**Action requise (humain uniquement)** : Exécuter `runs/T115/production-run-playbook.md` sur un environnement connecté à Fly.io :
1. Vérifier les migrations 0044-0047 appliquées.
2. Capturer `/admin/catalog-stats` **avant** (BEFORE snapshot sur ~60k films / ~5k séries).
3. `POST /admin/catalog-enrich-missing` avec `{"batchSize":50,"concurrency":3,"throttleMs":500}`.
4. Attendre `status: "COMPLETED"`.
5. Capturer `/admin/catalog-stats` **après** (AFTER snapshot).
6. `GET /admin/catalog-enrich-missing/failures?limit=200` — liste des failures avec `errorClass`, `errorCode`, `errorMessage` réels.
7. Publier dans `runs/T115/production-run-YYYYMMDD.md`.

---

## Risques résiduels (inchangés, non bloquants pour le code)

- **Ghost run** : un run ENRICH_MISSING bloqué en `RUNNING` empêche tout nouveau run. Pas de timeout automatique. Risque opérationnel faible.
- **Rate limit TMDB** : backoff 250/500/1000ms peut être insuffisant pour 60k titres en rafale soutenue. `throttleMs` atténue.
- **`mediaType` non contraint en DB** : colonne `text` sans CHECK CONSTRAINT ; TypeScript protège mais pas la couche DB.

---

## Décision

L'implémentation code est **complète et correcte**. Le fix de coder-21 sur le retour conditionnel des échecs de saisons est exact. Le cycle de review code est terminé.

Le ticket reste bloqué sur sa completion rule opérationnelle. Aucun changement de code ne peut débloquer cette situation. **L'action requise est humaine et unique** : exécuter le playbook production et publier l'artefact.

Si l'opérateur humain exécute le playbook et publie `runs/T115/production-run-YYYYMMDD.md`, la review suivante peut approuver.

## Actions demandées

1. **[BLOQUANT — HUMAIN REQUIS]** Exécuter `runs/T115/production-run-playbook.md` avec un accès Fly.io authentifié. Publier le rapport dans `runs/T115/production-run-YYYYMMDD.md`.

IMPLEMENTATION_FIX_REQUIRED