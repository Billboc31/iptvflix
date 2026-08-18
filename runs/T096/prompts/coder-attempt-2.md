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


# T096 — Import and sync intro/recap/outro/credits segment metadata for TV series and anime

**Source**: GitHub Issue #197

## Description

## Context
IPTVFlix already has canonical Series / Season / Episode entities and is moving toward richer playback UX such as `Passer l'intro`, `Passer le récap`, `Épisode suivant` and eventually a near-continuous anime/manga viewing mode.

There are public/community timestamp databases that can provide episode segment metadata. IntroDB exposes intro/recap/outro timestamps through a public read API keyed by IMDb ID + season + episode, and its public stats show strong anime coverage (e.g. One Piece and Bleach are among the top contributed shows). The UI also exposes a `Popular Anime` section.

This ticket should build the canonical IPTVFlix segment-metadata ingestion layer so Web and Android TV can later consume the same normalized markers.

## Goal
Create a provider-agnostic `MediaSegment` model and ingestion/sync pipeline for episodic content, initially sourcing IntroDB and designed so additional providers such as TheIntroDB / SkipMe / future fingerprint detection can be added later.

The data must work equally for live-action Series and Anime.

## 1. Canonical segment model
Add a normalized model tied to canonical Episode identity, not to an Xtream stream row.

Suggested shape:

```text
MediaSegment
- id
- episodeId
- type
- startMs
- endMs
- sourceProvider
- sourceExternalId / sourceKey
- confidence
- submissionCount (optional)
- isVerified / status where available
- sourceUpdatedAt (optional)
- createdAt
- updatedAt
```

Supported semantic types should be extensible, including at minimum:
- `RECAP`
- `INTRO`
- `OUTRO`
- `CREDITS`
- `PREVIEW`

IntroDB currently exposes intro/recap/outro; unsupported types can remain empty until another provider supplies them.

## 2. External ID resolution
IntroDB uses IMDb ID + season + episode as its canonical lookup key.

IPTVFlix catalog is TMDB-centered, so implement reliable episode/show identifier resolution:

```text
TMDB Series
   ↓
IMDb external ID
   ↓
season + episode number
   ↓
IntroDB /segments
```

Reuse existing TMDB external-ID data if present. If IMDb IDs are not currently persisted, enrich/store them in a clean reusable way rather than resolving from TMDB on every playback.

Support anime exactly like other TV series. Do not assume anime has a separate numbering model unless source metadata actually requires it.

## 3. IntroDB provider adapter
Implement a clean provider adapter for IntroDB's public read API.

Use the current `/segments?imdb_id=...&season=...&episode=...` endpoint rather than the legacy intro-only endpoint.

Map:
- intro -> `INTRO`
- recap -> `RECAP`
- outro -> `OUTRO`

Persist confidence/submission count when returned.

Treat 404/no segment as valid "no data" rather than an operational failure.

Respect fair-use/rate limits and add appropriate throttling/retry/backoff.

Do not require an API key for read-only IntroDB usage if the public API does not require one.

## 4. Anime coverage
Explicitly support Anime in this first version.

Validate the pipeline using real anime examples with public IntroDB coverage, ideally at least:
- One Piece;
- Bleach;
- another anime present in the user's TMDB catalog if available.

IntroDB public stats currently show One Piece and Bleach among the highest-submission titles, so Anime must not be deferred as a separate future architecture.

Check for potential numbering mismatches such as:
- absolute episode numbering vs season/episode;
- specials/season 0;
- split cours;
- provider season numbering differences.

Do not silently attach timestamps to the wrong canonical episode. If numbering is ambiguous, record a mismatch/skip and expose it diagnostically.

## 5. Bootstrap strategy
Investigate whether each provider legally/technically offers a downloadable dump/export and document license/terms before attempting a wholesale database copy.

Preferred strategy:
1. if an explicitly permitted bulk dump exists, support an import path;
2. otherwise sync only episodes that exist in IPTVFlix catalog;
3. cache results locally in IPTVFlix DB;
4. never hit IntroDB on every playback.

Do not scrape the public website or clone an entire third-party dataset without an explicit permitted mechanism.

## 6. Catalog-wide backfill
Provide an admin/job command capable of enriching all existing episodic canonical content:

