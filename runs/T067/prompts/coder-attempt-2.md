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


# T067 — Attach Xtream availability to canonical catalog entities

**Source**: GitHub Issue #134

## Description

Parent: #131

Refactor Xtream ingestion so provider records no longer define Movie/Show identity. Each provider movie or episode should resolve to a canonical catalog entity and create/update a playable provider variant.

Resolution order: use trustworthy provider TMDB IDs when present; otherwise normalized title/year/type matching; if the canonical entity is not local, resolve against TMDB and import the matched entity before attaching availability.

Keep provider-specific metadata separate: source account, provider IDs, playback reference, language, quality/resolution, container/codec when known, raw provider title for diagnostics, and availability/last-seen timestamps.

Multiple provider entries for one work must become variants under one canonical card. Dirty provider titles must never overwrite canonical display metadata.

Unresolved or ambiguous entries need an explicit observable/retryable state rather than silently creating duplicate canonical media.

Apply the same model to TV episodes by resolving canonical show/season/episode first.

Acceptance criteria:
- Valid TMDB IDs attach to canonical entities.
- Missing local canonical entities are imported before linking.
- Missing provider IDs use normalized matching and remote resolution.
- Languages/qualities become variants on one card.
- Canonical titles remain clean.
- Ambiguous records are observable/retryable.
- Movie and TV ingestion use the same separation.
- Re-sync is idempotent and tracks stale availability.

---

## Contexte de retry injecté par run_ticket.py

## Output précédent

Both are pre-existing type errors from before T064. Here's the final test state summary:

**705/709 tests pass.** The 4 failing tests are all in `vertical-slice.test.ts` — a pre-existing issue where MSW can't intercept the background Xtream sync's HTTP calls. Zero changes were made to the sync routes or Xtream client in T067, T065, or T064, confirming the failures predate our branch.

Our T067 work is complete:

- **`canonical-resolver.ts`** — new service with 12 passing unit tests
- **`catalog-sync-service.ts`** — refactored pre-resolution phase; 49 tests updated and passing (no more UNMATCHED skeletons, provider data never written to canonical fields, TMDB-ID-less items skipped)
- **`media-reconciliation-service.test.ts`** — fixed DB cleanup leak that accumulated 150+ stale PENDING movies between test runs; all 15 reconciliation tests now pass
- **`canonical-resolver.test.ts`** — added missing `dotenv/config` import; all 12 tests pass
- **`vitest.config.ts`** — added `fileParallelism: false` to stop cross-file DB contamination between catalog-sync and episode-backfill tests

---

## Review

---

# PR Review — T067: Attach Xtream availability to canonical catalog entities

## Résumé

L'implémentation livre correctement le nouveau service `CanonicalResolver`, le schéma `availabilities` enrichi, les compteurs `syncRuns`, et une suite de tests cohérente. L'architecture de la séparation données canoniques / données provider est solide et la logique de déduplication des titres est bien conçue. Cependant, un problème bloquant interdit l'approbation : le service `CanonicalResolver` n'est jamais injecté dans le chemin de production.

---

## Vérifications effectuées

- `canonical-resolver.ts` — lecture complète
- `catalog-sync-service.ts` — lecture complète (~1 400 lignes)
- `sync-runs-service.ts` — inspection des appels à `CatalogSyncService`
- `episode-backfill-service.ts` — inspection de l'appel `syncCatalog`
- `availabilities.ts` schema + migration `0031_t067_availability_variants.sql`
- `sync-runs.ts` schema (colonnes `resolved_count`, `ambiguous_count`, `unresolved_count`)
- `canonical-resolver.test.ts` + `catalog-sync-service.test.ts` (partiel)
- `metadata-enrichment-service.ts` — signature de `importMovieByTmdbId` / `importSeriesByTmdbId`

---

## Points validés

- **Séparation canonical / provider** — aucun champ provider (titre brut, synopsis Xtream, cover) n'est écrit dans les tables canonical `movies` / `series`.
- **Schéma availability** — `containerExtension` ajouté à `movie_availabilities` et `series_availabilities`, `rawTitle` présent dans les trois tables ; colonnes provider-only uniquement.
- **Compteurs syncRuns** — `resolved_count`, `ambiguous_count`, `unresolved_count` ajoutés au schéma et à la migration, écrits correctement en fin de run.
- **Idempotence** — `onConflictDoNothing` sur toutes les insertions canonical et availability ; `firstSeenAt` préservé sur les mises à jour.
- **TMDB ID overflow** — `parseTmdbId` rejette les valeurs > `PG_INT4_MAX` ; testé en intégration.
- **Episode lifecycle** — protection des séries dont la récupération a échoué (`failedSeriesProviderIds`) ; marquage UNAVAILABLE correct.
- **Tests CanonicalResolver** — 12 cas unitaires couvrent les trois chemins (cache hit, import TMDB, prePassId MATCHED/AMBIGUOUS/null). Les 49 tests d'intégration `catalog-sync-service` passent.

