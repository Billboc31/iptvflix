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


# T108 — Expand TMDB discovery catalog beyond current IPTV availability before recommendation embedding backfill

**Source**: GitHub Issue #211

## Description

## Context
IPTVFlix intentionally decouples **canonical catalog identity** from **playable availability**. A Movie/Series should exist in IPTVFlix even when no Xtream/Plex source currently provides a playable stream.

This is important for the product direction:
- discovery independent of IPTV;
- recommendations over the wider media universe;
- upcoming releases;
- `À surveiller` / `À ne pas rater`;
- My List before a title becomes playable;
- later notification when an existing canonical title gains an Availability;
- recommendation shelves that may be `WATCH_NOW`, `DISCOVERY`, `UPCOMING` or `UNAVAILABLE_HIGH_AFFINITY`.

#205 is about to build/has begun catalog embeddings. If this ticket lands after #205, that is still acceptable: #205 must support incremental/backfill embedding generation for the newly expanded catalog. Do NOT reset or duplicate the embedding architecture.

## Goal
Expand the canonical TMDB-backed catalog substantially beyond titles discovered through Xtream/Plex, while keeping `Availability` as a separate optional relation.

Target model:

```text
Canonical Catalog
  ├── Movie
  ├── Series
  ├── Seasons/Episodes
  ├── metadata / credits / keywords
  ├── future/upcoming titles
  └── recommendation embeddings
          │
          └── zero or more Availability rows
                 ├── Xtream
                 ├── Plex
                 └── future providers
```

A canonical title with **zero Availability rows remains a first-class discovery/recommendation entity**.

## 1. Audit current TMDB ingestion
Document the current catalog population rules:
- what is inserted during bootstrap;
- whether Movie/Series rows are created only from source matching;
- current discover/trending/popular imports;
- current pagination limits;
- whether upcoming content is stored;
- how much canonical catalog currently exists versus playable availability count.

Do not blindly add another TMDB importer if equivalent machinery already exists.

## 2. Discovery catalog policy
Define a configurable inclusion policy that gives IPTVFlix a large useful catalog without attempting to indiscriminately clone every obscure TMDB row.

Candidate feeds/signals to ingest, subject to current TMDB API capabilities/terms:
- popular Movies;
- popular TV Series;
- trending Movies/TV;
- now playing / current releases where applicable;
- upcoming Movies;
- on-the-air / upcoming/current Series;
- genre-based discovery pages;
- high-vote/high-popularity catalog pages;
- canonical titles referenced by recommendations/search/My List even if outside the bootstrap window.

Use multiple discovery dimensions so the catalog does not become only `popular this week`.

## 3. Breadth target and quality threshold
Make catalog breadth configurable.

Do not hard-code one arbitrary number, but support practical bootstrap targets such as tens of thousands of Movies/Series if API limits/runtime/storage make that reasonable.

Prefer useful discovery coverage over exhaustive garbage ingestion.

Possible configurable gates:
- minimum vote count/popularity floor for deep historical pages;
- language/region considerations;
- release date windows;
- include upcoming regardless of current availability;
- always retain titles already referenced by user state even if they later fall below import thresholds.

Do not delete canonical/user-referenced titles merely because a popularity threshold changes.

## 4. Canonical identity first
All imported TMDB titles must use the same canonical Movie/Series entities already used by Xtream matching.

When a source later contains the title:

```text
existing canonical TMDB Movie
        +
new Xtream match
        ↓
add Availability
```

Do NOT create a second duplicate Movie because it first entered through discovery and later through IPTV.

Reuse TMDB IDs as the primary external canonical match signal where available.

## 5. Rich metadata for recommendation use
Coordinate with #203/#205 so discovery titles retain enough normalized metadata for recommendation quality.

Where current catalog model supports it, bootstrap/enrich useful fields such as:
- title/original title;
- overview;
- release/first-air date;
- genres;
- runtime/episode runtime where available;
- original language;
- production countries;
- popularity;
- vote average/count;
- poster/backdrop;
- keywords/themes;
- collections/franchises;
- cast/crew/director/creators;
- networks for Series;
- external IDs;
- certification/maturity where available;
- status (`released`, `upcoming`, returning, ended, etc.).

