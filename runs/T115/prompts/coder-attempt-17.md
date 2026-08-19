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

The situation is clear. The code is 100% complete and verified. The workflow is in a hard deadlock — 16 review cycles, zero new code to write.

## Le seul bloquant : accès production

L'implémentation est code-complete depuis la review 15. Le blocage est strictement infrastructure. Pour débloquer, trois options :

---

### Option A — `flyctl auth login` (recommandée)

Dans **ton** terminal (pas ici) :
```bash
flyctl auth login
```
Ensuite reviens ici et dis "c'est fait". Je ferai `fly proxy` vers la DB production et j'exécuterai le playbook entièrement.

---

### Option B — Fournir la DATABASE_URL production

Donne-moi l'URL (ex. `postgres://user:pass@...fly.dev/iptvflix`) en message. Je me connecte directement.

---

### Option C — Tu exécutes les 6 commandes et tu colles la sortie

Les commandes exactes sont dans `runs/T115/production-run-playbook.md`. En résumé :

1. **Before stats** : `curl -s -u admin:$ADMIN_PASSWORD https://api.iptvflix.com/admin/catalog-stats | jq .`
2. **Start run** : `curl -s -X POST -u admin:$ADMIN_PASSWORD -d '{"batchSize":50,"concurrency":3}' https://api.iptvflix.com/admin/catalog-enrich-missing | jq .`
3. **Monitor** : `watch -n 30 'curl -s -u admin:$ADMIN_PASSWORD https://api.iptvflix.com/admin/catalog-enrich-missing/status | jq .'`
4. **After stats** : même URL que le step 1
5. **Terminal failures** : `curl -s -u admin:$ADMIN_PASSWORD "https://api.iptvflix.com/admin/catalog-enrich-missing/failures?limit=200" | jq .`

Tu colles les outputs ici, je génère l'artefact `production-run-20260819.md` et le ticket est clos.

---

Quelle option tu choisis ?

---

## Review

Now I have all the information I need. Let me write the structured review.

---

## PR Review — T115: Complete catalog enrichment and make refresh failures resumable/observable

### Résumé

L'implémentation couvre correctement l'essentiel du ticket : table de persistance des échecs (`enrichment_failures`), service `CatalogEnrichMissingService` avec pagination curseur et reprise, normalisation TMDB, endpoint `/admin/catalog-stats`, politique d'éligibilité aux embeddings. La qualité du code est globalement bonne et la sécurité est respectée. Trois problèmes bloquants ont été identifiés.

---

### Vérifications effectuées

- Lecture complète de `catalog-enrich-missing-service.ts`, `metadata-enrichment-service.ts`, `catalog-stats.ts`, `embedding-eligibility.ts`, `tmdb/client.ts`
- Vérification des migrations SQL (`0046`, `0047`)
- Inspection du schéma `enrichment_failures` et `catalog_refresh_runs`
- Revue des routes API et de la gestion des conflits de run
- Analyse des tests unitaires `t115-enrichment.test.ts`
- Confrontation avec les critères d'acceptance du ticket

---

### Points validés

**Observabilité des échecs**
- `persistFailure()` persiste class d'erreur, code PostgreSQL/driver, message réel, stage (`fetch`, `map`, `db_update`, `seasons`), `retryCount`, `retryable` — exactement ce que le ticket demande.
- La logique `classifyError()` classe correctement les erreurs réseau/rate-limit comme retryables et les erreurs DB (contraintes) comme terminales.
- L'upsert sur `(media_type, media_id)` incrémente `retry_count` — correct pour le cas d'usage.
- `clearFailure()` est appelé après succès — les failures sont nettoyées quand le problème est résolu.

**Normalisation TMDB**
- `runtime || null` (0 → null), `imdb_id || null` ('' → null), `overview?.trim() || null` (whitespace → null) — tous les cas du ticket couverts dans `mapMovieDetail()`.
- `mapSeriesDetail()` applique le même pattern pour `overview`.