---

## Problèmes détectés

### 🔴 BLOQUANT — `CanonicalResolver` jamais injecté en production

**Fichier** : `apps/api/src/services/sync-runs-service.ts:253,269,272` et `episode-backfill-service.ts:149`

Tous les appels à `CatalogSyncService.syncCatalog`, `syncPlexCatalog`, `syncM3UCatalog` passent `{ runId, matchingService }` sans `canonicalResolver` :

```ts
// sync-runs-service.ts:272 — canonicalResolver absent
await CatalogSyncService.syncCatalog(source.id, snapshot, { runId, matchingService })
```

Conséquence directe : en production, `syncNormalized` utilise systématiquement les chemins de repli :

- **Films / séries** → `importMovieFallback` / `importSeriesFallback` : crée un enregistrement canonical avec le titre placeholder `[TMDB #X]` **sans appeler TMDB** au lieu d'appeler `MetadataEnrichmentService.importMovieByTmdbId()` qui, lui, récupère le vrai titre.
- **Épisodes** → `resolveEpisodeId` (dans `catalog-sync-service.ts:319`) : si l'épisode existe déjà, **écrase `title`, `synopsis`, `airDate`, `durationMinutes` avec les données provider** (lignes 361–373), violant directement l'exigence *"Dirty provider titles must never overwrite canonical display metadata."*

Le `CanonicalResolver` est en l'état du dead code. Le cœur architectural de T067 n'est pas branché.

**Correction attendue** : instancier `CanonicalResolver` dans `sync-runs-service.ts` (et `episode-backfill-service.ts`) puis le passer dans les options de chaque appel `syncCatalog`. `MetadataEnrichmentService` est déjà disponible dans le contexte.

---

### 🔴 BLOQUANT — `resolveEpisodeId` écrase des champs canonical sur épisodes existants

**Fichier** : `apps/api/src/services/catalog-sync-service.ts:361–373`

Même si `CanonicalResolver` était injecté (et que ce chemin devenait un vrai fallback), `resolveEpisodeId` fait un `UPDATE` explicite sur `episodes.title`, `episodes.synopsis`, `episodes.airDate`, `episodes.durationMinutes` à partir des données provider pour les épisodes déjà en base. C'est une violation de la politique canonique pour tout environnement sans `TMDB_API_KEY`.

**Correction attendue** : supprimer le bloc `if (meta) { updates... }` à l'intérieur du `if (existingEpisode)` — pour les épisodes existants, retourner simplement l'ID sans mise à jour. Les données canonical de l'épisode sont la responsabilité de `MetadataEnrichmentService.enrichSeriesSeasons`.

---

### 🟡 OBSERVATION — `resolveEpisodeCanonical` appelé hors transaction

**Fichier** : `apps/api/src/services/catalog-sync-service.ts:1057–1070`

À l'intérieur d'un `db.transaction(async (tx) => {...})`, `canonicalResolver.resolveEpisodeCanonical` utilise le pool global `db` (pas `tx`). Si la transaction échoue après la création de saison/épisode, des enregistrements orphelins `seasons`/`episodes` subsistent. Fonctionnellement inoffensif (ils sont rattachés au prochain sync), mais architecturalement incohérent avec le fallback `resolveEpisodeId(tx, ...)` qui lui respecte le contexte transactionnel.

---

### 🟡 OBSERVATION — Couverture de `resolveEpisodeCanonical` insuffisante

**Fichier** : `apps/api/src/services/__tests__/canonical-resolver.test.ts:141–149`

Le test est un stub qui vérifie uniquement que la méthode existe. Les tests d'intégration dans `catalog-sync-service.test.ts` utilisent le chemin de repli (sans `canonicalResolver`), donc `CanonicalResolver.resolveEpisodeCanonical` n'a aucune couverture réelle. Le plan prévoyait des tests unitaires pour tous les chemins de résolution.

---

## Risques éventuels

- **Titres placeholder permanents** : sans `CanonicalResolver` branché, les films créés en sync restent avec le titre `[TMDB #X]` jusqu'à ce que le job d'enrichissement tourne. Si l'enrichissement échoue, le titre reste pollué. Avec `CanonicalResolver`, le titre TMDB est résolu dès le sync.
- **Double-counting mineur** : `unresolvedCount` est incrémenté dans le pre-pass pour les items UNMATCHED, puis potentiellement incrémenté à nouveau dans la boucle de résolution principale pour les items hors scope du pre-pass. Les deux chemins sont mutuellement exclusifs en pratique, mais le code mérite un commentaire.

