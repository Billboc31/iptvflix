# Plan — T114: Use full ProfileTaste and interaction signals in recommendation ranking

## Objective

Wire the full persisted `ProfileTaste` payload (people, keywords, franchises, languages, countries, decades, media-type preference, explicit feedback tiers) into the standalone recommendation-engine's LLM Query Planner and hybrid reranker, so that each profile's unique interaction history materially shapes shelf planning and candidate scoring end-to-end.

## Included

### 1. `packages/api-contracts/src/taste.ts`

Extend `ProfileTaste` with two new explicit-feedback split arrays:
- `dislikedMediaIds: string[]` — mediaIds where FeedbackType is DISLIKE
- `notInterestedMediaIds: string[]` — mediaIds where FeedbackType is NOT_INTERESTED
(Keep `negativeMediaIds` as their union for backwards compatibility with any callers not yet updated.)

### 2. `apps/api/src/services/profile-taste-service.ts`

In `buildTaste()`, separate DISLIKE entries from NOT_INTERESTED entries when populating `negativeSet` and write them into the two new arrays. Upsert both new columns.

### 3. `apps/api/src/db/schema/profile-taste.ts`

Add two new JSONB columns: `dislikedMediaIds` (text array, default `[]`) and `notInterestedMediaIds` (text array, default `[]`).
Add a Drizzle migration for the new columns.

### 4. `packages/api-contracts/src/query-plan.ts`

Extend `CompactTasteContext` with:
```typescript
topKeywords: string[]      // top-5 keywordScores keys
topFranchises: string[]    // top-3 franchiseScores keys
topLanguages: string[]     // top-3 languageScores keys
topDecades: string[]       // top-2 decadeScores keys (e.g. "2010s")
mediaTypePreference: 'movie' | 'series' | null
```
`likedPeople: string[]` is already declared; it must now be populated.

### 5. `apps/recommendation-engine/src/pipeline/stages/llm-planner.ts`

Extend the DB select in `buildCompactContext()` to load all new ProfileTaste columns:
`personScores`, `personMeta`, `keywordScores`, `franchiseScores`, `languageScores`, `decadeScores`, `mediaTypePreferences`.

Populate the new `CompactTasteContext` fields:
- `likedPeople`: top-5 entries from `personScores` (by score descending), names resolved via `personMeta`.
- `topKeywords`: top-5 keys from `keywordScores`.
- `topFranchises`: top-3 keys from `franchiseScores`.
- `topLanguages`: top-3 keys from `languageScores`.
- `topDecades`: top-2 keys from `decadeScores`.
- `mediaTypePreference`: whichever of `mediaTypePreferences['movie']` vs `['series']` is higher, or `null` if tied/absent.

### 6. `apps/recommendation-engine/src/prompts/query-planner-v1.ts`

Update the system prompt to reference the new context fields:
- Instruct LLM to consider `likedPeople` (actors/directors the user enjoys) when constructing `softPreferences.preferredDirectors` and thematic intents.
- Mention `topKeywords` / `topFranchises` as personalization hints.
- Reference `topLanguages` as a hint for `hardFilters.audioLanguages` only when the query clearly requests a language.
- Do not treat any of these as hard constraints unless the user's query explicitly demands it.

### 7. `apps/recommendation-engine/src/pipeline/stages/hybrid-reranker.ts`

#### 7a. Add `SCORE_MODEL_V2`

```typescript
export const SCORE_MODEL_V2 = {
  version: 'v2',
  wSemantic: 0.28,
  wGenre: 0.18,
  wTheme: 0.10,
  wPeople: 0.08,
  wKeyword: 0.10,
  wFranchise: 0.05,
  wLanguage: 0.05,
  wDecade: 0.04,
  wMediaType: 0.04,
  wFreshness: 0.03,
  wPrior: 0.10,
  wAvailability: 0.05,
} as const
```

`SCORE_MODEL_V2` becomes the default. `SCORE_MODEL_V1` stays defined but is no longer the active default. Update `WeightSet` interface and `getBlendedWeights()` to include the new weight keys; blended weight overrides follow the same pattern as existing keys.

#### 7b. Extend `TasteSignals` DB query

Load these additional fields from `profileTaste`:
`personScores`, `keywordScores`, `franchiseScores`, `languageScores`, `countryScores`, `decadeScores`, `mediaTypePreferences`, `dislikedMediaIds`, `notInterestedMediaIds`.

#### 7c. Fix `computePeopleAffinity()`

Replace the current implementation (which checks `softPreferences.preferredDirectors`, which is always empty from the planner) with a direct look-up against `tasteSignals.personScores`:
- For each credit on the candidate, look up the person's score in `personScores`.
- Return a normalized value in [0, 1] based on the top matched score (max-clip at a calibration constant).
- Fall back to 0.5 (neutral) when no overlap.

#### 7d. Add new affinity functions

- `computeKeywordAffinity(candidate, keywordScores)`: intersection of candidate keywords vs. profile keywordScores keys with positive scores; normalized to [0, 1].
- `computeFranchiseAffinity(candidate, franchiseScores)`: if candidate.collectionId is in franchiseScores with a positive score, return normalized score; else 0.5.
- `computeLanguageAffinity(candidate, languageScores, countryScores)`: match candidate originalLanguage against languageScores; match production countries against countryScores; average of both.
- `computeDecadeAffinity(candidate, decadeScores)`: derive decade from candidate releaseYear; look up in decadeScores; normalize to [0, 1]; return 0.5 if decade absent.
- `computeMediaTypeAffinity(candidate, mediaTypePreferences)`: compare candidate.mediaType against the dominant preference; return score in [0.3, 1.0].

