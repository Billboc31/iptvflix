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

All 23 tests pass, TypeScript compiles clean. 

Two changes made:

**Fix 1** — `catalog-enrich-missing-service.ts:165,169` — `&&` → `||` in the `resumeRunId` checkpoint merge. The old logic reset `done=false` whenever a type was included in the current run, defeating the resume. Now if a type was already done in the previous run it stays done.

**Fix 2** — `metadata-enrichment-service.ts:454-459` — when `enrichSeriesSeasons` throws, the function now returns `'terminal-failed'` immediately without calling `onEnriched`. This eliminates the inconsistent state where a series appeared simultaneously in `enriched` and `failedLastEnrichment`.

The remaining bloquant (BLOQUANT 3) is the production run artifact — that requires live infrastructure access (`flyctl auth login` or production `DATABASE_URL`) and cannot be resolved in code.

---

## Review

I have all the information needed. Let me write the review now.

---

# PR Review — T115: Complete catalog enrichment and make refresh failures resumable/observable

## Résumé

L'implémentation couvre la grande majorité des exigences fonctionnelles du ticket. Le code est architecturalement solide : normalisation TMDB, persistance des échecs par item, mode enrich-missing avec cursor keyset, routes admin, stats enrichies, politique d'éligibilité d'embedding. Deux bugs bloquants identifiés dans les itérations précédentes (logique de resume, état incohérent series/seasons) sont corrigés dans la version actuelle. **Un seul critère de complétude reste ouvert : l'exécution contre la production réelle.**

---

## Vérifications effectuées

### Fichiers lus

- `apps/api/src/services/catalog-enrich-missing-service.ts` (434 lignes)
- `apps/api/src/services/metadata-enrichment-service.ts` (824 lignes)
- `apps/api/src/services/embedding-eligibility.ts`
- `apps/api/src/services/embedding-backfill-service.ts` (imports vérifiés)
- `apps/api/src/routes/catalog-enrich-missing.ts`
- `apps/api/src/routes/catalog-stats.ts`
- `apps/api/src/providers/metadata/tmdb/client.ts` (lignes 49-144)
- `apps/api/src/db/schema/enrichment-failures.ts`
- `apps/api/migrations/0046_t115_catalog_refresh_runs_type.sql`
- `apps/api/migrations/0047_t115_enrichment_failures.sql`
- `apps/api/src/index.ts` (registration)
- `apps/api/src/providers/metadata/tmdb/__tests__/t115-normalization.test.ts`
- `apps/api/src/services/__tests__/t115-enrichment.test.ts`
- `runs/T115/production-run-20260819.md`
- `runs/T115/implementation-output.md`

---

## Points validés

### 1. Normalisation TMDB ✅

`mapMovieDetail()` (`client.ts:59-88`):
- `raw.runtime || null` → `runtime === 0` donne `null` ✅
- `raw.imdb_id || null` → chaîne vide donne `null` ✅  
- `raw.overview?.trim() || null` → synopsis whitespace donne `null` ✅

`mapSeriesDetail()` : même guards. Tests présents et passants (3 cas couverts).

### 2. Persistance des échecs par item ✅

Table `enrichment_failures` correcte : 13 colonnes, unique index sur `(media_type, media_id)`. L'upsert incrémente `retry_count` et met à jour `occurred_at`. `classifyError()` extrait `constructor.name` et `.code` PostgreSQL réel — plus de chaîne "Failed query: ...". Les stages couverts : `fetch`, `map`, `db_update`, `seasons`. `clearFailure()` nettoyage sur succès.

### 3. Logique de resume — BUG PRÉCÉDENT CORRIGÉ ✅

`catalog-enrich-missing-service.ts:165,169` : la condition `||` est correcte.  
```typescript
checkpoint.movies.done = prev.movies.done || !mediaTypes.includes('MOVIE')
```
Logique vérifiée : si un type était `done` dans le run précédent, il reste `done`. Si le type n'est pas dans `mediaTypes`, il est marqué `done`. Correct.

### 4. Incohérence series/seasons — BUG PRÉCÉDENT CORRIGÉ ✅

`metadata-enrichment-service.ts:437-459` : quand `enrichSeriesSeasons()` lance une exception, `seasonsFailed = true`, la fonction retourne `'terminal-failed'` sans appeler `onEnriched()`. La série apparaît dans `failedLastEnrichment` et non dans les succès du run. Correct.

### 5. Cursor keyset pagination ✅

La sélection `WHERE id > lastId ORDER BY id ASC LIMIT batchSize` (lignes 242-254) est correcte. Le curseur avance après chaque batch. Le checkpoint est sauvegardé. Idempotent : les lignes déjà fraîches ne sont pas dans la condition eligible.

### 6. Retry logic ✅