```text
for each canonical series
  resolve IMDb ID
  for each canonical episode
    fetch available segments
    upsert MediaSegment rows
```

Requirements:
- resumable/idempotent;
- bounded concurrency;
- progress counters;
- rate limiting;
- failures do not abort entire run;
- safe retry;
- metrics for found/no-data/error.

This should be suitable for a one-time bootstrap after deployment.

## 7. On-demand enrichment
When a new Series/Episode enters IPTVFlix after the bootstrap, fetch its segments automatically without requiring another full bootstrap.

Possible trigger points:
- after TMDB canonical episode creation;
- after catalog refresh;
- first detail/playback request as a low-priority fallback.

Prefer background enrichment rather than delaying user playback.

## 8. Nightly refresh
Add a scheduled refresh strategy for already-known episodes so community corrections/new submissions eventually reach IPTVFlix.

Do not refresh every episode every night blindly if the corpus is large. Use incremental/stale-window scheduling, e.g.:
- recently added/current-season episodes more frequently;
- old stable episodes less frequently;
- no-data episodes retried on a sensible cadence.

Make cadence configurable.

## 9. Multi-provider architecture
Do not hard-code product logic around IntroDB alone.

Define an abstraction such as:

```text
SegmentProvider
  fetchEpisodeSegments(canonicalEpisode)
```

so future sources can include:
- IntroDB;
- TheIntroDB;
- SkipMe;
- self-hosted/community submissions;
- local audio/video fingerprint detection.

Store provider provenance on every segment.

## 10. Conflict/merge strategy
If multiple providers eventually return competing timestamps for the same semantic segment, do not overwrite blindly.

Design for:
- provider priority;
- confidence;
- submission count;
- near-equal timestamp clustering;
- manually curated override.

For v1 with only IntroDB, implement the schema/logic so adding a second source does not require a migration redesign.

## 11. Version/duration awareness
A canonical episode may have multiple media cuts/releases whose timings differ slightly.

Persist enough metadata so future matching can account for:
- canonical runtime;
- playable asset duration;
- source/provider variant;
- potential offset.

Do NOT yet attempt complex automatic per-release offset correction unless clearly feasible, but do not bake in the assumption that one timestamp is always frame-perfect for every provider copy.

## 12. API for clients
Expose normalized episode segment data through IPTVFlix API, for example as part of Episode detail/playback metadata or a dedicated endpoint.

Client-facing shape should be simple:

```json
{
  "episodeId": "...",
  "segments": [
    { "type": "recap", "startMs": 0, "endMs": 62000 },
    { "type": "intro", "startMs": 115000, "endMs": 178000 },
    { "type": "outro", "startMs": 1421000, "endMs": 1485000 }
  ]
}
```

Do not expose unnecessary provider internals to normal clients.

## 13. Playback integration hooks only
This ticket should make the normalized data AVAILABLE to Web and Android TV, but should not overbuild all final player UI.

Provide clean hooks/contracts for follow-up behavior:
- show `Passer le récap` when current position is inside RECAP;
- show `Passer l'intro` inside INTRO;
- near OUTRO/CREDITS show `Épisode suivant`;
- future auto-skip / Anime never-stop mode.

Do not auto-skip anything globally in this ticket unless an existing user setting already exists.

## 14. Admin/diagnostics
Provide visibility for developers/admin into segment coverage:
- total canonical episodes;
- episodes with intro;
- with recap;
- with outro;
- no-data;
- provider failures;
- identifier mismatches;
- anime coverage separately if useful.

A diagnostic lookup by Series/Episode should show source and normalized timestamps.

## 15. Tests
Add tests for:
- IntroDB response mapping;
- no-data/404;
- IMDb + season + episode lookup;
- upsert/idempotency;
- provider provenance;
- rate-limit/retry behavior;
- anime season/episode mapping;
- specials/season 0 handling;
- provider abstraction;
- API serialization.

Use real public API smoke checks only where CI-safe; otherwise use recorded fixtures and manually verify against current public API.

