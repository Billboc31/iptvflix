# T041 — Deterministic personalized recommendation ranking

## Objective

Implement a backend ranking service that scores canonical local Media and external discovery candidates for a given profile using the existing taste model, and expose the results through a new REST endpoint with per-candidate reason signals.

## Included

### New file — `packages/api-contracts/src/recommendations.ts`

Public contract types shared across apps:

```typescript
export type RecommendationSource = 'LOCAL' | 'DISCOVERY'

export type RecommendationCandidate = {
  mediaType: 'MOVIE' | 'SERIES'
  mediaId: string           // canonical id, or discovery candidate id if not yet materialized
  title: string
  year: number | null
  posterPath: string | null
  score: number             // deterministic float; higher is better
  reasons: string[]         // e.g. ["Action", "Thriller"] | ["popular pick"] | ["liked"]
  source: RecommendationSource
  available: boolean        // true if a current AVAILABLE variant exists
}

export type RecommendationsResponse = {
  profileId: string
  coldStart: boolean        // true when profile taste signalCount === 0
  candidates: RecommendationCandidate[]
}
```

Modify `packages/api-contracts/src/index.ts`: add `export * from './recommendations.js'`.

---

### New file — `apps/api/src/services/recommendation-ranking-service.ts`

**Function signature:**

```typescript
export async function rankRecommendations(
  profileId: string,
  opts: {
    mediaType?: 'MOVIE' | 'SERIES'
    availableToMe?: boolean   // default false
    includeSeen?: boolean     // default false
    limit?: number            // default 20, max 100
  }
): Promise<RecommendationsResponse>
```

**Candidate collection:**

1. Canonical local candidates: query `movies` (with `movieGenres → genres`) and `series` (with `seriesGenres → genres`), filtered by `mediaType` if provided. Each carries its genre ids.
2. Discovery candidates: query `discovery_candidates` where `expiresAt > NOW()`, filtered by `mediaType` if provided. If `canonicalMovieId` / `canonicalSeriesId` is set, use the linked canonical record's genres for scoring; otherwise the candidate carries no genre data.
3. Deduplicate: if a discovery candidate links to a canonical record already in the local set, keep the canonical record only (prefer enriched data).

**Exclusion (hard — before scoring):**

- Remove any candidate whose canonical `mediaId` is in `taste.negativeMediaIds` (covers DISLIKE and NOT_INTERESTED signals).

**Seen-content suppression:**

Rule (documented and deterministic):
- **Movie**: look up `viewingProgress` where `mediaType = 'MOVIE'` and `progressSeconds / durationSeconds >= 0.9`. These are "completed". Unless `includeSeen = true`, apply a fixed score penalty of `-10` (does not hard-exclude; ensures completed movies sink below unstarted content but remain rankable if explicitly requested).
- **Series**: no series-level completion signal is tracked at this layer. Series are neither suppressed nor penalised for seen content (document this explicitly). Suppression only applies via `negativeMediaIds`.

**Scoring (warm profile — `signalCount > 0`):**

For each candidate:
```
genreAffinity = sum of taste.genreScores[g].score for each genre g the media belongs to
positiveBonus  = (mediaId in taste.positiveMediaIds) ? 5.0 : 0
seenPenalty    = (movie is completed && !includeSeen) ? -10.0 : 0
score          = genreAffinity + positiveBonus + seenPenalty
```

Reasons field:
- Genres whose slug is in `genreScores` and score > 0 and the media belongs to → include genre name.
- If `mediaId` in `positiveMediaIds` → prepend `"liked"`.
- If reasons is empty (no matching genre) → `["discovery"]`.

**Cold-start fallback (`signalCount === 0`):**

- Skip genre scoring entirely.
- Score = `(popularity ?? 0) * (voteAverage ?? 0)` from the discovery candidate row; for canonical-only records (no discovery row), score = `0`.
- Reasons: `["popular pick"]` for all candidates.
- `coldStart: true` in response.

**Availability flag:**

- For each candidate, set `available = true` if a row exists in `movieAvailabilities` / `seriesAvailabilities` with matching id and `status = 'AVAILABLE'`.
- If `availableToMe = true`, filter out all candidates where `available = false` after scoring.

**Final ordering (deterministic):**

```
ORDER BY score DESC, mediaId ASC
```

`mediaId ASC` is the stable UUID tiebreaker — identical score/snapshot always produces the same order.

Apply `limit` (clamped to 100) after ordering.

---

### New file — `apps/api/src/routes/recommendations.ts`

Fastify plugin exposing:

```
GET /profiles/:profileId/recommendations
```

Query parameters (all optional):
| param | type | default |
|---|---|---|
| `mediaType` | `'MOVIE' \| 'SERIES'` | both |
| `availableToMe` | boolean | false |
| `includeSeen` | boolean | false |
| `limit` | integer 1–100 | 20 |

Returns `200 RecommendationsResponse` or `404` if profile does not exist.

Error mapping:
- `NotFoundError` (profile missing) → 404
- Invalid query params → 400

---

### New file — `apps/api/src/services/__tests__/recommendation-ranking-service.test.ts`

Unit tests (vitest, DB mocked via `vi.hoisted`). Required scenarios:

| # | Scenario | Verifies |
|---|---|---|
| 1 | Positive genre affinity | Candidate with matching liked genre scores higher than unrelated one |
| 2 | Negative feedback exclusion | Media in `negativeMediaIds` absent from results |
| 3 | `availableToMe = true` | Only candidates with `status = 'AVAILABLE'` returned |
| 4 | Seen-content suppression (movie ≥ 90 %) | Completed movie ranks below unseen; present when `includeSeen = true` |
| 5 | Local + discovery mix | Discovery candidate (no canonical link) appears; dedup removes duplicate when canonical link exists |
| 6 | Cold-start | `signalCount = 0` → sorted by popularity×voteAverage; `coldStart: true`; reasons = `["popular pick"]` |
| 7 | Determinism | Same inputs called twice return identical ordering |
| 8 | `positiveMediaIds` bonus | Explicitly liked media ranks at top |
| 9 | mediaType filter | `mediaType = 'MOVIE'` returns no series candidates |

---

### Modified — `apps/api/src/index.ts`

Register `recommendationRoutes` plugin alongside existing route registrations.

---

## Excluded

- Collaborative filtering across profiles or households.
- LLM-based ranking or natural-language explanation generation.
- Persisting ranked results or caching recommendations in a dedicated table.
- Series seen-content suppression (no per-series completion signal exists; deferred).
- Materializing unmaterialized discovery candidates (that is `discovery-candidate-pool-service` responsibility).
- Pagination beyond `limit` (cursor/offset pagination is a follow-up).
- Natural-language shelf creation.

## Acceptance criteria

- `GET /profiles/:profileId/recommendations` returns `200` with an ordered `candidates` array and a `coldStart` boolean.
- When `availableToMe=true`, every candidate in the response has `available: true`.
- A media with DISLIKE or NOT_INTERESTED feedback does not appear in any response for that profile.
- A completed movie (progress ≥ 90 %) appears with a lower score than an unseen movie of identical genre match; it is absent unless `includeSeen=true`.
- Two identical calls (same profile, same DB snapshot) return candidates in the same order.
- When `signalCount = 0`, the response has `coldStart: true` and candidates are sorted by `popularity × voteAverage` descending.
- Every candidate carries a non-empty `reasons` array.
- All nine test scenarios in the test file pass (`pnpm vitest run` green).
- No existing tests regress.