Use staged/lazy enrichment for expensive detail endpoints rather than exploding TMDB calls during initial bootstrap.

## 6. Tiered enrichment
Separate cheap catalog discovery from expensive rich-detail enrichment.

Suggested tiers:

### Tier A — discovery seed
Enough data to create canonical identity and basic cards.

### Tier B — recommendation-enriched
Fetch details/keywords/credits/external IDs for titles likely to enter recommendation retrieval or high-value catalog segments.

### Tier C — on-demand deep enrichment
When user opens/searches/lists a less-enriched title, fill missing detail asynchronously/immediately as appropriate.

This avoids making a 50k-title bootstrap wait on multiple detail calls per title.

## 7. Search expansion
Current IPTVFlix search should remain capable of finding canonical titles not already in local DB by querying TMDB and importing them.

When a TMDB search result is selected/relevant:
- upsert canonical title;
- enrich it;
- make it immediately available to My List/recommendations;
- keep Availability empty until a provider matches.

Do not create temporary search-only objects that disappear.

## 8. Upcoming / future titles
Explicitly store upcoming titles useful for discovery.

Need enough metadata to support future shelves such as:
- `Sorties à venir pour vous`;
- `Films à ne pas rater`;
- `Séries bientôt disponibles`;
- `À surveiller`.

When release dates/status change, nightly/incremental TMDB sync should update the same canonical title.

## 9. Availability transitions
Ensure the system can efficiently detect the important transition:

```text
canonical title existed with 0 availability
             ↓
Xtream/Plex sync finds match
             ↓
Availability added
             ↓
playableNow changes false -> true
```

Emit/store enough state/event information for a future feature to notify a Profile that a watched/listed/recommended title became available.

Do not implement the full notification UX unless already in scope elsewhere.

## 10. Recommendation policy support
Expose/query catalog eligibility independently from availability so #207/#208/#210 can implement shelf modes like:
- `WATCH_NOW`: require household availability;
- `DISCOVERY`: availability optional;
- `UPCOMING`: future release/status;
- `WATCHLIST_CANDIDATE`: high profile affinity regardless of availability;
- `NEWLY_AVAILABLE`: title recently transitioned to playable.

Do not globally filter unavailable media out of Recommendation Engine candidate generation.

## 11. My List / profile state for unavailable titles
Ensure #201 profile state can reference canonical Movies/Series with no Availability.

User should be able to:
- open details;
- watch trailer/preview if metadata allows;
- add to My List;
- like/dislike where supported;
- receive recommendation/history interactions;
- later see `Lecture` automatically appear when an Availability is added.

No fake `Lecture` button when unavailable.

## 12. Bootstrap job
Provide an idempotent/resumable admin/bootstrap command/job.

Requirements:
- cursor/page progress persistence;
- bounded concurrency;
- TMDB rate-limit handling;
- retries/backoff;
- upsert, not duplicate;
- progress metrics;
- counts by Movie/Series/upcoming;
- safe resume after deployment interruption;
- can be run incrementally rather than requiring DB reset.

## 13. Incremental/nightly sync
After bootstrap, keep the discovery catalog fresh without re-downloading everything nightly.

Use sensible update groups:
- trending/current/upcoming titles refreshed frequently;
- recently changed/current Series refreshed reasonably often;
- older stable titles refreshed less frequently;
- titles in My List/recent recommendations/user interactions can receive priority refresh.

## 14. Interaction with #205 embeddings
This ticket may land before or after #205.

Required behavior either way:
- newly inserted discovery titles are eligible for embedding generation;
- enriched metadata changes invalidate/recompute embedding document when material;
- existing embeddings are NOT wiped unnecessarily;
- provide an idempotent embedding backfill trigger/queue for catalog rows missing #205 vectors.

If #205 has already completed, explicitly run/backfill embeddings for the expanded catalog and report counts.

