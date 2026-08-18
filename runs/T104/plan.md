# T104 — Hybrid Recommendation Reranking

## Objective

Build a hybrid reranking layer that combines semantic similarity scores (from T102 vector retrieval) with profile taste signals, structured QueryPlan hard filters, diversity controls, and availability policy into a single versioned, explainable score — so that different profiles produce visibly different orderings for the same semantic query while all explicit constraints remain satisfied.

## Included

### 1. Hybrid score model — `apps/api/src/services/recommendation-ranking-service.ts`

Replace the current simple genre-affinity loop with a versioned `HybridScoreModel`:

```
finalScore =
  semanticSimilarity   * wSemantic
  + genreAffinity      * wGenre
  + themeAffinity      * wTheme
  + peopleAffinity     * wPeople
  + freshness          * wFreshness
  + qualityPrior       * wPrior
  + availabilityBonus  * wAvailability
  - alreadyWatchedPenalty
  - dislikedPenalty
  - repetitionPenalty
```

- Extract all weight constants to a `SCORE_MODEL_V1` typed object; no magic scalars in scoring logic.
- Export a `rankHybrid(candidates, queryPlan, profileTaste, opts)` function that accepts `SemanticCandidate[]` (with `similarity` field from `semantic-retrieval-service`) as the candidate pool.
- Keep the existing `rankRecommendations` signature for backwards compatibility; wire it through `rankHybrid` with `similarity = 0` when no vector scores are available.

### 2. Eligibility hard-filter pass

Apply QueryPlan hard constraints before scoring (no soft-score bypass):

- `mediaTypes` — exclude candidates of wrong type.
- `hardFilters.maxRuntimeMinutes`, `minReleaseYear`, `maxReleaseYear`.
- `hardFilters.includeGenres` / `excludeGenres`.
- `hardFilters.audioLanguages`.
- Profile maturity restriction (from `profilePreferences.kidsMode` / `maxCertification`).
- `WATCH_NOW` availability: hard filter on `availableToMe` flag when `availabilityPolicy === "WATCH_NOW"`.

### 3. Profile taste signals

- **Genre affinity**: `genreScores[genreId]` from `ProfileTaste`, normalized 0–1.
- **Theme affinity**: keyword overlap between `queryPlan.desiredThemes` / `desiredTone` and genres/keywords already in the embedding document; coverage-aware default `0.5` when metadata absent.
- **People affinity**: match `queryPlan.softPreferences.preferredDirectors` and any director/cast info from candidate metadata against `positiveMediaIds`; default `0.5` on missing data.
- **Watched penalty**: completion ratio ≥ 0.9 (recent) → `alreadyWatchedPenalty`. Quick-abandon ratio < 0.2 → weaker separate penalty (do not conflate with dislike).
- **Dislike penalty**: `negativeMediaIds` membership → `dislikedPenalty` (large negative, not zero).
- **Avoid-signal penalty**: `queryPlan.avoidSignals` keyword match against candidate genres/themes → theme penalty.

### 4. Diversity post-processing

After initial scoring, apply MMR-style re-ranking:

- Cap same `collectionId` / franchise at `maxPerCollection` (default 2).
- Cap same primary director at `maxPerDirector` (default 3).
- Optionally penalise candidates in the same embedding-cluster quadrant when multiple near-identical similarity scores exist.
- Accept optional `alreadyShownIds: string[]` to penalise content already surfaced in the current Home session.
- `diversityEnabled` flag in `RankingOptions`; defaults `true`.

### 5. Exploration level

Add `explorationLevel: "exploit" | "explore" | "discover"` to `RankingOptions`:

- `exploit` — full personalization weights (default).
- `explore` — reduce `wGenre`/`wTheme` by 50 %, increase `wPrior` and `wSemantic`.
- `discover` — semantic similarity primary, personalization weights near-zero, `wPrior` elevated.

Weight blending is done at call-time using the `SCORE_MODEL_V1` base values; no separate weight objects needed.

### 6. Explainable debug output

New `ScoreBreakdown` type in `packages/api-contracts/src/recommendations.ts`:

```ts
interface ScoreBreakdown {
  modelVersion: string
  semantic: number
  genreAffinity: number
  themeAffinity: number
  peopleAffinity: number
  qualityPrior: number
  freshness: number
  availabilityBonus: number
  alreadyWatchedPenalty: number
  dislikedPenalty: number
  repetitionPenalty: number
  final: number
  reasons: string[]
}
```

