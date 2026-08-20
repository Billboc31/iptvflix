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

All 8 T115 tests pass. TypeScript compiles clean. The pre-existing failures in `title-matching-service.test.ts` are unrelated to this ticket.

**Change made:** `catalog-enrich-missing.ts:32-37` — added `mediaTypes` validation that returns HTTP 400 when the array contains values other than `'MOVIE'` or `'SERIES'`.

**Remaining blocker (not resolvable by code):** The production run criterion requires live infrastructure access (`DATABASE_URL` or `flyctl`). The review correctly flags this as requiring human operator action — once a run is executed against production and counts published to `runs/T115/production-run-20260819.md`, the implementation is complete.

---

## Review

---

# Review — T115 — Complete Catalog Enrichment and Make Refresh Failures Resumable/Observable

## Résumé

L'implémentation est structurellement complète et de bonne qualité. Toutes les fonctionnalités du plan sont présentes et correctement connectées. Cependant, la **completion rule** du ticket n'est pas satisfaite : la validation a été effectuée sur un DB de dev local (6 films dont 3 pré-enrichis, 1 cas synthétique), et non sur le catalogue de production (~60k films / ~5k séries) ni sur un snapshot restauré.

---

## Scope et plan

Le périmètre implémenté correspond fidèlement au plan :
- Normalisation TMDB (runtime=0 → null, imdb_id="" → null, overview blank → null) — ✅ `client.ts:54,59,60`
- Table `enrichment_failures` avec upsert sur (media_type, media_id), retryCount incrémental — ✅ migration 0047, schema, persistFailure()
- `CatalogEnrichMissingService` : keyset cursor, concurrence configurable, retry exponentiel, checkpoint JSONB — ✅
- 4 routes `/admin/catalog-enrich-missing` (POST, status, failures, retry-failures) — ✅
- Extension `/admin/catalog-stats` avec neverEnriched/partiallyEnriched/fullyEnriched/failedLastEnrichment/embeddingPending (queries réelles, pas hardcodé) — ✅
- `embedding-eligibility.ts` : source unique pour la politique d'éligibilité — ✅

---

## Qualité du code

**Points forts :**
- Pagination par keyset (id ASC) plutôt qu'offset — idempotente, résiliente à l'insertion concurrente
- `clearFailure()` appelé sur succès — pas de stale records
- L'index partiel `catalog_refresh_runs_running_idx` (existant depuis migration 0032) garantit qu'un seul run RUNNING peut exister ; le catch `23505` est du vrai code de défense, pas mort
- `classifyError()` extrait class/code/message réels du driver PostgreSQL, couvre TmdbRateLimitError/TmdbNetworkError

**Observations mineures (non bloquantes) :**
- `retryFailures()` insère un run COMPLETED même quand `failures.length === 0` — bruit DB mais non problématique
- `retryFailures` ne met pas à jour `failedCount` sur le run à la fin (contrairement à `execute()`) — incohérence mineure dans l'observabilité
- `embeddingEligibleCondition` prend une colonne en paramètre (correct), mais la JSDoc de `embedding-eligibility.ts` n'explicite pas que EMBEDDING_ELIGIBLE_SQL_PREDICATE et le helper Drizzle doivent rester synchronisés manuellement — risque futur

---

## Problème bloquant

### Completion rule non respectée

Le ticket stipule explicitement :

> *"Do not close after unit tests. Run the new enrichment mode against production (or an equivalent restored production snapshot), publish before/after counts, and show the remaining terminal failures with their real causes."*

Le fichier `production-run-20260819.md` reconnaît :

> *"Production API (api.iptvflix.com) not DNS-resolvable from this environment, and Fly.io authentication is not available."*

Le run a été effectué sur un DB de dev local avec **6 films** (3 pré-enrichis, 2 sans tmdbId, 1 cas de test synthétique avec TMDB ID 99999999 inexistant), et **39 séries** dont 37 sans tmdbId. Ce n'est ni la production ni un snapshot équivalent.

### Deux critères d'acceptance non démontrés

**Critère 1 :**
> *"Production refresh failure root causes are observable with the real DB error, not only generated SQL/params."*

Le cas de test simule un TMDB 404 (`stage: fetch`, `errorMessage: "TMDB returned null"`). Or les 126 failures originales sont décrites comme `"Failed query: update ... params ..."`, soit des erreurs `db_update` (contrainte PostgreSQL), pas des 404 TMDB. La capture d'erreur DB (`catch` sur `.update()` → `persistFailure({stage: 'db_update', ...})`) n'a pas été exercée avec une vraie erreur PostgreSQL.

