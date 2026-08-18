# T104 — Implement hybrid recommendation reranking with profile taste, metadata and explainable scores

**Source**: GitHub Issue #207

## Description

## Context
#205 retrieves semantically relevant candidates with embeddings/vector search and #206 can produce a structured QueryPlan from natural language. Vector similarity alone is not enough for high-quality personalized recommendations.

This ticket builds the deterministic/hybrid ranking stage that combines semantic similarity with profile taste, structured metadata, availability and negative signals.

## Goal
Given a QueryPlan + top-N candidate pool, compute a stable, explainable final score and return the best results for a specific Profile.

Desired pipeline:
```text
QueryPlan
   ↓
vector retrieval top 100-500
   ↓
structured eligibility filters
   ↓
profile-aware reranking
   ↓
diversity / repetition penalties
   ↓
final top 24
```

## 1. Candidate eligibility
Apply true hard constraints before ranking where required:
- media type;
- maturity/kids restrictions;
- runtime min/max;
- release year/date;
- required/excluded genres;
- required language/availability when explicit;
- playable-now requirement when shelf semantics require it.

Do not use soft scores to sneak in items that violate explicit hard constraints.

## 2. Profile taste inputs
Reuse #201/#203 derived profile data. Candidate features should support affinity to:
- genres;
- keywords/themes;
- actors/people;
- directors/creators;
- collections/franchises;
- language/country;
- decade/year;
- movie/series/anime preference;
- runtime preference;
- completion/abandon history;
- explicit likes/dislikes;
- recent activity.

Do not require all features to exist for every item; score gracefully with coverage-aware defaults.

## 3. Score model
Implement a versioned configurable score breakdown, e.g.:
```text
finalScore =
  semanticSimilarity * wSemantic
+ profileGenreAffinity * wGenre
+ profileThemeAffinity * wTheme
+ peopleAffinity * wPeople
+ freshness * wFreshness
+ quality/popularity prior * wPrior
+ availabilityQuality * wAvailability
- alreadyWatchedPenalty
- dislikedPenalty
- recentExposurePenalty
- repetitionPenalty
```

Weights must be configuration/model-version controlled, not magic constants scattered through code.

## 4. Negative signals
Strong negative preference should matter:
- explicit dislike;
- repeated quick abandonment;
- query `avoid` terms;
- already completed very recently;
- content hidden/dismissed if relevant.

Do not permanently blacklist everything abandoned once; distinguish weak and strong negative evidence.

## 5. Explore vs exploit
Support an exploration factor so recommendations are not a filter bubble.

Provide a configurable strategy such as:
- high-confidence personalized/exploitation;
- adjacent discovery/exploration;
- broad discovery/trending.

The shelf generator can later request an exploration class, but ranking should expose the primitive now.

## 6. Diversity
Avoid returning 24 near-identical items unless the concept explicitly demands it.

Add diversity controls over:
- repeated franchise/collection;
- same director/person dominance;
- same release period;
- extremely similar embedding cluster;
- already-shown content in current Home session when supplied.

Use MMR or another documented practical strategy if useful; do not reduce relevance excessively.

## 7. Availability awareness
Prefer titles that are actually playable in household sources when shelf semantics are `watch now`.

Catalog-only discovery shelves may intentionally include unavailable/upcoming titles, so availability must be a plan/ranking option rather than globally hard-coded.

## 8. Explainable debug output
For every result in debug mode, expose score components such as:
```json
{
  "semantic": 0.91,
  "genreAffinity": 0.84,
  "themeAffinity": 0.88,
  "peopleAffinity": 0.65,
  "availability": 1.0,
  "alreadySeenPenalty": -0.2,
  "final": 0.87,
  "reasons": ["strong AI theme affinity", "liked Denis Villeneuve"]
}
```

Normal consumer API need not expose all internals.

## 9. Lab controls
Recommendation Lab should support:
- personalization ON/OFF;
- choose profile;
- vector-only vs hybrid ranking comparison;
- weight preset/model version;
- diversity ON/OFF;
- exploration level;
- result score breakdown.

## 10. Evaluation
Create repeatable tests/benchmarks comparing:
- vector-only;
- vector + hard filters;
- full personalized hybrid ranking.

Use at least two profiles with intentionally different tastes from #203 validation data so the same query can produce meaningfully different ordering.

## Acceptance criteria
- [ ] Candidate pool is reranked using profile + semantic + structured features.
- [ ] Explicit hard constraints are respected.
- [ ] Strong dislikes/negative signals reduce ranking appropriately.
- [ ] Already-watched/recently exposed content can be penalized.
- [ ] Exploration level is configurable.
- [ ] Diversity strategy prevents pathological repetition.
- [ ] Availability can be hard/soft/ignored depending on query/shelf semantics.
- [ ] Every debug result has explainable score components/model version.
- [ ] Lab compares vector-only and hybrid output.
- [ ] Two profiles can produce visibly different rankings for the same semantic query.

## Completion rule
Do not close because a scoring function exists. Demonstrate real catalog queries in the Lab where profile A and profile B rank the same candidate set differently for understandable reasons, while all explicit constraints remain satisfied.