- Append optional `scoreBreakdown?: ScoreBreakdown` to `RecommendationCandidate` (only populated when `debug: true` in options).
- `reasons`: at least one human-readable string per non-zero component (e.g. `"strong sci-fi genre affinity"`, `"liked Denis Villeneuve films"`, `"already watched recently"`).
- `modelVersion` must equal the key of the active `SCORE_MODEL_*` constant.

### 7. Recommendation Lab enhancements — `apps/api/src/routes/recommendation-lab.ts`

Extend existing `POST /recommendation-lab/semantic-query` with new optional fields:

**Request additions**:
- `useHybridRanking?: boolean`
- `profileId?: string`
- `compareProfileId?: string`
- `explorationLevel?: "exploit" | "explore" | "discover"`
- `diversityEnabled?: boolean`
- `modelVersion?: string`
- `debug?: boolean`

**Response additions**:
- `hybridResults?: RecommendationCandidate[]` — same candidates re-ranked with hybrid model (when `useHybridRanking=true`).
- `compareProfileHybridResults?: RecommendationCandidate[]` — rankings for `compareProfileId` (when both profile params supplied).
- `scoreModel?: object` — active weight preset, exposed when `debug=true`.

The existing `results` field (vector-only) is preserved; hybrid and vector results appear side-by-side.

### 8. API contract updates — `packages/api-contracts/src/`

- `recommendations.ts`: add `ScoreBreakdown` interface; extend `RecommendationCandidate` with `scoreBreakdown?: ScoreBreakdown`.
- `recommendation-lab.ts` (or equivalent lab types file): add new request/response fields listed above.

### 9. Tests — `apps/api/src/services/__tests__/`

**Extend `recommendation-ranking-service.test.ts`**:
- Profile A (action/thriller genre scores high) vs. Profile B (family drama genre scores high): same 20-candidate pool + same query → top-5 overlap ≤ 3.
- Item violating `hardFilters.maxRuntimeMinutes` must be absent from output regardless of semantic score.
- `negativeMediaIds` item never appears in top-10 when 10+ alternatives exist.
- Franchise cap: franchise with 5 candidates → at most 2 appear in final output.
- `explorationLevel: "discover"` promotes a candidate with high `qualityPrior` but low taste affinity above a taste-aligned but obscure item.
- `debug: true` populates `scoreBreakdown.reasons` with at least one entry per result.

**New file `recommendation-ranking-benchmark.test.ts`**:
- Fixed mock candidate set (20 items), fixed similarity scores, fixed taste objects → deterministic comparison of vector-only vs. hybrid vs. hybrid-with-diversity outputs.
- Asserts ordering differences are meaningful (not accidental), and that all three pipelines respect hard filters identically.

## Excluded

- Persisting score model weights to the database or `app_config` table (weights live in versioned code constants for now).
- Real-time weight tuning, online A/B testing, or offline evaluation harness beyond the benchmark test.
- Frontend shelf display changes.
- Full cast/credits database join for people affinity (use metadata already present in embedding documents; deep credits join is a separate ticket).
- Rewriting `profile-taste-service.ts` or the interaction-event pipeline (used as-is).
- Changes to the embedding pipeline (T102) or LLM query planner prompt (T103).
- Production observability/metrics for ranking quality.
- Persisting debug score breakdowns to any storage layer.

## Acceptance criteria

- `rankHybrid(candidates, queryPlan, profileTaste, opts)` is exported from `recommendation-ranking-service.ts` and accepts `SemanticCandidate[]` carrying similarity scores.
- Every candidate that violates a QueryPlan hard filter is absent from ranked output regardless of its semantic similarity score.
- A `negativeMediaIds` item never appears in the top-10 when 10 or more alternatives are available (verified by unit test).
- `ScoreBreakdown.reasons` contains at least one string per result when `debug: true`.
- `ScoreBreakdown.modelVersion` matches the key of the active score model constant.
- Lab endpoint returns both `results` (vector-only) and `hybridResults` (hybrid) when `useHybridRanking: true`.
- Lab endpoint returns `compareProfileHybridResults` for a second profile when `compareProfileId` is supplied.
- Benchmark test confirms Profile A and Profile B top-5 overlap ≤ 3 on the same 20-candidate pool for the same query.
- No franchise appears more than twice in a 24-item final output when `diversityEnabled: true`.
- All pre-existing ranking tests pass without modification.
- `vitest run` exits 0 with new tests included.