## 15. Storage / scale diagnostics
Add diagnostics for:
- canonical Movie count;
- canonical Series count;
- Episode count;
- titles with at least one Availability;
- titles with zero Availability;
- upcoming titles;
- recommendation-enriched titles;
- titles with embeddings (when #205 exists);
- TMDB sync age/coverage.

This lets us know whether Recommendation Engine is operating on 3k IPTV titles or a true discovery catalog.

## 16. TMDB terms / image behavior
Continue respecting TMDB API attribution/cache/image requirements used by the project. Do not bulk-download unnecessary image binaries into DB unless existing architecture intentionally does so; storing TMDB image paths/metadata is preferred where appropriate.

## Tests
Cover at minimum:
- discovery import creates canonical title with zero Availability;
- later Xtream match adds Availability to same canonical title;
- rerunning bootstrap does not duplicate;
- search imports missing TMDB title canonically;
- unavailable title can be added to profile My List;
- upcoming title updates release/status;
- recommendation query can include unavailable title when policy permits;
- `WATCH_NOW` policy excludes it until Availability exists;
- newly inserted title enters embedding backlog when #205 is present.

## Acceptance criteria
- [ ] Canonical catalog is no longer limited to titles found in IPTV/Plex sources.
- [ ] Large configurable TMDB discovery bootstrap exists for Movies and Series.
- [ ] Upcoming/future content is persisted.
- [ ] Canonical titles with zero Availability are first-class objects.
- [ ] Source sync later attaches Availability without creating duplicate media.
- [ ] Search can import missing TMDB titles into canonical DB.
- [ ] Rich recommendation metadata is stored/enriched in tiers.
- [ ] Incremental sync keeps current/upcoming catalog fresh.
- [ ] My List/profile interactions work for unavailable titles.
- [ ] Recommendation Engine can distinguish discovery vs watch-now eligibility.
- [ ] #205 embeddings can be incrementally/backfilled for expanded catalog regardless of implementation order.
- [ ] Diagnostics clearly show total catalog vs playable catalog coverage.
- [ ] No DB reset is required.

## Completion rule
Do not close because one TMDB discover endpoint was called. Demonstrate a meaningful expanded canonical catalog containing real Movies/Series that have NO IPTV Availability, show one of them in normal IPTVFlix detail/My List flow, then run/trigger a source match for a previously unavailable canonical title and prove that it gains an Availability without changing/duplicating its canonical identity. If #205 already exists, prove newly imported catalog rows also receive embeddings through incremental/backfill processing.

---

## Contexte de retry injecté par run_ticket.py

## Output précédent

Implementation committed. 20 files changed (1,254 insertions). The ticket state is now `IMPLEMENTATION_DONE` — awaiting review.

---

## Review

I have enough information to write the complete review. Let me produce it now.

---

## PR Review — T108: Expand TMDB Discovery Catalog

## Résumé

L'implémentation livre le cœur du ticket : nouveaux feeds bootstrap (`now_playing`/`airing_today`), variables d'env configurables, endpoint de stats catalog, filtres de politique de disponibilité (`WATCH_NOW`/`DISCOVERY`/`UPCOMING`/`ALL`), stub d'embedding-backfill, et vérification que la liste de lecture fonctionne pour les titres sans disponibilité. Le code est globalement propre et conforme au plan. Un bug de cross-mapping dans le client TMDB doit être corrigé avant merge.

---

## Vérifications effectuées

- `catalog-bootstrap-service.ts` : logique de steps, quality floor, upsert, checkpoint resumability
- `catalog-sync-service.ts` : flux Xtream/Plex/M3U, logique d'Availability, déduplication canonique
- `discovery-candidate-pool-service.ts` : refresh, evict, materialize
- `apps/api/src/providers/metadata/tmdb/client.ts` : routage des feeds movie/series
- `apps/api/src/providers/metadata/types.ts` : type `DiscoveryFeed`
- `apps/api/src/routes/catalog-stats.ts` : agrégats SQL
- `apps/api/src/routes/embedding-backfill.ts` : stub 501
- `apps/api/src/routes/recommendations.ts` : validation du paramètre `policy`
- `apps/api/src/services/recommendation-ranking-service.ts` : filtrage par `AvailabilityPolicy`
- `apps/api/src/config/env.ts` : nouvelles variables d'env
- `apps/api/src/db/schema/availabilities.ts` + migration `0034_t093_variant_metadata.sql`
- Tous les tests correspondants (6 suites)

---

## Points validés

1. **Nouveaux feeds bootstrap corrects** — `now_playing` pour MOVIE → `/movie/now_playing`, `airing_today` pour SERIES → `/tv/airing_today`. Les appels effectués par `buildSteps()` + `execute()` sont corrects.
2. **Limites de pages élevées et configurables** — `CATALOG_BOOTSTRAP_MAX_PAGES_PER_FEED` 20→50, `CATALOG_BOOTSTRAP_MAX_PAGES_PER_GENRE` 10→20, tous via env vars.
3. **Quality floor correctement borné aux steps genre/language** — les feed steps (déjà curatés par TMDB) sont exemptés.
4. **Checkpoint persisté page par page** — reprise idempotente confirmée par la structure `checkpoint[key] = { done: false, lastPage: page }`.
5. **Upsert sur `tmdbId`** — `onConflictDoUpdate` préserve l'identité canonique ; `xmax = 0` distingue created vs updated. Test unitaire valide.
6. **`GET /admin/catalog-stats`** — 8 requêtes parallèles, agrégats corrects, `withoutAvailability = total - withAvailability`, stub `embeddingPending: 0` documenté.
7. **`POST /admin/embedding-backfill`** — 501 avec `eligibleMovies`/`eligibleSeries` (count sur `metadataEnrichedAt IS NOT NULL`), integration point clair pour #205.
8. **`AvailabilityPolicy`** — `WATCH_NOW` filtre sur présence d'une row AVAILABLE, `UPCOMING` filtre sur `status`, `DISCOVERY`/`ALL` incluent tout. Logique correcte et testée.
9. **Profile watchlist pour titres non-disponibles** — tests vérifient add/get/delete sans guard d'availability. Réponse 404 uniquement si le titre est absent du catalogue canonique.
10. **Enregistrement des routes** — `catalogStatsRoutes` et `embeddingBackfillRoutes` enregistrés dans `protectedApp` (admin-gated). ✓
11. **Migration additive et idempotente** — `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`. Aucun reset DB requis.

---

## Problèmes détectés

### 🔴 BLOQUANT — Cross-mapping TMDB feeds dans le client

**Fichier** : `apps/api/src/providers/metadata/tmdb/client.ts`, lignes 470-471 et 502-503

Dans `fetchMovieFeed`, le record `paths` contient :
```ts
now_playing: '/movie/now_playing',   // ✓ correct
airing_today: '/tv/airing_today',    // ✗ WRONG — TV endpoint dans une fonction movie
```

Dans `fetchSeriesFeed`, le record `paths` contient :
```ts
airing_today: '/tv/airing_today',    // ✓ correct
now_playing: '/movie/now_playing',   // ✗ WRONG — movie endpoint dans une fonction series
```

**Pourquoi c'est un bug réel** : `DiscoveryCandidatePoolService.refreshPool(feeds, mediaTypes)` itère sur `feeds × mediaTypes`. Si appelé avec `feeds = ['airing_today']` et `mediaTypes = ['MOVIE', 'SERIES']`, l'itération `'airing_today' × 'MOVIE'` invoque `fetchMovieFeed('airing_today', page)` → `/tv/airing_today`. Résultat : des séries TV sont insérées dans la `discovery_candidates` table avec `mediaType = 'MOVIE'`. Aucun type error côté TypeScript car `DiscoveryFeed` est shared entre les deux méthodes.

**Correction** : retirer `airing_today` du `paths` de `fetchMovieFeed` (ou lever une erreur explicite), et retirer `now_playing` du `paths` de `fetchSeriesFeed`. Ces feed values sont media-type-specific par nature.

---

### 🟡 OBSERVATION — Migration T093 portée par T108

`apps/api/migrations/0034_t093_variant_metadata.sql` est nommée T093 et ajoute des colonnes (`codec_name`, `hdr_format`, `release_hint`, `audio_format`) qui appartiennent au ticket T093. Cette migration apparaît dans le diff T108 car la branche est issue d'un état `main` qui ne contenait pas encore T093.

**Impact** : si T093 est mergé séparément, la migration est appliquée deux fois (safe grâce à `IF NOT EXISTS`), mais le fichier SQL sera en conflit. Le scope de T108 ne devrait pas inclure des migrations d'un autre ticket.

**Correction recommandée** : rebaser T108 sur un `main` incluant T093, ou extraire les colonnes T093 en les dépendances explicites.

---

### 🟡 OBSERVATION — SQL brut avec noms de tables hardcodés dans `catalog-stats.ts`

Lignes 27-33 :
```ts
sql<number>`cast(count(*) filter (where exists (
  select 1 from movie_availabilities where movie_id = movies.id and status = 'AVAILABLE'
)) as integer)`
```

Les noms `movie_availabilities`, `series_availabilities` sont des strings littéraux. Si les tables sont renommées dans Drizzle, ces requêtes silently broken. Préférer `getTableName(movieAvailabilities)` ou utiliser une sub-query Drizzle.

---

### 🟡 OBSERVATION — Test d'intégration manquant pour le flux bootstrap → sync attache Availability

`catalog-sync.test.ts` teste l'idempotence de `upsertMovieBatch` (created/updated counts) mais pas le flux complet : "bootstrapped movie (tmdbId=X, 0 availability) + syncCatalog avec snapshot contenant tmdbId=X → une seule row movies + une seule movieAvailabilities row." C'est l'un des critères d'acceptation critiques du ticket.

---

### 🟡 OBSERVATION — `rankRecommendations` charge l'intégralité de movies+series en mémoire

```ts
db.select({...}).from(movies)        // tous les films
db.select({...}).from(seriesTbl)     // toutes les séries
```

Avec la cible de 50k+ titres explicite dans ce ticket, cette requête devient un bottleneck de latence et de mémoire pour chaque appel de recommandations. Le plan documente ce choix comme exclu du scope T108, mais le ticket lui-même rend ce pattern significativement plus problématique. À tracker pour résolution rapide.

---

## Risques éventuels

- **Cross-mapping bug** : risque de corruption silencieuse de `discovery_candidates` (séries traitées comme movies) si `DiscoveryCandidatePoolService.refreshPool` est appelé avec des combinaisons feed/mediaType non anticipées par le bootstrap.
- **Scale des recommandations** : degradation de performance en production dès que le catalog bootstrap réussit son objectif de 50k titres.
- **Migration T093** : risque de conflit de merge si T093 n'est pas encore mergé.

---

## Actions demandées

1. **Corriger le cross-mapping dans `fetchMovieFeed` et `fetchSeriesFeed`** — retirer les entrées croisées (`airing_today` de `fetchMovieFeed`, `now_playing` de `fetchSeriesFeed`), ou les remplacer par un throw explicite :
   ```ts
   // Dans fetchMovieFeed
   if (feed === 'airing_today') throw new Error('airing_today is a series-only feed')
   // Dans fetchSeriesFeed
   if (feed === 'now_playing') throw new Error('now_playing is a movie-only feed')
   ```

2. **(Optionnel pour ce ticket)** Ajouter un test qui passe un snapshot Xtream contenant le `tmdbId` d'un movie déjà bootstrappé et vérifie : `movies.id` inchangé, 1 seule `movieAvailabilities` row créée.

---

## Décision

Le bug de cross-mapping dans le client TMDB peut entraîner une insertion silencieuse de séries TV avec `mediaType = 'MOVIE'` dans `discovery_candidates` — comportement incorrect et non testé. Il doit être corrigé avant merge.

IMPLEMENTATION_FIX_REQUIRED

---

## Instructions de fix

# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T108/reviews/implementation-review.md
- generated at: 2026-08-18T08:13:29Z

---

I have enough information to write the complete review. Let me produce it now.

---

## PR Review — T108: Expand TMDB Discovery Catalog

## Résumé

L'implémentation livre le cœur du ticket : nouveaux feeds bootstrap (`now_playing`/`airing_today`), variables d'env configurables, endpoint de stats catalog, filtres de politique de disponibilité (`WATCH_NOW`/`DISCOVERY`/`UPCOMING`/`ALL`), stub d'embedding-backfill, et vérification que la liste de lecture fonctionne pour les titres sans disponibilité. Le code est globalement propre et conforme au plan. Un bug de cross-mapping dans le client TMDB doit être corrigé avant merge.

---

## Vérifications effectuées

- `catalog-bootstrap-service.ts` : logique de steps, quality floor, upsert, checkpoint resumability
- `catalog-sync-service.ts` : flux Xtream/Plex/M3U, logique d'Availability, déduplication canonique
- `discovery-candidate-pool-service.ts` : refresh, evict, materialize
- `apps/api/src/providers/metadata/tmdb/client.ts` : routage des feeds movie/series
- `apps/api/src/providers/metadata/types.ts` : type `DiscoveryFeed`
- `apps/api/src/routes/catalog-stats.ts` : agrégats SQL
- `apps/api/src/routes/embedding-backfill.ts` : stub 501
- `apps/api/src/routes/recommendations.ts` : validation du paramètre `policy`
- `apps/api/src/services/recommendation-ranking-service.ts` : filtrage par `AvailabilityPolicy`
- `apps/api/src/config/env.ts` : nouvelles variables d'env
- `apps/api/src/db/schema/availabilities.ts` + migration `0034_t093_variant_metadata.sql`
- Tous les tests correspondants (6 suites)

---

## Points validés

1. **Nouveaux feeds bootstrap corrects** — `now_playing` pour MOVIE → `/movie/now_playing`, `airing_today` pour SERIES → `/tv/airing_today`. Les appels effectués par `buildSteps()` + `execute()` sont corrects.
2. **Limites de pages élevées et configurables** — `CATALOG_BOOTSTRAP_MAX_PAGES_PER_FEED` 20→50, `CATALOG_BOOTSTRAP_MAX_PAGES_PER_GENRE` 10→20, tous via env vars.
3. **Quality floor correctement borné aux steps genre/language** — les feed steps (déjà curatés par TMDB) sont exemptés.
4. **Checkpoint persisté page par page** — reprise idempotente confirmée par la structure `checkpoint[key] = { done: false, lastPage: page }`.
5. **Upsert sur `tmdbId`** — `onConflictDoUpdate` préserve l'identité canonique ; `xmax = 0` distingue created vs updated. Test unitaire valide.
6. **`GET /admin/catalog-stats`** — 8 requêtes parallèles, agrégats corrects, `withoutAvailability = total - withAvailability`, stub `embeddingPending: 0` documenté.
7. **`POST /admin/embedding-backfill`** — 501 avec `eligibleMovies`/`eligibleSeries` (count sur `metadataEnrichedAt IS NOT NULL`), integration point clair pour #205.
8. **`AvailabilityPolicy`** — `WATCH_NOW` filtre sur présence d'une row AVAILABLE, `UPCOMING` filtre sur `status`, `DISCOVERY`/`ALL` incluent tout. Logique correcte et testée.
9. **Profile watchlist pour titres non-disponibles** — tests vérifient add/get/delete sans guard d'availability. Réponse 404 uniquement si le titre est absent du catalogue canonique.
10. **Enregistrement des routes** — `catalogStatsRoutes` et `embeddingBackfillRoutes` enregistrés dans `protectedApp` (admin-gated). ✓
11. **Migration additive et idempotente** — `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`. Aucun reset DB requis.

---

## Problèmes détectés

### 🔴 BLOQUANT — Cross-mapping TMDB feeds dans le client

**Fichier** : `apps/api/src/providers/metadata/tmdb/client.ts`, lignes 470-471 et 502-503

Dans `fetchMovieFeed`, le record `paths` contient :
```ts
now_playing: '/movie/now_playing',   // ✓ correct
airing_today: '/tv/airing_today',    // ✗ WRONG — TV endpoint dans une fonction movie
```

Dans `fetchSeriesFeed`, le record `paths` contient :
```ts
airing_today: '/tv/airing_today',    // ✓ correct
now_playing: '/movie/now_playing',   // ✗ WRONG — movie endpoint dans une fonction series
```

**Pourquoi c'est un bug réel** : `DiscoveryCandidatePoolService.refreshPool(feeds, mediaTypes)` itère sur `feeds × mediaTypes`. Si appelé avec `feeds = ['airing_today']` et `mediaTypes = ['MOVIE', 'SERIES']`, l'itération `'airing_today' × 'MOVIE'` invoque `fetchMovieFeed('airing_today', page)` → `/tv/airing_today`. Résultat : des séries TV sont insérées dans la `discovery_candidates` table avec `mediaType = 'MOVIE'`. Aucun type error côté TypeScript car `DiscoveryFeed` est shared entre les deux méthodes.

**Correction** : retirer `airing_today` du `paths` de `fetchMovieFeed` (ou lever une erreur explicite), et retirer `now_playing` du `paths` de `fetchSeriesFeed`. Ces feed values sont media-type-specific par nature.

---

### 🟡 OBSERVATION — Migration T093 portée par T108

`apps/api/migrations/0034_t093_variant_metadata.sql` est nommée T093 et ajoute des colonnes (`codec_name`, `hdr_format`, `release_hint`, `audio_format`) qui appartiennent au ticket T093. Cette migration apparaît dans le diff T108 car la branche est issue d'un état `main` qui ne contenait pas encore T093.

**Impact** : si T093 est mergé séparément, la migration est appliquée deux fois (safe grâce à `IF NOT EXISTS`), mais le fichier SQL sera en conflit. Le scope de T108 ne devrait pas inclure des migrations d'un autre ticket.

**Correction recommandée** : rebaser T108 sur un `main` incluant T093, ou extraire les colonnes T093 en les dépendances explicites.

---

### 🟡 OBSERVATION — SQL brut avec noms de tables hardcodés dans `catalog-stats.ts`

Lignes 27-33 :
```ts
sql<number>`cast(count(*) filter (where exists (
  select 1 from movie_availabilities where movie_id = movies.id and status = 'AVAILABLE'
)) as integer)`
```

Les noms `movie_availabilities`, `series_availabilities` sont des strings littéraux. Si les tables sont renommées dans Drizzle, ces requêtes silently broken. Préférer `getTableName(movieAvailabilities)` ou utiliser une sub-query Drizzle.

---

### 🟡 OBSERVATION — Test d'intégration manquant pour le flux bootstrap → sync attache Availability

`catalog-sync.test.ts` teste l'idempotence de `upsertMovieBatch` (created/updated counts) mais pas le flux complet : "bootstrapped movie (tmdbId=X, 0 availability) + syncCatalog avec snapshot contenant tmdbId=X → une seule row movies + une seule movieAvailabilities row." C'est l'un des critères d'acceptation critiques du ticket.

---

### 🟡 OBSERVATION — `rankRecommendations` charge l'intégralité de movies+series en mémoire

```ts
db.select({...}).from(movies)        // tous les films
db.select({...}).from(seriesTbl)     // toutes les séries
```

Avec la cible de 50k+ titres explicite dans ce ticket, cette requête devient un bottleneck de latence et de mémoire pour chaque appel de recommandations. Le plan documente ce choix comme exclu du scope T108, mais le ticket lui-même rend ce pattern significativement plus problématique. À tracker pour résolution rapide.

---

## Risques éventuels

- **Cross-mapping bug** : risque de corruption silencieuse de `discovery_candidates` (séries traitées comme movies) si `DiscoveryCandidatePoolService.refreshPool` est appelé avec des combinaisons feed/mediaType non anticipées par le bootstrap.
- **Scale des recommandations** : degradation de performance en production dès que le catalog bootstrap réussit son objectif de 50k titres.
- **Migration T093** : risque de conflit de merge si T093 n'est pas encore mergé.

---

## Actions demandées

1. **Corriger le cross-mapping dans `fetchMovieFeed` et `fetchSeriesFeed`** — retirer les entrées croisées (`airing_today` de `fetchMovieFeed`, `now_playing` de `fetchSeriesFeed`), ou les remplacer par un throw explicite :
   ```ts
   // Dans fetchMovieFeed
   if (feed === 'airing_today') throw new Error('airing_today is a series-only feed')
   // Dans fetchSeriesFeed
   if (feed === 'now_playing') throw new Error('now_playing is a movie-only feed')
   ```

2. **(Optionnel pour ce ticket)** Ajouter un test qui passe un snapshot Xtream contenant le `tmdbId` d'un movie déjà bootstrappé et vérifie : `movies.id` inchangé, 1 seule `movieAvailabilities` row créée.

---

## Décision

Le bug de cross-mapping dans le client TMDB peut entraîner une insertion silencieuse de séries TV avec `mediaType = 'MOVIE'` dans `discovery_candidates` — comportement incorrect et non testé. Il doit être corrigé avant merge.

IMPLEMENTATION_FIX_REQUIRED