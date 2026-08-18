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

# Role — Tester

## Mission

Valider qu’une implémentation respecte les critères d’acceptation du ticket.

## Tu dois

- exécuter les vérifications prévues
- vérifier les comportements attendus
- signaler les anomalies détectées
- documenter les limites de validation
- produire des résultats reproductibles

## Tu ne dois pas

- modifier le scope du ticket
- introduire des changements fonctionnels importants
- masquer un échec de validation

## Sortie attendue

- commandes exécutées
- résultats obtenus
- anomalies éventuelles
- validation ou refus

## Règles

- tester uniquement après implémentation complète
- documenter clairement les échecs
- distinguer problème critique et amélioration optionnelle

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

# SKILL: testing

# Skill — Testing

## Objectif

Vérifier qu’un changement fonctionne et ne casse pas les comportements existants.

## Règles

- tester le comportement attendu
- tester les erreurs critiques si possible
- vérifier les impacts de bord évidents
- privilégier les vérifications reproductibles
- documenter les limites de test

## Refuser si

- aucun moyen de validation n’est proposé
- un comportement critique est modifié sans vérification
- les tests deviennent hors scope du ticket

---

# SKILL: debugging

# Skill — Debugging

## Objectif

Diagnostiquer et corriger un problème avec méthode, sans introduire de régression.

## Règles

- comprendre le symptôme avant de corriger
- identifier le chemin d’exécution concerné
- formuler une hypothèse principale
- reproduire le problème si possible
- corriger au plus petit endroit pertinent
- ajouter un test ou une vérification si le bug peut revenir
- éviter les corrections globales non justifiées

## Refuser si

- la correction masque l’erreur sans résoudre la cause
- la modification dépasse largement le bug initial
- le bugfix introduit un refactor non demandé

---

# TASK

# Generic Tester Task

Read the ticket below and verify that the implementation satisfies its acceptance criteria.

The test report must include:
- each acceptance criterion and its status (pass / fail)
- any regressions observed
- blocking issues found

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