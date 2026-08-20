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

Maintenant j'ai tout le contexte nécessaire. Voici la situation réelle :

---

## Coder-attempt-26 — Escalade vers l'opérateur humain

**Aucun changement de code. L'implémentation est complète.**

### État actuel

- **33 tests passent** — vérifié à l'instant (23:24:37)
- **`flyctl` est installé** (`/opt/homebrew/bin/flyctl`) mais pas authentifié
- **`api.iptvflix.com`** n'est pas joignable depuis cet environnement
- **Le workflow IA est en boucle depuis l'attempt-24** — chaque review marque `IMPLEMENTATION_FIX_REQUIRED` parce que la production n'a pas été touchée, mais il n'y a aucun code à corriger

### Ce que tu dois faire pour débloquer le ticket

**Étape 1 — Authentification Fly.io** (2 minutes)

```bash
flyctl auth login
```

Cela ouvre le navigateur pour te connecter. Une seule fois suffit.

**Étape 2 — Déployer la branche sur production** (ou tunnel DB)

```bash
# Option A — déployer le code sur prod
git checkout ticket/T115-complete-catalog-enrichment-and-make-refresh-failu
flyctl deploy --app <ton-app-api>

# Option B — pointer l'API locale sur la DB de production
flyctl proxy 5432 -a <ton-app-postgres>
# Puis lancer le serveur local avec DATABASE_URL=postgres://localhost:5432/...
```

**Étape 3 — Exécuter le playbook** — le playbook complet est à `runs/T115/production-run-playbook.md`

```bash
ADMIN_PASSWORD=xxx API=https://api.iptvflix.com

# Before stats
curl -s -u admin:$ADMIN_PASSWORD $API/admin/catalog-stats | jq .

# Start enrichment run
curl -s -X POST -u admin:$ADMIN_PASSWORD \
  -H "Content-Type: application/json" \
  -d '{"batchSize": 50, "concurrency": 3, "throttleMs": 500}' \
  $API/admin/catalog-enrich-missing | jq .

# Poll until COMPLETED
watch -n 30 "curl -s -u admin:\$ADMIN_PASSWORD $API/admin/catalog-enrich-missing/status | jq ."

# After stats + terminal failures
curl -s -u admin:$ADMIN_PASSWORD $API/admin/catalog-stats | jq .
curl -s -u admin:$ADMIN_PASSWORD "$API/admin/catalog-enrich-missing/failures?limit=200" | jq .
```

**Étape 4 — Créer le rapport** `runs/T115/production-run-20260820.md` avec les stats avant/après et la liste des 126 failures avec leurs vraies causes.

### Pourquoi le workflow IA ne peut pas le faire

Le workflow identifie correctement que la "Completion Rule" n'est pas satisfaite, mais ne peut pas y remédier lui-même — Fly.io nécessite une authentification OAuth interactive. Le code, les migrations, les routes, les stats et le playbook sont prêts depuis l'attempt-12. Les 12+ cycles suivants n'ont rien pu ajouter.

**Le seul débloquant : toi, avec `flyctl auth login`.**

---

## Review

I now have all the information needed. Let me write the review.

---

# PR Review — T115: Complete Catalog Enrichment and Make Refresh Failures Resumable/Observable
## Attempt 27

## Résumé

L'implémentation est **techniquement correcte et complète**. Les 33 tests passent (vérifiés en direct). Aucun changement de code depuis la review-26. Un nouveau défaut mineur a été identifié dans le playbook de production (numérotation des migrations). Le blocage opérationnel sur le Completion Rule demeure inchangé.

---

## Vérifications effectuées

- Lecture directe de tous les fichiers source modifiés vs `main` (hors `dist/`)
- Exécution des 4 fichiers de tests T115 : **33/33 passent**
- Lecture du rapport `runs/T115/production-run-20260819.md`
- Vérification du répertoire migrations pour contrôle des numéros réels
- Lecture du playbook `runs/T115/production-run-playbook.md`

