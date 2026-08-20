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

**Situation claire** : l'implémentation T115 est complète (33/33 tests, code et migrations corrects). Il n'y a aucun changement de code à faire.

Le seul blocage est la **Completion Rule** du ticket, qui requiert une intervention humaine :

```
Completion rule: Do not close after unit tests. Run the new enrichment mode against
production (or an equivalent restored production snapshot), publish before/after
counts, and show the remaining terminal failures with their real causes.
```

## Action requise — toi

Le playbook `runs/T115/production-run-playbook.md` détaille exactement les étapes. En résumé :

**Pré-requis**
- Accès Fly.io : `flyctl auth login`
- `ADMIN_PASSWORD` et `DATABASE_URL` disponibles

**Étapes**
1. Vérifier que les migrations `0047` et `0048` sont appliquées en production
2. Capturer les stats avant : `GET /admin/catalog-stats`
3. Lancer l'enrich-missing : `POST /admin/catalog-enrich-missing`
4. Relancer les 126 failures connues : `POST /admin/catalog-enrich-missing/retry-failures`
5. Attendre la complétion (`status: "COMPLETED"`)
6. Capturer les stats après et la liste des failures avec leurs vraies causes
7. Créer `runs/T115/production-run-20260820.md` avec le rapport

Une fois ce fichier commité sur la branche, la review suivante pourra approuver immédiatement — aucune correction de code n'est attendue.

Veux-tu que je t'aide à préparer autre chose, ou as-tu besoin de clarifications sur les commandes du playbook ?

---

## Review

# PR Review — T115 : Complete catalog enrichment and make refresh failures resumable/observable
## Attempt 29

## Résumé

L'implémentation est **techniquement complète et correcte**. L'ensemble du code source, des migrations et des tests ont été validés lors des reviews précédentes (24-28) et aucun changement n'a été apporté au code source depuis la review-28. Les 33 tests passent. Le seul blocage restant est opérationnel : la **Completion Rule** exige un run en production que seul un humain avec accès Fly.io peut exécuter.

---

## Vérifications effectuées

Audit direct des fichiers source sur la branche :

| Fichier | Statut |
|---|---|
| `tmdb/client.ts` — normalisation `runtime=0`, `imdb_id=""`, `overview` blank | ✓ |
| `metadata-enrichment-service.ts` — `classifyError()`, `persistFailure()`, `clearFailure()` | ✓ |
| `catalog-enrich-missing-service.ts` — keyset cursor, checkpoint, retry, idempotence | ✓ |
| `routes/catalog-enrich-missing.ts` — 4 routes, validation bounds, 202/409/404 | ✓ |
| `routes/catalog-stats.ts` — 13 agrégats parallèles, `embeddingPending` via NOT EXISTS | ✓ |
| `embedding-eligibility.ts` — source unique partagée stats + backfill | ✓ |
| `0047_t115_catalog_refresh_runs_type.sql` — colonne `type` | ✓ |
| `0048_t115_enrichment_failures.sql` — table + index unique | ✓ |
| `index.ts` — routes enregistrées | ✓ |

---

## Points validés

**Normalisation TMDB**
- `raw.runtime || null` → `runtimeMinutes: null` pour `runtime=0` ✓
- `raw.imdb_id || null` → `imdbId: null` pour `imdb_id=""` ✓
- `raw.overview?.trim() || null` → `synopsis: null` pour les chaînes blanches ✓
- Appliqué identiquement dans `mapMovieDetail()` et `mapSeriesDetail()` ✓

**Observabilité des échecs**
- `classifyError()` extrait `constructor.name`, code PG (ex. `23502`, `23505`), message brut — pas la requête SQL générée ✓
- `persistFailure()` upsert sur `(media_type, media_id)`, incrémente `retry_count` à chaque réessai ✓
- Stages distincts : `fetch`, `map`, `db_update`, `seasons` ✓
- `clearFailure()` supprime la ligne sur succès ✓