**Critère 2 :**
> *"Run against the real production catalog and demonstrate meaningful reduction of incomplete titles and successful retry/fix of the previous failure population."*

Non satisfait. Il n'y a ni before/after sur les ~60k films réels, ni liste des failures réelles avec leurs causes DB, ni démonstration de réduction du nombre de titres incomplets.

---

## Corrections requises

1. **Exécuter le mode enrich-missing contre le catalogue de production** (ou un snapshot restauré avec les ~60k films / ~5k séries réels) et publier dans `runs/T115/production-run-20260819.md` :
   - Counts avant (neverEnriched, partiallyEnriched, failedLastEnrichment)
   - Counts après
   - Liste des failures terminales avec `stage`, `errorClass`, `errorCode`, `errorMessage` réels (en particulier pour "Les Chevaliers du Fiel : L'assassin est dans la salle" et les autres parmi les 126 originaux)

2. **Démontrer la capture d'erreur `db_update`** : le cas synthétique doit inclure au moins une erreur PostgreSQL réelle (ex. violation de contrainte NOT NULL ou contrainte unique) pour confirmer que `errorClass: "PostgresError"`, `errorCode: "23505"` et `errorMessage` réel sont bien persistés — pas "Failed query: update...".

---

## Tableau critères d'acceptance

| Critère | Statut |
|---|---|
| Normalisation TMDB runtime=0, imdb_id="", overview blank | ✅ Code + tests |
| Erreur DB réelle capturée (pas "Failed query:...") | ⚠️ Implémenté, non démontré sur DB update réel |
| Per-item failure persistence avec tous les champs requis | ✅ Schema + persistFailure() |
| Enrich-missing resumable et idempotent | ✅ Keyset cursor + checkpoint |
| Re-run progresse vers zéro (pas toujours le même batch) | ✅ Keyset, non offset |
| Failures listables et retryables individuellement | ✅ Routes + retryFailures() |
| Catalog-stats enrichment complet/partiel/jamais/failed | ✅ Queries réelles |
| embeddingPending non hardcodé à 0 | ✅ NOT EXISTS réel |
| Éligibilité embedding explicite et source unique | ✅ embedding-eligibility.ts |
| Run sur le catalogue de production réel | ❌ Dev DB local seulement |
| Before/after counts publiés sur production | ❌ Absent |
| Failures de production avec causes DB réelles listées | ❌ Absent |

IMPLEMENTATION_FIX_REQUIRED

---

## Instructions de fix

# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T115/reviews/implementation-review.md
- generated at: 2026-08-19T16:36:37Z

---

---

# Review — T115 — Complete Catalog Enrichment and Make Refresh Failures Resumable/Observable

## Résumé

L'implémentation est structurellement complète et de bonne qualité. Toutes les fonctionnalités du plan sont présentes et correctement connectées. Cependant, la **completion rule** du ticket n'est pas satisfaite : la validation a été effectuée sur un DB de dev local (6 films dont 3 pré-enrichis, 1 cas synthétique), et non sur le catalogue de production (~60k films / ~5k séries) ni sur un snapshot restauré.

---

## Scope et plan

Le périmètre implémenté correspond fidèlement au plan :
- Normalisation TMDB (runtime=0 → null, imdb_id="" → null, overview blank → null) — ✅ `client.ts:54,59,60`
- Table `enrichment_failures` avec upsert sur (media_type, media_id), retryCount incrémental — ✅ migration 0047, schema, persistFailure()
- `CatalogEnrichMissingService` : keyset cursor, concurrence configurable, retry exponentiel, checkpoint JSONB — ✅
- 4 routes `/admin/catalog-enrich-missing` (POST, status, failures, retry-failures) — ✅
- Extension `/admin/catalog-stats` avec neverEnriched/partiallyEnriched/fullyEnriched/failedLastEnrichment/embeddingPending (queries réelles, pas hardcodé) — ✅
- `embedding-eligibility.ts` : source unique pour la politique d'éligibilité — ✅

---

## Qualité du code

**Points forts :**
- Pagination par keyset (id ASC) plutôt qu'offset — idempotente, résiliente à l'insertion concurrente
- `clearFailure()` appelé sur succès — pas de stale records
- L'index partiel `catalog_refresh_runs_running_idx` (existant depuis migration 0032) garantit qu'un seul run RUNNING peut exister ; le catch `23505` est du vrai code de défense, pas mort
- `classifyError()` extrait class/code/message réels du driver PostgreSQL, couvre TmdbRateLimitError/TmdbNetworkError

