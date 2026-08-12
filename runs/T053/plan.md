## Objective

Enrich Movie and Series detail pages with complete metadata (cast, director, ratings, certification, release dates, series status) and integrate inline YouTube trailers sourced from the TMDB metadata layer, without exposing provider-specific DTOs.

## Included

### 1. Database — new tables and columns

**`apps/api/src/db/schema/`** (new files or extensions via Drizzle):

- New table `mediaVideos`:
  - `id uuid PK`, `mediaType text` (movie/series), `mediaId uuid`, `youtubeKey text`, `videoType text` (Trailer/Teaser/…), `official boolean`, `publishedAt timestamptz nullable`, `fetchedAt timestamptz`
- New table `mediaCredits`:
  - `id uuid PK`, `mediaType text`, `mediaId uuid`, `role text` (cast/director), `name text`, `character text nullable`, `creditOrder int`, `profilePath text nullable`, `fetchedAt timestamptz`
- Extend `movies` table: add `voteAverage float nullable`, `certification text nullable`
- Extend `series` table: add `voteAverage float nullable`, `certification text nullable`, `status text nullable`

Migration file generated via Drizzle Kit (`apps/api/src/db/migrations/`).

### 2. TMDB client extensions

**`apps/api/src/providers/metadata/tmdb/client.ts`**:

- Add `getMovieVideos(tmdbId: number)` — calls `/movie/{id}/videos`, returns `ExternalVideo[]`
- Add `getSeriesVideos(tmdbId: number)` — calls `/tv/{id}/videos`, returns `ExternalVideo[]`
- Add `getMovieCredits(tmdbId: number)` — calls `/movie/{id}/credits`, returns top-N cast + director
- Add `getSeriesCredits(tmdbId: number)` — calls `/tv/{id}/aggregate_credits`, returns top-N cast + director

**New external types** (same file or adjacent types file):

```ts
ExternalVideo { key: string; site: string; type: string; official: boolean; publishedAt: string | null }
ExternalCreditPerson { name: string; character: string | null; role: 'cast' | 'director'; order: number; profilePath: string | null }
```

Extend `ExternalMovieMetadata` and `ExternalSeriesMetadata` with: `videos: ExternalVideo[]`, `credits: ExternalCreditPerson[]`, `voteAverage: number | null`, `certification: string | null`, `status: string | null` (series only).

### 3. Metadata enrichment service

**`apps/api/src/services/metadata-enrichment-service.ts`**:

- In `enrichMovie()`:
  - Fetch videos and credits in parallel with existing metadata call.
  - Persist preferred trailer to `mediaVideos` (prefer `official === true && type === 'Trailer'`; fall back to first Teaser; skip if none).
  - Upsert top-10 cast + director to `mediaCredits` (delete stale rows before re-insert).
  - Store `voteAverage` and `certification` on the `movies` row.
- In `enrichSeries()`:
  - Same for series; also store `status`.

### 4. API contracts

**`packages/api-contracts/src/catalog.ts`**:

- New type `CastMemberResponse { name: string; character: string | null; profileUrl: string | null }`
- Extend `MovieDetailResponse` with:
  - `trailerKey: string | null`
  - `cast: CastMemberResponse[]`
  - `director: string | null`
  - `voteAverage: number | null`
  - `certification: string | null`
- Extend `SeriesDetailResponse` with same fields + `status: string | null`

### 5. Catalog service

**`apps/api/src/services/catalog-service.ts`**:

- `getMovieDetail()`: join `mediaVideos` (pick best trailer key) and `mediaCredits`; map to new response fields.
- `getSeriesDetail()`: same; include `status` from `series` table.

### 6. API route

**`apps/api/src/routes/catalog.ts`**:

- `/movies/:id` and `/series/:id` response builders: pass through new fields from catalog service.

### 7. Frontend — TrailerPlayer component

**`apps/web/src/components/detail/TrailerPlayer.tsx`** (new):

- Accepts `trailerKey: string | null`.
- Renders nothing when `trailerKey` is null.
- When non-null: shows a poster/thumbnail with a play button overlay; on click, replaces with `<iframe src="https://www.youtube-nocookie.com/embed/{key}?autoplay=1" …>` (lazy-load pattern — no iframe until user interaction).

### 8. Frontend — CastRow component

**`apps/web/src/components/detail/CastRow.tsx`** (new):