```
 ✓ src/services/__tests__/metadata-enrichment-service.test.ts (23 tests)
 ✓ src/services/__tests__/t115-enrichment.test.ts (4 tests)
 ✓ src/routes/__tests__/catalog-stats.test.ts (2 tests)
 ✓ src/providers/metadata/tmdb/__tests__/t115-normalization.test.ts (4 tests)

 Test Files  4 passed (4)
      Tests  33 passed (33)
```

---

## Points validés (inchangés depuis review-24)

**Normalisation TMDB (`tmdb/client.ts`)**
- `raw.runtime || null` → `runtime=0` produit `runtimeMinutes: null` ✓
- `raw.imdb_id || null` → `imdb_id=""` produit `imdbId: null` ✓
- `raw.overview?.trim() || null` → synopsis whitespace-only produit `null` ✓
- Mêmes gardes dans `mapSeriesDetail()` ✓

**`MetadataEnrichmentService`**
- `classifyError()` extrait constructeur réel, code PG (`23502`, `23505`…), message brut ✓
- `persistFailure()` : upsert sur `(media_type, media_id)`, `retryCount + 1` atomique ✓
- `clearFailure()` au succès ✓
- `stage: 'seasons'` discriminé du stage `db_update` ✓

**`CatalogEnrichMissingService`**
- Pagination keyset `WHERE id > :lastId ORDER BY id LIMIT n` — résistante au drift ✓
- Checkpoint JSONB après chaque batch ✓
- Double protection concurrence : `checkNoRunningConflict()` + catch `23505` ✓
- `enrichWithRetry()` ne retente que `provider-failed` (transient) ✓
- `resumeRunId` charge le checkpoint du run précédent ✓
- `retryFailures()` : `force=true` inclut les terminaux ✓

**Routes (`catalog-enrich-missing.ts`)**
- Validation : `batchSize` [1-500], `concurrency` [1-20], `throttleMs ≥ 0`, `mediaTypes` enum ✓
- `force` passé depuis le body ✓
- HTTP 202/409/404 cohérents ✓

**Catalog-stats (`catalog-stats.ts`)**
- 13 requêtes parallèles ✓
- `embeddingPending` via `NOT EXISTS` — plus de `0` hardcodé ✓
- `EMBEDDING_ELIGIBLE_SQL_PREDICATE` source unique partagée ✓
- `enrichedWithSeasonFailures` exposé ✓

**Migrations**
- `0047_t115_catalog_refresh_runs_type.sql` : `ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'REFRESH'` — rétrocompatible ✓
- `0048_t115_enrichment_failures.sql` : table + index unique ✓
- Schema Drizzle aligné sur les migrations ✓

**Sécurité** : aucun secret loggué ou hardcodé, validation aux frontières ✓

---

## Problèmes détectés

### [Mineur — corrigeable par coder] Numérotation incorrecte dans le playbook

Le fichier `runs/T115/production-run-playbook.md` (Step 1) indique les migrations attendues comme :
```
0046_t115_catalog_refresh_runs_type
0047_t115_enrichment_failures
```

Les **vrais** noms de fichiers sur le filesystem sont :
```
0047_t115_catalog_refresh_runs_type.sql
0048_t115_enrichment_failures.sql
```

`0046` est en réalité `0046_device_account_id.sql` (migration non liée à T115). L'opérateur qui suivrait le playbook ne trouverait pas les migrations attendues et pourrait croire qu'elles ne sont pas appliquées.

**Correction requise** : mettre à jour le playbook Step 1 pour mentionner `0047_t115_catalog_refresh_runs_type` et `0048_t115_enrichment_failures`.

---

### [BLOQUANT — Opérationnel, escalade humaine requise] Completion Rule non satisfaite

Le ticket exige explicitement :

> **Completion rule** : Do not close after unit tests. Run the new enrichment mode against production (or an equivalent restored production snapshot), publish before/after counts, and show the remaining terminal failures with their real causes.

Le rapport `production-run-20260819.md` documente un run sur **6 films en DB locale**, pas une snapshot de production équivalente. Les critères non démontrés :