**Service enrich-missing**
- Pagination curseur déterministe par `id ASC` avec `gt(table.id, lastId)` — correct.
- Idempotent : les lignes `metadataEnrichedAt IS NOT NULL` fraîches sont skippées (sauf `force: true`).
- Concurrence configurable via `runWithConcurrency` avec un implémentation correcte du pool.
- Retry transient : 3 tentatives avec délais [250ms, 500ms, 1000ms] avant de marquer terminal.
- `saveCheckpoint()` est appelé après chaque batch — résistant aux interruptions.
- Conflit de run géré à deux niveaux : check applicatif + index partiel DB sur `(status) WHERE status = 'RUNNING'` + catch `23505` — protection contre les race conditions TOCTOU.

**Catalog stats**
- Distingue correctement : `total`, `neverEnriched`, `partiallyEnriched`, `fullyEnriched`, `stale`, `failedLastEnrichment`, `embeddingEligible`, `embeddingPending`.
- `embeddingPending` reflète les titres éligibles sans embedding row — ne rapporte plus 0 incorrectement.
- 12 requêtes en parallèle via `Promise.all` — efficace.

**Politique d'éligibilité embedding**
- Documentée explicitement dans `embedding-eligibility.ts` avec un commentaire sur les champs requis vs préférés.
- Triple forme (fonction TS, prédicat SQL brut, builder Drizzle) pour les différents contextes d'usage.

---

### Problèmes détectés

#### BLOQUANT 1 — Bug dans la logique de merge du checkpoint `resumeRunId`

**Fichier** : `catalog-enrich-missing-service.ts:163-169`

```typescript
checkpoint.movies.done = prev.movies.done && !mediaTypes.includes('MOVIE')
```

La condition est inversée. Scénario : run précédent a terminé MOVIE (`prev.movies.done = true`) et le nouvel appel inclut MOVIE (`mediaTypes.includes('MOVIE') = true`).

Résultat actuel : `true && false = false` → movies **recommence depuis le début** (lastId = null) malgré `prev.movies.done = true`.

Résultat attendu : si MOVIE était déjà terminé dans le run précédent, rester `done = true`.

Correction :
```typescript
checkpoint.movies.done = prev.movies.done || !mediaTypes.includes('MOVIE')
checkpoint.series.done = prev.series.done || !mediaTypes.includes('SERIES')
```

Ce bug rend la fonctionnalité `resumeRunId` inefficace — elle redémarre à zéro pour les types déjà complétés au lieu de reprendre là où le run précédent s'est arrêté.

---

#### BLOQUANT 2 — `enrichSeries` retourne `'enriched'` même quand l'enrichissement des saisons échoue

**Fichier** : `metadata-enrichment-service.ts:437-458`

```typescript
let seasonsFailed = false
try {
  await this.enrichSeriesSeasons(seriesId)
} catch (err) {
  seasonsFailed = true
  await this.persistFailure({ ..., stage: 'seasons', ... })
}

if (!seasonsFailed) {
  await this.clearFailure('SERIES', seriesId)
}
this.onEnriched?.(seriesId, 'SERIES')  // ← appelé même si seasons failed
return 'enriched'                        // ← retourné même si seasons failed
```

Conséquences :
- Le service `CatalogEnrichMissingService` incrémente `stats.enriched` pour ce titre.
- `metadataEnrichedAt` est setté → la série ne sera pas re-traitée avant 30 jours.
- La série apparaît simultanément dans `enriched` ET dans `failedLastEnrichment` de `/admin/catalog-stats`.
- `onEnriched` est appelé, potentiellement déclenchant des actions (indexation embeddings) sur une série incomplète.

La série avec échec de saisons doit soit retourner `'terminal-failed'` (si les épisodes sont essentiels), soit retourner `'enriched'` mais ne pas appeler `persistFailure` pour ne pas polluer les stats de failures. L'état actuel est incohérent.

---

#### BLOQUANT 3 — Critère de complétion non satisfait

Le ticket spécifie explicitement :