## Acceptance criteria
- [ ] Canonical `MediaSegment` model exists.
- [ ] Segments are attached to canonical Episode IDs, not Xtream availability IDs.
- [ ] IntroDB `/segments` provider integration works for intro/recap/outro.
- [ ] TMDB -> IMDb identifier resolution is reusable and persisted appropriately.
- [ ] Anime is supported in v1 and validated with real covered anime.
- [ ] One Piece and/or Bleach lookup successfully returns real community segment data where currently available.
- [ ] Ambiguous anime numbering does not silently attach wrong segments.
- [ ] Existing episodic catalog can be backfilled idempotently.
- [ ] New episodes can be enriched automatically.
- [ ] A sensible incremental/nightly refresh exists.
- [ ] Third-party rate limits/fair-use are respected.
- [ ] No unauthorized scraping/full-dump behavior is introduced.
- [ ] Provider abstraction allows additional segment DBs later.
- [ ] Provenance/confidence are stored.
- [ ] IPTVFlix API exposes normalized segments to Web/Android TV.
- [ ] Diagnostics show coverage/no-data/errors.
- [ ] Tests cover live-action and anime mapping cases.

## Completion rule
Do not close because the schema/provider interface exists. Validate against real public data for at least one live-action series episode and at least two Anime episodes, persist the returned segment(s) in IPTVFlix DB, and prove the normalized API returns them for the correct canonical episodes.

---

## Contexte de retry injecté par run_ticket.py

## Output précédent

Committed as `6d544aa`. T096 is done — 28 files, 1430 insertions, 36 passing tests.

---

## Review

I have a complete picture of the implementation. Writing the review now.

---

# PR Review — T096: Import and sync intro/recap/outro/credits segment metadata

## Résumé

L'implémentation livre un pipeline complet et bien structuré : schéma `media_segments`, provider IntroDB, service de sync avec upsert idempotent, 36 tests, endpoints API publics et admin, scheduler avec 3 priorités. La qualité de code est globalement bonne et la plupart des critères d'acceptation sont couverts par la structure.

Deux problèmes empêchent l'approbation immédiate.

---

## Vérifications effectuées

- Migration SQL `0036_t096_media_segments.sql`
- Schéma Drizzle `media-segments.ts`
- Client IntroDB (`client.ts`, `mapper.ts`, `types.ts`, `errors.ts`)
- Abstraction `SegmentProvider` / `types.ts`
- `SegmentSyncService` (upsert, syncEpisode, backfillCatalog)
- `imdb-resolver.ts`
- Scheduler (`scheduler-service.ts`) — intégration segment refresh
- Routes `GET /episodes/:id/segments` et `/admin/segments/coverage` + `/admin/segments/episode/:id`
- Script `backfill-segments.ts`
- Hook `setOnNewEpisodeHook` dans `sync-runs-service.ts` et `canonical-resolver.ts`
- Contrat `packages/api-contracts/src/segments.ts`
- Tests : client, mapper, segment-sync-service, imdb-resolver, episodes-segments route

---

## Points validés

**Schéma et migration**
- Table `media_segments` conforme au ticket : tous les champs requis, enum `segment_type` extensible, contrainte unique sur `(episode_id, type, source_provider)`, cascade DELETE, index sur `episode_id`. Correct.