`enrichWithRetry()` (lignes 94-104) : 3 tentatives avec backoff `[250ms, 500ms, 1000ms]` sur résultat `provider-failed`. Terminal sur le 3e échec.

### 7. Routes admin ✅

4 routes registrées dans `protectedScope` (JWT requis). Input validation sur `batchSize`, `concurrency`, `throttleMs`. `POST /retry-failures` : fix de la route `force` confirmé, le flag est transmis au service.

### 8. Catalog-stats ✅

Toutes les métriques demandées présentes : `neverEnriched`, `partiallyEnriched`, `fullyEnriched`, `stale`, `failedLastEnrichment` (query réelle), `embeddingEligible`, `embeddingPending` (NOT EXISTS réel, pas hardcodé à 0), `embeddingBlocked`.

### 9. Embedding eligibility — source unique ✅

`embedding-eligibility.ts` exporte 3 formes : fonction TypeScript, prédicat SQL raw, condition Drizzle.  
- `catalog-stats.ts` utilise `EMBEDDING_ELIGIBLE_SQL_PREDICATE` ✅  
- `embedding-backfill-service.ts` importe et utilise `embeddingEligibleCondition` (lignes 7, 126, 138) ✅  
Source unique confirmée.

---

## Problèmes détectés

### BLOQUANT — Exécution production absente

Le ticket spécifie une **Completion rule** explicite :

> *Do not close after unit tests. Run the new enrichment mode against production (or an equivalent restored production snapshot), publish before/after counts, and show the remaining terminal failures with their real causes.*

Et un critère d'acceptance non coché :

> *[ ] Run against the real production catalog and demonstrate meaningful reduction of incomplete titles and successful retry/fix of the previous failure population.*

Le `production-run-20260819.md` documente un run sur un DB local de **6 films** dont 1 inséré manuellement pour simuler la défaillance. Ce n'est pas une snapshot production équivalente :

- Catalog réel : ~60k films, ~5k séries
- Run local : 6 films, dont 1 avec un TMDB ID inventé (99999999 → 404 garanti)
- Aucun before/after sur les ~126 échecs production originaux
- Aucune démonstration de réduction de `neverEnriched` à l'échelle

Le `production-run-playbook.md` documente les étapes mais n'a pas pu être exécuté (accès Fly.io non disponible dans l'environnement CI).

**Ce critère ne peut pas être satisfait par un changement de code.** Il requiert un accès infrastructure.

---

### Observation — Validation absente pour `mediaTypes`

`catalog-enrich-missing.ts:11-18` : `mediaTypes` est casté sans validation runtime. Une valeur invalide comme `['INVALID']` ne déclenche pas d'erreur HTTP 400 — elle serait silencieusement traitée comme `'SERIES'` dans la boucle de `execute()`. Impact limité (pas d'exposition de données sensibles) mais contraire aux conventions de validation du service.

```typescript
// Absent — à ajouter :
if (body?.mediaTypes) {
  const valid = ['MOVIE', 'SERIES']
  if (!body.mediaTypes.every(t => valid.includes(t))) {
    return reply.status(400).send({ error: 'mediaTypes must contain only MOVIE or SERIES' })
  }
}
```

### Observation — `enrichMissingService` sans callback d'embedding

`index.ts:204` : `enrichMissingService` est instancié avec `refreshEnrichmentService`, créé sans callback `onEnriched`. Les titres enrichis via enrich-missing n'envoient pas de signal à `EmbeddingService` pour un upsert incrémental. Ils apparaîtront dans `embeddingPending` jusqu'au prochain run de l'embedding backfill. Comportement acceptable pour un mode batch, mais à documenter dans le playbook.

---

## Risques éventuels

