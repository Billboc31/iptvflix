# T122 — Bound profile boosts by semantic relevance in thematic reranking

## Objective

Modulate profile boost contributions in thematic shelf reranking by each candidate's relative semantic relevance within the pool, so that a candidate with weak semantic relevance cannot be rescued to a top position solely by genre/language/era affinities. Personalization remains fully active between candidates of comparable semantic relevance.

---

## Included

### Root cause

`hybrid-reranker.ts:669` — the T121 semantic floor (`SEMANTIC_FLOOR_STRICT = 0.40`) is a binary hard gate: candidates below the threshold are dropped before scoring. Within the passing pool (observed range 41–47 % on "Aventures à travers le temps"), profile boosts are applied uniformly regardless of each candidate's relative position in the semantic distribution. The semantic contribution spread across the pool is only `(0.47 - 0.41) × 0.40 ≈ 0.024`, while a single genre+language affinity combination can contribute `0.18 + 0.05 = 0.23` — an order of magnitude larger than the within-pool semantic delta. This is why `The Hobbit` (semantic ≈ 0.42) can outrank `The Time Machine` (semantic ≈ 0.46) in the final personalized list.

---

### 1. New config constants — `apps/recommendation-engine/src/config.ts`

Add after the existing `SEMANTIC_WEIGHT_THEMATIC` line:

```typescript
// Profile boost modulation for thematic reranking (T122).
// Factor applied to raw profile boost: factor = minFactor + (1 - minFactor) × normalizedSemantic^power
// At normalizedSemantic=0 (pool bottom): factor = minFactor (profile boost attenuated but not zeroed)
// At normalizedSemantic=1 (pool top): factor = 1.0 (full profile boost)
export const PROFILE_BOOST_MIN_FACTOR = Number(process.env.PROFILE_BOOST_MIN_FACTOR ?? 0.15)
export const PROFILE_BOOST_MODULATION_POWER = Number(process.env.PROFILE_BOOST_MODULATION_POWER ?? 1.5)
```

These two constants, together with `SEMANTIC_WEIGHT_THEMATIC` and `SEMANTIC_FLOOR_STRICT / SEMANTIC_FLOOR_MODERATE`, form the complete tunable surface for thematic scoring.

---

### 2. New pure function `computeSemanticConfidenceFactor` — `hybrid-reranker.ts`

Add a new exported function (near the existing `passesSemanticFloor`):

```typescript
export function computeSemanticConfidenceFactor(
  similarity: number,
  poolMin: number,
  poolMax: number,
  minFactor: number,
  power: number,
): number {
  const range = poolMax - poolMin
  const normalizedRelevance = range > 0 ? (similarity - poolMin) / range : 1.0
  return minFactor + (1 - minFactor) * Math.pow(Math.max(0, Math.min(1, normalizedRelevance)), power)
}
```

- Monotone: higher similarity → higher factor (never violated).
- No absolute threshold: operates entirely on pool-relative position.
- Degeneracy guard: if all candidates have the same similarity (`range === 0`), factor = 1.0 (personalization unrestricted, correct for uniform pools like broad action shelves).
- Bounded: always in `[minFactor, 1.0]`.

---

### 3. Compute pool semantic stats before the scoring loop — `hybrid-reranker.ts:668–670`

After `eligible` is computed and before `eligible.map(...)`, add:

```typescript
// Semantic confidence modulation: compute pool boundaries once.
const poolSimilarities = eligible.map((c) => c.similarity ?? 0)
const poolSemanticMin = Math.min(...poolSimilarities)
const poolSemanticMax = Math.max(...poolSimilarities)
```

---

### 4. Apply modulation inside the scoring loop — `hybrid-reranker.ts:697–711`

The modulation applies only when `blendLevel === 'thematic'` (i.e., when `semanticProtection` is `'strict'` or `'moderate'`). For `'exploit'` and `'discover'` blend levels, `semanticConfidenceFactor` is 1.0 (no change to existing behaviour).

Replace the current linear computation of `weighted` and `finalScore` with:

```typescript
// Profile-dependent contributions (candidate taste signal — modulatable)
const profileBoostRaw =
  genreAffinity * weights.wGenre +
  themeAffinity * weights.wTheme +
  peopleAffinity * weights.wPeople +
  keywordAffinity * weights.wKeyword +
  franchiseAffinity * weights.wFranchise +
  languageAffinity * weights.wLanguage +
  decadeAffinity * weights.wDecade +
  mediaTypeAffinity * weights.wMediaType

// Quality/context contributions (not profile-dependent — not modulatable)
const qualityContrib = fresh * weights.wFreshness + prior * weights.wPrior + availBonus * weights.wAvailability

const semanticContribution = semantic * weights.wSemantic

const semanticConfidenceFactor =
  blendLevel === 'thematic'
    ? computeSemanticConfidenceFactor(
        semantic,
        poolSemanticMin,
        poolSemanticMax,
        PROFILE_BOOST_MIN_FACTOR,
        PROFILE_BOOST_MODULATION_POWER,
      )
    : 1.0

const profileBoostEffective = profileBoostRaw * semanticConfidenceFactor

const weighted = semanticContribution + profileBoostEffective + qualityContrib

const finalScore = weighted - alreadyWatchedPenalty - abandonPenalty - dislikedPenalty - avoidPenalty - repetitionPenalty
```

**What is NOT modulated**: `wFreshness`, `wPrior`, `wAvailability` — these reflect catalogue facts, not user taste. Modulating them would penalise recent or high-quality content for reasons unrelated to relevance.

---

### 5. Compute per-candidate pool stats for breakdown — `hybrid-reranker.ts` (after sort)

After the sort, assign `rawVectorRank` (position in `eligible` before scoring) and `finalRank` (position in sorted results). The eligible array order corresponds to the retrieval order from the semantic vector index.

```typescript
// Build raw-vector rank map before sort
const rawRankById = new Map(eligible.map((c, i) => [c.id, i + 1]))
// After sort, annotate each scored item with rank delta
const poolSize = scored.length
const semanticPercentileById = new Map(
  [...poolSimilarities]
    .map((s, i) => [eligible[i].id, s] as [string, number])
    .sort(([, a], [, b]) => a - b)
    .map(([id], rank) => [id, (rank + 1) / poolSize]),
)
// After sort, add finalRank to each result's scoreBreakdown
```

---

### 6. Extend `ScoreBreakdown` type — `packages/api-contracts/src/recommendations.ts:5–34`

Add the following fields to the `ScoreBreakdown` interface:

```typescript
semanticRelevanceNormalized: number    // (similarity - poolMin) / (poolMax - poolMin), in [0,1]
semanticConfidenceFactor: number       // modulation factor in [minFactor, 1.0]
profileBoostRaw: number                // sum of profile contributions before modulation
profileBoostEffective: number          // profileBoostRaw × semanticConfidenceFactor
semanticPercentile: number             // rank of this candidate's similarity in pool, in (0,1]
rawVectorRank: number | null           // position in retrieval before reranking
finalRank: number | null               // position in final sorted output
rankDelta: number | null               // finalRank - rawVectorRank (negative = moved up)
```

---

### 7. Populate new breakdown fields — `hybrid-reranker.ts:729–758`

Update `breakdown` assembly block to include all new fields. The `rawVectorRank` is populated from `rawRankById`, `finalRank` is populated after sort, `rankDelta = finalRank - rawVectorRank`.

Because `scored.map()` runs before sort, `finalRank` and `rankDelta` must be patched in after sorting. Add a post-sort loop:

```typescript
scored.sort(...)
scored.forEach((item, idx) => {
  if (item.scoreBreakdown) {
    item.scoreBreakdown.finalRank = idx + 1
    const rawRank = item.scoreBreakdown.rawVectorRank
    item.scoreBreakdown.rankDelta = rawRank != null ? (idx + 1) - rawRank : null
  }
})
```

Flag candidates with large upward delta + low semantic percentile in `reasons` (e.g. `"⚠ large upward rank delta with weak semantic percentile"`).

