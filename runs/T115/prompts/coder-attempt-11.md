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

All T115-relevant tests pass. Here's a summary of the 4 fixes applied:

---

## Changes applied

### Fix 1 — `retryFailures` now filters retryable by default (🟠 Major)

**`services/catalog-enrich-missing-service.ts`**
- Added `force?: boolean` to the `retryFailures` opts interface
- Added `if (!force) conditions.push(eq(enrichmentFailures.retryable, true))` — by default only retryable failures are retried; pass `force: true` to retry terminal failures too

### Fix 2 — Seasons failures persisted in `enrichment_failures` (🟠 Major)

**`services/metadata-enrichment-service.ts`**
- Widened `persistFailure` stage type to include `'seasons'`
- Replaced the bare `console.warn` in the `enrichSeriesSeasons` catch with a `persistFailure` call (`stage: 'seasons'`)
- Made `clearFailure` conditional: only called when seasons enrichment succeeded, so the persisted failure isn't immediately cleared

### Fix 3 — Silent catch blocks now warn (🟡 Minor)

**`services/metadata-enrichment-service.ts`**
- Collection upsert catch: `catch {}` → `catch (err) { console.warn(...) }`
- `persistFrenchLocalization` catch: `catch { return }` → `catch (err) { console.warn(...); return }`

### Fix 4 — `fullyEnriched` definition documented (🟡 Minor)

**`routes/catalog-stats.ts`**
- Added inline comments on both the movies and series `fullyEnriched`/`partiallyEnriched` SQL filters explaining that "fully enriched" means `synopsis IS NOT NULL AND keywords IS NOT NULL` (not all optional fields)

---

## Review

I have a complete picture of the implementation. Here is my review:

---

# PR Review — T115 — Complete catalog enrichment and refresh failure observability

## Résumé

L'implémentation livre tous les mécanismes requis par le ticket. Les 4 problèmes identifiés lors des reviews précédentes ont bien été corrigés (vérifiés dans les fichiers source). La qualité du code est solide : pagination keyset correcte, classification d'erreurs transient/terminal, schema `enrichment_failures` conforme, routes admin complètes, eligibilité embedding avec source de vérité unique.

Il reste **un seul bloquant opérationnel** : le critère de complétion explicite du ticket n'est pas satisfait. La validation ne porte que sur 5 films de dev — la production run (~60k films / ~5k séries) exigée par la completion rule n'a pas été exécutée.

---

## Vérifications effectuées

- `catalog-enrich-missing-service.ts` : keyset pagination, `retryFailures` avec filtre `retryable` par défaut, `checkNoRunningConflict`, stats live, `saveCheckpoint`.
- `metadata-enrichment-service.ts` : `persistFailure`, `clearFailure`, `classifyError`, catch `enrichSeriesSeasons` + `persistFailure(stage: 'seasons')`, `console.warn` dans les catch blocks silencieux.
- `catalog-stats.ts` : tous les compteurs requis, `embeddingPending` via lookup réel dans `media_embeddings`, commentaires sur `fullyEnriched`.
- `embedding-eligibility.ts` : trois représentations synchronisées (TS function, raw SQL string, Drizzle condition), documentées.
- `tmdb/client.ts` : normalisation `runtime || null`, `imdb_id || null`, `overview?.trim() || null` — correcte et testée.
- Migrations `0046` et `0047` + `_journal.json` — cohérents et numérotés correctement.
- `local-validation-run-20260819.md` et `production-run-playbook.md`.
- Tests `t115-normalization.test.ts` et `t115-enrichment.test.ts`.

---

## Points validés

**Fix 1 (retryFailures filtre)** — Confirmé à la ligne 346 de `catalog-enrich-missing-service.ts` :
```typescript
if (!force) conditions.push(eq(enrichmentFailures.retryable, true))
```
Par défaut seules les failures retryable sont retraitées. Flag `force` disponible pour forcer les terminales.