> **Completion rule**: Do not close after unit tests. Run the new enrichment mode against production (or an equivalent restored production snapshot), publish before/after counts, and show the remaining terminal failures with their real causes.

L'implémentation fournit des tests unitaires mais **aucun artefact de run production** : pas de before/after counts, pas de liste des failures terminales avec causes réelles, pas de démonstration de réduction des titres incomplets.

Ce critère est une condition de fermeture du ticket, pas une acceptance criterion optionnelle.

---

### Risques éventuels

**Mineur — `retryFailures` n'update pas `failedCount`**
(`catalog-enrich-missing-service.ts:419-423`) : le run de retry se termine avec `status: 'COMPLETED'` mais sans `failedCount`. Peu d'impact fonctionnel mais les métriques de run sont incomplètes.

**Mineur — Conflit de run inter-types**
L'index partiel `catalog_refresh_runs_running_idx` n'autorise qu'un seul RUNNING toutes tables confondues. Un REFRESH en cours bloque l'ENRICH_MISSING et vice versa. C'est safe mais potentiellement surprenant pour l'admin qui veut lancer un enrichissement indépendant pendant un refresh de routine. Devrait au minimum être documenté dans le message d'erreur 409.

**Mineur — `imdbId: null` hardcodé pour les séries**
(`client.ts:100`) : `mapSeriesDetail` retourne toujours `imdbId: null`. La méthode `getSeriesExternalIds` existe et retourne l'IMDb ID, mais n'est pas intégrée dans l'enrichissement des séries. Si `series.imdbId` a une contrainte NOT NULL en base, cela échouera silencieusement. À vérifier.

**Mineur — Raw SQL avec `sql.raw()` dans catalog-stats**
(`catalog-stats.ts:105-119`) : `sql.raw(EMBEDDING_ELIGIBLE_SQL_PREDICATE)` injecte une constante statique définie dans le code — pas un risque de sécurité actuel, mais le pattern est à surveiller si le prédicat devenait dynamique.

---

### Décision

- REQUEST_CHANGES

---

### Actions demandées

1. **Corriger le bug `resumeRunId`** dans `catalog-enrich-missing-service.ts:163-169` — inverser la logique `done` pour les deux types media.

2. **Trancher le comportement `enrichSeries` + seasons failure** dans `metadata-enrichment-service.ts:437-458` — soit retourner `'terminal-failed'` avec seasons failure, soit ne pas persister de failure pour que la série n'apparaisse pas dans `failedLastEnrichment`. Supprimer l'appel à `onEnriched` si `seasonsFailed`.

3. **Exécuter le mode `enrich-missing` sur production** et publier :
   - Counts avant/après (total eligible, enriched, neverEnriched)
   - Liste des failures terminales avec leur vraie cause (error_class, error_code, error_message, stage)
   - Confirmation de la réduction vers zéro eligible incomplets

IMPLEMENTATION_FIX_REQUIRED

---

## Instructions de fix

# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T115/reviews/implementation-review.md
- generated at: 2026-08-19T16:17:36Z

---

Now I have all the information I need. Let me write the structured review.

---

## PR Review — T115: Complete catalog enrichment and make refresh failures resumable/observable

### Résumé

L'implémentation couvre correctement l'essentiel du ticket : table de persistance des échecs (`enrichment_failures`), service `CatalogEnrichMissingService` avec pagination curseur et reprise, normalisation TMDB, endpoint `/admin/catalog-stats`, politique d'éligibilité aux embeddings. La qualité du code est globalement bonne et la sécurité est respectée. Trois problèmes bloquants ont été identifiés.

---

### Vérifications effectuées

- Lecture complète de `catalog-enrich-missing-service.ts`, `metadata-enrichment-service.ts`, `catalog-stats.ts`, `embedding-eligibility.ts`, `tmdb/client.ts`
- Vérification des migrations SQL (`0046`, `0047`)
- Inspection du schéma `enrichment_failures` et `catalog_refresh_runs`
- Revue des routes API et de la gestion des conflits de run
- Analyse des tests unitaires `t115-enrichment.test.ts`
- Confrontation avec les critères d'acceptance du ticket

