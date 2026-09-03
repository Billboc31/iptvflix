# T139 — Add mandatory New Releases shelves to Home, Movies and Series

**Source**: GitHub Issue #296

## Description

## Context

IPTVFlix's personalized recommendation shelves are intentionally optimized around each profile's tastes. This works well for relevance, but it creates an important product risk: the recommender can keep surfacing excellent older catalog titles and make the user miss major recent additions.

We need a freshness surface that is deliberately **less personalized** than the recommendation shelves.

This is not the same concept as `Nouveautés pour toi`:
- **Nouveautés** = genuinely recent catalog additions/releases, broad enough to expose important new content even when it falls outside the user's strongest known tastes.
- **Nouveautés pour toi** = recent content reranked strongly using the user's profile.

Both may coexist. `Nouveautés` must not disappear simply because the recommendation engine believes older content is a better taste match.

## Goal

Add a stable, prominent **Nouveautés / New Releases** shelf to:

1. Home — mixed movies + series.
2. Movies page — movie-only.
3. Series page — series-only.

The purpose is to guarantee visibility of meaningful recent content and prevent personalization from becoming a freshness bubble.

## Freshness semantics

Use the best reliable metadata available to distinguish:
- actual release/first-air recency;
- recent arrival/addition to the IPTVFlix catalog.

Prefer a sensible combination where possible: a newly added 25-year-old movie should not automatically outrank a major genuinely new release solely because its provider entry was imported yesterday.

Do not hardcode specific titles.

The freshness window should be configurable/centralized rather than scattered magic numbers. Exact ranking policy can use tiers/decay rather than a single hard cutoff if that produces better results.

## Ranking philosophy

`Nouveautés` should primarily rank by:
- recency;
- catalog availability/playability;
- basic quality/popularity/confidence signals when available;
- enough diversity to avoid one franchise/category monopolizing the shelf.

Personalization may be used only as a **light tie-breaker**, not as the dominant ranking signal.

A major recent title outside the user's established tastes should still have a realistic chance of appearing.

This shelf is explicitly different from personalized exploitation/exploration shelves.

## Page behavior

### Home

Add a mixed-media `Nouveautés` shelf containing meaningful recent movies and series.

It should be positioned high enough that users are unlikely to miss it, while preserving existing Continue Watching / critical personal surfaces where appropriate.

### Movies

Add a prominent movie-only `Nouveautés` shelf.

If `Nouveautés pour toi` already exists, keep both concepts visibly distinct and avoid returning two nearly identical rails.

### Series

Add a prominent series-only `Nouveautés` shelf using first-air/recent-series metadata appropriately.

Again, `Nouveautés` and `Nouveautés pour toi` may coexist but must not collapse into duplicate rails.

## Deduplication and cross-shelf behavior

Do not globally remove a major new title from `Nouveautés` merely because it appears in another personalized shelf. Freshness visibility is the purpose of this rail.

However:
- avoid duplicates inside the `Nouveautés` shelf;
- canonicalize multi-source media as usual;
- where practical, reduce excessive duplication with an adjacent `Nouveautés pour toi` rail without weakening the core freshness guarantee.

## Cache / cost

This shelf should be cheap and deterministic from catalog metadata.

- Do not require an LLM call to generate it.
- Do not regenerate expensive recommendation state solely for this shelf.
- Reuse normal page snapshot/cache infrastructure where appropriate.
- Newly ingested catalog content should become visible according to a reasonable cache invalidation/freshness policy.

## UX

- Use the existing horizontal shelf components.
- Title should clearly communicate `Nouveautés` in the current locale.
- Preserve movie/series cards and navigation behavior already used on each page.
- Hide cleanly only when there genuinely is insufficient recent playable content; do not replace it with unrelated old catalog filler and still label it `Nouveautés`.

## Acceptance criteria

- [ ] Home contains a prominent mixed movie+series `Nouveautés` shelf.
- [ ] Movies contains a prominent movie-only `Nouveautés` shelf.
- [ ] Series contains a prominent series-only `Nouveautés` shelf.
- [ ] `Nouveautés` is driven primarily by freshness, not the user taste profile.
- [ ] Recent important content can surface even when outside the user's strongest known preferences.
- [ ] `Nouveautés` remains conceptually distinct from `Nouveautés pour toi` when both exist.
- [ ] A recently imported old catalog title does not automatically outrank genuinely recent releases solely because of import time.
- [ ] Media-type constraints are enforced at retrieval level for Movies/Series pages.
- [ ] Multi-source/canonical duplicates do not appear multiple times within the rail.
- [ ] Shelf generation requires no LLM call.
- [ ] Existing personalized shelves, exploration policy, Home snapshots and Movies/Series snapshots do not regress.
- [ ] Add tests covering mixed Home results, movie-only/series-only constraints, release-vs-import recency, low-personalization ranking, canonical deduplication and insufficient-recent-content behavior.
- [ ] No title-specific hacks and no manual production DB changes.
