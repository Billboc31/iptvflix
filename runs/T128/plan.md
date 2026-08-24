# Plan — T128: Build personalized Movies page with exploitation and discovery shelves

## Objective

Replace the static Movies browse page with a personalized discovery experience composed of horizontal movie-only shelves, reusing the Home page's shelf/session/snapshot infrastructure adapted for an independent Movies page with a 75% exploitation / 25% exploration product policy.

## Included

### Backend — route and services

**`apps/api/src/routes/movies.ts`** (new)
- `GET /profiles/:profileId/movies?cursor=` — validates cursor, delegates to `buildMoviesPage(profileId, cursor?)`.
- Register in `apps/api/src/routes/index.ts`.

**`apps/api/src/services/movies-service.ts`** (new)
- Entry point `buildMoviesPage(profileId, cursor?)` returns `MoviesPageResponse`.
- Three states mirroring `home-service.ts`: HIT (valid snapshot) → return declared shelves + cursor; STALE → serve old snapshot + trigger async regeneration; MISS → build declared rails synchronously.
- Snapshot TTL governed by `MOVIES_SNAPSHOT_TTL_HOURS`.

**`apps/api/src/services/movies-pool-service.ts`** (new)
- `getOrCreateMoviesSession(profileId)` — 24-hour session, independent of Home session.
- `buildMoviesDeclaredRails(profileId, sessionId)` — generates the first batch of shelves:
  1. "Pour toi" — PERSONALIZED concept, `mediaTypeFilter='MOVIE'`, general intent.
  2. "Nouveautés pour toi" — PERSONALIZED concept, `mediaTypeFilter='MOVIE'`, `freshnessPolicy=NEW_RELEASES`.
  3–6. Dynamic thematic shelves drawn from `shelf_concepts` with `desiredMediaTypes` includes MOVIE; maintain 75% PERSONALIZED / 25% EXPLORATION ratio across thematic slots; guarantee at least one EXPLORATION/DISCOVERY concept in the declared batch.
- `selectExplorationMovieConcept(profileId, usedConceptIds)` — picks EXPLORATION/DISCOVERY concept filtered to MOVIE, ordered by semantic distance from strongest exploitation concepts; rejects pure-random candidates (zero semantic scores are disqualifying).
- `fillMoviesPool(sessionId, profileId, targetCount)` — async pool fill; same 75/25 ratio; respects fatigue cooldowns via existing `ShelfFatigueService`.
- `serveMoviesBatch(sessionId, nextPosition, batchSize)` — cursor-based batch serving.
- Cross-shelf deduplication via `excludedMediaIds` set accumulated across rails within the same Movies session; independent of Home sessions.
- Concepts with zero qualifying movie candidates produce no rail and are skipped silently.

**`apps/api/src/services/movies-snapshot-service.ts`** (new)
- `readMoviesSnapshot(profileId)`, `writeMoviesSnapshot(profileId, declaredInstanceIds)`, `invalidateMoviesSnapshot(profileId)`.
- Reads/writes `movies_discovery_snapshots`; TTL = `MOVIES_SNAPSHOT_TTL_HOURS`; supports stale detection.

### Database — two new tables

**`apps/api/src/db/schema/movies-sessions.ts`** (new)
- Table `movies_sessions`: `profileId`, `sessionId`, `cursorReference`, `expiresAt`, `createdAt`.

**`apps/api/src/db/schema/movies-snapshots.ts`** (new)
- Table `movies_discovery_snapshots`: `profileId`, `declaredShelfInstanceIds` (JSON), `createdAt`, `expiresAt`.

**Migration** `apps/api/src/db/migrations/<timestamp>_add_movies_tables.ts` — creates both tables.

### Config

`apps/api/src/config/env.ts` — add:
- `MOVIES_SNAPSHOT_TTL_HOURS` (default `24`)
- `MOVIES_SESSION_TTL_HOURS` (default `24`)
- `MOVIES_BATCH_SIZE` (default `6`)
- `MOVIES_ITEMS_PER_SHELF` (default `24`)
- `MOVIES_EXPLORATION_RATIO` (default `0.25`)
- `MOVIES_POOL_MIN` (default `10`)
- `MOVIES_POOL_TARGET` (default `25`)

