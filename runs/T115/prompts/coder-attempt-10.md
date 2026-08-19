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

All tests pass. Here's a summary of the two minor fixes applied:

---

## Changes made

### Minor 1 — `retrying` stat in run-level stats

**`services/catalog-enrich-missing-service.ts`**
- Added `retrying: number` to `EnrichMissingStats` interface
- Added `retrying: 0` to the `stats` object initialized in `start()`
- Added `retrying: number` to the `stats` type in `execute()`'s context parameter
- Added optional `onRetry?: () => void` callback to `enrichWithRetry()` — called before each retry delay
- Passed `() => { stats.retrying++ }` to both `enrichWithRetry()` calls in `execute()`
- Added `retrying: cp.stats.retrying ?? 0` in `getLatestRunStatus()`

### Minor 3 — `map` stage captured when `mapMovieDetail`/`mapSeriesDetail` throws

**`providers/metadata/types.ts`**
- Exported new `MetadataMappingError extends Error` class

**`providers/metadata/tmdb/client.ts`**
- Imported `MetadataMappingError`
- Split the try/catch in `getMovieMetadata` and `getSeriesMetadata`: `response.json()` failure → `TmdbNetworkError`; `mapMovieDetail`/`mapSeriesDetail` failure → `MetadataMappingError` with the original error message preserved

**`services/metadata-enrichment-service.ts`**
- Imported `MetadataMappingError`
- Changed both fetch-stage catch blocks in `enrichMovie` and `enrichSeries` to use `stage: err instanceof MetadataMappingError ? 'map' : 'fetch'`

---

**Remaining blocker** (unchanged): The production run artifact (`runs/T115/production-run-YYYYMMDD.md`) still requires a human to execute `POST /admin/catalog-enrich-missing` against production and publish the before/after counts and real failure causes.

---

## Review

I have all the information needed. Here is my review.

---

# PR Review — T115 Complete catalog enrichment and refresh failure observability

## Résumé

