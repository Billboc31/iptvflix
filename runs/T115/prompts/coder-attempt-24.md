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

The fixes look correct. Here's a summary of what was changed:

**Files modified:**

1. **`apps/api/src/services/catalog-enrich-missing-service.ts`** — `retryFailures()` now tracks `{ totalEligible, processed, enriched, skipped, retrying, failedTerminal }` per item, and saves them to `checkpoint.stats` (with `remaining` = `failedTerminal`, `ratePerMinute: 0`, `etaSeconds: null`) when the run completes. Also sets `failedCount` on the run record. `GET /admin/catalog-enrich-missing/status` after a retry run will now return meaningful stats instead of `"stats": null`.

2. **`apps/api/src/db/schema/enrichment-failures.ts`** — added a one-line comment above `retryCount` clarifying `0 = initial failure, no retry attempted; incremented on each subsequent retry`.

**Remaining blocker (unchanged — requires human action):** The Completion Rule requires a production run via `flyctl`. The playbook at `runs/T115/production-run-playbook.md` documents the exact steps; it must be executed by an operator with Fly.io access.

---

## Review

I have a complete picture. Let me write the review.

---

# PR Review — T115: Complete Catalog Enrichment and Make Refresh Failures Resumable/Observable

## Résumé

Coder-attempt-23 résout correctement les deux problèmes mineurs identifiés lors de la review précédente. L'implémentation technique est complète, propre et bien testée (33 tests). Le **seul blocage restant** est le **Completion Rule** du ticket, toujours non honoré : aucun run sur le catalogue de production réel n'a été exécuté et aucun résultat avant/après n'a été publié.

---

## Vérifications effectuées

- Lecture du diff complet de coder-attempt-23 (`catalog-enrich-missing-service.ts`, `enrichment-failures.ts`)
- Relecture du service complet `CatalogEnrichMissingService` pour valider la correction des mineurs
- Lecture de l'`implementation-output.md` pour comprendre ce qui a été fait
- Lecture du rapport de run (`production-run-20260819.md`) pour confirmer qu'aucun run production n'a été ajouté
- Consultation de la review précédente (`reviews/implementation-review.md`) pour vérifier que toutes les demandes ont été traitées

---

## Points validés depuis la review précédente

**[Mineur résolu] `retryFailures()` trace maintenant les stats dans le checkpoint**

Le diff montre :
- Ajout d'un objet `stats` avec `totalEligible`, `processed`, `enriched`, `skipped`, `retrying`, `failedTerminal`
- Comptage par item dans les callbacks `onRetry` et dans le try/catch per-item
- Construction de `finalCheckpoint = { stats: { ...stats, remaining: stats.failedTerminal, ratePerMinute: 0, etaSeconds: null } }` dans le `.then()` handler
- Mise à jour du run avec `checkpoint: finalCheckpoint` et `failedCount: stats.failedTerminal`

La correction est correcte. `GET /admin/catalog-enrich-missing/status` après un retry run retournera maintenant des stats significatives au lieu de `"stats": null`. La sémantique de `remaining: stats.failedTerminal` est cohérente pour un retry run (= items qui ont encore échoué après le retry). La valeur `ratePerMinute: 0` est acceptable pour un run complété sans suivi de timing.

**[Mineur résolu] `retryCount: 0` — commentaire de clarification ajouté**

```typescript
// 0 = initial failure, no retry attempted; incremented on each subsequent retry
retryCount: integer('retry_count').notNull().default(0),
```

Suffisant. La sémantique est maintenant documentée au niveau du schéma.

**Vérification de la cohérence stats.retrying dans retryFailures()**

Le `stats.retrying++` est passé comme callback `onRetry` à `enrichWithRetry()`, ce qui est cohérent avec le comportement de `execute()`. Le commentaire JSDoc `/** Counts retry *attempts*, not unique items */` dans `EnrichMissingStats` couvre ce comportement. Pas d'incohérence.

---

## Problèmes détectés