**Observations mineures (non bloquantes) :**
- `retryFailures()` insère un run COMPLETED même quand `failures.length === 0` — bruit DB mais non problématique
- `retryFailures` ne met pas à jour `failedCount` sur le run à la fin (contrairement à `execute()`) — incohérence mineure dans l'observabilité
- `embeddingEligibleCondition` prend une colonne en paramètre (correct), mais la JSDoc de `embedding-eligibility.ts` n'explicite pas que EMBEDDING_ELIGIBLE_SQL_PREDICATE et le helper Drizzle doivent rester synchronisés manuellement — risque futur

---

## Problème bloquant

### Completion rule non respectée

Le ticket stipule explicitement :

> *"Do not close after unit tests. Run the new enrichment mode against production (or an equivalent restored production snapshot), publish before/after counts, and show the remaining terminal failures with their real causes."*

Le fichier `production-run-20260819.md` reconnaît :

> *"Production API (api.iptvflix.com) not DNS-resolvable from this environment, and Fly.io authentication is not available."*

Le run a été effectué sur un DB de dev local avec **6 films** (3 pré-enrichis, 2 sans tmdbId, 1 cas de test synthétique avec TMDB ID 99999999 inexistant), et **39 séries** dont 37 sans tmdbId. Ce n'est ni la production ni un snapshot équivalent.

### Deux critères d'acceptance non démontrés

**Critère 1 :**
> *"Production refresh failure root causes are observable with the real DB error, not only generated SQL/params."*

Le cas de test simule un TMDB 404 (`stage: fetch`, `errorMessage: "TMDB returned null"`). Or les 126 failures originales sont décrites comme `"Failed query: update ... params ..."`, soit des erreurs `db_update` (contrainte PostgreSQL), pas des 404 TMDB. La capture d'erreur DB (`catch` sur `.update()` → `persistFailure({stage: 'db_update', ...})`) n'a pas été exercée avec une vraie erreur PostgreSQL.

**Critère 2 :**
> *"Run against the real production catalog and demonstrate meaningful reduction of incomplete titles and successful retry/fix of the previous failure population."*

Non satisfait. Il n'y a ni before/after sur les ~60k films réels, ni liste des failures réelles avec leurs causes DB, ni démonstration de réduction du nombre de titres incomplets.

---

## Corrections requises

1. **Exécuter le mode enrich-missing contre le catalogue de production** (ou un snapshot restauré avec les ~60k films / ~5k séries réels) et publier dans `runs/T115/production-run-20260819.md` :
   - Counts avant (neverEnriched, partiallyEnriched, failedLastEnrichment)
   - Counts après
   - Liste des failures terminales avec `stage`, `errorClass`, `errorCode`, `errorMessage` réels (en particulier pour "Les Chevaliers du Fiel : L'assassin est dans la salle" et les autres parmi les 126 originaux)

2. **Démontrer la capture d'erreur `db_update`** : le cas synthétique doit inclure au moins une erreur PostgreSQL réelle (ex. violation de contrainte NOT NULL ou contrainte unique) pour confirmer que `errorClass: "PostgresError"`, `errorCode: "23505"` et `errorMessage` réel sont bien persistés — pas "Failed query: update...".

---

## Tableau critères d'acceptance

| Critère | Statut |
|---|---|
| Normalisation TMDB runtime=0, imdb_id="", overview blank | ✅ Code + tests |
| Erreur DB réelle capturée (pas "Failed query:...") | ⚠️ Implémenté, non démontré sur DB update réel |
| Per-item failure persistence avec tous les champs requis | ✅ Schema + persistFailure() |
| Enrich-missing resumable et idempotent | ✅ Keyset cursor + checkpoint |
| Re-run progresse vers zéro (pas toujours le même batch) | ✅ Keyset, non offset |
| Failures listables et retryables individuellement | ✅ Routes + retryFailures() |
| Catalog-stats enrichment complet/partiel/jamais/failed | ✅ Queries réelles |
| embeddingPending non hardcodé à 0 | ✅ NOT EXISTS réel |
| Éligibilité embedding explicite et source unique | ✅ embedding-eligibility.ts |
| Run sur le catalogue de production réel | ❌ Dev DB local seulement |
| Before/after counts publiés sur production | ❌ Absent |
| Failures de production avec causes DB réelles listées | ❌ Absent |

IMPLEMENTATION_FIX_REQUIRED