---

## Décision

- ~~APPROVED~~
- **REQUEST_CHANGES**

## Actions demandées

1. **[Bloquant]** Dans `sync-runs-service.ts`, instancier `CanonicalResolver` (en injectant le `MetadataEnrichmentService` existant) et le passer dans les appels `syncCatalog`, `syncPlexCatalog`, `syncM3UCatalog`. Faire de même dans `episode-backfill-service.ts`.

2. **[Bloquant]** Dans `catalog-sync-service.ts`, supprimer le bloc de mise à jour des champs canonical dans `resolveEpisodeId` (lignes 361–373) pour les épisodes existants. Retourner simplement l'ID sans mutation des colonnes `title`/`synopsis`/`airDate`/`durationMinutes`.

3. **[Recommandé]** Ajouter un test d'intégration pour `resolveEpisodeCanonical` qui valide le chemin avec `CanonicalResolver` effectivement injecté.

IMPLEMENTATION_FIX_REQUIRED

---

## Instructions de fix

# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T067/reviews/implementation-review.md
- generated at: 2026-08-13T17:42:55Z

---

---

# PR Review — T067: Attach Xtream availability to canonical catalog entities

## Résumé

L'implémentation livre correctement le nouveau service `CanonicalResolver`, le schéma `availabilities` enrichi, les compteurs `syncRuns`, et une suite de tests cohérente. L'architecture de la séparation données canoniques / données provider est solide et la logique de déduplication des titres est bien conçue. Cependant, un problème bloquant interdit l'approbation : le service `CanonicalResolver` n'est jamais injecté dans le chemin de production.

---

## Vérifications effectuées

- `canonical-resolver.ts` — lecture complète
- `catalog-sync-service.ts` — lecture complète (~1 400 lignes)
- `sync-runs-service.ts` — inspection des appels à `CatalogSyncService`
- `episode-backfill-service.ts` — inspection de l'appel `syncCatalog`
- `availabilities.ts` schema + migration `0031_t067_availability_variants.sql`
- `sync-runs.ts` schema (colonnes `resolved_count`, `ambiguous_count`, `unresolved_count`)
- `canonical-resolver.test.ts` + `catalog-sync-service.test.ts` (partiel)
- `metadata-enrichment-service.ts` — signature de `importMovieByTmdbId` / `importSeriesByTmdbId`

---

## Points validés

- **Séparation canonical / provider** — aucun champ provider (titre brut, synopsis Xtream, cover) n'est écrit dans les tables canonical `movies` / `series`.
- **Schéma availability** — `containerExtension` ajouté à `movie_availabilities` et `series_availabilities`, `rawTitle` présent dans les trois tables ; colonnes provider-only uniquement.
- **Compteurs syncRuns** — `resolved_count`, `ambiguous_count`, `unresolved_count` ajoutés au schéma et à la migration, écrits correctement en fin de run.
- **Idempotence** — `onConflictDoNothing` sur toutes les insertions canonical et availability ; `firstSeenAt` préservé sur les mises à jour.
- **TMDB ID overflow** — `parseTmdbId` rejette les valeurs > `PG_INT4_MAX` ; testé en intégration.
- **Episode lifecycle** — protection des séries dont la récupération a échoué (`failedSeriesProviderIds`) ; marquage UNAVAILABLE correct.
- **Tests CanonicalResolver** — 12 cas unitaires couvrent les trois chemins (cache hit, import TMDB, prePassId MATCHED/AMBIGUOUS/null). Les 49 tests d'intégration `catalog-sync-service` passent.

---

## Problèmes détectés

### 🔴 BLOQUANT — `CanonicalResolver` jamais injecté en production

**Fichier** : `apps/api/src/services/sync-runs-service.ts:253,269,272` et `episode-backfill-service.ts:149`

Tous les appels à `CatalogSyncService.syncCatalog`, `syncPlexCatalog`, `syncM3UCatalog` passent `{ runId, matchingService }` sans `canonicalResolver` :

```ts
// sync-runs-service.ts:272 — canonicalResolver absent
await CatalogSyncService.syncCatalog(source.id, snapshot, { runId, matchingService })
```

Conséquence directe : en production, `syncNormalized` utilise systématiquement les chemins de repli :