| Critère ticket | Statut |
|---|---|
| Run against real production catalog (~60k films / ~5k séries) | ❌ |
| Meaningful reduction of `neverEnriched` | ❌ |
| Remaining terminal failures with real causes (les 126 échecs) | ❌ |
| Cursor behavior at real volume | ❌ |

**Ce blocage ne peut pas être résolu par un cycle IA.** L'accès Fly.io est requis. Le playbook est prêt à `runs/T115/production-run-playbook.md` (à corriger selon le point mineur ci-dessus).

**Action requise** : un opérateur humain avec accès production doit :
1. Corriger le playbook (numéros de migrations)
2. Exécuter le playbook contre la production
3. Publier le rapport before/after dans `runs/T115/production-run-YYYYMMDD.md`

---

## Risques

1. **Scalabilité** : 13 requêtes agrégées sur ~60k lignes sans cache — endpoint admin à faible trafic, acceptable.
2. **Rate limiting TMDB** : le playbook recommande `throttleMs ≥ 500` sur ~60k films.
3. **Migration 0047** sur table non vide : `IF NOT EXISTS` protège la rétrocompatibilité ✓.

---

## Décision

L'implémentation est techniquement correcte. 33 tests passent. Un seul correctif de code est nécessaire (playbook), et la condition de clôture du ticket reste non satisfaite par manque d'accès production.

**Aucun nouveau cycle IA sur la partie code n'est utile après la correction du playbook.** La validation finale est un acte opérationnel humain.

IMPLEMENTATION_FIX_REQUIRED

---

## Instructions de fix

# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T115/reviews/implementation-review.md
- generated at: 2026-08-20T21:30:05Z

---

I now have all the information needed. Let me write the review.

---

# PR Review — T115: Complete Catalog Enrichment and Make Refresh Failures Resumable/Observable
## Attempt 27

## Résumé

L'implémentation est **techniquement correcte et complète**. Les 33 tests passent (vérifiés en direct). Aucun changement de code depuis la review-26. Un nouveau défaut mineur a été identifié dans le playbook de production (numérotation des migrations). Le blocage opérationnel sur le Completion Rule demeure inchangé.

---

## Vérifications effectuées

- Lecture directe de tous les fichiers source modifiés vs `main` (hors `dist/`)
- Exécution des 4 fichiers de tests T115 : **33/33 passent**
- Lecture du rapport `runs/T115/production-run-20260819.md`
- Vérification du répertoire migrations pour contrôle des numéros réels
- Lecture du playbook `runs/T115/production-run-playbook.md`

```
 ✓ src/services/__tests__/metadata-enrichment-service.test.ts (23 tests)
 ✓ src/services/__tests__/t115-enrichment.test.ts (4 tests)
 ✓ src/routes/__tests__/catalog-stats.test.ts (2 tests)
 ✓ src/providers/metadata/tmdb/__tests__/t115-normalization.test.ts (4 tests)

 Test Files  4 passed (4)
      Tests  33 passed (33)
```

---

## Points validés (inchangés depuis review-24)

**Normalisation TMDB (`tmdb/client.ts`)**
- `raw.runtime || null` → `runtime=0` produit `runtimeMinutes: null` ✓
- `raw.imdb_id || null` → `imdb_id=""` produit `imdbId: null` ✓
- `raw.overview?.trim() || null` → synopsis whitespace-only produit `null` ✓
- Mêmes gardes dans `mapSeriesDetail()` ✓

**`MetadataEnrichmentService`**
- `classifyError()` extrait constructeur réel, code PG (`23502`, `23505`…), message brut ✓
- `persistFailure()` : upsert sur `(media_type, media_id)`, `retryCount + 1` atomique ✓
- `clearFailure()` au succès ✓
- `stage: 'seasons'` discriminé du stage `db_update` ✓

**`CatalogEnrichMissingService`**
- Pagination keyset `WHERE id > :lastId ORDER BY id LIMIT n` — résistante au drift ✓
- Checkpoint JSONB après chaque batch ✓
- Double protection concurrence : `checkNoRunningConflict()` + catch `23505` ✓
- `enrichWithRetry()` ne retente que `provider-failed` (transient) ✓
- `resumeRunId` charge le checkpoint du run précédent ✓
- `retryFailures()` : `force=true` inclut les terminaux ✓