**Mode enrich-missing**
- Pagination keyset : `WHERE id > :lastId ORDER BY id LIMIT n` — stable même si des lignes s'intercalent ✓
- Éligibilité : `tmdbId IS NOT NULL AND matchStatus = 'MATCHED' AND (metadataEnrichedAt IS NULL OR stale)` ✓
- Checkpoint JSON écrit après chaque batch — redémarrage sans perte de position ✓
- Retry transient : 3 tentatives avec backoff 250/500/1000 ms ✓
- Idempotence : les lignes fraîches sont sautées (sauf `force=true`) ✓
- Protection concurrence : `checkNoRunningConflict()` + unique partial index sur `status='RUNNING'` + catch `23505` ✓
- Saisons enrichies via `enrichSeriesSeasons()` existant ✓

**Routes**
- `POST /admin/catalog-enrich-missing` → 202 `{runId}`, run asynchrone ✓
- `GET .../status` → dernières stats live depuis le checkpoint ✓
- `GET .../failures` → liste paginée avec filtres `mediaType`, `retryable` ✓
- `POST .../retry-failures` → réessai des failures (retryables par défaut, `force=true` pour toutes) ✓
- Validation des paramètres : `batchSize ∈ [1,500]`, `concurrency ∈ [1,20]`, `throttleMs ≥ 0` ✓

**Catalog stats**
- `neverEnriched`, `partiallyEnriched`, `fullyEnriched`, `stale`, `failedLastEnrichment` ✓
- `embeddingPending` calculé via `NOT EXISTS (SELECT 1 FROM media_embeddings ...)` — non hardcodé à 0 ✓

**Eligibilité embedding**
- `isEmbeddingEligible()` + `EMBEDDING_ELIGIBLE_SQL_PREDICATE` + `embeddingEligibleCondition` dans `embedding-eligibility.ts` ✓
- Utilisé par `catalog-stats.ts` (SQL brut) et `embedding-backfill-service.ts` (Drizzle condition) — source unique ✓

**Sécurité**
- Aucun secret loggué — `classifyError()` n'extrait que classe, code, message ✓
- Paramètres validés côté route avant transmission au service ✓

---

## Problèmes détectés

### [BLOQUANT — Opérationnel] Completion Rule non satisfaite

Le ticket exige explicitement :

> **Completion rule** : Do not close after unit tests. Run the new enrichment mode against production (or an equivalent restored production snapshot), publish before/after counts, and show the remaining terminal failures with their real causes.

Le seul rapport existant (`production-run-20260819.md`) est **auto-labellisé** comme run local sur dev DB (6 films, pas un snapshot de production) :

> "Production API (api.iptvflix.com) not DNS-resolvable from this environment; Fly.io unauthenticated."

Aucun `production-run-*.md` avec des données à l'échelle de production (~60k films / ~5k séries) n'existe sur la branche.

Critères d'acceptance non démontrés :

| Critère | Statut |
|---|---|
| Run against the real production catalog | ❌ |
| Meaningful reduction of `neverEnriched` | ❌ |
| Remaining terminal failures with their real causes (les 126) | ❌ |
| Before/after counts at production scale | ❌ |

**Aucun cycle IA supplémentaire ne peut résoudre ce blocage.** Le code et le playbook sont prêts depuis l'attempt-12 ; la numérotation des migrations dans le playbook a été corrigée en attempt-27.

---

## Risques éventuels

**Mineur — `retryFailures()` sans checkpoint live** : contrairement à `start()` qui écrit le checkpoint après chaque batch, `retryFailures()` n'écrit le statut qu'à la fin. Sur un grand lot de failures, `GET .../status` reste figé sur le run précédent pendant le retry. Acceptable en l'état — le ticket ne demande pas de monitoring temps-réel des retries.

**Mineur — `retrying` dans les stats** : le compteur mesure des tentatives (pas des items uniques). Un seul item peut contribuer 3 fois. Commenté dans le code (`// Counts retry *attempts*, not unique items`). Comportement correct et documenté.

---

## Décision

