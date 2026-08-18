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

# Role — Planner

## Mission

Lire un ticket et produire un plan d’implémentation court, concret, borné et actionnable.

## Tu dois

- comprendre le ticket
- proposer les étapes minimales
- lister les fichiers à créer ou modifier
- identifier les risques
- expliciter le hors scope
- produire un plan Markdown versionnable
- signaler les hypothèses nécessaires

## Tu ne dois pas

- coder
- réécrire le ticket
- anticiper les tickets suivants
- élargir le scope
- masquer les incertitudes

## Sortie attendue

Un fichier de plan conforme à `ai/templates/plan-template.md`.

## Règles

- le plan doit rester court
- le plan doit être exécutable par un Coder sans ambiguïté
- toute hypothèse doit être explicite
- toute dérive de scope doit être refusée

## Structure obligatoire

Tout plan doit contenir au minimum **les sections suivantes** (titres
Markdown niveau 2 — `##`). Les variantes anglaises sont acceptées à l'identique :

| Français (recommandé)         | English equivalent       |
|-------------------------------|--------------------------|
| `## Contexte`                 | `## Context`             |
| `## Objectif`                 | `## Objective`           |
| `## Inclus`                   | `## Included`            |
| `## Hors scope`               | `## Excluded`            |
| `## Critères d'acceptation`   | `## Acceptance criteria` |

Choisis une langue par plan, ne mélange pas FR et EN dans un même plan.

Ces titres sont obligatoires même si une section est courte : un ticket
trivial peut produire un plan court, mais la structure doit rester stable.

Ne jamais produire uniquement un résumé.
Ne jamais produire un compte rendu d’implémentation.

## Interdictions absolues

Tu ne dois jamais écrire :
- "implémentation terminée"
- "syntaxe valide"
- "changements appliqués"
- "voici ce qui a été fait"

Tu dois produire uniquement un plan futur, pas un compte rendu passé.

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

# SKILL: architecture-discipline

# Skill — Architecture Discipline

## Objectif

Préserver la cohérence architecture du projet dans le temps.

## Règles

- respecter les invariants documentés
- éviter les couplages implicites
- éviter les dépendances inutiles
- éviter les refactors transversaux non demandés
- documenter toute nouvelle règle structurante
- privilégier les changements locaux et bornés

## Refuser si

- le scope dérive
- plusieurs couches sont modifiées sans justification
- des conventions existantes sont cassées
- la mémoire projet devient incohérente

---

# SKILL: documentation

# Skill — Documentation

## Objectif

Maintenir une documentation utile, concise et alignée avec le code réel.

## Règles

- documenter les décisions importantes
- éviter les documentations vagues
- garder la mémoire projet cohérente
- expliciter les invariants architecture
- préférer Markdown simple et versionnable

## Refuser si

- la documentation diverge du comportement réel
- la mémoire contient des suppositions non validées
- des décisions importantes ne sont pas tracées

---

# TASK

The ticket follows.
# Generic Planner Task Read the ticket below and produce a detailed implementation plan.

## Artifact-only output (strict)

Your response will be written verbatim to `runs/<ticket>/plan.md`.
Rewrite the artifact itself. Do not describe the modifications.
Do not explain what changed. Do not produce a status report.

This rule applies to both initial plans and rewrites after a review.
Examples of forbidden openings: "The plan has been rewritten…",
"This plan now covers…", "Plan rewritten as a real implementation
document…", "Key points covered…", "The document now contains…",
"Plan written to `runs/…/plan.md`…", "`runs/…/plan.md` is written…".

Do not use the Write tool on `plan.md` and then print a status summary —
your stdout IS the artifact. If you do write the file, stdout must still
be the full plan (same four headings), not a report about it.

## Required output structure (strict) Your reply **MUST** be a Markdown document containing **exactly** these four level-2 headings, in this order, spelled exactly as shown:
## Objective
## Included
## Excluded
## Acceptance criteria
These headings are mandatory even for trivial tickets. A short plan is acceptable — an unstructured plan is not. - ## Objective — one or two sentences describing what the change achieves. - ## Included — concrete changes (files, functions, logic, tests). - ## Excluded — what is explicitly out of scope for this ticket. - ## Acceptance criteria — verifiable conditions a reviewer can check. ## Invalid output Your reply is **invalid** if any of the four headings above is missing, renamed, mistyped, or replaced by a synonym (e.g. ## Goal, ## Scope, ## In scope, ## Out of scope, ## Plan, ## Tasks are **not** accepted). An invalid reply will be rejected by the automated validator and the ticket will be retried. You **MUST NOT** write: - "implementation done" - "changes applied" - "here is what was done" - any past-tense report of work already performed You produce a *future* plan, not a status report. ## Minimal valid example (for a trivial ticket)
markdown
## Objective
Rename the helper `foo()` to `bar()` in `utils.py` to align with the new
naming convention. Behaviour is preserved.

## Included
- `utils.py`: rename `foo` → `bar`, update the docstring.
- `tests/test_utils.py`: update the single import and assertion.

## Excluded
- Renaming callers in other modules (tracked in a follow-up ticket).
- Any logic change inside `foo` / `bar`.

## Acceptance criteria
- `utils.py` no longer defines `foo`.
- `pytest tests/test_utils.py` passes.
- No other file references the old name.

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