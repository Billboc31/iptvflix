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

Here's a summary of all fixes applied in this coder attempt:

---

**3 additional fixes beyond what coder-attempt-5 had:**

1. **Migration rename** — `0045_t115_enrichment_failures.sql` → `0047_t115_enrichment_failures.sql`  
   Two files shared the `0045` prefix. The T114 migration already owns that slot; the T115 migration is moved to `0047`.

2. **Journal update** — `migrations/meta/_journal.json` (4 new entries, idx 44–47)  
   `migrate-safe.mjs` is journal-driven — files not listed in it are silently skipped. All 4 new migrations (T107, T114, and the two T115 ones) were unregistered. Added entries for all of them. Validated: all 48 journal entries have matching SQL files.

3. **Bug fix in `catalog-stats.ts:20`** — `staleThreshold` `.toISOString()`  
   A bare `new Date()` inside a `sql\`...\`` template literal caused a `TypeError` in the postgres.js driver. Fixed by calling `.toISOString()` to pass a string. The endpoint now returns 200.

**Local validation run** confirms end-to-end correctness: 5 TMDB-matched items enriched (3 movies + 2 series), 0 terminal failures, 444 episodes fetched, before/after stats captured in `runs/T115/local-validation-run-20260819.md`.

**The only remaining gap** is a full production run (~60k movies / ~5k series). That requires access to the production environment to deploy the branch and execute the endpoints.

---

## Review

I have a complete picture of what coder-attempt-6 produced. Let me write the review.

---

# PR Review — T115: Complete catalog enrichment and make refresh failures resumable/observable

**Review attempt:** 6

## Résumé

Coder-attempt-6 apporte trois corrections de code (renommage migration `0047`, mise à jour du journal, fix `toISOString()` dans `catalog-stats.ts`) et produit un artefact de run local (`runs/T115/local-validation-run-20260819.md`). Ces corrections lèvent les risques techniques identifiés en review 5 (conflit de numérotation migration, erreur `TypeError` sur `Date`). Cependant, **le blocker de completion rule reste non satisfait** : un run local avec 5 films et 39 séries de dev n'est pas équivalent à un snapshot production, et les 126 failures de production ne sont pas diagnostiquées.

## Vérifications effectuées

- `apps/api/migrations/meta/_journal.json` — entrées idx 44–47 présentes ✓
- `apps/api/migrations/0047_t115_enrichment_failures.sql` — fichier renommé, plus de conflit avec `0045_t114` ✓
- `apps/api/src/routes/catalog-stats.ts:20` — `staleThreshold` utilise `.toISOString()` ✓
- `apps/api/src/services/catalog-enrich-missing-service.ts` — code inchangé depuis review 5, fixes `matchStatus = 'MATCHED'` inconditionnels confirmés ✓
- `apps/api/src/services/metadata-enrichment-service.ts` — `classifyError`, `persistFailure`, `clearFailure` confirmés ✓
- `runs/T115/local-validation-run-20260819.md` — artefact de run local présent

## Points validés (inchangés depuis review 5)

Tous les points techniques restent validés :
- TMDB normalization (`runtime=0` → `null`, empty `imdb_id` → `null`, blank `overview` → `null`) ✓
- `classifyError()` expose le vrai `error.constructor.name`, `.code`, `.message` ✓
- Upsert `enrichment_failures` avec `ON CONFLICT` incrémentant `retryCount` ✓
- `clearFailure()` sur succès ✓
- Keyset cursor `WHERE id > :lastId` sans drift ✓
- `matchStatus = 'MATCHED'` inconditionnellement dans `countEligible()` et `execute()` ✓
- 8 nouvelles métriques dans `/admin/catalog-stats` + `embeddingPending` non-hardcodé ✓
- Migrations `0046` et `0047` + journal complet ✓

## Corrections de coder-attempt-6 validées

**Migration renommée** (`0047_t115_enrichment_failures.sql`) : le conflit `0045` signalé comme risque en review 5 est éliminé ✓

**Journal complet** (idx 44–47) : les 4 migrations T107/T114/T115 sont enregistrées, `migrate-safe.mjs` ne les sautera plus silencieusement ✓

**`staleThreshold.toISOString()`** (`catalog-stats.ts:20`) : le `TypeError` postgres.js sur interpolation de `Date` brut est corrigé, l'endpoint retourne 200 ✓

## Problème bloquant — Completion rule non satisfaite

### Le run local ne constitue pas un "équivalent restored production snapshot"

Le ticket stipule :

> **Do not close after unit tests. Run the new enrichment mode against production (or an equivalent restored production snapshot), publish before/after counts, and show the remaining terminal failures with their real causes.**