### [BLOQUANT] Completion Rule non respectée — run production absent

Le ticket stipule explicitement :

> **Completion rule** : Do not close after unit tests. Run the new enrichment mode against production (or an equivalent restored production snapshot), publish before/after counts, and show the remaining terminal failures with their real causes.

Le rapport `runs/T115/production-run-20260819.md` reste inchangé depuis la review précédente : run sur base locale avec 6 films seulement (dont 1 cas de test artificiel avec TMDB ID `99999999`). Ce run ne constitue pas une validation au sens du Completion Rule.

**Ce que le Completion Rule exige et qui n'est pas démontré :**
- Stats avant/après sur le catalogue de production réel (~60k films / ~5k séries)
- Réduction mesurable de `neverEnriched` / `partiallyEnriched` sur le vrai catalogue
- Causes réelles des 126 échecs de production (notamment `Les Chevaliers du Fiel : L'assassin est dans la salle` avec son vrai TMDB ID — pas le 99999999 artificiel)
- Comportement de la pagination keyset et du checkpoint sur volume réel
- Comportement de la migration 0047 sur une table de production non vide

**Ce blocage ne peut pas être levé par un changement de code.** Il requiert une action humaine : exécuter le `production-run-playbook.md` avec accès Fly.io authentifié et publier le rapport résultant dans `runs/T115/production-run-YYYYMMDD.md`.

---

## Risques éventuels

*(Inchangés depuis la review précédente)*

1. **Stats query à l'échelle** : 13 requêtes agrégées parallèles sur 60k lignes sans cache. À monitorer après déploiement.
2. **Conflict 409 avec refresh planifié** : documenté dans le playbook, comportement correct.
3. **Rate limiting TMDB** : `throttleMs ≥ 500ms` recommandé pour les runs production sur grande volumétrie.

---

## Décision

Les deux corrections demandées lors de la review précédente sont livrées correctement. L'implémentation technique est finalisée.

Le seul motif de blocage est le **Completion Rule non exécuté** — étape opérationnelle qui requiert un accès Fly.io humain. Le playbook est prêt et complet ; l'implémentation peut être approuvée dès que les résultats du run production (avant/après stats + liste des failures réelles) sont publiés dans `runs/T115/`.

**Action requise (humaine) :** exécuter le playbook `runs/T115/production-run-playbook.md` contre l'environnement de production, attacher le rapport dans `runs/T115/production-run-YYYYMMDD.md`, puis relancer la review.

---

IMPLEMENTATION_FIX_REQUIRED

---

## Instructions de fix

# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T115/reviews/implementation-review.md
- generated at: 2026-08-20T21:07:31Z

---

I have a complete picture. Let me write the review.

---

# PR Review — T115: Complete Catalog Enrichment and Make Refresh Failures Resumable/Observable

## Résumé

Coder-attempt-23 résout correctement les deux problèmes mineurs identifiés lors de la review précédente. L'implémentation technique est complète, propre et bien testée (33 tests). Le **seul blocage restant** est le **Completion Rule** du ticket, toujours non honoré : aucun run sur le catalogue de production réel n'a été exécuté et aucun résultat avant/après n'a été publié.

---

## Vérifications effectuées

- Lecture du diff complet de coder-attempt-23 (`catalog-enrich-missing-service.ts`, `enrichment-failures.ts`)
- Relecture du service complet `CatalogEnrichMissingService` pour valider la correction des mineurs
- Lecture de l'`implementation-output.md` pour comprendre ce qui a été fait
- Lecture du rapport de run (`production-run-20260819.md`) pour confirmer qu'aucun run production n'a été ajouté
- Consultation de la review précédente (`reviews/implementation-review.md`) pour vérifier que toutes les demandes ont été traitées

---

## Points validés depuis la review précédente

**[Mineur résolu] `retryFailures()` trace maintenant les stats dans le checkpoint**