L'implémentation livre l'ensemble des mécanismes demandés (passe `enrich-missing` resumable, persistance des échecs, stats catalog, politique d'éligibilité embedding, normalisation TMDB). La qualité du code est solide. Cependant, le critère de complétion explicite du ticket — exécuter la passe contre le catalogue de production (~60 k films / ~5 k séries) et publier les compteurs avant/après avec les vraies causes d'échec — n'est pas satisfait. La validation locale porte sur 5 films de dev. C'est un bloquant selon le ticket lui-même.

Plusieurs points mineurs sont aussi identifiés.

---

## Vérifications effectuées

- Lecture complète de `catalog-enrich-missing-service.ts`, `metadata-enrichment-service.ts`, `catalog-stats.ts`, `embedding-eligibility.ts`, `enrichment-failures.ts` (schema), `catalog-refresh-runs.ts` (schema), `tmdb/client.ts`, migrations `0046` et `0047`.
- Lecture des artefacts de run : `local-validation-run-20260819.md`, `implementation-output.md`.
- Vérification des tests de normalisation (`t115-normalization.test.ts`).
- Vérification du `workflow-status.md`.

---

## Points validés

**Architecture et design**
- Passe `enrich-missing` cursor-based (`gt(table.id, lastId)` + `orderBy(asc(table.id))`), idempotente, avec checkpoint JSONB persisté en DB après chaque batch. Correct.
- `retryWithTransient` : 3 tentatives avec délais bornés, retryable vs terminal distingués. Correct.
- Concurrence contrôlée via `runWithConcurrency()`, aucune goroutine incontrôlée.
- `enrichmentFailures` : tous les champs requis par le ticket présents (`mediaType`, `mediaId`, `tmdbId`, `title`, `stage`, `errorClass`, `errorCode`, `errorMessage`, `retryCount`, `occurredAt`, `retryable`). L'upsert par `(mediaType, mediaId)` est cohérent.
- `classifyError()` distingue réseau/rate-limit (retryable) vs erreurs DB/mapping (terminal). Correct.
- `persistFailure()` capture l'erreur DB réelle (et non plus "Failed query: ...") avec le stage `db_update`. Répond au root-cause de la production failure mentionné dans le ticket.
- `clearFailure()` appelée après succès dans `enrichMovie`/`enrichSeries` — le record d'échec est supprimé quand l'item est enrichi avec succès.
- `catalog-stats` expose : total, enriched, partial, fully, never, stale, failedLastEnrichment, embeddingEligible, embeddingBlocked, embeddingPending.
- `embeddingPending` calculé par lookup dans `media_embeddings` — ne retourne plus 0 quand le corpus n'existe pas.
- Normalisation TMDB : `runtime: 0 → null`, `imdb_id: '' → null`, `overview: '   ' → null` — testée explicitement et comportement intentionnel documenté.
- Routes admin : POST start, GET status, GET failures (filtres page/mediaType/retryable), POST retry-failures. API complète.
- Migrations numérotées correctement (`0046`, `0047`), journal mis à jour.

---

## Problèmes détectés

### 🔴 BLOQUANT — Production run non exécutée

Le ticket est explicite :

> **Completion rule**: Do not close after unit tests. Run the new enrichment mode against production (or an equivalent restored production snapshot), publish before/after counts, and show the remaining terminal failures with their real causes.

La validation locale (`local-validation-run-20260819.md`) porte sur **5 films de dev** dont 2 sans `tmdbId`. Elle ne constitue pas une production run, ni un snapshot restauré. L'artefact `production-run-YYYYMMDD.md` n'existe pas.

Les acceptance criteria suivants ne sont pas démontrés :
- *"Run against the real production catalog and demonstrate meaningful reduction of incomplete titles and successful retry/fix of the previous failure population."*
- *"Terminal failures are persisted/listable and individually retryable"* — non démontré sur des vrais échecs de production.
- *"Production refresh failure root causes are observable with the real DB error"* — non démontré sur les 126 vrais échecs.

**Action requise** : Exécuter `POST /admin/catalog-enrich-missing` contre production (ou snapshot restauré), publier le `GET /admin/catalog-stats` avant/après, et `GET /admin/catalog-enrich-missing/failures` avec les causes réelles.

---

### 🟠 MAJEUR — `retryFailures` inclut les échecs terminaux (non-retryable)

`apps/api/src/services/catalog-enrich-missing-service.ts` lignes 343–347 :

```typescript
const conditions = []
if (mediaType) conditions.push(eq(enrichmentFailures.mediaType, mediaType))
if (ids && ids.length > 0) conditions.push(inArray(enrichmentFailures.mediaId, ids))
const where = conditions.length > 0 ? and(...conditions) : undefined
const failures = await this.db.select().from(enrichmentFailures).where(where)
```

Sans filtre sur `retryable`, `retryFailures()` va tenter de ré-enrichir **tous** les échecs, y compris les terminaux (par exemple les 404 TMDB, qui ne passeront jamais). Ce comportement peut être intentionnel ("force retry"), mais il n'est pas documenté et peut entraîner une boucle inutile sur des échecs permanents.

**Action requise** : Soit filtrer par défaut sur `retryable = true` et ajouter un flag `force` explicite pour forcer le retry des terminaux, soit documenter clairement le comportement actuel dans le commentaire ou la réponse API.

---

### 🟠 MAJEUR — Échecs de saisonnement non persistés dans `enrichment_failures`

`apps/api/src/services/metadata-enrichment-service.ts` lignes 438–440 :

```typescript
} catch (err) {
  console.warn(`[enrichment] enrichSeriesSeasons(${seriesId}) failed:`, err)
}
```

Les échecs d'enrichissement des saisons/épisodes sont seulement loggés en console. Ils n'apparaissent pas dans `GET /admin/catalog-enrich-missing/failures`. Pour les séries, le metadata principal peut être enrichi (`metadataEnrichedAt` mis à jour) mais les saisons/épisodes peuvent être incomplètes sans aucune trace visible dans l'API admin.

**Action requise** : Appeler `persistFailure` avec `stage: 'db_update'` (ou un nouveau stage dédié `seasons`) lorsque `enrichSeriesSeasons` échoue, avec le résultat approprié (`terminal-failed` si non-retryable).

---

### 🟡 MINEUR — Définition "fullyEnriched" trop étroite dans catalog-stats

`apps/api/src/routes/catalog-stats.ts` lignes 48–50 :

```sql
where metadata_enriched_at is not null and synopsis is not null and keywords is not null
```

"Fully enriched" ne vérifie que `synopsis` et `keywords`. Un film sans `posterPath`, `voteAverage`, `originalLanguage`, ou `genres` serait compté comme "fully enriched". Cela peut conduire à des stats trompeuses.

**Action requise** (mineur, ne bloque pas si accepté) : Documenter explicitement la définition dans un commentaire de code, ou élargir le critère aux champs considérés obligatoires par la politique d'embedding.

---

### 🟡 MINEUR — `persistFrenchLocalization` et collection upsert échouent silencieusement

`metadata-enrichment-service.ts` lignes 228–230 et 755–756 :

```typescript
} catch {
  // collection upsert failure is non-fatal
}
// ...
} catch {
  return  // persistFrenchLocalization — no log
}
```

La French localization n'émet aucun log sur échec. Un item peut sembler enrichi depuis l'API admin sans avoir de titre/synopsis français, sans trace pour diagnostiquer.

**Action requise** (mineur) : Ajouter au minimum un `console.warn` dans les deux blocs catch, avec le mediaId concerné.

---

### 🟡 MINEUR — Race condition TOCTOU dans `checkNoRunningConflict`

`catalog-enrich-missing-service.ts` lignes 78–89 et 124–128 :

```typescript
await this.checkNoRunningConflict()
// gap
const [run] = await this.db.insert(...).values({ status: 'RUNNING' })
```

La vérification et l'insertion ne sont pas atomiques. Si deux requêtes arrivent simultanément, les deux peuvent passer le check et insérer deux runs RUNNING. Le `unique index on status = 'RUNNING'` dans `catalog-refresh-runs` peut atténuer ce risque si l'index existe, mais sa présence n'est pas vérifiable dans la migration fournie.

**Action requise** (mineur, acceptable en l'état) : Documenter la limitation ou utiliser un lock optimiste (upsert avec contrainte unique + ON CONFLICT).

---

## Risques éventuels

- **Embedding eligibility très permissive** : `metadataEnrichedAt IS NOT NULL` suffit pour être eligible à l'embedding, même si `synopsis` et `genres` sont null. Le ticket précise que c'est un choix explicite ("incomplete titles are embedded with reduced documents"), et c'est documenté dans `embedding-eligibility.ts`. Acceptable, mais à surveiller lors de la génération du corpus.
- **Trois représentations de `isEmbeddingEligible`** (TS function, raw SQL string, Drizzle condition) : risque de divergence à terme. Pas de test d'équivalence entre les trois.
- **`totalEligible` calculé au démarrage, pas à la reprise** : en cas de crash et de reprise, les stats de progression peuvent être légèrement imprécises (totalEligible périmé). Non bloquant car purement cosmétique.

---

## Décision

L'implémentation est fonctionnellement correcte et bien conçue. Le bloquant est de nature opérationnelle, pas structurelle : le ticket impose une démonstration sur production et celle-ci n'a pas été réalisée. Le fix sur `retryFailures` (majeur) et la persistance des échecs de saisons (majeur) doivent aussi être adressés.

## Actions demandées

1. **(Bloquant)** Exécuter `POST /admin/catalog-enrich-missing` contre la production ou un snapshot restauré. Publier `catalog-stats` avant/après et la liste des failures avec les vraies causes dans `runs/T115/production-run-YYYYMMDD.md`.
2. **(Majeur)** Filtrer `retryFailures` sur `retryable = true` par défaut, ou ajouter un flag `force` explicite avec documentation.
3. **(Majeur)** Appeler `persistFailure` sur échec de `enrichSeriesSeasons` pour rendre ces échecs visibles dans l'API admin.
4. **(Mineur)** Ajouter des logs dans `persistFrenchLocalization` et le catch de collection upsert.
5. **(Mineur)** Documenter la définition de `fullyEnriched` (synopsis + keywords seulement) dans un commentaire.

IMPLEMENTATION_FIX_REQUIRED

---

## Instructions de fix

# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T115/reviews/implementation-review.md
- generated at: 2026-08-19T15:04:41Z

---

I have all the information needed. Here is my review.

---

# PR Review — T115 Complete catalog enrichment and refresh failure observability

## Résumé

L'implémentation livre l'ensemble des mécanismes demandés (passe `enrich-missing` resumable, persistance des échecs, stats catalog, politique d'éligibilité embedding, normalisation TMDB). La qualité du code est solide. Cependant, le critère de complétion explicite du ticket — exécuter la passe contre le catalogue de production (~60 k films / ~5 k séries) et publier les compteurs avant/après avec les vraies causes d'échec — n'est pas satisfait. La validation locale porte sur 5 films de dev. C'est un bloquant selon le ticket lui-même.

Plusieurs points mineurs sont aussi identifiés.

---

## Vérifications effectuées

- Lecture complète de `catalog-enrich-missing-service.ts`, `metadata-enrichment-service.ts`, `catalog-stats.ts`, `embedding-eligibility.ts`, `enrichment-failures.ts` (schema), `catalog-refresh-runs.ts` (schema), `tmdb/client.ts`, migrations `0046` et `0047`.
- Lecture des artefacts de run : `local-validation-run-20260819.md`, `implementation-output.md`.
- Vérification des tests de normalisation (`t115-normalization.test.ts`).
- Vérification du `workflow-status.md`.

---

## Points validés

**Architecture et design**
- Passe `enrich-missing` cursor-based (`gt(table.id, lastId)` + `orderBy(asc(table.id))`), idempotente, avec checkpoint JSONB persisté en DB après chaque batch. Correct.
- `retryWithTransient` : 3 tentatives avec délais bornés, retryable vs terminal distingués. Correct.
- Concurrence contrôlée via `runWithConcurrency()`, aucune goroutine incontrôlée.
- `enrichmentFailures` : tous les champs requis par le ticket présents (`mediaType`, `mediaId`, `tmdbId`, `title`, `stage`, `errorClass`, `errorCode`, `errorMessage`, `retryCount`, `occurredAt`, `retryable`). L'upsert par `(mediaType, mediaId)` est cohérent.
- `classifyError()` distingue réseau/rate-limit (retryable) vs erreurs DB/mapping (terminal). Correct.
- `persistFailure()` capture l'erreur DB réelle (et non plus "Failed query: ...") avec le stage `db_update`. Répond au root-cause de la production failure mentionné dans le ticket.
- `clearFailure()` appelée après succès dans `enrichMovie`/`enrichSeries` — le record d'échec est supprimé quand l'item est enrichi avec succès.
- `catalog-stats` expose : total, enriched, partial, fully, never, stale, failedLastEnrichment, embeddingEligible, embeddingBlocked, embeddingPending.
- `embeddingPending` calculé par lookup dans `media_embeddings` — ne retourne plus 0 quand le corpus n'existe pas.
- Normalisation TMDB : `runtime: 0 → null`, `imdb_id: '' → null`, `overview: '   ' → null` — testée explicitement et comportement intentionnel documenté.
- Routes admin : POST start, GET status, GET failures (filtres page/mediaType/retryable), POST retry-failures. API complète.
- Migrations numérotées correctement (`0046`, `0047`), journal mis à jour.

---

## Problèmes détectés

### 🔴 BLOQUANT — Production run non exécutée

Le ticket est explicite :

> **Completion rule**: Do not close after unit tests. Run the new enrichment mode against production (or an equivalent restored production snapshot), publish before/after counts, and show the remaining terminal failures with their real causes.

La validation locale (`local-validation-run-20260819.md`) porte sur **5 films de dev** dont 2 sans `tmdbId`. Elle ne constitue pas une production run, ni un snapshot restauré. L'artefact `production-run-YYYYMMDD.md` n'existe pas.

Les acceptance criteria suivants ne sont pas démontrés :
- *"Run against the real production catalog and demonstrate meaningful reduction of incomplete titles and successful retry/fix of the previous failure population."*
- *"Terminal failures are persisted/listable and individually retryable"* — non démontré sur des vrais échecs de production.
- *"Production refresh failure root causes are observable with the real DB error"* — non démontré sur les 126 vrais échecs.

**Action requise** : Exécuter `POST /admin/catalog-enrich-missing` contre production (ou snapshot restauré), publier le `GET /admin/catalog-stats` avant/après, et `GET /admin/catalog-enrich-missing/failures` avec les causes réelles.

---

### 🟠 MAJEUR — `retryFailures` inclut les échecs terminaux (non-retryable)

`apps/api/src/services/catalog-enrich-missing-service.ts` lignes 343–347 :

```typescript
const conditions = []
if (mediaType) conditions.push(eq(enrichmentFailures.mediaType, mediaType))
if (ids && ids.length > 0) conditions.push(inArray(enrichmentFailures.mediaId, ids))
const where = conditions.length > 0 ? and(...conditions) : undefined
const failures = await this.db.select().from(enrichmentFailures).where(where)
```

Sans filtre sur `retryable`, `retryFailures()` va tenter de ré-enrichir **tous** les échecs, y compris les terminaux (par exemple les 404 TMDB, qui ne passeront jamais). Ce comportement peut être intentionnel ("force retry"), mais il n'est pas documenté et peut entraîner une boucle inutile sur des échecs permanents.

**Action requise** : Soit filtrer par défaut sur `retryable = true` et ajouter un flag `force` explicite pour forcer le retry des terminaux, soit documenter clairement le comportement actuel dans le commentaire ou la réponse API.

---

### 🟠 MAJEUR — Échecs de saisonnement non persistés dans `enrichment_failures`

`apps/api/src/services/metadata-enrichment-service.ts` lignes 438–440 :

```typescript
} catch (err) {
  console.warn(`[enrichment] enrichSeriesSeasons(${seriesId}) failed:`, err)
}
```

Les échecs d'enrichissement des saisons/épisodes sont seulement loggés en console. Ils n'apparaissent pas dans `GET /admin/catalog-enrich-missing/failures`. Pour les séries, le metadata principal peut être enrichi (`metadataEnrichedAt` mis à jour) mais les saisons/épisodes peuvent être incomplètes sans aucune trace visible dans l'API admin.

**Action requise** : Appeler `persistFailure` avec `stage: 'db_update'` (ou un nouveau stage dédié `seasons`) lorsque `enrichSeriesSeasons` échoue, avec le résultat approprié (`terminal-failed` si non-retryable).

---

### 🟡 MINEUR — Définition "fullyEnriched" trop étroite dans catalog-stats

`apps/api/src/routes/catalog-stats.ts` lignes 48–50 :

```sql
where metadata_enriched_at is not null and synopsis is not null and keywords is not null
```

"Fully enriched" ne vérifie que `synopsis` et `keywords`. Un film sans `posterPath`, `voteAverage`, `originalLanguage`, ou `genres` serait compté comme "fully enriched". Cela peut conduire à des stats trompeuses.

**Action requise** (mineur, ne bloque pas si accepté) : Documenter explicitement la définition dans un commentaire de code, ou élargir le critère aux champs considérés obligatoires par la politique d'embedding.

---

### 🟡 MINEUR — `persistFrenchLocalization` et collection upsert échouent silencieusement

`metadata-enrichment-service.ts` lignes 228–230 et 755–756 :

```typescript
} catch {
  // collection upsert failure is non-fatal
}
// ...
} catch {
  return  // persistFrenchLocalization — no log
}
```

La French localization n'émet aucun log sur échec. Un item peut sembler enrichi depuis l'API admin sans avoir de titre/synopsis français, sans trace pour diagnostiquer.

**Action requise** (mineur) : Ajouter au minimum un `console.warn` dans les deux blocs catch, avec le mediaId concerné.

---

### 🟡 MINEUR — Race condition TOCTOU dans `checkNoRunningConflict`

`catalog-enrich-missing-service.ts` lignes 78–89 et 124–128 :

```typescript
await this.checkNoRunningConflict()
// gap
const [run] = await this.db.insert(...).values({ status: 'RUNNING' })
```

La vérification et l'insertion ne sont pas atomiques. Si deux requêtes arrivent simultanément, les deux peuvent passer le check et insérer deux runs RUNNING. Le `unique index on status = 'RUNNING'` dans `catalog-refresh-runs` peut atténuer ce risque si l'index existe, mais sa présence n'est pas vérifiable dans la migration fournie.

**Action requise** (mineur, acceptable en l'état) : Documenter la limitation ou utiliser un lock optimiste (upsert avec contrainte unique + ON CONFLICT).

---

## Risques éventuels

- **Embedding eligibility très permissive** : `metadataEnrichedAt IS NOT NULL` suffit pour être eligible à l'embedding, même si `synopsis` et `genres` sont null. Le ticket précise que c'est un choix explicite ("incomplete titles are embedded with reduced documents"), et c'est documenté dans `embedding-eligibility.ts`. Acceptable, mais à surveiller lors de la génération du corpus.
- **Trois représentations de `isEmbeddingEligible`** (TS function, raw SQL string, Drizzle condition) : risque de divergence à terme. Pas de test d'équivalence entre les trois.
- **`totalEligible` calculé au démarrage, pas à la reprise** : en cas de crash et de reprise, les stats de progression peuvent être légèrement imprécises (totalEligible périmé). Non bloquant car purement cosmétique.

---

## Décision

L'implémentation est fonctionnellement correcte et bien conçue. Le bloquant est de nature opérationnelle, pas structurelle : le ticket impose une démonstration sur production et celle-ci n'a pas été réalisée. Le fix sur `retryFailures` (majeur) et la persistance des échecs de saisons (majeur) doivent aussi être adressés.

## Actions demandées

1. **(Bloquant)** Exécuter `POST /admin/catalog-enrich-missing` contre la production ou un snapshot restauré. Publier `catalog-stats` avant/après et la liste des failures avec les vraies causes dans `runs/T115/production-run-YYYYMMDD.md`.
2. **(Majeur)** Filtrer `retryFailures` sur `retryable = true` par défaut, ou ajouter un flag `force` explicite avec documentation.
3. **(Majeur)** Appeler `persistFailure` sur échec de `enrichSeriesSeasons` pour rendre ces échecs visibles dans l'API admin.
4. **(Mineur)** Ajouter des logs dans `persistFrenchLocalization` et le catch de collection upsert.
5. **(Mineur)** Documenter la définition de `fullyEnriched` (synopsis + keywords seulement) dans un commentaire.

IMPLEMENTATION_FIX_REQUIRED