**Provider IntroDB**
- Implémente bien `SegmentProvider` ; 404 → `null` (pas d'erreur) ; 429 → backoff exponentiel avec cap à 60s, max 3 tentatives ; timeout via `AbortSignal.timeout` ; pas de clé API requise. Conforme au ticket §3.
- Conversion secondes → millisecondes correcte (`Math.round`).
- `sourceProvider = 'introdb'` stocké sur chaque ligne — provenance garantie.

**IMDb resolution**
- `resolveAndPersistSeriesImdbId` : lecture locale en premier, persistance si absent, no-op si pas de TMDB ID. Évite les appels TMDB répétés. Conforme au ticket §2.

**SegmentSyncService**
- Upsert via `onConflictDoUpdate` sur la contrainte unique — idempotent.
- Season-0 : log structuré `segment_numbering_ambiguous`, compteur `mismatches++`, zéro ligne insérée. Correct.
- `backfillCatalog` : pagination par 200, `filterUnsynced` pour sauter les épisodes déjà synchés (sauf `--force`), `withBoundedConcurrency`, erreurs non fatales, métriques JSON. Conforme §6.

**Scheduler**
- 3 niveaux de priorité : recent (chaque tick), no-data (tick % 3), stable (tick % 7). Concurrence bornée à 3. Cadence configurable via env. Conforme §8.

**Hook on-demand**
- `setOnNewEpisodeHook` + `createOptionalCanonicalResolver` lit le hook au moment de l'appel (`triggerSync`). Comme le hook est enregistré synchroniquement au démarrage (avant tout déclenchement de sync), le timing est sûr. Conforme §7.

**Endpoints API**
- `GET /episodes/:id/segments` exposé publiquement, ne retourne que `type/startMs/endMs`. Conforme §12.
- Admin routes dans `protectedScope` → protégées par `authenticate`. Conforme §14.
- Shape du contrat `EpisodeSegmentsResponse` identique à l'exemple du ticket.

**Tests**
- Couverture des cas : 404, 429/retry, mapping anime (One Piece fixture), season-0, idempotence upsert, provenance, IMDb resolver (cache hit, TMDB fetch, pas de tmdbId). Conforme §15.

---

## Problèmes détectés

### [BLOQUANT 1] Completion rule non satisfaite : aucune validation contre des données réelles

Le ticket impose explicitement :

> "Do not close because the schema/provider interface exists. Validate against real public data for at least one live-action series episode and at least two Anime episodes, persist the returned segment(s) in IPTVFlix DB, and prove the normalized API returns them for the correct canonical episodes."

L'`implementation-output.md` contient seulement :
> "Committed as 6d544aa. T096 is done — 28 files, 1430 insertions, 36 passing tests."

Il n'y a aucune trace de smoke test réel : pas de log de `pnpm backfill:segments`, pas de résultat JSON d'un appel IntroDB contre One Piece ou Bleach, pas de capture de `GET /episodes/:id/segments` retournant des segments réels.

Le code est structurellement correct mais la completion rule n'est pas satisfaite. Les tests utilisent des fixtures mocked, pas l'API publique réelle.

**Action requise** : exécuter le smoke test complet — résoudre l'IMDb ID de One Piece et Bleach via TMDB, appeler IntroDB, persister en DB, vérifier `GET /episodes/:id/segments` avec les IDs canoniques réels. Documenter le résultat dans un fichier d'artefact.

---

### [BLOQUANT 2] `withAnySegment` dans `/admin/segments/coverage` charge tous les UUIDs en mémoire

`segment-admin.ts` lignes 20-23 :

```ts
const withAnySegment = await db
  .selectDistinct({ episodeId: mediaSegments.episodeId })
  .from(mediaSegments)
const withAnyCount = withAnySegment.length
```

Pour un catalogue de 50 000 épisodes, cela rapatrie potentiellement 50 000 UUID dans Node.js pour compter. Le reste de la même requête utilise `COUNT(DISTINCT ...)` via `sql<number>` — c'est incohérent. Remplacer par :

```ts
const [anyRow] = await db.select({
  withAny: sql<number>`cast(count(distinct episode_id) as integer)`,
}).from(mediaSegments)
const withAnyCount = Number(anyRow?.withAny ?? 0)
```

Ce n'est pas bloquant sur un petit catalogue mais c'est un bug de scalabilité réel pour une installation production.

---

## Risques éventuels (non bloquants)

**Dead code — `IntroDbNoDataError`**
La classe `IntroDbNoDataError` dans `errors.ts` est définie mais n'est jamais jetée ni importée. À supprimer.

**`sourceExternalId` jamais renseigné par le mapper**
Le mapper ne peuple pas `sourceExternalId` même si la clé composite `(imdbId, season, episode)` pourrait y être stockée pour tracabilité. Acceptable pour v1 mais à documenter comme limitation connue.

**Pas de test d'intégration pour `backfillCatalog`**
L'acceptance criteria mentionne "runs to completion twice without errors and produces identical row counts" — ce cas n'est pas couvert par les tests automatisés. Acceptable si le smoke test manuel couvre ce cas.

**`IntroDbRateLimitError` perd la valeur réelle du header `Retry-After`**
Le client récupère le header mais le throw utilise le constructeur par défaut (`retryAfterSec = 60`) : `throw new IntroDbRateLimitError()`. La valeur extraite du header est utilisée pour le backoff local mais pas stockée dans l'erreur propagée. Mineur.

---

## Décision

- REQUEST_CHANGES

## Actions demandées

1. **[Obligatoire]** Exécuter le smoke test réel contre IntroDB : One Piece + Bleach (anime, 2 épisodes minimum) + 1 série live-action. Persister en DB, vérifier `GET /episodes/:id/segments`, documenter le résultat dans `runs/T096/smoke-test.md`.

2. **[Obligatoire]** Corriger `/admin/segments/coverage` : remplacer `selectDistinct` + `.length` par un `COUNT(DISTINCT episode_id)` SQL côté serveur.

3. **[Souhaitable]** Supprimer `IntroDbNoDataError` (dead code).

IMPLEMENTATION_FIX_REQUIRED

---

## Instructions de fix

# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T096/reviews/implementation-review.md
- generated at: 2026-08-18T09:09:17Z

---

I have a complete picture of the implementation. Writing the review now.

---

# PR Review — T096: Import and sync intro/recap/outro/credits segment metadata

## Résumé

L'implémentation livre un pipeline complet et bien structuré : schéma `media_segments`, provider IntroDB, service de sync avec upsert idempotent, 36 tests, endpoints API publics et admin, scheduler avec 3 priorités. La qualité de code est globalement bonne et la plupart des critères d'acceptation sont couverts par la structure.

Deux problèmes empêchent l'approbation immédiate.

---

## Vérifications effectuées

- Migration SQL `0036_t096_media_segments.sql`
- Schéma Drizzle `media-segments.ts`
- Client IntroDB (`client.ts`, `mapper.ts`, `types.ts`, `errors.ts`)
- Abstraction `SegmentProvider` / `types.ts`
- `SegmentSyncService` (upsert, syncEpisode, backfillCatalog)
- `imdb-resolver.ts`
- Scheduler (`scheduler-service.ts`) — intégration segment refresh
- Routes `GET /episodes/:id/segments` et `/admin/segments/coverage` + `/admin/segments/episode/:id`
- Script `backfill-segments.ts`
- Hook `setOnNewEpisodeHook` dans `sync-runs-service.ts` et `canonical-resolver.ts`
- Contrat `packages/api-contracts/src/segments.ts`
- Tests : client, mapper, segment-sync-service, imdb-resolver, episodes-segments route

---

## Points validés

**Schéma et migration**
- Table `media_segments` conforme au ticket : tous les champs requis, enum `segment_type` extensible, contrainte unique sur `(episode_id, type, source_provider)`, cascade DELETE, index sur `episode_id`. Correct.

**Provider IntroDB**
- Implémente bien `SegmentProvider` ; 404 → `null` (pas d'erreur) ; 429 → backoff exponentiel avec cap à 60s, max 3 tentatives ; timeout via `AbortSignal.timeout` ; pas de clé API requise. Conforme au ticket §3.
- Conversion secondes → millisecondes correcte (`Math.round`).
- `sourceProvider = 'introdb'` stocké sur chaque ligne — provenance garantie.

**IMDb resolution**
- `resolveAndPersistSeriesImdbId` : lecture locale en premier, persistance si absent, no-op si pas de TMDB ID. Évite les appels TMDB répétés. Conforme au ticket §2.

**SegmentSyncService**
- Upsert via `onConflictDoUpdate` sur la contrainte unique — idempotent.
- Season-0 : log structuré `segment_numbering_ambiguous`, compteur `mismatches++`, zéro ligne insérée. Correct.
- `backfillCatalog` : pagination par 200, `filterUnsynced` pour sauter les épisodes déjà synchés (sauf `--force`), `withBoundedConcurrency`, erreurs non fatales, métriques JSON. Conforme §6.

**Scheduler**
- 3 niveaux de priorité : recent (chaque tick), no-data (tick % 3), stable (tick % 7). Concurrence bornée à 3. Cadence configurable via env. Conforme §8.

**Hook on-demand**
- `setOnNewEpisodeHook` + `createOptionalCanonicalResolver` lit le hook au moment de l'appel (`triggerSync`). Comme le hook est enregistré synchroniquement au démarrage (avant tout déclenchement de sync), le timing est sûr. Conforme §7.

**Endpoints API**
- `GET /episodes/:id/segments` exposé publiquement, ne retourne que `type/startMs/endMs`. Conforme §12.
- Admin routes dans `protectedScope` → protégées par `authenticate`. Conforme §14.
- Shape du contrat `EpisodeSegmentsResponse` identique à l'exemple du ticket.

**Tests**
- Couverture des cas : 404, 429/retry, mapping anime (One Piece fixture), season-0, idempotence upsert, provenance, IMDb resolver (cache hit, TMDB fetch, pas de tmdbId). Conforme §15.

---

## Problèmes détectés

### [BLOQUANT 1] Completion rule non satisfaite : aucune validation contre des données réelles

Le ticket impose explicitement :

> "Do not close because the schema/provider interface exists. Validate against real public data for at least one live-action series episode and at least two Anime episodes, persist the returned segment(s) in IPTVFlix DB, and prove the normalized API returns them for the correct canonical episodes."

L'`implementation-output.md` contient seulement :
> "Committed as 6d544aa. T096 is done — 28 files, 1430 insertions, 36 passing tests."

Il n'y a aucune trace de smoke test réel : pas de log de `pnpm backfill:segments`, pas de résultat JSON d'un appel IntroDB contre One Piece ou Bleach, pas de capture de `GET /episodes/:id/segments` retournant des segments réels.

Le code est structurellement correct mais la completion rule n'est pas satisfaite. Les tests utilisent des fixtures mocked, pas l'API publique réelle.

**Action requise** : exécuter le smoke test complet — résoudre l'IMDb ID de One Piece et Bleach via TMDB, appeler IntroDB, persister en DB, vérifier `GET /episodes/:id/segments` avec les IDs canoniques réels. Documenter le résultat dans un fichier d'artefact.

---

### [BLOQUANT 2] `withAnySegment` dans `/admin/segments/coverage` charge tous les UUIDs en mémoire

`segment-admin.ts` lignes 20-23 :

```ts
const withAnySegment = await db
  .selectDistinct({ episodeId: mediaSegments.episodeId })
  .from(mediaSegments)
const withAnyCount = withAnySegment.length
```

Pour un catalogue de 50 000 épisodes, cela rapatrie potentiellement 50 000 UUID dans Node.js pour compter. Le reste de la même requête utilise `COUNT(DISTINCT ...)` via `sql<number>` — c'est incohérent. Remplacer par :

```ts
const [anyRow] = await db.select({
  withAny: sql<number>`cast(count(distinct episode_id) as integer)`,
}).from(mediaSegments)
const withAnyCount = Number(anyRow?.withAny ?? 0)
```

Ce n'est pas bloquant sur un petit catalogue mais c'est un bug de scalabilité réel pour une installation production.

---

## Risques éventuels (non bloquants)

**Dead code — `IntroDbNoDataError`**
La classe `IntroDbNoDataError` dans `errors.ts` est définie mais n'est jamais jetée ni importée. À supprimer.

**`sourceExternalId` jamais renseigné par le mapper**
Le mapper ne peuple pas `sourceExternalId` même si la clé composite `(imdbId, season, episode)` pourrait y être stockée pour tracabilité. Acceptable pour v1 mais à documenter comme limitation connue.

**Pas de test d'intégration pour `backfillCatalog`**
L'acceptance criteria mentionne "runs to completion twice without errors and produces identical row counts" — ce cas n'est pas couvert par les tests automatisés. Acceptable si le smoke test manuel couvre ce cas.

**`IntroDbRateLimitError` perd la valeur réelle du header `Retry-After`**
Le client récupère le header mais le throw utilise le constructeur par défaut (`retryAfterSec = 60`) : `throw new IntroDbRateLimitError()`. La valeur extraite du header est utilisée pour le backoff local mais pas stockée dans l'erreur propagée. Mineur.

---

## Décision

- REQUEST_CHANGES

## Actions demandées

1. **[Obligatoire]** Exécuter le smoke test réel contre IntroDB : One Piece + Bleach (anime, 2 épisodes minimum) + 1 série live-action. Persister en DB, vérifier `GET /episodes/:id/segments`, documenter le résultat dans `runs/T096/smoke-test.md`.

2. **[Obligatoire]** Corriger `/admin/segments/coverage` : remplacer `selectDistinct` + `.length` par un `COUNT(DISTINCT episode_id)` SQL côté serveur.

3. **[Souhaitable]** Supprimer `IntroDbNoDataError` (dead code).

IMPLEMENTATION_FIX_REQUIRED