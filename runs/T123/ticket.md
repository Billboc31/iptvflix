# T123 — Improve semantic retrieval precision for thematic shelf intent

**Source**: GitHub Issue #262

## Description

## Context

After the recent reranking changes, profile boosts are better bounded by semantic relevance. The next bottleneck is now visible in the semantic candidate pool itself.

Benchmark shelf: **« Aventures à travers le temps »**.

The semantic pipeline is healthy (`semanticRetrieved` populated, `fallbackCandidates = 0`), but RAW VECTOR still ranks several candidates highly because they match broad concepts such as *adventure*, *journey* or *time* without actually matching the intended theme of **time travel / temporal adventure**.

Examples observed in the semantic pool/final ranking include candidates such as:
- `L'Avventura`
- `France, le fabuleux voyage`
- `Mystery at the Louvre Museum`
- `Treasure Island`

while genuine temporal candidates such as `The Time Machine`, `Timescape: Back to the Dinosaurs`, `The Visitor from the Future`, `Time Lapse`, etc. should receive stronger thematic relevance.

## Problem

Semantic retrieval currently appears too tolerant of individual lexical/semantic components of a shelf concept. For a compound thematic intent, matching *adventure* or *journey* should not be enough when the defining concept is **travel through time**.

The reranker should not have to repair a candidate pool whose semantic intent has already drifted.

## Goal

Improve semantic retrieval / intent representation so that compound thematic concepts preserve their defining semantic constraints.

For **« Aventures à travers le temps »**, the system should understand that temporal displacement/time travel is a central semantic anchor, not merely that the content relates independently to adventure, travel or time.

## Expected direction

Investigate the current ShelfConcept → semantic query / embedding construction and determine the best generic solution. Possible approaches include semantic intent expansion, required/weighted thematic anchors, richer query representation, or another mechanism that preserves compound concepts.

Do **not** hardcode this specific shelf or movie titles. The solution must generalize to other compound thematic shelves.

Do not change database data manually as part of the fix.

## Acceptance criteria

- Semantic retrieval remains vector/semantic based and does not fall back to title keyword matching.
- Compound shelf intents preserve their defining thematic concept.
- For the benchmark **« Aventures à travers le temps »**, genuine time-travel/temporal-story candidates rank materially above generic adventure/travel candidates.
- Candidates matching only broad secondary concepts such as adventure/journey should not dominate the top semantic results.
- Existing personalization/reranking remains functional; this ticket focuses on improving the semantic candidate pool before personalization.
- Add regression tests covering this benchmark and at least one additional compound thematic intent.
- No shelf-specific hardcoding and no manual production database modification.
