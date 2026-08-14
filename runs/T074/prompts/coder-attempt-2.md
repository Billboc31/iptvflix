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


# T074 — Populate canonical TV seasons and episodes from TMDB independently of sources

**Source**: GitHub Issue #152

## Description

## Context
IPTVFlix is now TMDB-first: canonical media exists independently from Xtream/Plex availability. However, series can currently have a canonical show page while seasons/episodes are missing until source data is present. That violates the new model and blocks the immersive Series detail experience (#150).

## Core rule
TMDB defines the canonical TV hierarchy. A Series MUST be able to exist as:

Series → Seasons → Episodes

with ZERO playable sources anywhere in that hierarchy. Xtream/Plex only attach availability/variants to the matching canonical show/season/episode later.

## Goal
Extend the TMDB catalog bootstrap/enrichment/refresh pipeline so imported canonical TV shows have their TMDB seasons and episodes populated locally, with rich enough metadata for browsing before any source import.

## Requirements

### Canonical hierarchy
For every eligible imported TMDB show, persist canonical seasons and episodes using stable TMDB identities and existing relational tables/models. Do not create episodes from Xtream identity.

Support normal seasons, season 0 / specials, miniseries, currently airing shows, future announced seasons/episodes, missing/partial TMDB metadata, and shows whose hierarchy changes later.

### Season metadata
Persist useful available metadata such as TMDB season id, season number/name, overview, poster path, air date, episode count and sync timestamps/provenance where compatible with the existing schema.

### Episode metadata
Persist useful available metadata such as TMDB episode id, season/episode number, localized title, original title where useful, overview, still image path, air date, runtime, vote/rating and other existing canonical fields useful to the UI. Do not store image binaries.

### Bootstrap integration
The catalog bootstrap introduced by the TMDB-first pivot must populate TV hierarchy without requiring Xtream/Plex first.

Do not make bootstrap fragile by serially fetching an unlimited number of endpoints with no controls. Implement sensible concurrency/rate-limit handling, retries/backoff, progress accounting and resumability/idempotency consistent with the existing bootstrap architecture.

If fully hydrating every episode for the entire initial long-tail catalog would make bootstrap impractical, implement a deliberate scalable strategy: prioritize relevant/popular/current catalog during bootstrap and support deferred/on-demand hydration for remaining shows. The end-user invariant remains that opening/browsing a canonical show can obtain its canonical seasons/episodes without any playable source.

### On-demand enrichment
When a canonical Series is opened/searched/imported and its season/episode hierarchy is absent or stale, the backend should be able to hydrate/refresh it from TMDB. Avoid requiring a full global bootstrap rerun.

### Scheduled refresh
Integrate with the existing TMDB refresh scheduler. Current/upcoming/airing shows should refresh more frequently than completed old shows. Detect newly announced seasons/episodes and metadata changes without destructive duplication.

### Xtream/Plex attachment
Source sync must resolve incoming series/episode streams against the canonical hierarchy and attach availability/variants. It must NOT be the mechanism responsible for creating the canonical hierarchy. Existing matching improvements should be reused.

### Idempotency and reconciliation
Repeated bootstrap/refresh/hydration must not duplicate seasons or episodes. Upsert using stable TMDB identities/natural hierarchy constraints as appropriate. Preserve user state such as episode progress/watched state and existing valid availability links during metadata refresh.

### API/UI readiness
Ensure the existing/new Series detail API can return canonical seasons/episodes even when all have `sources = []`. #150 should be able to render season selectors and episode cards before Xtream import.

## Acceptance criteria
- [ ] A TMDB-imported Series can have seasons and episodes before any source is configured.
- [ ] Seasons/episodes use canonical TMDB identity rather than Xtream identity.
- [ ] Series with zero playable sources still return their hierarchy through the API.
- [ ] Bootstrap populates or schedules hydration of TV hierarchy according to a documented scalable strategy.
- [ ] Opening/enriching a missing or stale show can hydrate hierarchy from TMDB without rerunning the global bootstrap.
- [ ] Scheduled refresh discovers new seasons/episodes for ongoing shows.
- [ ] Specials/season 0, miniseries, upcoming and partially populated shows are handled gracefully.
- [ ] Repeated hydration is idempotent and creates no duplicates.
- [ ] Refresh does not destroy playback progress, watched state or valid source availability.
- [ ] Xtream/Plex attach variants to canonical episodes instead of defining the hierarchy.
- [ ] TMDB rate limits/retries/concurrency are handled safely.
- [ ] Progress/observability makes large hierarchy hydration diagnosable.
- [ ] Automated tests cover source-free shows, hierarchy hydration, refresh and idempotency.

## Dependency / UX
This is backend/catalog groundwork for #150 `Immersive modal Movie & Series detail experience`. The desired UI is: canonical Series → season selector → rich episode list, regardless of whether any episode is currently playable.

---

## Contexte de retry injecté par run_ticket.py

## Output précédent

All tasks complete. Here is a summary of changes made:

---

## Summary

### Files modified

**`apps/api/src/providers/metadata/types.ts`**
- Extended `ExternalSeriesMetadata.seasons[]` with `name: string | null` and `airDate: string | null` fields

**`apps/api/src/providers/metadata/tmdb/client.ts`**
- Updated `mapSeriesDetail()` to populate the new `name` and `airDate` fields from the raw TMDB response

**`apps/api/src/services/metadata-enrichment-service.ts`**
- `enrichSeries()` — seasons block changed from `UPDATE WHERE` to `INSERT ... ON CONFLICT (seriesId, seasonNumber) DO UPDATE`, creating canonical season rows even when none existed
- `enrichSeriesSeasons()` — episodes loop changed from "skip if no DB row" to `INSERT ... ON CONFLICT (seasonId, episodeNumber) DO UPDATE`, creating canonical episode rows from TMDB data independently of any source import

**`apps/api/src/config/env.ts`**
- Added `CATALOG_BOOTSTRAP_HIERARCHY_PRIORITY_COUNT` (default 200)

**`apps/api/src/services/catalog-bootstrap-service.ts`**
- Added `hierarchyPriorityCount` to `BootstrapConfig`
- Added optional `enrichmentService` as 4th constructor parameter
- Added priority-tier hierarchy hydration phase at end of `execute()`: queries top-N series by popularity, enriches them in batches of 5 with 500 ms inter-batch delay, tracked in checkpoint under key `hierarchy:priority`

**`apps/api/src/routes/catalog.ts`**
- Added `CatalogRoutesOptions` interface with optional `enrichmentService`
- `GET /series/:id` — when seasons are absent and `tmdbId` is set, fires `enrichSeries()` as fire-and-forget and sets `X-Hierarchy-Hydrating: true` response header

**`apps/api/src/index.ts`**
- Passes `MetadataEnrichmentService` to both `catalogRoutes` (on-demand hydration) and `CatalogBootstrapService` (priority tier)

### Files updated (tests)
- `metadata-enrichment-service.test.ts` — updated 2 existing tests to reflect upsert behavior; added 5 new tests (season upsert, idempotency, source-free episode creation)
- `catalog-bootstrap-service.test.ts` — added new env var to mock; added 2 tests for new config and wiring
- `catalog.test.ts` — added `GET /series/:id — on-demand hierarchy hydration` describe block with 3 tests

---

## Review

Good, the TypeScript error is confirmed. Now I have everything needed to write the review.

---

# PR Review — T074: Populate canonical TV seasons and episodes from TMDB

## Résumé

L'implémentation couvre l'essentiel du ticket de manière propre et focalisée : upsert canonique des saisons et épisodes, hydratation prioritaire au bootstrap, trigger on-demand, et tests ciblés. Un défaut TypeScript bloquant est introduit dans les tests, et un garde de concurrence manque pour le trigger on-demand (déviation explicite du plan). Le reste est correct.

---

## Vérifications effectuées

- `metadata-enrichment-service.ts` : logique d'upsert saisons et épisodes
- `catalog-bootstrap-service.ts` : configuration, tier prioritaire, checkpoint
- `routes/catalog.ts` : trigger fire-and-forget, header `X-Hierarchy-Hydrating`
- `index.ts` : câblage des services
- `providers/metadata/types.ts` et `tmdb/client.ts` : champs `name` et `airDate` sur les saisons
- `config/env.ts` : nouvelle variable `CATALOG_BOOTSTRAP_HIERARCHY_PRIORITY_COUNT`
- Tests : `metadata-enrichment-service.test.ts`, `catalog-bootstrap-service.test.ts`, `catalog.test.ts`
- Vérification TypeScript (`tsc --noEmit`)

---

## Points validés

**Upsert canonique (`metadata-enrichment-service.ts`)**
- `enrichSeries()` : `INSERT ... ON CONFLICT (seriesId, seasonNumber) DO UPDATE` correct avec `sql\`EXCLUDED.*\`` pour les champs ; season 0 gérée nativement sans filtre.
- `enrichSeriesSeasons()` : `INSERT ... ON CONFLICT (seasonId, episodeNumber) DO UPDATE` ; `episodeAvailabilities` et watch-state intacts (tables séparées non touchées).
- `updatedAt: sql\`now()\`` inclus dans les deux upserts — propre.
- Throttle 250ms entre saisons dans `enrichSeriesSeasons()`.

**Bootstrap (`catalog-bootstrap-service.ts`)**
- Tier prioritaire post-étapes : top-N par `popularity`, batches de 5, délai 500ms inter-batch, checkpoint `hierarchy:priority`, logs clairs.
- Résumabilité : `checkpoint[hierarchyKey]?.done` évite de rejouer le tier en cas de reprise.
- `BootstrapConfig.hierarchyPriorityCount` avec défaut 200 via `env.ts`.

**On-demand hydration (`routes/catalog.ts`)**
- Condition triple correcte : `seasonRows.length === 0 && seriesRow.tmdbId != null && opts.enrichmentService`.
- Fire-and-forget via `void` ; `X-Hierarchy-Hydrating: true` retourné immédiatement.
- Câblage `index.ts` correct : `enrichmentService` passé aux deux services.

**Tests**
- 5 nouveaux cas dans `metadata-enrichment-service.test.ts` : upsert sans source, idempotence, épisodes source-free, épisode TMDB crée une ligne.
- 3 cas d'hydratation on-demand dans `catalog.test.ts` (trigger, non-trigger si saisons présentes, non-trigger si `tmdbId` null).
- Coverage fonctionnel suffisant pour les acceptance criteria.

**Types TMDB**
- `ExternalSeriesMetadata.seasons[].name` et `.airDate` ajoutés dans `types.ts`; `mapSeriesDetail()` les popule depuis `raw.seasons`.

---

## Problèmes détectés

### [BLOQUANT] TypeScript type error dans `catalog-bootstrap-service.test.ts`

`tsc --noEmit` confirme :

```
src/services/__tests__/catalog-bootstrap-service.test.ts(16,7): error TS2741:
Property 'hierarchyPriorityCount' is missing in type '{ maxPagesPerFeed: number;
... }' but required in type 'BootstrapConfig'.
```

Le champ `hierarchyPriorityCount: number` a été ajouté comme requis dans l'interface `BootstrapConfig`, mais l'objet `config` du test (ligne 16) n'a pas été mis à jour. Le CI type-check échouera.

**Fix requis** : ajouter `hierarchyPriorityCount: 200` à l'objet `config` du test (ligne 23), ou rendre le champ optionnel dans l'interface avec une valeur par défaut dans le constructeur.

---

### [MINEUR] Garde de concurrence absent pour le trigger on-demand

Le plan spécifiait explicitement : *"AND enrichment is not already running"*. L'implémentation déclenche `enrichSeries(id)` à chaque requête `GET /series/:id` quand `seasonRows.length === 0`. Si N requêtes simultanées arrivent pour la même série non hydratée, N appels TMDB concurrents sont déclenchés.

Les upserts étant idempotents, aucune donnée corrompue ne résulte. Mais cela gaspille le quota TMDB et pourrait déclencher du rate-limiting sur des séries très demandées au démarrage. L'impact est faible en pratique, mais c'est une déviation documentée du plan.

**Fix suggéré** : un `Set<string>` en mémoire (ou un champ de module) des IDs en cours d'hydratation suffit. Pas de persistance DB nécessaire.

---

### [OBSERVATION] Tier bootstrap prioritaire peut sauter des séries récemment enrichies sans saisons

`enrichSeries()` retourne `'skipped'` si `metadataEnrichedAt` est dans la fenêtre `staleDays`. Une série enrichie avant ce fix (donc sans saisons) et dont `metadataEnrichedAt` est récent sera sautée par le tier prioritaire. Le refresh scheduler la ramassera à sa prochaine fenêtre de staleness.

Pour un bootstrap initial (toutes séries nouvelles, `metadataEnrichedAt = null`), ce cas ne se produit pas. Pour un re-bootstrap sur un catalogue existant, certaines séries resteront sans hiérarchie jusqu'au prochain cycle de refresh. Ce comportement est acceptable mais mériterait un commentaire dans le code.

---

### [OBSERVATION] Parallélisme bootstrap × rate-limit TMDB

Le tier prioritaire lance 5 séries en `Promise.all`. Chaque `enrichSeries()` fait 4 appels TMDB parallèles (metadata, videos, credits, certification). Cela représente jusqu'à 20 requêtes TMDB simultanées par batch, au-delà de la fenêtre TMDB de ~40 req/10s. Le retry/backoff du client TMDB absorbe les 429, mais le bruit sera visible. Acceptable compte tenu de la stratégie documentée ; à surveiller en prod.

---

## Risques éventuels

- Aucun risque de régression sur les `episodeAvailabilities` ou watch-state (tables distinctes, non touchées par les upserts).
- L'idempotence des upserts est correctement garantie par les contraintes DB `(seriesId, seasonNumber)` et `(seasonId, episodeNumber)`.
- Le fire-and-forget ne propage aucune erreur à l'appelant HTTP.

---

## Décision

L'implémentation est fonctionnellement correcte et bien structurée. Un défaut TypeScript bloquant introduit dans les tests doit être corrigé avant fusion. La déviation sur le garde de concurrence est mineure mais documentée dans le plan ; elle devrait être adressée dans le même fix.

**Actions requises :**
1. **[Bloquant]** Ajouter `hierarchyPriorityCount: 200` à l'objet `const config: BootstrapConfig` dans `catalog-bootstrap-service.test.ts` ligne 16.
2. **[Conseillé]** Ajouter un garde simple contre les hydrations concurrentes dans le handler `GET /series/:id`.

IMPLEMENTATION_FIX_REQUIRED

---

## Instructions de fix

# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T074/reviews/implementation-review.md
- generated at: 2026-08-14T07:17:02Z

---

Good, the TypeScript error is confirmed. Now I have everything needed to write the review.

---

# PR Review — T074: Populate canonical TV seasons and episodes from TMDB

## Résumé

L'implémentation couvre l'essentiel du ticket de manière propre et focalisée : upsert canonique des saisons et épisodes, hydratation prioritaire au bootstrap, trigger on-demand, et tests ciblés. Un défaut TypeScript bloquant est introduit dans les tests, et un garde de concurrence manque pour le trigger on-demand (déviation explicite du plan). Le reste est correct.

---

## Vérifications effectuées

- `metadata-enrichment-service.ts` : logique d'upsert saisons et épisodes
- `catalog-bootstrap-service.ts` : configuration, tier prioritaire, checkpoint
- `routes/catalog.ts` : trigger fire-and-forget, header `X-Hierarchy-Hydrating`
- `index.ts` : câblage des services
- `providers/metadata/types.ts` et `tmdb/client.ts` : champs `name` et `airDate` sur les saisons
- `config/env.ts` : nouvelle variable `CATALOG_BOOTSTRAP_HIERARCHY_PRIORITY_COUNT`
- Tests : `metadata-enrichment-service.test.ts`, `catalog-bootstrap-service.test.ts`, `catalog.test.ts`
- Vérification TypeScript (`tsc --noEmit`)

---

## Points validés

**Upsert canonique (`metadata-enrichment-service.ts`)**
- `enrichSeries()` : `INSERT ... ON CONFLICT (seriesId, seasonNumber) DO UPDATE` correct avec `sql\`EXCLUDED.*\`` pour les champs ; season 0 gérée nativement sans filtre.
- `enrichSeriesSeasons()` : `INSERT ... ON CONFLICT (seasonId, episodeNumber) DO UPDATE` ; `episodeAvailabilities` et watch-state intacts (tables séparées non touchées).
- `updatedAt: sql\`now()\`` inclus dans les deux upserts — propre.
- Throttle 250ms entre saisons dans `enrichSeriesSeasons()`.

**Bootstrap (`catalog-bootstrap-service.ts`)**
- Tier prioritaire post-étapes : top-N par `popularity`, batches de 5, délai 500ms inter-batch, checkpoint `hierarchy:priority`, logs clairs.
- Résumabilité : `checkpoint[hierarchyKey]?.done` évite de rejouer le tier en cas de reprise.
- `BootstrapConfig.hierarchyPriorityCount` avec défaut 200 via `env.ts`.

**On-demand hydration (`routes/catalog.ts`)**
- Condition triple correcte : `seasonRows.length === 0 && seriesRow.tmdbId != null && opts.enrichmentService`.
- Fire-and-forget via `void` ; `X-Hierarchy-Hydrating: true` retourné immédiatement.
- Câblage `index.ts` correct : `enrichmentService` passé aux deux services.

**Tests**
- 5 nouveaux cas dans `metadata-enrichment-service.test.ts` : upsert sans source, idempotence, épisodes source-free, épisode TMDB crée une ligne.
- 3 cas d'hydratation on-demand dans `catalog.test.ts` (trigger, non-trigger si saisons présentes, non-trigger si `tmdbId` null).
- Coverage fonctionnel suffisant pour les acceptance criteria.

**Types TMDB**
- `ExternalSeriesMetadata.seasons[].name` et `.airDate` ajoutés dans `types.ts`; `mapSeriesDetail()` les popule depuis `raw.seasons`.

---

## Problèmes détectés

### [BLOQUANT] TypeScript type error dans `catalog-bootstrap-service.test.ts`

`tsc --noEmit` confirme :

```
src/services/__tests__/catalog-bootstrap-service.test.ts(16,7): error TS2741:
Property 'hierarchyPriorityCount' is missing in type '{ maxPagesPerFeed: number;
... }' but required in type 'BootstrapConfig'.
```

Le champ `hierarchyPriorityCount: number` a été ajouté comme requis dans l'interface `BootstrapConfig`, mais l'objet `config` du test (ligne 16) n'a pas été mis à jour. Le CI type-check échouera.

**Fix requis** : ajouter `hierarchyPriorityCount: 200` à l'objet `config` du test (ligne 23), ou rendre le champ optionnel dans l'interface avec une valeur par défaut dans le constructeur.

---

### [MINEUR] Garde de concurrence absent pour le trigger on-demand

Le plan spécifiait explicitement : *"AND enrichment is not already running"*. L'implémentation déclenche `enrichSeries(id)` à chaque requête `GET /series/:id` quand `seasonRows.length === 0`. Si N requêtes simultanées arrivent pour la même série non hydratée, N appels TMDB concurrents sont déclenchés.

Les upserts étant idempotents, aucune donnée corrompue ne résulte. Mais cela gaspille le quota TMDB et pourrait déclencher du rate-limiting sur des séries très demandées au démarrage. L'impact est faible en pratique, mais c'est une déviation documentée du plan.

**Fix suggéré** : un `Set<string>` en mémoire (ou un champ de module) des IDs en cours d'hydratation suffit. Pas de persistance DB nécessaire.

---

### [OBSERVATION] Tier bootstrap prioritaire peut sauter des séries récemment enrichies sans saisons

`enrichSeries()` retourne `'skipped'` si `metadataEnrichedAt` est dans la fenêtre `staleDays`. Une série enrichie avant ce fix (donc sans saisons) et dont `metadataEnrichedAt` est récent sera sautée par le tier prioritaire. Le refresh scheduler la ramassera à sa prochaine fenêtre de staleness.

Pour un bootstrap initial (toutes séries nouvelles, `metadataEnrichedAt = null`), ce cas ne se produit pas. Pour un re-bootstrap sur un catalogue existant, certaines séries resteront sans hiérarchie jusqu'au prochain cycle de refresh. Ce comportement est acceptable mais mériterait un commentaire dans le code.

---

### [OBSERVATION] Parallélisme bootstrap × rate-limit TMDB

Le tier prioritaire lance 5 séries en `Promise.all`. Chaque `enrichSeries()` fait 4 appels TMDB parallèles (metadata, videos, credits, certification). Cela représente jusqu'à 20 requêtes TMDB simultanées par batch, au-delà de la fenêtre TMDB de ~40 req/10s. Le retry/backoff du client TMDB absorbe les 429, mais le bruit sera visible. Acceptable compte tenu de la stratégie documentée ; à surveiller en prod.

---

## Risques éventuels

- Aucun risque de régression sur les `episodeAvailabilities` ou watch-state (tables distinctes, non touchées par les upserts).
- L'idempotence des upserts est correctement garantie par les contraintes DB `(seriesId, seasonNumber)` et `(seasonId, episodeNumber)`.
- Le fire-and-forget ne propage aucune erreur à l'appelant HTTP.

---

## Décision

L'implémentation est fonctionnellement correcte et bien structurée. Un défaut TypeScript bloquant introduit dans les tests doit être corrigé avant fusion. La déviation sur le garde de concurrence est mineure mais documentée dans le plan ; elle devrait être adressée dans le même fix.

**Actions requises :**
1. **[Bloquant]** Ajouter `hierarchyPriorityCount: 200` à l'objet `const config: BootstrapConfig` dans `catalog-bootstrap-service.test.ts` ligne 16.
2. **[Conseillé]** Ajouter un garde simple contre les hydrations concurrentes dans le handler `GET /series/:id`.

IMPLEMENTATION_FIX_REQUIRED