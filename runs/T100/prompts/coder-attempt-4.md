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


# T100 — Capture and persist comprehensive profile interaction data for future recommendation quality

**Source**: GitHub Issue #203

## Description

## Context
IPTVFlix is introducing first-class Account -> Profile support (#201) and wants to build highly personalized, effectively infinite Home shelves later.

To make future recommendation models genuinely good, we should start capturing useful profile-level behavioral signals NOW, even if many of them are not consumed by the recommendation engine immediately.

The principle is:

```text
collect rich, meaningful, privacy-conscious interaction history now
        ↓
keep canonical/profile ownership correct
        ↓
allow future algorithms/LLMs/rankers to recompute taste from history
```

This ticket is DATA COLLECTION + NORMALIZATION + RETENTION. It should not yet attempt to build the final infinite-home recommendation engine.

## Goal
Ensure IPTVFlix persistently captures the useful signals needed to understand each Profile's tastes, behavior, content affinities, playback habits and recommendation interactions over time.

The data must be profile-scoped and reusable by future algorithms without requiring a database redesign.

## 1. Reuse #201 profile interaction architecture
Do not create a competing event model if #201 has already introduced `ProfileInteractionEvent` or an equivalent structure.

Extend/adapt the actual merged schema so all events are owned by `profileId` and can be queried efficiently by profile, time, media and event type.

## 2. Event taxonomy
Define a clear, versioned taxonomy of meaningful events. At minimum support where the product actually has these interactions:

### Discovery / browsing
- `HOME_OPENED`
- `SHELF_IMPRESSION`
- `SHELF_VIEWED`
- `SHELF_ITEM_IMPRESSION`
- `SHELF_ITEM_OPENED`
- `DETAIL_OPENED`
- `TRAILER_PREVIEW_STARTED`
- `TRAILER_PREVIEW_COMPLETED`
- `SEARCH_PERFORMED`
- `SEARCH_RESULT_IMPRESSION`
- `SEARCH_RESULT_OPENED`

### Intent / explicit preference
- `MY_LIST_ADDED`
- `MY_LIST_REMOVED`
- `LIKED`
- `DISLIKED`
- `RATED` if ratings exist later
- `CONTINUE_WATCHING_DISMISSED`
- `REMINDER_ADDED` if reminders exist later

### Playback
- `PLAY_STARTED`
- `PLAY_RESUMED`
- `PLAY_PAUSED`
- `PLAY_STOPPED`
- `PLAY_COMPLETED`
- `PLAY_ABANDONED`
- `SEEK_FORWARD`
- `SEEK_BACKWARD`
- `SKIP_INTRO`
- `SKIP_RECAP`
- `SKIP_OUTRO`
- `NEXT_EPISODE_AUTO`
- `NEXT_EPISODE_MANUAL`
- `SOURCE_SELECTED`
- `AUDIO_TRACK_SELECTED`
- `SUBTITLE_TRACK_SELECTED`
- `PLAYBACK_SPEED_CHANGED`

### Profile/settings
- `PROFILE_SELECTED`
- `PROFILE_PREFERENCE_CHANGED`
- `NEVER_STOP_ENABLED`
- `NEVER_STOP_DISABLED`

Do not emit events that the UI cannot meaningfully produce yet; the taxonomy should be extensible and versioned.

## 3. Store context with each event
Persist enough context to make future ranking explainable and useful, without duplicating entire catalog rows.

Suggested fields where applicable:

```text
ProfileInteractionEvent
- id
- profileId
- eventType
- occurredAt
- mediaType
- mediaId
- seriesId (nullable)
- seasonId / seasonNumber (nullable)
- episodeId (nullable)
- positionMs (nullable)
- durationMs (nullable)
- progressPercent (nullable derived/snapshot)
- shelfInstanceId (nullable)
- shelfConceptId / shelfConcept (nullable)
- shelfPosition (nullable)
- itemPositionInShelf (nullable)
- searchQueryNormalized (nullable)
- sourceId (nullable)
- availabilityId (nullable)
- deviceType (nullable)
- clientType (web/mobile/android-tv)
- appVersion (nullable)
- sessionId (nullable)
- referrerSurface (nullable)
- metadataJson (strictly bounded)
- schemaVersion
```

Avoid copying poster URLs, overviews, full TMDB payloads or provider credentials into interaction rows. Catalog metadata remains canonical elsewhere.

## 4. Playback quality signals
Future recommendations should distinguish "clicked" from "actually enjoyed".

Capture/derive durable playback behavior such as:
- started but abandoned quickly;
- watched 5/25/50/75/90+%;
- completed;
- repeatedly resumed;
- replayed after completion;
- episode binge streaks;
- series abandonment after N episodes;
- manual next episode vs autoplay;
- long pauses / repeated seeks only where useful.

Do NOT emit one event every second. Existing watch progress remains the authoritative continuous position store. Events should represent meaningful boundaries or milestones.

## 5. Milestone events instead of noisy telemetry
Implement deduplicated playback milestones where useful, for example:
- `WATCHED_10_PERCENT`
- `WATCHED_25_PERCENT`
- `WATCHED_50_PERCENT`
- `WATCHED_75_PERCENT`
- `WATCHED_90_PERCENT`
- `PLAY_COMPLETED`

Or store equivalent structured snapshots without exploding event volume.

Each milestone must be emitted at most once per viewing lifecycle/content/profile unless intentional replay semantics require otherwise.

## 6. Session / viewing-session model
Introduce or reuse a lightweight viewing session concept if it improves data quality:

```text
ViewingSession
- id
- profileId
- mediaId / episodeId
- startedAt
- endedAt
- startPositionMs
- endPositionMs
- maxPositionMs
- watchedMsApprox
- completed
- deviceType
- sourceId / availabilityId
```

This can summarize one actual watch session and avoid reconstructing everything only from event logs.

Do not double-store contradictory progress semantics; document source of truth.

## 7. Catalog feature snapshots / joins
Do not duplicate all TMDB metadata into events, but ensure future recommendation jobs can efficiently join an interaction to useful canonical features such as:
- genres;
- keywords/tags;
- cast;
- directors/creators;
- production countries;
- original language;
- release year/decade;
- runtime;
- popularity;
- rating/vote count;
- collection/franchise;
- TV networks;
- anime classification if present;
- certification/maturity;
- canonical TMDB external IDs.

If the current canonical schema is missing important reusable metadata from TMDB, enrich/store it in normalized catalog tables rather than in interaction events.

## 8. People / credits data
Audit whether IPTVFlix currently persists cast/crew sufficiently for recommendation use.

Where licensing/API rules allow and data is available from existing TMDB sync, persist useful normalized relationships such as:
- Actor / Person;
- MoviePerson / SeriesPerson / EpisodePerson where appropriate;
- role/character;
- department/job;
- billing/order;
- director/creator flags.

This is important for future shelves such as:
- `Avec Cillian Murphy`;
- `Films de Denis Villeneuve`;
- `Parce que tu regardes souvent X`.

Do not fetch deep credit detail for every obscure entity if it causes unreasonable API cost; design backfill tiers/priorities.

## 9. Keywords / themes / collections
Persist useful TMDB-derived discovery metadata where not already stored:
- keywords;
- collections/franchises;
- networks;
- production companies;
- countries;
- languages;
- certifications/content ratings;
- watch/provider-independent metadata when useful.

These features are especially valuable for semantic shelf construction.

## 10. Availability-aware features
Keep catalog identity separate from provider availability, but ensure recommendation/ranking can efficiently answer:
- playable now yes/no;
- source count;
- best known quality;
- language variants;
- recently became playable;
- available in user's household sources.

Do not let recommendation logic depend on raw Xtream names or UUIDs.

## 11. Shelf analytics groundwork
Future infinite shelves need feedback on shelf quality.

Persist stable concepts/instances so we can know:
- shelf was rendered;
- which items were shown;
- item positions;
- item clicked/opened/played;
- shelf ignored;
- shelf reached during vertical scroll;
- whether a concept repeatedly performs poorly for a profile.

Avoid an event for every tiny scroll pixel. Emit impression only after a reasonable visibility threshold.

## 12. Search behavior
Persist profile-scoped search behavior carefully:
- normalized query;
- timestamp;
- result opened/played;
- no-result state when useful.

Do not store sensitive free-text indefinitely without policy. Add configurable retention/anonymization capability for raw search strings if needed.

## 13. Derived taste model pipeline
Create or extend a recomputable profile feature store such as `ProfileTasteFeature` / `TasteProfileVersion`.

Potential derived weights:
- genre affinity;
- keyword/theme affinity;
- actor/person affinity;
- director/creator affinity;
- franchise affinity;
- language affinity;
- country affinity;
- decade/year affinity;
- runtime preference;
- movie/series/anime preference;
- completion likelihood;
- novelty vs familiar-content preference;
- popularity/mainstream vs niche preference;
- binge tendency;
- explicit negative signals.

The raw event/history store must remain available so a new algorithm version can recompute taste from scratch.

## 14. Recommendation explainability readiness
Keep enough provenance so a future shelf/item can explain internally why it was selected, e.g.:
- liked genre X;
- completed movies A/B;
- actor affinity Y;
- recently watched series Z;
- trending/currently popular;
- newly available from household source.

This does not require showing explanations to users yet, but the system should not become a black box with no traceable features.

## 15. Backfill existing state
Create migration/backfill from existing profile-scoped data after #201:
- current watch progress;
- completed items;
- My List;
- likes/dislikes if present;
- Continue Watching dismissals;
- existing history.

Do not fabricate historical timestamps/events that are unknown. Create explicit migration-origin snapshots/events where necessary.

## 16. Retention and database growth
This feature intentionally stores a lot, so build sustainable retention/indexing from the beginning.

Requirements:
- indexes by profile/time/event/media;
- bounded metadata JSON;
- no per-second playback spam;
- archive/compact strategy for very old low-value telemetry;
- preserve high-value durable preference/history events longer;
- configurable retention by event class;
- schema supports future partitioning if data grows substantially.

Do not prematurely delete watch history needed to recompute tastes.

## 17. Privacy/account deletion
Although this is a private/personal product today, build clean ownership semantics:
- profile deletion cascades/removes profile interaction/taste data appropriately;
- account deletion removes all profile behavioral data;
- no profile can query another account's events;
- admin diagnostics should not casually expose raw search/history across accounts.

## 18. Event ingestion API/service
Centralize event emission through one server-side validated service/API rather than arbitrary frontend table writes.

Requirements:
- authenticated Account + current Profile enforcement;
- validate event type and media ownership/reference;
- reject oversized metadata;
- idempotency/deduping where needed;
- batch support for safe client telemetry upload where beneficial;
- failure to record non-critical analytics must not break playback.

## 19. Client instrumentation
Wire the existing Web/Mobile and Android TV clients to emit meaningful events for interactions that already exist.

At minimum instrument currently available flows:
- profile select;
- Home/detail open;
- search;
- My List add/remove;
- playback start/resume/pause/complete;
- source selection;
- audio/subtitle selection where available;
- Continue Watching dismissal;
- shelf/item interactions where current Home architecture supports them.

Do not block UI waiting for analytics persistence.

## 20. Admin diagnostics
Provide dev/admin-level visibility:
- events/day;
- events/profile (sanitized/admin appropriate);
- top event types;
- storage growth;
- ingestion failures;
- duplicate/dropped noisy events;
- derived taste recompute status;
- number of profiles with enough signal for personalization.

## Acceptance criteria
- [ ] All behavioral data is owned by `profileId`.
- [ ] Event taxonomy is explicit/versioned/extensible.
- [ ] Current Web/Mobile and Android TV interactions emit meaningful events.
- [ ] No per-second noisy playback telemetry is introduced.
- [ ] Viewing behavior can distinguish start/abandon/partial/complete.
- [ ] Viewing sessions or equivalent summaries exist where useful.
- [ ] Shelf impression/click groundwork exists for future infinite Home ranking.
- [ ] Search behavior can be learned from with appropriate retention safeguards.
- [ ] Canonical metadata can be joined to interactions for genres/people/keywords/languages/etc.
- [ ] Missing useful TMDB metadata is persisted in normalized catalog storage where appropriate.
- [ ] Cast/crew/director relationships are available for recommendation features where feasible.
- [ ] Keywords/collections/themes and key discovery metadata are retained where available.
- [ ] Availability-aware ranking features are queryable without leaking provider internals.
- [ ] Derived taste features can be fully recomputed from durable history.
- [ ] Existing profile state is backfilled without inventing false history.
- [ ] Database retention/indexing prevents unbounded noisy growth.
- [ ] Profile/account deletion correctly removes owned interaction/taste data.
- [ ] Event recording failures do not break primary product flows.
- [ ] Diagnostics show data volume and instrumentation health.

## Completion rule
Do not close because an `events` table exists. Demonstrate with at least two Profiles using the app differently that their persisted interaction histories differ, their derived taste features can be recomputed independently, and the stored data is rich enough to distinguish at minimum: content opened but not played, quickly abandoned, partially watched, completed, explicitly liked/disliked/listed, searched for, and discovered through a shelf.

---

## Contexte de retry injecté par run_ticket.py

## Output précédent

The file looks correct. The fix is complete.

**What changed in `PlayerViewModel.kt`:**

- **`sessionEnded: Boolean` flag** — tracks whether the session has been closed (either by `PLAY_COMPLETED` or `PLAY_ABANDONED`). Reset to `false` in `load()`, set to `true` on `STATE_ENDED`.

- **`emitAbandonIfNeeded(positionMs: Long)`** — guards against double-firing (`if (sessionEnded) return`), then emits `PLAY_ABANDONED` with the correct `mediaType`, `mediaId`, `sessionId`, and pre-captured position. Fire-and-forget with logged failure (never breaks playback).

- **`stop()`** — captures `currentPosition` before stopping the player (position resets to 0 after `player.stop()`), then calls `emitAbandonIfNeeded` inside the existing `NonCancellable` coroutine alongside the progress flush.

- **`onCleared()`** — same pattern: captures position first, then calls `emitAbandonIfNeeded` inside the existing `withTimeout(2_000L)` block so both the progress report and the abandon event are flushed within the 2s budget.

This ensures `ViewingSession.endedAt` is always populated on Android TV — whether the user presses back, the ViewModel is destroyed by the system, or playback ends naturally.

---

## Review

Now I have a complete picture. Writing the final review.

---

# PR Review — T100: Capture and persist comprehensive profile interaction data

## Résumé

C'est la troisième passe de review après deux cycles de correction. L'implémentation est globalement solide : schéma DB complet, taxonomie de 50 événements, service de session, milestones dédupliqués côté serveur, taste service enrichi avec 7 dimensions supplémentaires, backfill idempotent, rétention par classe, admin routes, et instrumentation complète Web + Android TV. Les deux bloquants de la review 1 (milestone service câblé, `mediaType` hardcodé, retours de rétention) ont bien été corrigés.

Un seul bloquant subsiste : le contrat API `ProfileTaste` n'expose pas les nouvelles dimensions calculées par T100, rendant le critère principal du ticket invérifiable en pratique.

---

## Vérifications effectuées

- Migration `0040_t100_profile_interaction_events_v2.sql` relue intégralement
- Schéma Drizzle : `profile-interaction-events.ts`, `viewing-sessions.ts`, `persons.ts`, `profile-taste.ts`, `media-credits.ts`
- Services : `interaction-event-service.ts`, `viewing-session-service.ts`, `playback-milestone-service.ts`, `profile-taste-service.ts`, `retention-service.ts`
- Routes : `interaction-events.ts` (batch handler), `admin.ts` (5 routes)
- Contrat API : `packages/api-contracts/src/taste.ts`, `interaction-events.ts`
- Client Web : `PlayerPage.tsx`, `useInteractionEvents.ts`, `useProgressSync.ts`
- Android TV : `PlayerViewModel.kt` (cycle complet play/abandon)
- Script : `backfill-interaction-events.ts`
- Reviews précédentes : `runs/T100/reviews/implementation-review.md`

---

## Points validés

- **Schéma DB** : tous les champs du plan présents, migration additive (`IF NOT EXISTS`), cascade DELETE sur `profileId` dans les trois tables, `ON DELETE SET NULL` sur `sessionId`. Indexes complets : `(profileId, eventType)`, `(profileId, mediaId)`, `(sessionId)`, `(occurredAt)`.
- **Taxonomie** : 50 types définis dans `ALLOWED_EVENT_TYPES` et le type `InteractionEventType`; inconnus rejetés en 400.
- **Batch endpoint** : best-effort, jamais de 5xx pour analytics, session ouverte sur `PLAY_STARTED` avec `sessionId` retourné, session fermée sur `PLAY_COMPLETED`/`PLAY_ABANDONED`.
- **Milestone deduplication** : `emitMilestoneIfNew` est câblé dans le batch handler (`interaction-events.ts:70-79`), prend `mediaType` en paramètre, génère une `idempotencyKey` correcte `${profileId}:${mediaId}:${sessionId}:${milestone}`. Bloquant 1 et 2 de la review précédente corrigés.
- **Idempotency générale** : check SELECT avant INSERT + unique index conditionnel — correct pour la sémantique analytics.
- **Taste service** : `buildTaste` calcule `personScores`, `keywordScores`, `franchiseScores`, `languageScores`, `countryScores`, `decadeScores`, `mediaTypePreferences`, `completionRate`, `historyEventCount`, `tasteVersion` — toutes les dimensions plan. Upsert avec bump `tasteVersion`.
- **Persons enrichment** : upsert `persons` par `tmdbPersonId`, FK `personId` dans `media_credits`, flags `isDirector`/`isCreator`. Correct.
- **Rétention** : `runCompaction()` retourne `{ deleted: number, anonymized: number }` (counts réels). `getRetentionStats()` filtre correctement par `STANDARD_TYPES` et `ANALYTICS_TYPES`. Bloquants rétention corrigés.
- **Backfill** : idempotent via `idempotencyKey = backfill:${profileId}:${mediaId}:${eventType}`, `schemaVersion=0`, `origin=backfill` — conforme, ne fabrique pas de timestamps inconnus.
- **Admin routes** : 5 endpoints présents et fonctionnels ; `interaction-health` calcule le milestone coverage correctement.
- **Android TV** : `emitAbandonIfNeeded()` appelé dans `stop()` avec `NonCancellable`, flag `sessionEnded` empêche les doublons — correct.
- **Web player** : `PLAY_STARTED` via batch (reçoit `sessionId`), cycle complet sur événements HTML5 video, `PLAY_ABANDONED` sur unmount — correct.

---

## Problèmes détectés

### 🔴 BLOQUANT — Contrat API `ProfileTaste` n'expose pas les nouvelles dimensions

**Fichier** : `packages/api-contracts/src/taste.ts` et `apps/api/src/services/profile-taste-service.ts`

Le type `ProfileTaste` n'a pas été mis à jour :

```typescript
// packages/api-contracts/src/taste.ts
export type ProfileTaste = {
  profileId: string
  genreScores: GenreScore[]
  positiveMediaIds: string[]
  negativeMediaIds: string[]
  signalCount: number
  builtAt: string
  // ← personScores, keywordScores, franchiseScores, languageScores,
  //   countryScores, decadeScores, mediaTypePreferences,
  //   completionRate, historyEventCount, tasteVersion ABSENTS
}
```

La fonction `buildOutput` (profile-taste-service.ts:46-86) reçoit ces champs dans le paramètre `extra` mais ne les inclut pas dans l'objet retourné. Les 7 nouvelles dimensions sont correctement calculées et persistées en DB, mais jamais exposées par l'API.

Conséquences directes :
- Le critère du plan *"profile_taste record includes personScores, keywordScores, franchiseScores, languageScores, decadeScores after POST /taste/rebuild"* ne peut pas être vérifié via l'API.
- Les futurs algorithmes appelant `GET /taste/:profileId` ne voient que les genre scores — les dimensions person/keyword/franchise/language/decade sont inaccessibles sans requête DB directe.
- Le ticket §13/14 (taste model pipeline, explainability readiness) est partiellement bloqué.

**Correction minimale :**

1. Étendre `ProfileTaste` dans `packages/api-contracts/src/taste.ts` :
```typescript
export type ProfileTaste = {
  profileId: string
  genreScores: GenreScore[]
  positiveMediaIds: string[]
  negativeMediaIds: string[]
  signalCount: number
  builtAt: string
  personScores: Record<string, number>
  personMeta: Record<string, { name: string; role: string }>
  keywordScores: Record<string, number>
  franchiseScores: Record<string, number>
  languageScores: Record<string, number>
  countryScores: Record<string, number>
  decadeScores: Record<string, number>
  mediaTypePreferences: Record<string, number>
  completionRate: number | null
  historyEventCount: number
  tasteVersion: number
}
```

2. Inclure `extra` dans le return de `buildOutput` (profile-taste-service.ts:78-85).

---

### 🟡 OBSERVATION 1 — Dérive schema/migration pour `sessionId` FK

**Fichier** : `apps/api/src/db/schema/profile-interaction-events.ts:33`

```typescript
sessionId: uuid('session_id'),  // ← aucune référence FK
```

La migration SQL ajoute correctement `REFERENCES "viewing_sessions"("id") ON DELETE SET NULL`. Mais le schéma Drizzle n'a pas de `.references()` correspondant. Un `drizzle-kit check` ou `push` détectera une dérive et génèrera une migration parasite. À corriger pour aligner le schéma ORM sur la DB réelle.

---

### 🟡 OBSERVATION 2 — `tasteVersion` retourné comme `1` systématiquement

**Fichier** : `apps/api/src/services/profile-taste-service.ts:349`

```typescript
return buildOutput(profileId, ..., {
  ...
  tasteVersion: 1,  // ← hardcodé, ne reflète pas le vrai incrément DB
})
```

Sur un rebuild (conflict path), la DB a `tasteVersion = sql\`...+1\`` mais l'API retourne toujours 1. Non bloquant maintenant car `tasteVersion` n'est pas dans le contrat — mais ce sera incorrect dès que le type sera étendu (voir bloquant ci-dessus). À corriger en même temps.

---

### 🟡 OBSERVATION 3 — Mobile non documenté comme absent

Le plan §12 et le critère de plan "Mobile client emits the same set as Web" sont non satisfaits. `apps/mobile/` n'existe pas. L'`implementation-output.md` ne le mentionne pas explicitement. À documenter comme out-of-scope pour clarifier le delta entre plan et livraison.

---

## Risques éventuels

- **Données taste inaccessibles via API** : futur développeur qui intègre le taste service obtiendra des objets partiels sans avertissement — risque de régression silencieuse sur les futures features recommandation.
- **Drizzle schema drift** : le décalage `sessionId` FK risque de créer une fausse migration lors du prochain `drizzle-kit generate`, potentiellement appliquée en production.

---

## Décision

REQUEST_CHANGES — un défaut bloquant à corriger : le contrat `ProfileTaste` doit exposer les nouvelles dimensions calculées par T100. Les deux observations sont mineures et peuvent être traitées dans le même patch.

**Actions requises :**
1. **[Bloquant]** Étendre `ProfileTaste` dans `packages/api-contracts/src/taste.ts` avec les 10 champs manquants et mettre à jour `buildOutput` pour les inclure dans le retour.
2. **[Bloquant, même correctif]** Corriger `tasteVersion: 1` hardcodé dans l'appel `buildOutput` de `buildTaste()` — passer la valeur issue du contexte (1 pour insert, la valeur DB pour les consommateurs de `getTaste`).
3. **[Mineur]** Ajouter `.references(() => viewingSessions.id, { onDelete: 'set null' })` sur `sessionId` dans le schéma Drizzle.

IMPLEMENTATION_FIX_REQUIRED

---

## Instructions de fix

# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T100/reviews/implementation-review.md
- generated at: 2026-08-18T12:21:00Z

---

Now I have a complete picture. Writing the final review.

---

# PR Review — T100: Capture and persist comprehensive profile interaction data

## Résumé

C'est la troisième passe de review après deux cycles de correction. L'implémentation est globalement solide : schéma DB complet, taxonomie de 50 événements, service de session, milestones dédupliqués côté serveur, taste service enrichi avec 7 dimensions supplémentaires, backfill idempotent, rétention par classe, admin routes, et instrumentation complète Web + Android TV. Les deux bloquants de la review 1 (milestone service câblé, `mediaType` hardcodé, retours de rétention) ont bien été corrigés.

Un seul bloquant subsiste : le contrat API `ProfileTaste` n'expose pas les nouvelles dimensions calculées par T100, rendant le critère principal du ticket invérifiable en pratique.

---

## Vérifications effectuées

- Migration `0040_t100_profile_interaction_events_v2.sql` relue intégralement
- Schéma Drizzle : `profile-interaction-events.ts`, `viewing-sessions.ts`, `persons.ts`, `profile-taste.ts`, `media-credits.ts`
- Services : `interaction-event-service.ts`, `viewing-session-service.ts`, `playback-milestone-service.ts`, `profile-taste-service.ts`, `retention-service.ts`
- Routes : `interaction-events.ts` (batch handler), `admin.ts` (5 routes)
- Contrat API : `packages/api-contracts/src/taste.ts`, `interaction-events.ts`
- Client Web : `PlayerPage.tsx`, `useInteractionEvents.ts`, `useProgressSync.ts`
- Android TV : `PlayerViewModel.kt` (cycle complet play/abandon)
- Script : `backfill-interaction-events.ts`
- Reviews précédentes : `runs/T100/reviews/implementation-review.md`

---

## Points validés

- **Schéma DB** : tous les champs du plan présents, migration additive (`IF NOT EXISTS`), cascade DELETE sur `profileId` dans les trois tables, `ON DELETE SET NULL` sur `sessionId`. Indexes complets : `(profileId, eventType)`, `(profileId, mediaId)`, `(sessionId)`, `(occurredAt)`.
- **Taxonomie** : 50 types définis dans `ALLOWED_EVENT_TYPES` et le type `InteractionEventType`; inconnus rejetés en 400.
- **Batch endpoint** : best-effort, jamais de 5xx pour analytics, session ouverte sur `PLAY_STARTED` avec `sessionId` retourné, session fermée sur `PLAY_COMPLETED`/`PLAY_ABANDONED`.
- **Milestone deduplication** : `emitMilestoneIfNew` est câblé dans le batch handler (`interaction-events.ts:70-79`), prend `mediaType` en paramètre, génère une `idempotencyKey` correcte `${profileId}:${mediaId}:${sessionId}:${milestone}`. Bloquant 1 et 2 de la review précédente corrigés.
- **Idempotency générale** : check SELECT avant INSERT + unique index conditionnel — correct pour la sémantique analytics.
- **Taste service** : `buildTaste` calcule `personScores`, `keywordScores`, `franchiseScores`, `languageScores`, `countryScores`, `decadeScores`, `mediaTypePreferences`, `completionRate`, `historyEventCount`, `tasteVersion` — toutes les dimensions plan. Upsert avec bump `tasteVersion`.
- **Persons enrichment** : upsert `persons` par `tmdbPersonId`, FK `personId` dans `media_credits`, flags `isDirector`/`isCreator`. Correct.
- **Rétention** : `runCompaction()` retourne `{ deleted: number, anonymized: number }` (counts réels). `getRetentionStats()` filtre correctement par `STANDARD_TYPES` et `ANALYTICS_TYPES`. Bloquants rétention corrigés.
- **Backfill** : idempotent via `idempotencyKey = backfill:${profileId}:${mediaId}:${eventType}`, `schemaVersion=0`, `origin=backfill` — conforme, ne fabrique pas de timestamps inconnus.
- **Admin routes** : 5 endpoints présents et fonctionnels ; `interaction-health` calcule le milestone coverage correctement.
- **Android TV** : `emitAbandonIfNeeded()` appelé dans `stop()` avec `NonCancellable`, flag `sessionEnded` empêche les doublons — correct.
- **Web player** : `PLAY_STARTED` via batch (reçoit `sessionId`), cycle complet sur événements HTML5 video, `PLAY_ABANDONED` sur unmount — correct.

---

## Problèmes détectés

### 🔴 BLOQUANT — Contrat API `ProfileTaste` n'expose pas les nouvelles dimensions

**Fichier** : `packages/api-contracts/src/taste.ts` et `apps/api/src/services/profile-taste-service.ts`

Le type `ProfileTaste` n'a pas été mis à jour :

```typescript
// packages/api-contracts/src/taste.ts
export type ProfileTaste = {
  profileId: string
  genreScores: GenreScore[]
  positiveMediaIds: string[]
  negativeMediaIds: string[]
  signalCount: number
  builtAt: string
  // ← personScores, keywordScores, franchiseScores, languageScores,
  //   countryScores, decadeScores, mediaTypePreferences,
  //   completionRate, historyEventCount, tasteVersion ABSENTS
}
```

La fonction `buildOutput` (profile-taste-service.ts:46-86) reçoit ces champs dans le paramètre `extra` mais ne les inclut pas dans l'objet retourné. Les 7 nouvelles dimensions sont correctement calculées et persistées en DB, mais jamais exposées par l'API.

Conséquences directes :
- Le critère du plan *"profile_taste record includes personScores, keywordScores, franchiseScores, languageScores, decadeScores after POST /taste/rebuild"* ne peut pas être vérifié via l'API.
- Les futurs algorithmes appelant `GET /taste/:profileId` ne voient que les genre scores — les dimensions person/keyword/franchise/language/decade sont inaccessibles sans requête DB directe.
- Le ticket §13/14 (taste model pipeline, explainability readiness) est partiellement bloqué.

**Correction minimale :**

1. Étendre `ProfileTaste` dans `packages/api-contracts/src/taste.ts` :
```typescript
export type ProfileTaste = {
  profileId: string
  genreScores: GenreScore[]
  positiveMediaIds: string[]
  negativeMediaIds: string[]
  signalCount: number
  builtAt: string
  personScores: Record<string, number>
  personMeta: Record<string, { name: string; role: string }>
  keywordScores: Record<string, number>
  franchiseScores: Record<string, number>
  languageScores: Record<string, number>
  countryScores: Record<string, number>
  decadeScores: Record<string, number>
  mediaTypePreferences: Record<string, number>
  completionRate: number | null
  historyEventCount: number
  tasteVersion: number
}
```

2. Inclure `extra` dans le return de `buildOutput` (profile-taste-service.ts:78-85).

---

### 🟡 OBSERVATION 1 — Dérive schema/migration pour `sessionId` FK

**Fichier** : `apps/api/src/db/schema/profile-interaction-events.ts:33`

```typescript
sessionId: uuid('session_id'),  // ← aucune référence FK
```

La migration SQL ajoute correctement `REFERENCES "viewing_sessions"("id") ON DELETE SET NULL`. Mais le schéma Drizzle n'a pas de `.references()` correspondant. Un `drizzle-kit check` ou `push` détectera une dérive et génèrera une migration parasite. À corriger pour aligner le schéma ORM sur la DB réelle.

---

### 🟡 OBSERVATION 2 — `tasteVersion` retourné comme `1` systématiquement

**Fichier** : `apps/api/src/services/profile-taste-service.ts:349`

```typescript
return buildOutput(profileId, ..., {
  ...
  tasteVersion: 1,  // ← hardcodé, ne reflète pas le vrai incrément DB
})
```

Sur un rebuild (conflict path), la DB a `tasteVersion = sql\`...+1\`` mais l'API retourne toujours 1. Non bloquant maintenant car `tasteVersion` n'est pas dans le contrat — mais ce sera incorrect dès que le type sera étendu (voir bloquant ci-dessus). À corriger en même temps.

---

### 🟡 OBSERVATION 3 — Mobile non documenté comme absent

Le plan §12 et le critère de plan "Mobile client emits the same set as Web" sont non satisfaits. `apps/mobile/` n'existe pas. L'`implementation-output.md` ne le mentionne pas explicitement. À documenter comme out-of-scope pour clarifier le delta entre plan et livraison.

---

## Risques éventuels

- **Données taste inaccessibles via API** : futur développeur qui intègre le taste service obtiendra des objets partiels sans avertissement — risque de régression silencieuse sur les futures features recommandation.
- **Drizzle schema drift** : le décalage `sessionId` FK risque de créer une fausse migration lors du prochain `drizzle-kit generate`, potentiellement appliquée en production.

---

## Décision

REQUEST_CHANGES — un défaut bloquant à corriger : le contrat `ProfileTaste` doit exposer les nouvelles dimensions calculées par T100. Les deux observations sont mineures et peuvent être traitées dans le même patch.

**Actions requises :**
1. **[Bloquant]** Étendre `ProfileTaste` dans `packages/api-contracts/src/taste.ts` avec les 10 champs manquants et mettre à jour `buildOutput` pour les inclure dans le retour.
2. **[Bloquant, même correctif]** Corriger `tasteVersion: 1` hardcodé dans l'appel `buildOutput` de `buildTaste()` — passer la valeur issue du contexte (1 pour insert, la valeur DB pour les consommateurs de `getTaste`).
3. **[Mineur]** Ajouter `.references(() => viewingSessions.id, { onDelete: 'set null' })` sur `sessionId` dans le schéma Drizzle.

IMPLEMENTATION_FIX_REQUIRED