---

### 8. Unit tests — `hybrid-reranker.test.ts`

Add a new describe block `T122 — semanticConfidenceFactor modulation`:

- `computeSemanticConfidenceFactor` at pool bottom → `PROFILE_BOOST_MIN_FACTOR`.
- `computeSemanticConfidenceFactor` at pool top → `1.0`.
- Factor is strictly monotone (pool-bottom < mid < pool-top).
- Uniform pool (all same similarity) → factor = 1.0.
- Profile boost for low-semantic candidate is strictly lower than for high-semantic candidate in same pool.
- `blendLevel !== 'thematic'` → factor = 1.0 (no modulation).

---

### 9. Regression tests — `pipeline-regression.test.ts`

Update the existing `"Aventures à travers le temps"` test (line 47) to assert:

- At least 4 of the top 8 results have a title containing a time-related keyword from the known pool (`Time`, `Chrono`, `Visitor`, `Timescape`, `Lapse`, `House of Time`).
- `The Hobbit: An Unexpected Journey` does not appear in top 5.
- `profileBoostEffective < profileBoostRaw` for at least 3 candidates in the final result (modulation is active).

Add two new `it.skipIf(!canRun)` test cases:

- `"SF qui fait réfléchir"` — semantically dominant results (high `semanticConfidenceFactor`) are not displaced by a known popular blockbuster with weak thematic alignment.
- `"film qui retourne le cerveau"` — same pattern.

---

## Excluded

- Changes to the semantic retrieval stage (vector similarity search, embedding, retrieval limit).
- Changes to the semantic floor thresholds (`SEMANTIC_FLOOR_STRICT`, `SEMANTIC_FLOOR_MODERATE`).
- Modulation of `wFreshness`, `wPrior`, `wAvailability`.
- Modulation for `exploit` or `discover` blend levels (only `thematic` is affected).
- Any change to the LLM planner, QueryPlan schema, or shelf concept generation.
- Lab UI frontend changes beyond the data the API already returns (the Lab reads `scoreBreakdown` from the API; new fields are immediately visible with no frontend change required).
- Performance optimisation of the scoring loop.
- Any change to diversity filtering or the post-sort deduplication logic.

---

## Acceptance criteria

- [ ] `computeSemanticConfidenceFactor` is exported and pure; all unit tests pass.
- [ ] For `blendLevel === 'thematic'`, `profileBoostEffective = profileBoostRaw × factor` is used in `finalScore`; for other blend levels the formula is unchanged.
- [ ] `factor` is strictly monotone with respect to within-pool semantic rank (lower similarity → lower factor, provable from the formula).
- [ ] No absolute similarity threshold is hardcoded (`SEMANTIC_FLOOR_STRICT`/`SEMANTIC_FLOOR_MODERATE` remain the only thresholds; the new constants are relative scalars).
- [ ] `ScoreBreakdown` exposes: `semanticRelevanceNormalized`, `semanticConfidenceFactor`, `profileBoostRaw`, `profileBoostEffective`, `semanticPercentile`, `rawVectorRank`, `finalRank`, `rankDelta`.
- [ ] Regression test "Aventures à travers le temps": at least 4 of top 8 are temporal titles; `The Hobbit` is not in top 5.
- [ ] `profileBoostEffective < profileBoostRaw` for the lowest-semantic candidates in the "Aventures à travers le temps" pool (modulation is active in practice, not just in theory).
- [ ] On a broad action/aventure shelf (uniform-relevance pool), `factor ≈ 1.0` for all candidates; personalization is unrestricted.
- [ ] Regression tests "SF qui fait réfléchir" and "film qui retourne le cerveau" pass.
- [ ] `PROFILE_BOOST_MIN_FACTOR` and `PROFILE_BOOST_MODULATION_POWER` are env-overridable; no magic numbers in scoring logic.
- [ ] All existing unit and regression tests pass unmodified.
- [ ] Recommendation Lab displays breakdown with new fields for each result (validated visually in the Lab on the real "Aventures à travers le temps" case).
