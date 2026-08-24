# Plan — T127: Build a true must-watch Hero ranker for Home

## Objective

Replace the current first-eligible-candidate hero selection in `hero-selector.ts` with a dedicated Hero ranking formula that evaluates a configurable pool of eligible candidates and selects the one with the strongest `heroScore`. Snapshot stability, the eligibility gate, and all other Home mechanics remain unchanged.

---

## Included

### 1. Extend `ShelfCandidateItem` with hero-relevant score components

**File:** `apps/api/src/client/recommendation-engine-client.ts`

Add two fields to the `ShelfCandidateItem` interface (defined inline in this file, lines 68–76):

```typescript
qualityPrior: number      // r.scoreBreakdown?.qualityPrior ?? 0
languageAffinity: number  // r.scoreBreakdown?.languageAffinity ?? 0
```

Update the `queryForShelf()` mapping (lines 267–275) to extract both fields from `r.scoreBreakdown`.

### 2. Add hero-ranking config constants

**File:** `apps/api/src/config/env.ts`

Add two env-backed constants near the existing hero/home block (lines 141–142):

| Constant | Env var | Default | Meaning |
|---|---|---|---|
| `HERO_POOL_SIZE` | `HERO_POOL_SIZE` | `15` | Max candidates evaluated by the hero ranker |
| `HERO_SCORE_WEIGHTS` | — | hardcoded object (versioned) | Weight object for `computeHeroScore` |

`HERO_SCORE_WEIGHTS` is a hardcoded export (not an env var) so it is versioned in code and observable in tests:

```typescript
export const HERO_SCORE_WEIGHTS = {
  version: 'v1',
  profileRelevance: 0.45,   // profileScore — primary signal
  semanticConfidence: 0.25, // semanticScore — recommendation confidence
  qualityPrior: 0.20,       // popularity × vote average — noise safeguard
  languageAffinity: 0.10,   // localization fit
} as const
```

### 3. Rewrite `hero-selector.ts` — replace first-eligible with ranked selection

**File:** `apps/api/src/services/hero-selector.ts`

#### 3a. Candidate pool cap

Before filtering eligibility, slice the input to `HERO_POOL_SIZE` candidates:

```typescript
const pool = candidates.slice(0, HERO_POOL_SIZE)
```

This bounds the DB enrichment queries and hero-ranking work.

#### 3b. Eligibility gate (preserved, no logic change)

Keep the existing two-step filter unchanged:
1. `c.available && c.finalScore >= HERO_MIN_SCORE`
2. Not in the disliked-ids set fetched from `explicitFeedback`

After enrichment (existing DB queries for movies/series/trailers), additionally reject candidates where `backdropUrl` or `title` is missing — same as today.

#### 3c. `computeHeroScore()` — new pure function

Add this function at module level (no DB access):

```typescript
function computeHeroScore(
  candidate: ShelfCandidateItem,
  weights: typeof HERO_SCORE_WEIGHTS,
): number {
  return (
    weights.profileRelevance * candidate.profileScore +
    weights.semanticConfidence * candidate.semanticScore +
    weights.qualityPrior * candidate.qualityPrior +
    weights.languageAffinity * candidate.languageAffinity
  )
}
```

The result is a scalar in [0, 1] (all inputs are normalized scores from the engine).

#### 3d. Select best candidate, not first eligible

After building `enrichMap`, iterate all non-disliked candidates that pass enrichment checks to compute their `heroScore`, then pick the maximum:

```typescript
// Build ranked list of fully eligible candidates
type RankedEntry = {
  candidate: ShelfCandidateItem
  enrichment: EnrichEntry
  heroScore: number
}

const ranked: RankedEntry[] = []
for (const candidate of nonDisliked) {
  const enrichment = enrichMap.get(candidate.mediaId)
  if (!enrichment?.title || !enrichment.backdropUrl) continue
  const heroScore = computeHeroScore(candidate, HERO_SCORE_WEIGHTS)
  ranked.push({ candidate, enrichment, heroScore })
}

if (ranked.length === 0) return null

ranked.sort((a, b) => b.heroScore - a.heroScore)
const winner = ranked[0]
```