### API contracts

**`packages/api-contracts/src/movies.ts`** (new)
- `MoviesPageResponse { shelves: ShelfResponse[], nextCursor?: string, sessionId: string }` — no hero field; reuses existing `ShelfResponse` and `ShelfItem` types.
- Re-export from `packages/api-contracts/src/index.ts`.

### Frontend

**`apps/web/src/hooks/useMovies.ts`** (new)
- `useInfiniteMovies(profileId)` — mirrors `useInfiniteHome`; calls `/profiles/:profileId/movies`; manages cursor pagination, 3-retry exponential backoff, session ID.
- Returns `{ allShelves, sessionId, nextCursor, isLoading, hasMore, loadMore }`.

**`apps/web/src/pages/MoviesPage.tsx`** (rewrite)
- Replace static genre-filter catalog with infinite shelf list powered by `useMovies`.
- Renders `ShelfRow` components from existing component; no layout or visual changes to `ShelfRow`.
- Empty shelves are not rendered.
- One shelf's render error is caught per-shelf (error boundary or try/catch); remaining shelves continue to render.
- No recommendation scores, debug info, or genre-filter UI.
- Preserves existing movie detail / playback navigation (same `href` / `onClick` patterns as today).

### Tests

**`apps/api/src/services/__tests__/movies-pool-service.test.ts`** (new)
- `movie-only constraint`: mock recommendation engine returns mixed MOVIE+SERIES; assert all shelf items have `mediaType='MOVIE'`.
- `exploitation/exploration ratio`: generate 20 thematic shelves; assert EXPLORATION/DISCOVERY concepts represent 20–30% of slots.
- `theme diversity`: assert no two concepts in the same declared batch share identical `semanticIntent` strings.
- `cross-shelf deduplication`: assert no `mediaId` appears in more than one shelf within a session batch.
- `snapshot reuse`: second `buildMoviesPage` call within TTL does not invoke recommendation engine; returns same `shelfInstanceIds`.
- `empty concept`: concept whose engine query returns 0 MOVIE results produces no shelf entry in output.
- `error isolation`: engine throws for one concept; other shelves in same batch are unaffected and returned.

**`apps/api/src/services/__tests__/movies-snapshot-service.test.ts`** (new)
- HIT / STALE / MISS states; TTL boundary conditions.

## Excluded

- Changes to Home page, Home sessions, or Home snapshots.
- Hero/banner section on the Movies page.
- Cross-page deduplication between Home shelves and Movies shelves.
- Modifying the recommendation engine service or adding new shelf concept types.
- Generating new shelf concepts (Movies page consumes existing `shelf_concepts` rows filtered by media type).
- Seen/liked/disliked feedback collection (referenced in ticket as future work).
- Manual production DB changes or seeding movie-specific concepts.

## Acceptance criteria

- `GET /profiles/:profileId/movies` returns `MoviesPageResponse`; every shelf item has `mediaType='MOVIE'`.
- At least one shelf in each declared batch has `generationType='EXPLORATION'` or `'DISCOVERY'`.
- Exploration shelf items carry non-zero semantic scores (verified by unit test — pure random is disqualifying).
- Thematic shelf slots are ~75% PERSONALIZED and ~25% EXPLORATION/DISCOVERY (unit test checks ratio across ≥ 20 generated shelves).
- No `mediaId` appears in more than one shelf within the same session batch (dedup unit test passes).
- Two calls within `MOVIES_SNAPSHOT_TTL_HOURS` return identical `shelfInstanceIds` without invoking the recommendation engine (snapshot reuse unit test passes).
- A concept returning zero MOVIE candidates produces no rendered rail (empty behavior test passes).
- A runtime error on one shelf's query does not prevent remaining shelves from being returned (error isolation test passes).
- `MoviesPage.tsx` renders only `ShelfRow` components; no static genre-filter UI remains.
- No `mediaType='SERIES'` item appears in any Movies page API response (enforced at query level).
- Existing Home page, hero ranker endpoints, and recommendation diagnostic routes return unchanged responses (existing test suites pass without modification).