- Accepts `cast: CastMemberResponse[]`.
- Renders nothing when array is empty.
- Horizontal scrollable list of cast cards: profile avatar (`posterUrl` or placeholder), name, character.

### 9. Frontend — detail page updates

**`apps/web/src/pages/MovieDetailPage.tsx`**:

- Metadata row: add `voteAverage` (e.g., "★ 7.4") and `certification` badge when present.
- Below synopsis: add `TrailerPlayer` section.
- Below availability variants: add `CastRow` section (with director credited separately if present).

**`apps/web/src/pages/SeriesDetailPage.tsx`**:

- Same additions + `status` badge (e.g., "Returning Series") in metadata row.

### 10. Frontend — API client types

**`apps/web/src/lib/api.ts`** (or wherever the frontend API client is defined):

- Update `MovieDetailResponse` and `SeriesDetailResponse` types to include new fields from the contracts package.

### 11. Test mock data

**`apps/web/src/test/handlers.ts`**:

- Extend `MOCK_MOVIE`: add `trailerKey: 'abc123'`, `cast: [...]`, `director: 'Villeneuve'`, `voteAverage: 7.9`, `certification: 'PG-13'`
- Add `MOCK_MOVIE_NO_TRAILER`: same but `trailerKey: null`
- Extend `MOCK_SERIES`: add `status: 'Returning Series'`, `trailerKey`, `cast`, `director`, `voteAverage`, `certification`

### 12. API tests (new)

**`apps/api/src/routes/movies.detail.test.ts`** (new):

- Rich movie: `/movies/:id` returns `trailerKey`, `cast`, `director`, `voteAverage`, `certification`.
- Trailer-absent: when `mediaVideos` has no row, `trailerKey` is null.
- Cast-absent: when `mediaCredits` is empty, `cast` is `[]`, `director` is null.
- Not found: 404 on unknown ID.

**`apps/api/src/routes/series.detail.test.ts`** (new):

- Rich series: same as movie plus `status`, seasons navigable.
- Trailer-absent case.

### 13. Frontend tests (additions)

**`apps/web/src/components/detail/TrailerPlayer.test.tsx`** (new):

- `trailerKey` non-null → iframe not mounted until user clicks play button.
- `trailerKey` null → nothing rendered.

**`apps/web/src/components/detail/CastRow.test.tsx`** (new):

- Non-empty `cast` → renders member names and characters.
- Empty `cast` → renders nothing.

**Update existing:**

- `MovieDetailPage.test.tsx`: add cases for trailer present/absent, cast present/absent, voteAverage and certification display.
- `SeriesDetailPage.test.tsx`: same + `status` badge.

## Excluded

- Automatic trailer preview on browsing cards or Home hero.
- Hosting or proxying trailer video files.
- DRM or commercial-provider trailer extraction.
- Android TV-specific UI.
- Person/actor detail pages.
- Season-level video support (TMDB season videos endpoint).
- Additional TMDB metadata beyond videos and credits (keywords, reviews, budget, revenue, networks, production companies).
- Series enrichment via TMDB season-detail endpoint (season synopsis, season poster).
- IMDb or Rotten Tomatoes external rating integration.

## Acceptance criteria

- `GET /movies/:id` response includes `trailerKey`, `cast`, `director`, `voteAverage`, `certification`; no provider-internal field is exposed.
- `GET /series/:id` response includes same fields plus `status`; seasons remain fully navigable.
- `MovieDetailPage` and `SeriesDetailPage` display voteAverage and certification in the metadata row when non-null.
- `TrailerPlayer` shows a lazy YouTube embed (nocookie) when `trailerKey` is non-null; renders nothing when `trailerKey` is null.
- `CastRow` renders cast members when present; section is absent from DOM when `cast` is empty.
- Director name is displayed separately from cast when present.
- `trailerKey` is sourced exclusively from `mediaVideos` (TMDB enrichment); no YouTube URL is constructed in the frontend.
- Enrichment service writes official trailer (or first teaser as fallback) to `mediaVideos` and top-10 cast + director to `mediaCredits`.
- No trailer UI element appears for media where no TMDB video was found.
- Responsive layout remains usable on mobile (≤ 640 px) and desktop.
- New API tests cover: rich-movie, rich-series, trailer-present, trailer-absent, cast-absent, 404.
- New frontend tests cover: `TrailerPlayer` with and without key, `CastRow` with and without cast, updated `MovieDetailPage` and `SeriesDetailPage` cases.