#### 7e. Tiered negative-feedback penalties

Replace the single disliked penalty block with two tiers:
- `dislikedMediaIds` hit → penalty **−2.0** (DISLIKE, strongest explicit rejection)
- `notInterestedMediaIds` hit → penalty **−1.2** (NOT_INTERESTED, weaker explicit rejection)
- Exposure repetition stays at **−0.05 × min(n, 4)** (max −0.2), clearly weaker than any explicit signal.
- Partial-watch penalty (abandoned <20%): keep at **−0.1** (behavioural, weakest).

#### 7f. Score assembly

Incorporate new dimensions into the final score computation:
```
finalScore = w.semantic * semantic
           + w.genre * genreAffinity
           + w.theme * themeAffinity
           + w.people * peopleAffinity
           + w.keyword * keywordAffinity
           + w.franchise * franchiseAffinity
           + w.language * languageAffinity
           + w.decade * decadeAffinity
           + w.mediaType * mediaTypeAffinity
           + w.freshness * freshness
           + w.prior * qualityPrior
           + w.availability * availabilityBonus
           + penalties
```

### 8. `packages/api-contracts/src/recommendations.ts`

Extend `ScoreBreakdown` with:
```typescript
keywordAffinity: number
franchiseAffinity: number
languageAffinity: number
decadeAffinity: number
mediaTypeAffinity: number
```
These fields are always populated (non-debug mode included) so that API consumers can inspect them.

### 9. `runs/T114/interaction-audit.md`

New artifact documenting every user-facing action, the canonical event/state persisted, and whether it feeds taste/ranking. At minimum covers the 13 actions listed in the ticket. Classify each as: feeds taste positively / feeds taste negatively / recorded but does not feed taste / not yet recorded.

### 10. Tests

- `apps/recommendation-engine/src/pipeline/stages/__tests__/hybrid-reranker.test.ts`: unit tests for each new affinity function with mock inputs (happy path + no-overlap fallback = 0.5).
- `apps/recommendation-engine/src/__tests__/ranking-divergence.integration.ts` (new): seed two profiles with distinct interaction histories, run the same semantic query through `runPipeline()`, assert that ranking order differs materially (top-3 must not be identical) and that `scoreBreakdown` attributes the difference to at least one new signal dimension.

## Excluded

- Changing how `buildTaste()` is triggered (trigger strategy is out of scope for T114).
- Modifying the text-search or semantic-search stages; this ticket covers only LLM planner context and hybrid reranking.
- Account-level (cross-profile) aggregated taste — per-profile isolation is preserved unchanged.
- Adding real-time event streaming to taste updates (incremental taste rebuilds are a separate ticket).
- Changing the recommendation API response contract beyond `ScoreBreakdown` (no new top-level fields).
- Tuning or backfilling the `SCORE_MODEL_V2` weights beyond an initial calibrated set — weight optimization is a separate concern.
- Maturity/kids restriction enforcement in `passesHardFilters()` (already noted as TODO, not part of this ticket).
- The deprecated `/apps/api/src/services/llm-query-planner-service.ts` — it is not the live path and must not be modified here.

## Acceptance criteria

1. **Full ProfileTaste loaded by engine**: the DB query in `buildCompactContext()` selects all new columns; `likedPeople` is non-empty for a profile that has liked/completed media involving named credits.
2. **LLM planner receives rich context**: a debug log of `CompactTasteContext` for a profile with varied history shows non-empty `likedPeople`, `topKeywords`, `topLanguages`, and `topDecades`.
3. **New score dimensions present in breakdown**: every recommendation response includes non-zero values for `keywordAffinity`, `franchiseAffinity`, `languageAffinity`, `decadeAffinity`, `mediaTypeAffinity` when the candidate has matching metadata.
4. **Explicit dislikes suppress results**: a title in `dislikedMediaIds` receives a penalty ≤ −2.0 in its `ScoreBreakdown` and does not appear in the top-20 results; a `notInterestedMediaIds` title receives ≤ −1.2.
5. **Profile divergence demonstrated**: two seeded profiles with distinct histories (e.g. one skewing horror + French + 1980s, the other skewing comedy + English + 2010s) produce a materially different top-5 for the same generic query (e.g. "something thrilling"); the `scoreBreakdown` shows the divergence originates from at least one new dimension (language, decade, genre, or people).
6. **Episode → series aggregation unchanged**: a profile that watched only episodes still produces a non-empty `genreScores` and `personScores` attributed to the parent series; no regression in episode resolution path.
7. **`SCORE_MODEL_V2` is the active default**: `runHybridReranker()` uses `SCORE_MODEL_V2`; responses include `modelVersion: 'v2'` in `ScoreBreakdown`.
8. **No profile data leakage**: integration test verifies that taste loaded for profile A is not influenced by profile B's interactions.
9. **Interaction audit exists**: `runs/T114/interaction-audit.md` covers all 13 required action types with explicit classification (positive taste / negative taste / recorded only / gap).
10. **Unit tests pass**: `hybrid-reranker.test.ts` covers all five new affinity functions.