- **Séries avec `metadataEnrichedAt` défini mais seasons échouées** : ne sont pas dans `neverEnriched` mais dans `failedLastEnrichment`. Un re-run sans `force=true` les skipperait (déjà enrichies). Le `retry-failures` utilise `force: true` hardcodé côté enrichment — ce chemin de retry est correct.
- **`retrying` counter** : compte les tentatives pas les items uniques (documenté dans l'interface). Peut paraître élevé comparé à `failedTerminal`. Lisible mais potentiellement trompeur pour l'opérateur.
- **`embeddingBlocked` toujours 0** : car la politique d'éligibilité est `metadataEnrichedAt IS NOT NULL` = même que `enriched`. Correct et documenté dans le code, mais la métrique n'a pas encore de valeur informative.

---

## Décision

L'implémentation est fonctionnellement correcte sur tous les plans code. La seule exigence non satisfaite est la **Completion rule** explicite du ticket — un run contre la production ou une snapshot de production représentative, avec publication des compteurs avant/après.

Ce point ne peut pas être résolu par un changement de code. Il requiert une action opérationnelle : accès `DATABASE_URL` production ou restauration d'un dump représentatif (~60k films).

**Recommandation** : escalader l'accès infrastructure à un opérateur humain. Dès que le run est exécuté et les résultats publiés dans `runs/T115/production-run-20260819.md`, l'implémentation peut être approuvée sans nouvelle itération de code.

IMPLEMENTATION_FIX_REQUIRED

---

## Instructions de fix

# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T115/reviews/implementation-review.md
- generated at: 2026-08-19T16:27:42Z

---

I have all the information needed. Let me write the review now.

---

# PR Review — T115: Complete catalog enrichment and make refresh failures resumable/observable

## Résumé

L'implémentation couvre la grande majorité des exigences fonctionnelles du ticket. Le code est architecturalement solide : normalisation TMDB, persistance des échecs par item, mode enrich-missing avec cursor keyset, routes admin, stats enrichies, politique d'éligibilité d'embedding. Deux bugs bloquants identifiés dans les itérations précédentes (logique de resume, état incohérent series/seasons) sont corrigés dans la version actuelle. **Un seul critère de complétude reste ouvert : l'exécution contre la production réelle.**

---

## Vérifications effectuées

### Fichiers lus

- `apps/api/src/services/catalog-enrich-missing-service.ts` (434 lignes)
- `apps/api/src/services/metadata-enrichment-service.ts` (824 lignes)
- `apps/api/src/services/embedding-eligibility.ts`
- `apps/api/src/services/embedding-backfill-service.ts` (imports vérifiés)
- `apps/api/src/routes/catalog-enrich-missing.ts`
- `apps/api/src/routes/catalog-stats.ts`
- `apps/api/src/providers/metadata/tmdb/client.ts` (lignes 49-144)
- `apps/api/src/db/schema/enrichment-failures.ts`
- `apps/api/migrations/0046_t115_catalog_refresh_runs_type.sql`
- `apps/api/migrations/0047_t115_enrichment_failures.sql`
- `apps/api/src/index.ts` (registration)
- `apps/api/src/providers/metadata/tmdb/__tests__/t115-normalization.test.ts`
- `apps/api/src/services/__tests__/t115-enrichment.test.ts`
- `runs/T115/production-run-20260819.md`
- `runs/T115/implementation-output.md`

---

## Points validés

### 1. Normalisation TMDB ✅

`mapMovieDetail()` (`client.ts:59-88`):
- `raw.runtime || null` → `runtime === 0` donne `null` ✅
- `raw.imdb_id || null` → chaîne vide donne `null` ✅  
- `raw.overview?.trim() || null` → synopsis whitespace donne `null` ✅

`mapSeriesDetail()` : même guards. Tests présents et passants (3 cas couverts).

### 2. Persistance des échecs par item ✅

Table `enrichment_failures` correcte : 13 colonnes, unique index sur `(media_type, media_id)`. L'upsert incrémente `retry_count` et met à jour `occurred_at`. `classifyError()` extrait `constructor.name` et `.code` PostgreSQL réel — plus de chaîne "Failed query: ...". Les stages couverts : `fetch`, `map`, `db_update`, `seasons`. `clearFailure()` nettoyage sur succès.

### 3. Logique de resume — BUG PRÉCÉDENT CORRIGÉ ✅

`catalog-enrich-missing-service.ts:165,169` : la condition `||` est correcte.  
```typescript
checkpoint.movies.done = prev.movies.done || !mediaTypes.includes('MOVIE')
```
Logique vérifiée : si un type était `done` dans le run précédent, il reste `done`. Si le type n'est pas dans `mediaTypes`, il est marqué `done`. Correct.

### 4. Incohérence series/seasons — BUG PRÉCÉDENT CORRIGÉ ✅

`metadata-enrichment-service.ts:437-459` : quand `enrichSeriesSeasons()` lance une exception, `seasonsFailed = true`, la fonction retourne `'terminal-failed'` sans appeler `onEnriched()`. La série apparaît dans `failedLastEnrichment` et non dans les succès du run. Correct.

### 5. Cursor keyset pagination ✅

La sélection `WHERE id > lastId ORDER BY id ASC LIMIT batchSize` (lignes 242-254) est correcte. Le curseur avance après chaque batch. Le checkpoint est sauvegardé. Idempotent : les lignes déjà fraîches ne sont pas dans la condition eligible.

### 6. Retry logic ✅

`enrichWithRetry()` (lignes 94-104) : 3 tentatives avec backoff `[250ms, 500ms, 1000ms]` sur résultat `provider-failed`. Terminal sur le 3e échec.

### 7. Routes admin ✅

4 routes registrées dans `protectedScope` (JWT requis). Input validation sur `batchSize`, `concurrency`, `throttleMs`. `POST /retry-failures` : fix de la route `force` confirmé, le flag est transmis au service.

### 8. Catalog-stats ✅

Toutes les métriques demandées présentes : `neverEnriched`, `partiallyEnriched`, `fullyEnriched`, `stale`, `failedLastEnrichment` (query réelle), `embeddingEligible`, `embeddingPending` (NOT EXISTS réel, pas hardcodé à 0), `embeddingBlocked`.

### 9. Embedding eligibility — source unique ✅

`embedding-eligibility.ts` exporte 3 formes : fonction TypeScript, prédicat SQL raw, condition Drizzle.  
- `catalog-stats.ts` utilise `EMBEDDING_ELIGIBLE_SQL_PREDICATE` ✅  
- `embedding-backfill-service.ts` importe et utilise `embeddingEligibleCondition` (lignes 7, 126, 138) ✅  
Source unique confirmée.

---

## Problèmes détectés

### BLOQUANT — Exécution production absente

Le ticket spécifie une **Completion rule** explicite :

> *Do not close after unit tests. Run the new enrichment mode against production (or an equivalent restored production snapshot), publish before/after counts, and show the remaining terminal failures with their real causes.*

Et un critère d'acceptance non coché :

> *[ ] Run against the real production catalog and demonstrate meaningful reduction of incomplete titles and successful retry/fix of the previous failure population.*

Le `production-run-20260819.md` documente un run sur un DB local de **6 films** dont 1 inséré manuellement pour simuler la défaillance. Ce n'est pas une snapshot production équivalente :

- Catalog réel : ~60k films, ~5k séries
- Run local : 6 films, dont 1 avec un TMDB ID inventé (99999999 → 404 garanti)
- Aucun before/after sur les ~126 échecs production originaux
- Aucune démonstration de réduction de `neverEnriched` à l'échelle

Le `production-run-playbook.md` documente les étapes mais n'a pas pu être exécuté (accès Fly.io non disponible dans l'environnement CI).

