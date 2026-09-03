## Objective

Add a non-personalized **Nouveautés** shelf to Home (mixed movies + series), Movies (movie-only), and Series (series-only) that surfaces genuinely recent catalog content ranked primarily by actual release recency rather than profile affinity, guaranteeing freshness visibility even when personalization would prefer older titles.

## Included

### 1. `apps/api/src/config/env.ts`

Add four new exported constants with env-var overrides:

- `NOUVEAUTES_RELEASE_WINDOW_DAYS` (default `180`) — upper bound for the "genuine release" tier.
- `NOUVEAUTES_CATALOG_MAX_AGE_YEARS` (default `3`) — maximum age of a title's actual release year when using catalog-arrival as the freshness signal; prevents a newly imported 25-year-old title from appearing on the shelf.
- `NOUVEAUTES_MIN_ITEMS` (default `5`) — minimum items required before the caller emits the shelf; shelf is suppressed when below this threshold.
- `NOUVEAUTES_ITEMS_PER_SHELF` (default `20`) — maximum items returned.

---

### 2. `apps/api/src/services/nouveautes-service.ts` (new file)

Export one function:

```ts
buildNouveautesItems(options: {
  mediaType?: 'MOVIE' | 'SERIES'   // omit for mixed
  excludeIds?: Set<string>
  limit?: number                   // defaults to NOUVEAUTES_ITEMS_PER_SHELF
}): Promise<NouveautesItem[]>

type NouveautesItem = {
  mediaId: string
  mediaType: 'MOVIE' | 'SERIES'
  title: string
  posterPath: string | null
  score: number
}
```

**Ranking logic — no LLM call, no recommendation-engine HTTP call.**

Run two independent DB queries (movies and/or series depending on `mediaType`), merge, deduplicate by `mediaId`, sort by `score`, apply `excludeIds`, return top `limit`.

**Tier 1 — genuine release within `NOUVEAUTES_RELEASE_WINDOW_DAYS`:**
- Movies: `COALESCE(digital_release_date, theatrical_release_date)` is not null and within the window.
- Series: `COALESCE(theatrical_release_date, digital_release_date)` is not null and within the window; OR both date columns are NULL and `first_air_year` = current year or current year − 1.
- `recencyScore = 1 − daysSinceRelease / NOUVEAUTES_RELEASE_WINDOW_DAYS` (range 0–1).
- Tier multiplier: `1.0`.

**Tier 2 — recent catalog arrival with bounded release age:**
- `createdAt` within last 30 days AND the title's actual release year (derived from `theatrical_release_date`, `digital_release_date`, or `first_air_year`) is within `NOUVEAUTES_CATALOG_MAX_AGE_YEARS` of today.
- `recencyScore = 1 − daysSinceCatalogAddition / 30`.
- Tier multiplier: `0.5` (discounted relative to tier 1).

**Quality tie-breaker (both tiers):**
`qualityPrior = COALESCE(vote_average, 0) / 10 * 0.6 + LEAST(COALESCE(popularity, 0) / 100, 1) * 0.4`

**Final score:**
`score = tieredRecency * 0.75 + qualityPrior * 0.25`

**Availability filter:**
- Movies: `INNER JOIN movie_availabilities ON movie_availabilities.movie_id = movies.id AND movie_availabilities.status = 'AVAILABLE'`
- Series: `INNER JOIN series_availabilities ON series_availabilities.series_id = series.id AND series_availabilities.status = 'AVAILABLE'`
- Use `DISTINCT ON (movies.id)` / `DISTINCT ON (series.id)` to collapse multiple availability rows per title.

---

### 3. `apps/api/src/services/home-pool-service.ts`

In `buildDeclaredRails`, insert **Rail 2.5 — "Nouveautés"** (mixed movies + series) between the existing Rail 2 ("Pour toi") and Rail 3 ("Nouveautés pour toi"):

```
// ── Rail 2.5: "Nouveautés" ────────────────────────────────────────────────
try {
  const t0 = Date.now()
  const nouveautesItems = await buildNouveautesItems({ excludeIds: excludedMediaIds, limit: HOME_ITEMS_PER_SHELF })
  if (nouveautesItems.length >= NOUVEAUTES_MIN_ITEMS) {
    pendingRails.push({
      title: 'Nouveautés',
      candidates: nouveautesItems.map(toShelfCandidateItem),
      conceptId: null, semanticIntent: null,
      queryPlannerVersion: MODEL_VERSION, embeddingModelVersion: 'none', rankerVersion: MODEL_VERSION,
      candidateCount: nouveautesItems.length,
      latencyMs: Date.now() - t0,
      verticalPosition: nextPosition++,
    })
    for (const item of nouveautesItems) excludedMediaIds.add(item.mediaId)
  }
} catch (err) {
  console.error('[home-pool] declared rail 2.5 "Nouveautés" failed:', err)
}
```