**Fix 2 (échecs seasons persistés)** — Confirmé aux lignes 437–452 de `metadata-enrichment-service.ts` :
```typescript
let seasonsFailed = false
try {
  await this.enrichSeriesSeasons(seriesId)
} catch (err) {
  console.warn(`[enrichment] enrichSeriesSeasons(${seriesId}) failed:`, err)
  seasonsFailed = true
  await this.persistFailure({ ..., stage: 'seasons', err, ... })
}
if (!seasonsFailed) await this.clearFailure('SERIES', seriesId)
```
Les échecs de saisons apparaissent maintenant dans `GET /admin/catalog-enrich-missing/failures`. `clearFailure` est conditionnelle.

**Fix 3 (catch blocks silencieux)** — `console.warn` présent dans le catch du collection upsert (ligne ~229) et dans `enrichSeriesSeasons` (ligne 441).

**Fix 4 (fullyEnriched documenté)** — Commentaires inline présents dans `catalog-stats.ts` aux deux blocs movies et series :
```
// fullyEnriched: enriched with at least synopsis and keywords present (does not require all optional fields)
```

**Autres points solides :**
- Cursor keyset sur `id ASC` : `WHERE id > :lastId ORDER BY id LIMIT batchSize` — correct, sans offset drift.
- `persistFailure` via upsert sur `(mediaType, mediaId)` avec `retryCount + 1` — correct.
- `classifyError` distingue Network/RateLimit (retryable) vs PostgresError/mapping (terminal). Root cause réel capturé, non plus le SQL généré.
- `embeddingPending` calculé par `NOT EXISTS (SELECT 1 FROM media_embeddings WHERE media_id = ...)` — plus jamais hardcodé à 0.
- `EMBEDDING_ELIGIBLE_SQL_PREDICATE` utilisé à la fois dans `catalog-stats.ts` et dans `embedding-backfill-service.ts` — source de vérité unique confirmée.
- Migrations dans le journal (`idx 44–47`), toutes les quatre présentes.
- `local-validation-run-20260819.md` démontre le flux end-to-end sur un dev DB : 5 eligible → 5 enriched, 0 failures, `embeddingPending: 3` non-zéro.

---

## Problèmes détectés

### 🔴 BLOQUANT — Production run non exécutée

La completion rule du ticket est explicite et non-négociable :

> **Completion rule**: Do not close after unit tests. Run the new enrichment mode against production (or an equivalent restored production snapshot), publish before/after counts, and show the remaining terminal failures with their real causes.

Les acceptance criteria non-démontrés :
- *"Run against the real production catalog and demonstrate meaningful reduction of incomplete titles and successful retry/fix of the previous failure population."*
- *"Production refresh failure root causes are observable with the real DB error, not only generated SQL/params."* — Les 126 vrais échecs de production n'ont pas été diagnostiqués.
- L'artefact `runs/T115/production-run-YYYYMMDD.md` n'existe pas.

La validation locale sur 5 films de dev (dont 2 sans `tmdbId`) ne constitue pas une production run ni un snapshot équivalent. Le `production-run-playbook.md` est présent et correct — il reste à l'exécuter.

**Action requise** : Connecter le branch au DB de production (ou snapshot restauré), appliquer les migrations `0044–0047`, exécuter les étapes du playbook, et publier l'artefact `production-run-YYYYMMDD.md` avec les compteurs avant/après et la liste des failures avec leurs causes réelles.

---

## Risques éventuels

- **Trois représentations de `isEmbeddingEligible`** (fonction TS, raw SQL string, Drizzle condition) : synchronisées aujourd'hui, mais aucun test d'équivalence automatique. Risque de divergence silencieuse à une future évolution. Acceptable en l'état.
- **`totalEligible` calculé au démarrage** : en cas de crash + reprise, le chiffre peut être périmé. Purement cosmétique, non bloquant.
- **Race condition TOCTOU dans `checkNoRunningConflict`** : check et insert non atomiques. Acceptable pour un endpoint admin à faible concurrence, mais à documenter si le service devient exposé.