Le run local produit dans `local-validation-run-20260819.md` utilise :
- **5 films** (dont 2 sans `tmdbId`, 3 avec IDs réels Inception/Dark Knight/Interstellar)
- **39 séries** (dont 37 sans `tmdbId`, 2 avec IDs réels Breaking Bad/GoT)
- **0 terminal failures**

Il s'agit d'un environnement de développement synthétique, pas d'un snapshot production. L'écart avec le contexte réel est fondamental :

| Dimension | Production | Run local |
|---|---|---|
| Films | ~60 000 | 5 |
| Séries | ~5 000 | 39 |
| Failures connues | 126 | 0 |
| Films français (ex. *Les Chevaliers du Fiel*) | Présents | Absent |
| Cas runtime=0 / imdb_id="" en prod | Non testés ici | Non exercés |

La completion rule exige spécifiquement :
- "show the remaining terminal failures with their real causes" — le run produit **0 terminal failures**, ce qui ne démontre pas la résolution des 126 failures connues
- "successful retry/fix of the previous failure population" — le film en exemple (`Les Chevaliers du Fiel : L'assassin est dans la salle`) n'est pas présent dans le dataset de test

Le local run démontre la **correctness fonctionnelle du chemin nominal**, mais pas la **résolution des failures de production** qui était l'objectif central du ticket.

### Escalade requise vers un opérateur humain

Cette condition ne peut pas être satisfaite par l'agent AI : l'accès à l'environnement de production est un prérequis humain. Les actions requises sont :

1. Déployer cette branche en production (ou monter un snapshot PostgreSQL de production)
2. Exécuter les migrations 0044–0047 via `migrate-safe.mjs`
3. `GET /admin/catalog-stats` → capturer l'état avant (notamment `neverEnriched`, `failedLastEnrichment`)
4. `POST /admin/catalog-enrich-missing` → démarrer le run
5. Attendre `status: "COMPLETED"` via `GET /admin/catalog-enrich-missing/status`
6. `GET /admin/catalog-stats` → capturer l'état après
7. `GET /admin/catalog-enrich-missing/failures` → capturer les failures terminales avec `errorClass`, `errorCode`, `errorMessage` réels
8. Déposer ces artefacts dans `runs/T115/production-run-YYYYMMDD.md`

## Observations mineures (inchangées)

**`retrying` stat absente** — structurellement non observable entre checkpoints synchrones. Acceptable, un commentaire dans le code suffirait.

**`embeddingBlocked` toujours 0** — attendu et documenté dans `catalog-stats.ts`. Pas de problème.

## Décision

Le code est techniquement complet et correct sur tous les points du plan et du ticket. Les trois corrections de coder-attempt-6 règlent les derniers risques opérationnels (conflit migration, journal incomplet, TypeError date). La seule condition non satisfaite est l'exécution contre un dataset production, qui constitue un critère d'acceptance explicite du ticket et requiert une intervention humaine.

IMPLEMENTATION_FIX_REQUIRED

---

## Instructions de fix

# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T115/reviews/implementation-review.md
- generated at: 2026-08-19T14:33:12Z

---

I have a complete picture of what coder-attempt-6 produced. Let me write the review.

---

# PR Review — T115: Complete catalog enrichment and make refresh failures resumable/observable

**Review attempt:** 6

## Résumé

Coder-attempt-6 apporte trois corrections de code (renommage migration `0047`, mise à jour du journal, fix `toISOString()` dans `catalog-stats.ts`) et produit un artefact de run local (`runs/T115/local-validation-run-20260819.md`). Ces corrections lèvent les risques techniques identifiés en review 5 (conflit de numérotation migration, erreur `TypeError` sur `Date`). Cependant, **le blocker de completion rule reste non satisfait** : un run local avec 5 films et 39 séries de dev n'est pas équivalent à un snapshot production, et les 126 failures de production ne sont pas diagnostiquées.

## Vérifications effectuées

- `apps/api/migrations/meta/_journal.json` — entrées idx 44–47 présentes ✓
- `apps/api/migrations/0047_t115_enrichment_failures.sql` — fichier renommé, plus de conflit avec `0045_t114` ✓
- `apps/api/src/routes/catalog-stats.ts:20` — `staleThreshold` utilise `.toISOString()` ✓
- `apps/api/src/services/catalog-enrich-missing-service.ts` — code inchangé depuis review 5, fixes `matchStatus = 'MATCHED'` inconditionnels confirmés ✓
- `apps/api/src/services/metadata-enrichment-service.ts` — `classifyError`, `persistFailure`, `clearFailure` confirmés ✓
- `runs/T115/local-validation-run-20260819.md` — artefact de run local présent