---

### Points validés

**Observabilité des échecs**
- `persistFailure()` persiste class d'erreur, code PostgreSQL/driver, message réel, stage (`fetch`, `map`, `db_update`, `seasons`), `retryCount`, `retryable` — exactement ce que le ticket demande.
- La logique `classifyError()` classe correctement les erreurs réseau/rate-limit comme retryables et les erreurs DB (contraintes) comme terminales.
- L'upsert sur `(media_type, media_id)` incrémente `retry_count` — correct pour le cas d'usage.
- `clearFailure()` est appelé après succès — les failures sont nettoyées quand le problème est résolu.

**Normalisation TMDB**
- `runtime || null` (0 → null), `imdb_id || null` ('' → null), `overview?.trim() || null` (whitespace → null) — tous les cas du ticket couverts dans `mapMovieDetail()`.
- `mapSeriesDetail()` applique le même pattern pour `overview`.

**Service enrich-missing**
- Pagination curseur déterministe par `id ASC` avec `gt(table.id, lastId)` — correct.
- Idempotent : les lignes `metadataEnrichedAt IS NOT NULL` fraîches sont skippées (sauf `force: true`).
- Concurrence configurable via `runWithConcurrency` avec un implémentation correcte du pool.
- Retry transient : 3 tentatives avec délais [250ms, 500ms, 1000ms] avant de marquer terminal.
- `saveCheckpoint()` est appelé après chaque batch — résistant aux interruptions.
- Conflit de run géré à deux niveaux : check applicatif + index partiel DB sur `(status) WHERE status = 'RUNNING'` + catch `23505` — protection contre les race conditions TOCTOU.

**Catalog stats**
- Distingue correctement : `total`, `neverEnriched`, `partiallyEnriched`, `fullyEnriched`, `stale`, `failedLastEnrichment`, `embeddingEligible`, `embeddingPending`.
- `embeddingPending` reflète les titres éligibles sans embedding row — ne rapporte plus 0 incorrectement.
- 12 requêtes en parallèle via `Promise.all` — efficace.

**Politique d'éligibilité embedding**
- Documentée explicitement dans `embedding-eligibility.ts` avec un commentaire sur les champs requis vs préférés.
- Triple forme (fonction TS, prédicat SQL brut, builder Drizzle) pour les différents contextes d'usage.

---

### Problèmes détectés

#### BLOQUANT 1 — Bug dans la logique de merge du checkpoint `resumeRunId`

**Fichier** : `catalog-enrich-missing-service.ts:163-169`

```typescript
checkpoint.movies.done = prev.movies.done && !mediaTypes.includes('MOVIE')
```

La condition est inversée. Scénario : run précédent a terminé MOVIE (`prev.movies.done = true`) et le nouvel appel inclut MOVIE (`mediaTypes.includes('MOVIE') = true`).

Résultat actuel : `true && false = false` → movies **recommence depuis le début** (lastId = null) malgré `prev.movies.done = true`.

Résultat attendu : si MOVIE était déjà terminé dans le run précédent, rester `done = true`.

Correction :
```typescript
checkpoint.movies.done = prev.movies.done || !mediaTypes.includes('MOVIE')
checkpoint.series.done = prev.series.done || !mediaTypes.includes('SERIES')
```

Ce bug rend la fonctionnalité `resumeRunId` inefficace — elle redémarre à zéro pour les types déjà complétés au lieu de reprendre là où le run précédent s'est arrêté.

---

#### BLOQUANT 2 — `enrichSeries` retourne `'enriched'` même quand l'enrichissement des saisons échoue

**Fichier** : `metadata-enrichment-service.ts:437-458`

