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

Correction confirmée. Le playbook mentionne maintenant les bons numéros de migrations : `0047_t115_catalog_refresh_runs_type` et `0048_t115_enrichment_failures`.

**Seul changement effectué** : `runs/T115/production-run-playbook.md` — correction de la numérotation dans Pre-flight checklist et Step 1 (le `0046_t115_catalog_refresh_runs_type` et `0047_t115_enrichment_failures` incorrects remplacés par `0047` et `0048`).

Le reste de l'implémentation (33 tests, code, migrations) était déjà correct selon la review. Le seul blocage restant est opérationnel : executer le playbook contre la production avec `flyctl auth login` puis les commandes curl documentées dans le playbook.

---

## Review

I have all the information needed. The playbook fix was correctly applied. Let me write the review for attempt 28.

---

# PR Review — T115: Complete Catalog Enrichment and Make Refresh Failures Resumable/Observable
## Attempt 28

## Résumé

L'implémentation est **techniquement complète et correcte**. Le seul correctif demandé par la review-27 (numérotation des migrations dans le playbook) a été correctement appliqué par coder-attempt-27. Les 33 tests passent. Aucun changement de code source. Le blocage opérationnel sur la Completion Rule demeure.

---

## Vérifications effectuées

- Exécution des 4 fichiers de tests T115 : **33/33 passent** (vérifié à 23:32:50)
- Lecture du diff `0bf49b42..HEAD` sur `production-run-playbook.md` — correction confirmée
- Vérification des migrations sur le filesystem

```
 ✓ src/services/__tests__/metadata-enrichment-service.test.ts (23 tests)
 ✓ src/services/__tests__/t115-enrichment.test.ts (4 tests)
 ✓ src/routes/__tests__/catalog-stats.test.ts (2 tests)
 ✓ src/providers/metadata/tmdb/__tests__/t115-normalization.test.ts (4 tests)

 Test Files  4 passed (4)
      Tests  33 passed (33)
```

---

## Fix de review-27 — Confirmé ✓

Le playbook `runs/T115/production-run-playbook.md` a été corrigé :

| Localisation | Avant (incorrect) | Après (correct) |
|---|---|---|
| Pre-flight checklist | `should apply 0044, 0045, 0046, 0047` | `should apply at minimum 0047, 0048` |
| Step 1 expected output | `0046_t115_catalog_refresh_runs_type` / `0047_t115_enrichment_failures` | `0047_t115_catalog_refresh_runs_type` / `0048_t115_enrichment_failures` |

Migrations sur le filesystem confirmées :
- `0047_t115_catalog_refresh_runs_type.sql` ✓
- `0048_t115_enrichment_failures.sql` ✓
- `0046_device_account_id.sql` — migration non-T115 qui occupait la position 0046

---

## Points validés (inchangés depuis review-24)

Tous les points techniques validés dans les reviews précédentes restent vrais — aucun changement de code source entre review-27 et cet audit.

**Normalisation TMDB** : `runtime=0 → null`, `imdb_id="" → null`, `overview whitespace → null` ✓  
**`classifyError()`** : extrait constructeur, code PG (`23502`, `23505`…), message brut ✓  
**Pagination keyset** : `WHERE id > :lastId ORDER BY id LIMIT n` ✓  
**Checkpoint JSONB** après chaque batch ✓  
**Protection concurrence** : `checkNoRunningConflict()` + catch `23505` ✓  
**Catalog-stats** : 13 requêtes parallèles, `embeddingPending` via `NOT EXISTS` ✓  
**Routes** : validation bounds, HTTP 202/409/404 cohérents ✓  
**Sécurité** : aucun secret loggué ✓

---

## Problème restant

### [BLOQUANT — Opérationnel, escalade humaine] Completion Rule non satisfaite

Le ticket exige explicitement :

> **Completion rule** : Do not close after unit tests. Run the new enrichment mode against production (or an equivalent restored production snapshot), publish before/after counts, and show the remaining terminal failures with their real causes.

Le seul rapport existant (`production-run-20260819.md`) documente un run sur **6 films en DB locale** — pas une snapshot de production équivalente. Le rapport lui-même l'admet explicitement dans la section "Production access gap".

Critères d'acceptance non démontrés :

| Critère ticket | Statut |
|---|---|
| Run against real production catalog (~60k films / ~5k séries) | ❌ |
| Meaningful reduction of `neverEnriched` | ❌ |
| Remaining terminal failures with their real causes (les 126 échecs) | ❌ |
| Before/after counts at production scale | ❌ |

**Aucun cycle IA supplémentaire ne peut résoudre ce blocage.** Le code, les migrations, les routes, le playbook (désormais correct) sont prêts depuis l'attempt-12.

**Action requise — humain uniquement** :
1. `flyctl auth login` (ou accès direct DB)
2. Exécuter le playbook `runs/T115/production-run-playbook.md` contre la production
3. Créer `runs/T115/production-run-20260820.md` (ou date courante) avec les stats avant/après et la liste des 126 failures avec leurs vraies causes

