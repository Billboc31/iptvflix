## Objective

Introduce a generic, pool-relative semantic relevance factor that attenuates profile-affinity boosts in proportion to a candidate's thematic relevance within the eligible pool, so that personalization reorders within the semantically relevant set without lifting off-theme candidates above clearly stronger core-intent matches.

## Included

### `apps/recommendation-engine/src/config.ts`
- Add `PROFILE_MODULATION_POWER` constant (default `1.5`, env-overridable): exponent applied to the pool-relative semantic relevance factor. Values above 1.0 make the attenuation increasingly steep for candidates that score well below the pool leader.

### `packages/api-contracts/src/recommendations.ts` — `ScoreBreakdown`
- Add three new fields:
  - `semanticRelevanceFactor: number` — the computed pool-relative factor `(semantic / poolMaxSemantic) ^ PROFILE_MODULATION_POWER`, in `[0, 1]`
  - `profileBoostRaw: number` — weighted sum of all taste-signal contributions before modulation
  - `profileBoostEffective: number` — `profileBoostRaw * semanticRelevanceFactor`

### `apps/recommendation-engine/src/pipeline/stages/hybrid-reranker.ts` — `runHybridReranker`

**Pre-pass before `eligible.map()`** (after line 619):
```
const poolMaxSemantic = Math.max(...eligible.map(c => c.similarity ?? 0), Number.EPSILON)
```

**Inside `eligible.map()`**, split the scoring formula:
1. Compute individual affinity values as today (lines 628–638).
2. Group profile taste signals separately:
   ```
   profileBoostRaw =
     genreAffinity * weights.wGenre +
     themeAffinity * weights.wTheme +
     peopleAffinity * weights.wPeople +
     keywordAffinity * weights.wKeyword +
     franchiseAffinity * weights.wFranchise +
     languageAffinity * weights.wLanguage +
     decadeAffinity * weights.wDecade +
     mediaTypeAffinity * weights.wMediaType
   ```
3. Compute the relevance factor:
   ```
   semanticRelevanceFactor = Math.pow(semantic / poolMaxSemantic, PROFILE_MODULATION_POWER)
   ```
4. Compute effective boost:
   ```
   profileBoostEffective = profileBoostRaw * semanticRelevanceFactor
   ```
5. Reassemble `weighted`:
   ```
   weighted = semantic * weights.wSemantic
            + profileBoostEffective
            + fresh * weights.wFreshness
            + prior * weights.wPrior
            + availBonus * weights.wAvailability
   ```
   Quality/context signals (`freshness`, `prior`, `availability`) are **not** modulated — they represent merit, not taste personalization.

6. Populate the three new `ScoreBreakdown` fields.

No change to hard filters, penalties, diversity filter, or exploration-mode weight blending.

### `apps/recommendation-engine/src/pipeline/stages/__tests__/hybrid-reranker.test.ts`
New test block **"profile boost modulation"**:
- Given two candidates with identical profile affinities, the one with higher semantic similarity receives a higher effective boost.
- Given a high-affinity/low-semantic candidate and a low-affinity/high-semantic candidate, the high-semantic candidate wins (or the gap is bounded by the factor).
- `semanticRelevanceFactor` equals `1.0` for the pool leader (semantic = poolMax).
- `semanticRelevanceFactor` equals `0.0` when `semantic = 0` (edge case).
- Verify the three new `ScoreBreakdown` fields are populated correctly.

### `apps/recommendation-engine/src/pipeline/__tests__/pipeline-regression.test.ts`
Two new test blocks:

**Block T124-precision** — "Aventures à travers le temps":
- All genuine time-travel titles (`Time Trap`, `The Time Travelers`, `The Time Machine`, `Timescape: Back to the Dinosaurs`, `The Visitor from the Future`) must appear in the top-8 results.
- Broad adventure matches without strong temporal content (`The Hobbit: An Unexpected Journey`, `Journey to the Center of the Earth`) must **not** be ranked above any genuine time-travel title present in the pool.

**Block T124-personalization** — three broader shelves (e.g., `"films d'action"`, `"comédies romantiques"`, `"thrillers psychologiques"`):
- Verify that the top results still vary meaningfully when two different profile configurations are applied (personalization remains active on broad shelves where most candidates have high semantic relevance, so `semanticRelevanceFactor` is close to `1.0` across the board).
- Assert result count ≥ 5 for each shelf to confirm no unintended filtering.

---

## Excluded

- Changes to the query planner, semantic search, or anchor-blend logic (T123 territory).
- Hard semantic floors or per-shelf/per-movie thresholds.
- Modulation of quality/context signals (`freshness`, `prior`, `availability`).
- Modulation of penalty values.
- Changes to `getBlendedWeights` or exploration-mode logic.
- UI, API surface changes, or database migrations.
- Tuning `PROFILE_MODULATION_POWER` beyond providing a sensible default and env override.

---

## Acceptance criteria

- `semanticRelevanceFactor = 1.0` for the candidate with the highest semantic score in the eligible pool.
- `semanticRelevanceFactor` is strictly monotonically non-decreasing with `semantic` for a fixed pool.
- On "Aventures à travers le temps": all five benchmark time-travel titles appear before `The Hobbit: An Unexpected Journey` and `Journey to the Center of the Earth` in the T124 regression test.
- On three additional broader shelves: personalization remains demonstrably active (different profiles produce different orderings within top results).
- No regression on T117 and T123 regression test assertions.
- `ScoreBreakdown` always exposes `semanticRelevanceFactor`, `profileBoostRaw`, and `profileBoostEffective`.
- `PROFILE_MODULATION_POWER` is configurable via environment variable with default `1.5`.
- No shelf-specific or title-specific strings in production code.
- All existing unit and regression tests continue to pass.