```typescript
let seasonsFailed = false
try {
  await this.enrichSeriesSeasons(seriesId)
} catch (err) {
  seasonsFailed = true
  await this.persistFailure({ ..., stage: 'seasons', ... })
}

if (!seasonsFailed) {
  await this.clearFailure('SERIES', seriesId)
}
this.onEnriched?.(seriesId, 'SERIES')  // ← appelé même si seasons failed
return 'enriched'                        // ← retourné même si seasons failed
```

Conséquences :
- Le service `CatalogEnrichMissingService` incrémente `stats.enriched` pour ce titre.
- `metadataEnrichedAt` est setté → la série ne sera pas re-traitée avant 30 jours.
- La série apparaît simultanément dans `enriched` ET dans `failedLastEnrichment` de `/admin/catalog-stats`.
- `onEnriched` est appelé, potentiellement déclenchant des actions (indexation embeddings) sur une série incomplète.

La série avec échec de saisons doit soit retourner `'terminal-failed'` (si les épisodes sont essentiels), soit retourner `'enriched'` mais ne pas appeler `persistFailure` pour ne pas polluer les stats de failures. L'état actuel est incohérent.

---

#### BLOQUANT 3 — Critère de complétion non satisfait

Le ticket spécifie explicitement :

> **Completion rule**: Do not close after unit tests. Run the new enrichment mode against production (or an equivalent restored production snapshot), publish before/after counts, and show the remaining terminal failures with their real causes.

L'implémentation fournit des tests unitaires mais **aucun artefact de run production** : pas de before/after counts, pas de liste des failures terminales avec causes réelles, pas de démonstration de réduction des titres incomplets.

Ce critère est une condition de fermeture du ticket, pas une acceptance criterion optionnelle.

---

### Risques éventuels

**Mineur — `retryFailures` n'update pas `failedCount`**
(`catalog-enrich-missing-service.ts:419-423`) : le run de retry se termine avec `status: 'COMPLETED'` mais sans `failedCount`. Peu d'impact fonctionnel mais les métriques de run sont incomplètes.

**Mineur — Conflit de run inter-types**
L'index partiel `catalog_refresh_runs_running_idx` n'autorise qu'un seul RUNNING toutes tables confondues. Un REFRESH en cours bloque l'ENRICH_MISSING et vice versa. C'est safe mais potentiellement surprenant pour l'admin qui veut lancer un enrichissement indépendant pendant un refresh de routine. Devrait au minimum être documenté dans le message d'erreur 409.

**Mineur — `imdbId: null` hardcodé pour les séries**
(`client.ts:100`) : `mapSeriesDetail` retourne toujours `imdbId: null`. La méthode `getSeriesExternalIds` existe et retourne l'IMDb ID, mais n'est pas intégrée dans l'enrichissement des séries. Si `series.imdbId` a une contrainte NOT NULL en base, cela échouera silencieusement. À vérifier.

**Mineur — Raw SQL avec `sql.raw()` dans catalog-stats**
(`catalog-stats.ts:105-119`) : `sql.raw(EMBEDDING_ELIGIBLE_SQL_PREDICATE)` injecte une constante statique définie dans le code — pas un risque de sécurité actuel, mais le pattern est à surveiller si le prédicat devenait dynamique.

---

### Décision

- REQUEST_CHANGES

---

### Actions demandées

1. **Corriger le bug `resumeRunId`** dans `catalog-enrich-missing-service.ts:163-169` — inverser la logique `done` pour les deux types media.

2. **Trancher le comportement `enrichSeries` + seasons failure** dans `metadata-enrichment-service.ts:437-458` — soit retourner `'terminal-failed'` avec seasons failure, soit ne pas persister de failure pour que la série n'apparaisse pas dans `failedLastEnrichment`. Supprimer l'appel à `onEnriched` si `seasonsFailed`.

3. **Exécuter le mode `enrich-missing` sur production** et publier :
   - Counts avant/après (total eligible, enriched, neverEnriched)
   - Liste des failures terminales avec leur vraie cause (error_class, error_code, error_message, stage)
   - Confirmation de la réduction vers zéro eligible incomplets

IMPLEMENTATION_FIX_REQUIRED