Après ce rapport commité, la prochaine review devrait approuver immédiatement (aucune autre correction de code n'est attendue).

---

## Décision

Le code est complet et correct. La numérotation du playbook est désormais exacte. Il n'existe aucun défaut de code à corriger. Le seul blocage est opérationnel et requiert impérativement une intervention humaine avec accès à Fly.io.

IMPLEMENTATION_FIX_REQUIRED

---

## Instructions de fix

# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T115/reviews/implementation-review.md
- generated at: 2026-08-20T21:34:08Z

---

I have all the information needed. The playbook fix was correctly applied. Let me write the review for attempt 28.

---

# PR Review — T115: Complete Catalog Enrichment and Make Refresh Failures Resumable/Observable
## Attempt 28

## Résumé

L'implémentation est **techniquement complète et correcte**. Le seul correctif demandé par la review-27 (numérotation des migrations dans le playbook) a été correctement appliqué par coder-attempt-27. Les 33 tests passent. Aucun changement de code source. Le blocage opérationnel sur la Completion Rule demeure.

---

## Vérifications effectuées

- Exécution des 4 fichiers de tests T115 : **33/33 passent** (vérifié à 23:32:50)
- Lecture du diff `0bf49b42..HEAD` sur `production-run-playbook.md` — correction confirmée
- Vérification des migrations sur le filesystem

```
 ✓ src/services/__tests__/metadata-enrichment-service.test.ts (23 tests)
 ✓ src/services/__tests__/t115-enrichment.test.ts (4 tests)
 ✓ src/routes/__tests__/catalog-stats.test.ts (2 tests)
 ✓ src/providers/metadata/tmdb/__tests__/t115-normalization.test.ts (4 tests)

 Test Files  4 passed (4)
      Tests  33 passed (33)
```

---

## Fix de review-27 — Confirmé ✓

Le playbook `runs/T115/production-run-playbook.md` a été corrigé :

| Localisation | Avant (incorrect) | Après (correct) |
|---|---|---|
| Pre-flight checklist | `should apply 0044, 0045, 0046, 0047` | `should apply at minimum 0047, 0048` |
| Step 1 expected output | `0046_t115_catalog_refresh_runs_type` / `0047_t115_enrichment_failures` | `0047_t115_catalog_refresh_runs_type` / `0048_t115_enrichment_failures` |

Migrations sur le filesystem confirmées :
- `0047_t115_catalog_refresh_runs_type.sql` ✓
- `0048_t115_enrichment_failures.sql` ✓
- `0046_device_account_id.sql` — migration non-T115 qui occupait la position 0046

---

## Points validés (inchangés depuis review-24)

Tous les points techniques validés dans les reviews précédentes restent vrais — aucun changement de code source entre review-27 et cet audit.

**Normalisation TMDB** : `runtime=0 → null`, `imdb_id="" → null`, `overview whitespace → null` ✓  
**`classifyError()`** : extrait constructeur, code PG (`23502`, `23505`…), message brut ✓  
**Pagination keyset** : `WHERE id > :lastId ORDER BY id LIMIT n` ✓  
**Checkpoint JSONB** après chaque batch ✓  
**Protection concurrence** : `checkNoRunningConflict()` + catch `23505` ✓  
**Catalog-stats** : 13 requêtes parallèles, `embeddingPending` via `NOT EXISTS` ✓  
**Routes** : validation bounds, HTTP 202/409/404 cohérents ✓  
**Sécurité** : aucun secret loggué ✓

---

## Problème restant

### [BLOQUANT — Opérationnel, escalade humaine] Completion Rule non satisfaite

Le ticket exige explicitement :

> **Completion rule** : Do not close after unit tests. Run the new enrichment mode against production (or an equivalent restored production snapshot), publish before/after counts, and show the remaining terminal failures with their real causes.

Le seul rapport existant (`production-run-20260819.md`) documente un run sur **6 films en DB locale** — pas une snapshot de production équivalente. Le rapport lui-même l'admet explicitement dans la section "Production access gap".

Critères d'acceptance non démontrés :

| Critère ticket | Statut |
|---|---|
| Run against real production catalog (~60k films / ~5k séries) | ❌ |
| Meaningful reduction of `neverEnriched` | ❌ |
| Remaining terminal failures with their real causes (les 126 échecs) | ❌ |
| Before/after counts at production scale | ❌ |

**Aucun cycle IA supplémentaire ne peut résoudre ce blocage.** Le code, les migrations, les routes, le playbook (désormais correct) sont prêts depuis l'attempt-12.

**Action requise — humain uniquement** :
1. `flyctl auth login` (ou accès direct DB)
2. Exécuter le playbook `runs/T115/production-run-playbook.md` contre la production
3. Créer `runs/T115/production-run-20260820.md` (ou date courante) avec les stats avant/après et la liste des 126 failures avec leurs vraies causes

Après ce rapport commité, la prochaine review devrait approuver immédiatement (aucune autre correction de code n'est attendue).

---

## Décision

Le code est complet et correct. La numérotation du playbook est désormais exacte. Il n'existe aucun défaut de code à corriger. Le seul blocage est opérationnel et requiert impérativement une intervention humaine avec accès à Fly.io.

IMPLEMENTATION_FIX_REQUIRED