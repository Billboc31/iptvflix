# T124 — Prevent profile boosts from overpowering core shelf intent

**Source**: GitHub Issue #264

## Description

## Context

Following #260 and #262, the benchmark shelf **« Aventures à travers le temps »** is now substantially better: the top results are genuine temporal/time-travel titles such as `Time Trap`, `The Time Travelers`, `The Time Machine`, `Timescape: Back to the Dinosaurs` and `The Visitor from the Future`.

However, some candidates with weaker thematic relevance can still climb too high because profile-affinity boosts reward broad genres such as adventure/drama.

Observed examples include `The Hobbit: An Unexpected Journey`, `Hors limites` and `Journey to the Center of the Earth` ranking relatively high despite not matching the core temporal intent as strongly as genuine time-travel candidates.

## Problem

Personalization should **rank relevant candidates according to user taste**, not compensate for insufficient relevance to the shelf's defining concept.

A candidate with strong user-profile affinity but weak core thematic relevance should not overtake a substantially more relevant candidate simply because its genres/language/era match the user profile.

## Goal

Make profile boosts explicitly bounded by the candidate's relevance to the **core shelf intent**.

The solution must be generic and work for any thematic/compound shelf, not just time travel.

Conceptually:

> semantic/thematic relevance determines whether a movie belongs near the top of the shelf; personalization then orders candidates within that relevant set.

## Expected direction

Investigate the hybrid reranker and introduce a generic relevance-aware cap/gating/attenuation mechanism for personalization boosts.

Possible approaches include:
- scale maximum profile boost by semantic/core-intent relevance;
- use relative relevance to the strongest candidates as a gate;
- attenuate profile signals sharply below a thematic relevance threshold/band;
- distinguish core-intent relevance from secondary genre affinity when available.

Choose the most robust implementation based on the existing architecture rather than hardcoding thresholds or movie/shelf names solely for this benchmark.

## Acceptance criteria

- Highly relevant candidates can still be reordered meaningfully by personalization.
- Strong profile affinity cannot promote a substantially off-theme candidate above clearly stronger core-intent matches.
- On **« Aventures à travers le temps »**, genuine temporal/time-travel candidates should dominate the leading positions; generic adventure matches such as `The Hobbit: An Unexpected Journey` must not be promoted mainly by `strong adventure genre affinity`.
- Validate against at least 3 additional shelf concepts, including broader shelves where personalization should remain influential.
- Do not regress the improvements from #260/#262.
- No shelf-specific/movie-specific hardcoding.
- No manual production database modifications.
- Add regression tests demonstrating both sides: protection of precise thematic intent and preservation of useful personalization on broad shelves.