## Points validés (inchangés depuis review 5)

Tous les points techniques restent validés :
- TMDB normalization (`runtime=0` → `null`, empty `imdb_id` → `null`, blank `overview` → `null`) ✓
- `classifyError()` expose le vrai `error.constructor.name`, `.code`, `.message` ✓
- Upsert `enrichment_failures` avec `ON CONFLICT` incrémentant `retryCount` ✓
- `clearFailure()` sur succès ✓
- Keyset cursor `WHERE id > :lastId` sans drift ✓
- `matchStatus = 'MATCHED'` inconditionnellement dans `countEligible()` et `execute()` ✓
- 8 nouvelles métriques dans `/admin/catalog-stats` + `embeddingPending` non-hardcodé ✓
- Migrations `0046` et `0047` + journal complet ✓

## Corrections de coder-attempt-6 validées

**Migration renommée** (`0047_t115_enrichment_failures.sql`) : le conflit `0045` signalé comme risque en review 5 est éliminé ✓

**Journal complet** (idx 44–47) : les 4 migrations T107/T114/T115 sont enregistrées, `migrate-safe.mjs` ne les sautera plus silencieusement ✓

**`staleThreshold.toISOString()`** (`catalog-stats.ts:20`) : le `TypeError` postgres.js sur interpolation de `Date` brut est corrigé, l'endpoint retourne 200 ✓

## Problème bloquant — Completion rule non satisfaite

### Le run local ne constitue pas un "équivalent restored production snapshot"

Le ticket stipule :

> **Do not close after unit tests. Run the new enrichment mode against production (or an equivalent restored production snapshot), publish before/after counts, and show the remaining terminal failures with their real causes.**

Le run local produit dans `local-validation-run-20260819.md` utilise :
- **5 films** (dont 2 sans `tmdbId`, 3 avec IDs réels Inception/Dark Knight/Interstellar)
- **39 séries** (dont 37 sans `tmdbId`, 2 avec IDs réels Breaking Bad/GoT)
- **0 terminal failures**

Il s'agit d'un environnement de développement synthétique, pas d'un snapshot production. L'écart avec le contexte réel est fondamental :

| Dimension | Production | Run local |
|---|---|---|
| Films | ~60 000 | 5 |
| Séries | ~5 000 | 39 |
| Failures connues | 126 | 0 |
| Films français (ex. *Les Chevaliers du Fiel*) | Présents | Absent |
| Cas runtime=0 / imdb_id="" en prod | Non testés ici | Non exercés |

La completion rule exige spécifiquement :
- "show the remaining terminal failures with their real causes" — le run produit **0 terminal failures**, ce qui ne démontre pas la résolution des 126 failures connues
- "successful retry/fix of the previous failure population" — le film en exemple (`Les Chevaliers du Fiel : L'assassin est dans la salle`) n'est pas présent dans le dataset de test

Le local run démontre la **correctness fonctionnelle du chemin nominal**, mais pas la **résolution des failures de production** qui était l'objectif central du ticket.

### Escalade requise vers un opérateur humain

Cette condition ne peut pas être satisfaite par l'agent AI : l'accès à l'environnement de production est un prérequis humain. Les actions requises sont :

1. Déployer cette branche en production (ou monter un snapshot PostgreSQL de production)
2. Exécuter les migrations 0044–0047 via `migrate-safe.mjs`
3. `GET /admin/catalog-stats` → capturer l'état avant (notamment `neverEnriched`, `failedLastEnrichment`)
4. `POST /admin/catalog-enrich-missing` → démarrer le run
5. Attendre `status: "COMPLETED"` via `GET /admin/catalog-enrich-missing/status`
6. `GET /admin/catalog-stats` → capturer l'état après
7. `GET /admin/catalog-enrich-missing/failures` → capturer les failures terminales avec `errorClass`, `errorCode`, `errorMessage` réels
8. Déposer ces artefacts dans `runs/T115/production-run-YYYYMMDD.md`

## Observations mineures (inchangées)

**`retrying` stat absente** — structurellement non observable entre checkpoints synchrones. Acceptable, un commentaire dans le code suffirait.

**`embeddingBlocked` toujours 0** — attendu et documenté dans `catalog-stats.ts`. Pas de problème.

## Décision

Le code est techniquement complet et correct sur tous les points du plan et du ticket. Les trois corrections de coder-attempt-6 règlent les derniers risques opérationnels (conflit migration, journal incomplet, TypeError date). La seule condition non satisfaite est l'exécution contre un dataset production, qui constitue un critère d'acceptance explicite du ticket et requiert une intervention humaine.

IMPLEMENTATION_FIX_REQUIRED