---

## Décision

L'implémentation est fonctionnellement complète, correctement corrigée, et de bonne qualité. Le seul obstacle est opérationnel : la completion rule du ticket impose une démonstration sur production et celle-ci n'a pas été réalisée.

## Actions demandées

1. **(Bloquant)** Exécuter les étapes du `production-run-playbook.md` contre production ou snapshot restauré. Créer `runs/T115/production-run-YYYYMMDD.md` avec les `catalog-stats` avant/après, le statut du run, et `GET /admin/catalog-enrich-missing/failures` avec les causes réelles des failures (notamment pour `Les Chevaliers du Fiel : L'assassin est dans la salle`).

IMPLEMENTATION_FIX_REQUIRED

---

## Instructions de fix

# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T115/reviews/implementation-review.md
- generated at: 2026-08-19T15:13:52Z

---

I have a complete picture of the implementation. Here is my review:

---

# PR Review — T115 — Complete catalog enrichment and refresh failure observability

## Résumé

L'implémentation livre tous les mécanismes requis par le ticket. Les 4 problèmes identifiés lors des reviews précédentes ont bien été corrigés (vérifiés dans les fichiers source). La qualité du code est solide : pagination keyset correcte, classification d'erreurs transient/terminal, schema `enrichment_failures` conforme, routes admin complètes, eligibilité embedding avec source de vérité unique.

Il reste **un seul bloquant opérationnel** : le critère de complétion explicite du ticket n'est pas satisfait. La validation ne porte que sur 5 films de dev — la production run (~60k films / ~5k séries) exigée par la completion rule n'a pas été exécutée.

---

## Vérifications effectuées

- `catalog-enrich-missing-service.ts` : keyset pagination, `retryFailures` avec filtre `retryable` par défaut, `checkNoRunningConflict`, stats live, `saveCheckpoint`.
- `metadata-enrichment-service.ts` : `persistFailure`, `clearFailure`, `classifyError`, catch `enrichSeriesSeasons` + `persistFailure(stage: 'seasons')`, `console.warn` dans les catch blocks silencieux.
- `catalog-stats.ts` : tous les compteurs requis, `embeddingPending` via lookup réel dans `media_embeddings`, commentaires sur `fullyEnriched`.
- `embedding-eligibility.ts` : trois représentations synchronisées (TS function, raw SQL string, Drizzle condition), documentées.
- `tmdb/client.ts` : normalisation `runtime || null`, `imdb_id || null`, `overview?.trim() || null` — correcte et testée.
- Migrations `0046` et `0047` + `_journal.json` — cohérents et numérotés correctement.
- `local-validation-run-20260819.md` et `production-run-playbook.md`.
- Tests `t115-normalization.test.ts` et `t115-enrichment.test.ts`.

---

## Points validés

**Fix 1 (retryFailures filtre)** — Confirmé à la ligne 346 de `catalog-enrich-missing-service.ts` :
```typescript
if (!force) conditions.push(eq(enrichmentFailures.retryable, true))
```
Par défaut seules les failures retryable sont retraitées. Flag `force` disponible pour forcer les terminales.

**Fix 2 (échecs seasons persistés)** — Confirmé aux lignes 437–452 de `metadata-enrichment-service.ts` :
```typescript
let seasonsFailed = false
try {
  await this.enrichSeriesSeasons(seriesId)
} catch (err) {
  console.warn(`[enrichment] enrichSeriesSeasons(${seriesId}) failed:`, err)
  seasonsFailed = true
  await this.persistFailure({ ..., stage: 'seasons', err, ... })
}
if (!seasonsFailed) await this.clearFailure('SERIES', seriesId)
```
Les échecs de saisons apparaissent maintenant dans `GET /admin/catalog-enrich-missing/failures`. `clearFailure` est conditionnelle.

**Fix 3 (catch blocks silencieux)** — `console.warn` présent dans le catch du collection upsert (ligne ~229) et dans `enrichSeriesSeasons` (ligne 441).