Le diff montre :
- Ajout d'un objet `stats` avec `totalEligible`, `processed`, `enriched`, `skipped`, `retrying`, `failedTerminal`
- Comptage par item dans les callbacks `onRetry` et dans le try/catch per-item
- Construction de `finalCheckpoint = { stats: { ...stats, remaining: stats.failedTerminal, ratePerMinute: 0, etaSeconds: null } }` dans le `.then()` handler
- Mise à jour du run avec `checkpoint: finalCheckpoint` et `failedCount: stats.failedTerminal`

La correction est correcte. `GET /admin/catalog-enrich-missing/status` après un retry run retournera maintenant des stats significatives au lieu de `"stats": null`. La sémantique de `remaining: stats.failedTerminal` est cohérente pour un retry run (= items qui ont encore échoué après le retry). La valeur `ratePerMinute: 0` est acceptable pour un run complété sans suivi de timing.

**[Mineur résolu] `retryCount: 0` — commentaire de clarification ajouté**

```typescript
// 0 = initial failure, no retry attempted; incremented on each subsequent retry
retryCount: integer('retry_count').notNull().default(0),
```

Suffisant. La sémantique est maintenant documentée au niveau du schéma.

**Vérification de la cohérence stats.retrying dans retryFailures()**

Le `stats.retrying++` est passé comme callback `onRetry` à `enrichWithRetry()`, ce qui est cohérent avec le comportement de `execute()`. Le commentaire JSDoc `/** Counts retry *attempts*, not unique items */` dans `EnrichMissingStats` couvre ce comportement. Pas d'incohérence.

---

## Problèmes détectés

### [BLOQUANT] Completion Rule non respectée — run production absent

Le ticket stipule explicitement :

> **Completion rule** : Do not close after unit tests. Run the new enrichment mode against production (or an equivalent restored production snapshot), publish before/after counts, and show the remaining terminal failures with their real causes.

Le rapport `runs/T115/production-run-20260819.md` reste inchangé depuis la review précédente : run sur base locale avec 6 films seulement (dont 1 cas de test artificiel avec TMDB ID `99999999`). Ce run ne constitue pas une validation au sens du Completion Rule.

**Ce que le Completion Rule exige et qui n'est pas démontré :**
- Stats avant/après sur le catalogue de production réel (~60k films / ~5k séries)
- Réduction mesurable de `neverEnriched` / `partiallyEnriched` sur le vrai catalogue
- Causes réelles des 126 échecs de production (notamment `Les Chevaliers du Fiel : L'assassin est dans la salle` avec son vrai TMDB ID — pas le 99999999 artificiel)
- Comportement de la pagination keyset et du checkpoint sur volume réel
- Comportement de la migration 0047 sur une table de production non vide

**Ce blocage ne peut pas être levé par un changement de code.** Il requiert une action humaine : exécuter le `production-run-playbook.md` avec accès Fly.io authentifié et publier le rapport résultant dans `runs/T115/production-run-YYYYMMDD.md`.

---

## Risques éventuels

*(Inchangés depuis la review précédente)*

1. **Stats query à l'échelle** : 13 requêtes agrégées parallèles sur 60k lignes sans cache. À monitorer après déploiement.
2. **Conflict 409 avec refresh planifié** : documenté dans le playbook, comportement correct.
3. **Rate limiting TMDB** : `throttleMs ≥ 500ms` recommandé pour les runs production sur grande volumétrie.

---

## Décision

Les deux corrections demandées lors de la review précédente sont livrées correctement. L'implémentation technique est finalisée.

Le seul motif de blocage est le **Completion Rule non exécuté** — étape opérationnelle qui requiert un accès Fly.io humain. Le playbook est prêt et complet ; l'implémentation peut être approuvée dès que les résultats du run production (avant/après stats + liste des failures réelles) sont publiés dans `runs/T115/`.

**Action requise (humaine) :** exécuter le playbook `runs/T115/production-run-playbook.md` contre l'environnement de production, attacher le rapport dans `runs/T115/production-run-YYYYMMDD.md`, puis relancer la review.

---

IMPLEMENTATION_FIX_REQUIRED