`toShelfCandidateItem` maps `NouveautesItem` to `ShelfCandidateItem` (setting `semanticScore: 0`, `profileScore: 0`, `finalScore: item.score`, `available: true`, `reasons: ['NOUVEAUTES']`).

---

### 4. `apps/api/src/services/movies-pool-service.ts`

In `buildMoviesDeclaredRails`, insert **"Nouveautés"** as the **first** declared rail (before existing movie recommendation rails):

- Call `buildNouveautesItems({ mediaType: 'MOVIE', excludeIds: excludedMediaIds, limit: MOVIES_ITEMS_PER_SHELF })`.
- Emit only if `candidates.length >= NOUVEAUTES_MIN_ITEMS`.
- Add returned `mediaId`s to `excludedMediaIds`.
- Persist as `SYSTEM_DECLARED` shelf instance (same `shelfInstanceService.persistShelfInstance` pattern already used in this file).

---

### 5. `apps/api/src/services/series-pool-service.ts`

In `buildSeriesDeclaredRails`, insert **"Nouveautés"** as the **first** declared rail (before existing series recommendation rails):

- Call `buildNouveautesItems({ mediaType: 'SERIES', excludeIds: excludedMediaIds, limit: SERIES_ITEMS_PER_SHELF })`.
- Emit only if `candidates.length >= NOUVEAUTES_MIN_ITEMS`.
- Add returned `mediaId`s to `excludedMediaIds`.
- Persist as `SYSTEM_DECLARED` shelf instance.

---

### 6. Tests — `apps/api/src/services/__tests__/nouveautes-service.test.ts` (new file)

Seed a minimal in-memory or test-DB fixture with controlled movies and series rows. Cover:

| Test | What is verified |
|------|-----------------|
| Mixed-media results | No `mediaType` filter returns both MOVIE and SERIES items. |
| Movie-only constraint | `mediaType: 'MOVIE'` returns no SERIES items. |
| Series-only constraint | `mediaType: 'SERIES'` returns no MOVIE items. |
| Release-vs-import recency | A movie with `theatricalReleaseDate` = 30 days ago has a higher score than a movie with `createdAt` = yesterday and `theatrical_release_date` = NULL and release year = 1999. |
| Tier-2 catalog guard | A title added to catalog yesterday whose year is beyond `NOUVEAUTES_CATALOG_MAX_AGE_YEARS` does not appear in results. |
| Intra-shelf deduplication | A mediaId present in both tier-1 and tier-2 candidate sets appears exactly once. |
| `excludeIds` | Items whose IDs are in the `excludeIds` set are absent from results. |
| Insufficient content | When fewer than `NOUVEAUTES_MIN_ITEMS` candidates exist, the function still returns the partial list (suppression is the caller's responsibility). |
| Availability filter | A movie with no `movieAvailabilities` row with `status = 'AVAILABLE'` does not appear. |
| Score ordering | Returned items are sorted by `score` descending. |

## Excluded

- Frontend component changes — `ShelfRow` / `HorizontalRow` are media-type-agnostic and already handle the `title` string returned by the API; no frontend work is required.
- New DB migrations — all required columns (`theatrical_release_date`, `digital_release_date`, `first_air_year`, `created_at`, `movie_availabilities.status`, `series_availabilities.status`) already exist in the schema.
- Modifications to the existing `getFreshMediaIds` helper in `home-pool-service.ts` — it is used by the `NEW_RELEASES` pool-fill freshness policy for personalized shelves and is a different concept.
- Modifications to the "Nouveautés pour toi" rail logic or ranking.
- Changes to the arrivals system or `ArrivalCard` component.
- Changes to snapshot TTLs, session infrastructure, or cursor signing.
- Personalization signal injection into `buildNouveautesItems` beyond the quality tie-breaker already specified.
- LLM calls or recommendation-engine HTTP calls in `nouveautes-service.ts`.

## Acceptance criteria

- Home page response for any profile includes a shelf with `title: 'Nouveautés'` positioned after "Pour toi" and before "Nouveautés pour toi" in `shelves[]`.
- Movies page response includes a shelf with `title: 'Nouveautés'` whose every item has `mediaType: 'MOVIE'`.
- Series page response includes a shelf with `title: 'Nouveautés'` whose every item has `mediaType: 'SERIES'`.
- All tests in `nouveautes-service.test.ts` pass, including the release-vs-import recency test confirming a genuine new release ranks above a recently imported old title.
- A title with no AVAILABLE `movieAvailabilities` / `seriesAvailabilities` row does not appear in any Nouveautés shelf.
- `buildNouveautesItems` makes zero HTTP calls (verifiable via test spy or mock).
- When the catalog contains fewer than `NOUVEAUTES_MIN_ITEMS` recent playable titles for a given media type, the corresponding Nouveautés shelf is absent from the page response (suppressed by the caller).
- Existing declared rails ("Pour toi", "Nouveautés pour toi", "Films pour toi", "Séries pour toi", "Continuer à regarder") remain in their original order and are unmodified in logic.
- `tsc --noEmit` passes with no new type errors in `apps/api`.