**Ce critère ne peut pas être satisfait par un changement de code.** Il requiert un accès infrastructure.

---

### Observation — Validation absente pour `mediaTypes`

`catalog-enrich-missing.ts:11-18` : `mediaTypes` est casté sans validation runtime. Une valeur invalide comme `['INVALID']` ne déclenche pas d'erreur HTTP 400 — elle serait silencieusement traitée comme `'SERIES'` dans la boucle de `execute()`. Impact limité (pas d'exposition de données sensibles) mais contraire aux conventions de validation du service.

```typescript
// Absent — à ajouter :
if (body?.mediaTypes) {
  const valid = ['MOVIE', 'SERIES']
  if (!body.mediaTypes.every(t => valid.includes(t))) {
    return reply.status(400).send({ error: 'mediaTypes must contain only MOVIE or SERIES' })
  }
}
```

### Observation — `enrichMissingService` sans callback d'embedding

`index.ts:204` : `enrichMissingService` est instancié avec `refreshEnrichmentService`, créé sans callback `onEnriched`. Les titres enrichis via enrich-missing n'envoient pas de signal à `EmbeddingService` pour un upsert incrémental. Ils apparaîtront dans `embeddingPending` jusqu'au prochain run de l'embedding backfill. Comportement acceptable pour un mode batch, mais à documenter dans le playbook.

---

## Risques éventuels

- **Séries avec `metadataEnrichedAt` défini mais seasons échouées** : ne sont pas dans `neverEnriched` mais dans `failedLastEnrichment`. Un re-run sans `force=true` les skipperait (déjà enrichies). Le `retry-failures` utilise `force: true` hardcodé côté enrichment — ce chemin de retry est correct.
- **`retrying` counter** : compte les tentatives pas les items uniques (documenté dans l'interface). Peut paraître élevé comparé à `failedTerminal`. Lisible mais potentiellement trompeur pour l'opérateur.
- **`embeddingBlocked` toujours 0** : car la politique d'éligibilité est `metadataEnrichedAt IS NOT NULL` = même que `enriched`. Correct et documenté dans le code, mais la métrique n'a pas encore de valeur informative.

---

## Décision

L'implémentation est fonctionnellement correcte sur tous les plans code. La seule exigence non satisfaite est la **Completion rule** explicite du ticket — un run contre la production ou une snapshot de production représentative, avec publication des compteurs avant/après.

Ce point ne peut pas être résolu par un changement de code. Il requiert une action opérationnelle : accès `DATABASE_URL` production ou restauration d'un dump représentatif (~60k films).

**Recommandation** : escalader l'accès infrastructure à un opérateur humain. Dès que le run est exécuté et les résultats publiés dans `runs/T115/production-run-20260819.md`, l'implémentation peut être approuvée sans nouvelle itération de code.

IMPLEMENTATION_FIX_REQUIRED