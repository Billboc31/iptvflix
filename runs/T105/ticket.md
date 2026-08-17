# T105 — Generate personalized shelf concepts with LLM using profile taste and exploration strategy

**Source**: GitHub Issue #208

## Description

## Context
#203 captures rich profile behavior, #205 provides semantic retrieval, #206 provides LLM intent planning and #207 provides hybrid reranking. We now need the layer that decides WHICH shelves should exist for a Profile.

The LLM should act like an editorial concept generator informed by profile taste/history, not like the final movie selector.

## Goal
Generate a diverse set of personalized shelf concepts from compact profile/taste context, recent activity, previously shown shelf history and product exploration rules.

Example concepts:
- `SF qui fait réfléchir`
- `Quand l'intelligence artificielle nous dépasse`
- `Dans la lignée de Denis Villeneuve`
- `Thrillers en huis clos où personne n'est fiable`
- `Anime à binge-watcher`
- `Nouveautés proches de vos goûts`

Each concept must then flow through #206 -> #205/#207 to produce actual catalog items.

## 1. ShelfConcept model
Create a durable/versioned shelf concept representation, e.g.:
```text
ShelfConcept
- id
- profileId nullable for global/editorial concepts
- title
- rawIntent
- semanticIntent / query seed
- generationType (PERSONALIZED / EXPLORATION / DISCOVERY / FIXED / EDITORIAL)
- reasonCodes / generationReasons
- sourceModel
- promptVersion
- createdAt
- expiresAt / freshness window
- active
```

The exact schema should fit existing #203 groundwork and must not duplicate ShelfInstance history from the dedicated history ticket.

## 2. Compact profile context
Build a bounded context for concept generation from derived taste data, not a giant raw history dump.

Include useful summaries such as:
- top genres/themes;
- actors/directors/creators affinity;
- movie/series/anime balance;
- runtime/language preferences;
- recent completions;
- recent likes/dislikes/abandons;
- current My List themes;
- binge tendencies;
- recent shelf concepts shown and their performance;
- currently available/new catalog signals where useful.

Do not send secrets or raw provider URLs.

## 3. Exploration/exploitation mix
Support configurable generation mix, initially something like:
- ~70% personalized/exploitation;
- ~20% adjacent exploration;
- ~10% broad discovery/trending/editorial.

These ratios must be configuration, not hard-coded product truth.

Avoid filter bubbles while still making Home feel personal.

## 4. Avoid repetitive concepts
Use recent ShelfConcept/ShelfInstance history to penalize:
- identical titles/intents;
- near-duplicate semantic concepts;
- repeatedly ignored concepts;
- repeated use of the same single watched title as anchor;
- endless genre-only shelves.

Concept novelty should be measured semantically where possible, not only by exact title string.

## 5. Performance feedback
Feed aggregated shelf performance back into future concept generation, e.g.:
- shelf reached/visible;
- shelf item open rate;
- play rate;
- meaningful watch/completion after play;
- ignored shelf;
- explicit negative/dismissal signals if available.

The LLM should receive a summarized performance view, while deterministic rules should also enforce suppression of consistently poor concepts.

## 6. Cold-start behavior
For a new/empty Profile, generate useful shelves from:
- popular/trending catalog;
- genres/content-type starter mix;
- household availability;
- explicit profile language/kids settings;
- optional onboarding preferences if added later.

Do not hallucinate a detailed TasteProfile for a new profile.

## 7. LLM output schema
Require strict structured output per proposed shelf including:
- display title;
- raw recommendation intent;
- generation type;
- generation reason;
- optional anchor media/people IDs only when these IDs are supplied in context;
- desired content type;
- optional freshness/availability policy.

LLM must not return final authoritative content IDs from memory.

## 8. Concept validation
Before persisting/using a concept:
- validate schema;
- reject unsafe/empty/nonsensical concepts;
- check it is not semantically too close to recent shelves;
- dry-run retrieval to ensure enough viable candidates exist;
- discard concepts that cannot produce a healthy shelf.

## 9. Batch generation/cache
Generate concepts in batches, e.g. enough for dozens of future shelves, and cache them per Profile.

Do not call the LLM every time the user scrolls one screen.

Refresh when:
- pool is low;
- taste changed materially;
- concepts become stale;
- repeated poor performance warrants regeneration.

## 10. Lab support
Add a Lab page/panel that can:
- choose a Profile;
- inspect compact taste context;
- ask `Generate shelf concepts`;
- show generated concepts + reasons/types;
- preview each concept through the recommendation pipeline;
- flag concepts as good/bad manually for development.

## Acceptance criteria
- [ ] LLM can generate structured personalized shelf concepts from compact profile context.
- [ ] Final content selection remains delegated to retrieval/ranking.
- [ ] Concept generation supports personalized/exploration/discovery modes.
- [ ] Recent shelf history reduces repetitive concepts.
- [ ] Poor-performing/ignored concepts can influence future generation.
- [ ] Cold-start profiles receive sensible non-hallucinated concepts.
- [ ] Concepts are validated against real catalog candidate availability before use.
- [ ] Concepts are batch-generated/cached rather than generated on every scroll.
- [ ] Lab can inspect profile context and preview generated shelves.
- [ ] Model/prompt/version/reason provenance is persisted.

## Completion rule
Do not close because the LLM generated 20 strings. For at least two Profiles with different taste histories, generate materially different concept sets, run multiple concepts through the real retrieval/ranking pipeline, and demonstrate that weak/duplicate concepts are filtered before reaching Home.