REQUEST_CHANGES — non pour une raison de code (l'implémentation est correcte), mais parce que le critère d'acceptance opérationnel explicite n'est pas rempli.

---

## Actions demandées

**Humain uniquement** (l'IA ne peut pas exécuter cette étape) :

1. `flyctl auth login`
2. Déployer la branche en production ou accéder directement à `DATABASE_URL`
3. Vérifier que les migrations `0047` et `0048` sont appliquées (`psql $DATABASE_URL -c "SELECT tag FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 5"`)
4. Exécuter le playbook `runs/T115/production-run-playbook.md` intégralement
5. Créer `runs/T115/production-run-20260820.md` avec :
   - Stats avant (`GET /admin/catalog-stats`)
   - `runId` et réponse du POST
   - Stats après
   - Liste des failures terminales avec `errorClass`, `errorCode`, `errorMessage` réels
   - Analyse des 126 failures connues (résolues vs encore terminales)
6. Commiter ce fichier sur la branche

Après ce commit, la review suivante devrait approuver immédiatement — aucune correction de code n'est attendue.

IMPLEMENTATION_FIX_REQUIRED

---

## Instructions de fix

# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T115/reviews/implementation-review.md
- generated at: 2026-08-20T21:39:35Z

---

# PR Review — T115 : Complete catalog enrichment and make refresh failures resumable/observable
## Attempt 29

## Résumé

L'implémentation est **techniquement complète et correcte**. L'ensemble du code source, des migrations et des tests ont été validés lors des reviews précédentes (24-28) et aucun changement n'a été apporté au code source depuis la review-28. Les 33 tests passent. Le seul blocage restant est opérationnel : la **Completion Rule** exige un run en production que seul un humain avec accès Fly.io peut exécuter.

---

## Vérifications effectuées

Audit direct des fichiers source sur la branche :

| Fichier | Statut |
|---|---|
| `tmdb/client.ts` — normalisation `runtime=0`, `imdb_id=""`, `overview` blank | ✓ |
| `metadata-enrichment-service.ts` — `classifyError()`, `persistFailure()`, `clearFailure()` | ✓ |
| `catalog-enrich-missing-service.ts` — keyset cursor, checkpoint, retry, idempotence | ✓ |
| `routes/catalog-enrich-missing.ts` — 4 routes, validation bounds, 202/409/404 | ✓ |
| `routes/catalog-stats.ts` — 13 agrégats parallèles, `embeddingPending` via NOT EXISTS | ✓ |
| `embedding-eligibility.ts` — source unique partagée stats + backfill | ✓ |
| `0047_t115_catalog_refresh_runs_type.sql` — colonne `type` | ✓ |
| `0048_t115_enrichment_failures.sql` — table + index unique | ✓ |
| `index.ts` — routes enregistrées | ✓ |

---

## Points validés

**Normalisation TMDB**
- `raw.runtime || null` → `runtimeMinutes: null` pour `runtime=0` ✓
- `raw.imdb_id || null` → `imdbId: null` pour `imdb_id=""` ✓
- `raw.overview?.trim() || null` → `synopsis: null` pour les chaînes blanches ✓
- Appliqué identiquement dans `mapMovieDetail()` et `mapSeriesDetail()` ✓

**Observabilité des échecs**
- `classifyError()` extrait `constructor.name`, code PG (ex. `23502`, `23505`), message brut — pas la requête SQL générée ✓
- `persistFailure()` upsert sur `(media_type, media_id)`, incrémente `retry_count` à chaque réessai ✓
- Stages distincts : `fetch`, `map`, `db_update`, `seasons` ✓
- `clearFailure()` supprime la ligne sur succès ✓

**Mode enrich-missing**
- Pagination keyset : `WHERE id > :lastId ORDER BY id LIMIT n` — stable même si des lignes s'intercalent ✓
- Éligibilité : `tmdbId IS NOT NULL AND matchStatus = 'MATCHED' AND (metadataEnrichedAt IS NULL OR stale)` ✓
- Checkpoint JSON écrit après chaque batch — redémarrage sans perte de position ✓
- Retry transient : 3 tentatives avec backoff 250/500/1000 ms ✓
- Idempotence : les lignes fraîches sont sautées (sauf `force=true`) ✓
- Protection concurrence : `checkNoRunningConflict()` + unique partial index sur `status='RUNNING'` + catch `23505` ✓
- Saisons enrichies via `enrichSeriesSeasons()` existant ✓

**Routes**
- `POST /admin/catalog-enrich-missing` → 202 `{runId}`, run asynchrone ✓
- `GET .../status` → dernières stats live depuis le checkpoint ✓
- `GET .../failures` → liste paginée avec filtres `mediaType`, `retryable` ✓
- `POST .../retry-failures` → réessai des failures (retryables par défaut, `force=true` pour toutes) ✓
- Validation des paramètres : `batchSize ∈ [1,500]`, `concurrency ∈ [1,20]`, `throttleMs ≥ 0` ✓

**Catalog stats**
- `neverEnriched`, `partiallyEnriched`, `fullyEnriched`, `stale`, `failedLastEnrichment` ✓
- `embeddingPending` calculé via `NOT EXISTS (SELECT 1 FROM media_embeddings ...)` — non hardcodé à 0 ✓

**Eligibilité embedding**
- `isEmbeddingEligible()` + `EMBEDDING_ELIGIBLE_SQL_PREDICATE` + `embeddingEligibleCondition` dans `embedding-eligibility.ts` ✓
- Utilisé par `catalog-stats.ts` (SQL brut) et `embedding-backfill-service.ts` (Drizzle condition) — source unique ✓

**Sécurité**
- Aucun secret loggué — `classifyError()` n'extrait que classe, code, message ✓
- Paramètres validés côté route avant transmission au service ✓

---

## Problèmes détectés

### [BLOQUANT — Opérationnel] Completion Rule non satisfaite

Le ticket exige explicitement :

> **Completion rule** : Do not close after unit tests. Run the new enrichment mode against production (or an equivalent restored production snapshot), publish before/after counts, and show the remaining terminal failures with their real causes.

Le seul rapport existant (`production-run-20260819.md`) est **auto-labellisé** comme run local sur dev DB (6 films, pas un snapshot de production) :

> "Production API (api.iptvflix.com) not DNS-resolvable from this environment; Fly.io unauthenticated."

Aucun `production-run-*.md` avec des données à l'échelle de production (~60k films / ~5k séries) n'existe sur la branche.

Critères d'acceptance non démontrés :

| Critère | Statut |
|---|---|
| Run against the real production catalog | ❌ |
| Meaningful reduction of `neverEnriched` | ❌ |
| Remaining terminal failures with their real causes (les 126) | ❌ |
| Before/after counts at production scale | ❌ |

**Aucun cycle IA supplémentaire ne peut résoudre ce blocage.** Le code et le playbook sont prêts depuis l'attempt-12 ; la numérotation des migrations dans le playbook a été corrigée en attempt-27.

---

## Risques éventuels

**Mineur — `retryFailures()` sans checkpoint live** : contrairement à `start()` qui écrit le checkpoint après chaque batch, `retryFailures()` n'écrit le statut qu'à la fin. Sur un grand lot de failures, `GET .../status` reste figé sur le run précédent pendant le retry. Acceptable en l'état — le ticket ne demande pas de monitoring temps-réel des retries.

**Mineur — `retrying` dans les stats** : le compteur mesure des tentatives (pas des items uniques). Un seul item peut contribuer 3 fois. Commenté dans le code (`// Counts retry *attempts*, not unique items`). Comportement correct et documenté.

---

## Décision

REQUEST_CHANGES — non pour une raison de code (l'implémentation est correcte), mais parce que le critère d'acceptance opérationnel explicite n'est pas rempli.

---

## Actions demandées

**Humain uniquement** (l'IA ne peut pas exécuter cette étape) :

1. `flyctl auth login`
2. Déployer la branche en production ou accéder directement à `DATABASE_URL`
3. Vérifier que les migrations `0047` et `0048` sont appliquées (`psql $DATABASE_URL -c "SELECT tag FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 5"`)
4. Exécuter le playbook `runs/T115/production-run-playbook.md` intégralement
5. Créer `runs/T115/production-run-20260820.md` avec :
   - Stats avant (`GET /admin/catalog-stats`)
   - `runId` et réponse du POST
   - Stats après
   - Liste des failures terminales avec `errorClass`, `errorCode`, `errorMessage` réels
   - Analyse des 126 failures connues (résolues vs encore terminales)
6. Commiter ce fichier sur la branche

Après ce commit, la review suivante devrait approuver immédiatement — aucune correction de code n'est attendue.

IMPLEMENTATION_FIX_REQUIRED