**Fix 4 (fullyEnriched documenté)** — Commentaires inline présents dans `catalog-stats.ts` aux deux blocs movies et series :
```
// fullyEnriched: enriched with at least synopsis and keywords present (does not require all optional fields)
```

**Autres points solides :**
- Cursor keyset sur `id ASC` : `WHERE id > :lastId ORDER BY id LIMIT batchSize` — correct, sans offset drift.
- `persistFailure` via upsert sur `(mediaType, mediaId)` avec `retryCount + 1` — correct.
- `classifyError` distingue Network/RateLimit (retryable) vs PostgresError/mapping (terminal). Root cause réel capturé, non plus le SQL généré.
- `embeddingPending` calculé par `NOT EXISTS (SELECT 1 FROM media_embeddings WHERE media_id = ...)` — plus jamais hardcodé à 0.
- `EMBEDDING_ELIGIBLE_SQL_PREDICATE` utilisé à la fois dans `catalog-stats.ts` et dans `embedding-backfill-service.ts` — source de vérité unique confirmée.
- Migrations dans le journal (`idx 44–47`), toutes les quatre présentes.
- `local-validation-run-20260819.md` démontre le flux end-to-end sur un dev DB : 5 eligible → 5 enriched, 0 failures, `embeddingPending: 3` non-zéro.

---

## Problèmes détectés

### 🔴 BLOQUANT — Production run non exécutée

La completion rule du ticket est explicite et non-négociable :

> **Completion rule**: Do not close after unit tests. Run the new enrichment mode against production (or an equivalent restored production snapshot), publish before/after counts, and show the remaining terminal failures with their real causes.

Les acceptance criteria non-démontrés :
- *"Run against the real production catalog and demonstrate meaningful reduction of incomplete titles and successful retry/fix of the previous failure population."*
- *"Production refresh failure root causes are observable with the real DB error, not only generated SQL/params."* — Les 126 vrais échecs de production n'ont pas été diagnostiqués.
- L'artefact `runs/T115/production-run-YYYYMMDD.md` n'existe pas.

La validation locale sur 5 films de dev (dont 2 sans `tmdbId`) ne constitue pas une production run ni un snapshot équivalent. Le `production-run-playbook.md` est présent et correct — il reste à l'exécuter.

**Action requise** : Connecter le branch au DB de production (ou snapshot restauré), appliquer les migrations `0044–0047`, exécuter les étapes du playbook, et publier l'artefact `production-run-YYYYMMDD.md` avec les compteurs avant/après et la liste des failures avec leurs causes réelles.

---

## Risques éventuels

- **Trois représentations de `isEmbeddingEligible`** (fonction TS, raw SQL string, Drizzle condition) : synchronisées aujourd'hui, mais aucun test d'équivalence automatique. Risque de divergence silencieuse à une future évolution. Acceptable en l'état.
- **`totalEligible` calculé au démarrage** : en cas de crash + reprise, le chiffre peut être périmé. Purement cosmétique, non bloquant.
- **Race condition TOCTOU dans `checkNoRunningConflict`** : check et insert non atomiques. Acceptable pour un endpoint admin à faible concurrence, mais à documenter si le service devient exposé.

---

## Décision

L'implémentation est fonctionnellement complète, correctement corrigée, et de bonne qualité. Le seul obstacle est opérationnel : la completion rule du ticket impose une démonstration sur production et celle-ci n'a pas été réalisée.

## Actions demandées

1. **(Bloquant)** Exécuter les étapes du `production-run-playbook.md` contre production ou snapshot restauré. Créer `runs/T115/production-run-YYYYMMDD.md` avec les `catalog-stats` avant/après, le statut du run, et `GET /admin/catalog-enrich-missing/failures` avec les causes réelles des failures (notamment pour `Les Chevaliers du Fiel : L'assassin est dans la salle`).

IMPLEMENTATION_FIX_REQUIRED