**Routes (`catalog-enrich-missing.ts`)**
- Validation : `batchSize` [1-500], `concurrency` [1-20], `throttleMs ≥ 0`, `mediaTypes` enum ✓
- `force` passé depuis le body ✓
- HTTP 202/409/404 cohérents ✓

**Catalog-stats (`catalog-stats.ts`)**
- 13 requêtes parallèles ✓
- `embeddingPending` via `NOT EXISTS` — plus de `0` hardcodé ✓
- `EMBEDDING_ELIGIBLE_SQL_PREDICATE` source unique partagée ✓
- `enrichedWithSeasonFailures` exposé ✓

**Migrations**
- `0047_t115_catalog_refresh_runs_type.sql` : `ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'REFRESH'` — rétrocompatible ✓
- `0048_t115_enrichment_failures.sql` : table + index unique ✓
- Schema Drizzle aligné sur les migrations ✓

**Sécurité** : aucun secret loggué ou hardcodé, validation aux frontières ✓

---

## Problèmes détectés

### [Mineur — corrigeable par coder] Numérotation incorrecte dans le playbook

Le fichier `runs/T115/production-run-playbook.md` (Step 1) indique les migrations attendues comme :
```
0046_t115_catalog_refresh_runs_type
0047_t115_enrichment_failures
```

Les **vrais** noms de fichiers sur le filesystem sont :
```
0047_t115_catalog_refresh_runs_type.sql
0048_t115_enrichment_failures.sql
```

`0046` est en réalité `0046_device_account_id.sql` (migration non liée à T115). L'opérateur qui suivrait le playbook ne trouverait pas les migrations attendues et pourrait croire qu'elles ne sont pas appliquées.

**Correction requise** : mettre à jour le playbook Step 1 pour mentionner `0047_t115_catalog_refresh_runs_type` et `0048_t115_enrichment_failures`.

---

### [BLOQUANT — Opérationnel, escalade humaine requise] Completion Rule non satisfaite

Le ticket exige explicitement :

> **Completion rule** : Do not close after unit tests. Run the new enrichment mode against production (or an equivalent restored production snapshot), publish before/after counts, and show the remaining terminal failures with their real causes.

Le rapport `production-run-20260819.md` documente un run sur **6 films en DB locale**, pas une snapshot de production équivalente. Les critères non démontrés :

| Critère ticket | Statut |
|---|---|
| Run against real production catalog (~60k films / ~5k séries) | ❌ |
| Meaningful reduction of `neverEnriched` | ❌ |
| Remaining terminal failures with real causes (les 126 échecs) | ❌ |
| Cursor behavior at real volume | ❌ |

**Ce blocage ne peut pas être résolu par un cycle IA.** L'accès Fly.io est requis. Le playbook est prêt à `runs/T115/production-run-playbook.md` (à corriger selon le point mineur ci-dessus).

**Action requise** : un opérateur humain avec accès production doit :
1. Corriger le playbook (numéros de migrations)
2. Exécuter le playbook contre la production
3. Publier le rapport before/after dans `runs/T115/production-run-YYYYMMDD.md`

---

## Risques

1. **Scalabilité** : 13 requêtes agrégées sur ~60k lignes sans cache — endpoint admin à faible trafic, acceptable.
2. **Rate limiting TMDB** : le playbook recommande `throttleMs ≥ 500` sur ~60k films.
3. **Migration 0047** sur table non vide : `IF NOT EXISTS` protège la rétrocompatibilité ✓.

---

## Décision

L'implémentation est techniquement correcte. 33 tests passent. Un seul correctif de code est nécessaire (playbook), et la condition de clôture du ticket reste non satisfaite par manque d'accès production.

**Aucun nouveau cycle IA sur la partie code n'est utile après la correction du playbook.** La validation finale est un acte opérationnel humain.

IMPLEMENTATION_FIX_REQUIRED