#### 3e. Debug / observability log

Emit one structured log line after ranking (visible in server logs, not in consumer API):

```
[HERO_RANKING] profileId=<id> pool=<N> eligible=<M> winner=<mediaId>(<title>) heroScore=<x.xxx> weights=v1
  candidates: [
    { rank:1 mediaId:X title:Y heroScore:0.812 profile:0.91 semantic:0.74 quality:0.68 lang:0.95 selected:true }
    { rank:2 mediaId:A title:B heroScore:0.701 profile:0.82 semantic:0.65 quality:0.55 lang:0.90 selected:false }
    ...
  ]
```

If `ranked.length === 0`, log `[HERO_RANKING] profileId=<id> result=null reason=no_eligible_candidates`.

Return the winner as `HeroItem` (same shape as today).

### 4. Rewrite `hero-selector.test.ts` — replace and expand

**File:** `apps/api/src/services/__tests__/hero-selector.test.ts`

Keep existing test infrastructure (mock DB, `makeCandidate()` helper). Add `qualityPrior` and `languageAffinity` to `makeCandidate()` defaults (both default to `0.5`).

**Tests to add / replace:**

| # | Description |
|---|---|
| 1 | First eligible candidate is not automatically selected — candidate #3 with higher `profileScore` wins over candidate #1 |
| 2 | A later candidate (index 7 of 10) with materially stronger `heroScore` wins |
| 3 | Low `qualityPrior` candidate loses to a slightly weaker personalisation candidate with higher `qualityPrior` |
| 4 | Disliked candidate cannot win even when its `heroScore` would be highest |
| 5 | Unavailable candidate (`available: false`) is excluded before ranking |
| 6 | No-backdrop candidate is excluded from ranking |
| 7 | Foreign-language content wins when its `heroScore` is highest (no language hard-filter) |
| 8 | Empty eligible pool after filtering returns `null` |
| 9 | `computeHeroScore` unit test: verify formula with known inputs and weights |

Existing tests that cover score threshold, backdrop-missing, and empty-pool may be kept if they remain valid after refactor.

---

## Excluded

- Changes to the Home snapshot lifecycle, TTL, or stability behavior (T126/T128).
- Changes to the recommendation engine scoring pipeline (`hybrid-reranker.ts`, `SCORE_MODEL_V2`).
- Changes to the `home-pool-service.ts` rail assembly, pool filling, or `Pour toi` shelf exclusion of the hero — these remain unchanged.
- Changes to `home-service.ts`, `home-snapshot-service.ts`, or snapshot schema/migrations.
- Frontend/web changes (`HomePage.tsx`, `useHome.ts`).
- New database tables or migrations.
- Exposing `heroScore` in the consumer Home API response (`HomePageResponse`, `HeroItem`).
- Hero rotation, refresh-on-demand, or editorial overrides.
- Rewatch/unseen penalty logic (no watched-state is implemented yet).
- Changes to the `ScoreBreakdown` type in `packages/api-contracts/src/recommendations.ts`.

---

## Acceptance criteria

1. `selectHero` no longer returns the candidate at index 0 of the input when a lower-ranked candidate has a higher `heroScore` — verified by test #1 and #2.
2. `HERO_SCORE_WEIGHTS` (version `v1`) is exported from `env.ts` and references four named components: `profileRelevance`, `semanticConfidence`, `qualityPrior`, `languageAffinity`.
3. `computeHeroScore()` exists as an exported pure function, covered by a unit test with known inputs (test #9).
4. `ShelfCandidateItem` carries `qualityPrior` and `languageAffinity`; `queryForShelf()` populates them from `r.scoreBreakdown`.
5. All 9 tests listed above pass (`pnpm test hero-selector`).
6. A `[HERO_RANKING]` log line is emitted on every `selectHero()` call, containing pool size, eligible count, winner `mediaId`, and `heroScore`.
7. No snapshot-related tests regress (`home-snapshot.test.ts`, `home-pool-service.test.ts`).
8. No title-specific, country-specific, or language-hard-filter conditions in the new code.
9. TypeScript compilation (`pnpm tsc --noEmit`) passes with no new errors.