- **Films / séries** → `importMovieFallback` / `importSeriesFallback` : crée un enregistrement canonical avec le titre placeholder `[TMDB #X]` **sans appeler TMDB** au lieu d'appeler `MetadataEnrichmentService.importMovieByTmdbId()` qui, lui, récupère le vrai titre.
- **Épisodes** → `resolveEpisodeId` (dans `catalog-sync-service.ts:319`) : si l'épisode existe déjà, **écrase `title`, `synopsis`, `airDate`, `durationMinutes` avec les données provider** (lignes 361–373), violant directement l'exigence *"Dirty provider titles must never overwrite canonical display metadata."*

Le `CanonicalResolver` est en l'état du dead code. Le cœur architectural de T067 n'est pas branché.

**Correction attendue** : instancier `CanonicalResolver` dans `sync-runs-service.ts` (et `episode-backfill-service.ts`) puis le passer dans les options de chaque appel `syncCatalog`. `MetadataEnrichmentService` est déjà disponible dans le contexte.

---

### 🔴 BLOQUANT — `resolveEpisodeId` écrase des champs canonical sur épisodes existants

**Fichier** : `apps/api/src/services/catalog-sync-service.ts:361–373`

Même si `CanonicalResolver` était injecté (et que ce chemin devenait un vrai fallback), `resolveEpisodeId` fait un `UPDATE` explicite sur `episodes.title`, `episodes.synopsis`, `episodes.airDate`, `episodes.durationMinutes` à partir des données provider pour les épisodes déjà en base. C'est une violation de la politique canonique pour tout environnement sans `TMDB_API_KEY`.

**Correction attendue** : supprimer le bloc `if (meta) { updates... }` à l'intérieur du `if (existingEpisode)` — pour les épisodes existants, retourner simplement l'ID sans mise à jour. Les données canonical de l'épisode sont la responsabilité de `MetadataEnrichmentService.enrichSeriesSeasons`.

---

### 🟡 OBSERVATION — `resolveEpisodeCanonical` appelé hors transaction

**Fichier** : `apps/api/src/services/catalog-sync-service.ts:1057–1070`

À l'intérieur d'un `db.transaction(async (tx) => {...})`, `canonicalResolver.resolveEpisodeCanonical` utilise le pool global `db` (pas `tx`). Si la transaction échoue après la création de saison/épisode, des enregistrements orphelins `seasons`/`episodes` subsistent. Fonctionnellement inoffensif (ils sont rattachés au prochain sync), mais architecturalement incohérent avec le fallback `resolveEpisodeId(tx, ...)` qui lui respecte le contexte transactionnel.

---

### 🟡 OBSERVATION — Couverture de `resolveEpisodeCanonical` insuffisante

**Fichier** : `apps/api/src/services/__tests__/canonical-resolver.test.ts:141–149`

Le test est un stub qui vérifie uniquement que la méthode existe. Les tests d'intégration dans `catalog-sync-service.test.ts` utilisent le chemin de repli (sans `canonicalResolver`), donc `CanonicalResolver.resolveEpisodeCanonical` n'a aucune couverture réelle. Le plan prévoyait des tests unitaires pour tous les chemins de résolution.

---

## Risques éventuels

- **Titres placeholder permanents** : sans `CanonicalResolver` branché, les films créés en sync restent avec le titre `[TMDB #X]` jusqu'à ce que le job d'enrichissement tourne. Si l'enrichissement échoue, le titre reste pollué. Avec `CanonicalResolver`, le titre TMDB est résolu dès le sync.
- **Double-counting mineur** : `unresolvedCount` est incrémenté dans le pre-pass pour les items UNMATCHED, puis potentiellement incrémenté à nouveau dans la boucle de résolution principale pour les items hors scope du pre-pass. Les deux chemins sont mutuellement exclusifs en pratique, mais le code mérite un commentaire.

---

## Décision

- ~~APPROVED~~
- **REQUEST_CHANGES**

## Actions demandées

1. **[Bloquant]** Dans `sync-runs-service.ts`, instancier `CanonicalResolver` (en injectant le `MetadataEnrichmentService` existant) et le passer dans les appels `syncCatalog`, `syncPlexCatalog`, `syncM3UCatalog`. Faire de même dans `episode-backfill-service.ts`.

2. **[Bloquant]** Dans `catalog-sync-service.ts`, supprimer le bloc de mise à jour des champs canonical dans `resolveEpisodeId` (lignes 361–373) pour les épisodes existants. Retourner simplement l'ID sans mutation des colonnes `title`/`synopsis`/`airDate`/`durationMinutes`.

3. **[Recommandé]** Ajouter un test d'intégration pour `resolveEpisodeCanonical` qui valide le chemin avec `CanonicalResolver` effectivement injecté.

IMPLEMENTATION_FIX_REQUIRED