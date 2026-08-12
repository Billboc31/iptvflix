## Objective

Add a profile-scoped `explicit_feedback` table and matching API routes so a user can set, change, or clear a `LIKE`, `DISLIKE`, or `NOT_INTERESTED` signal for any canonical Movie or Series. Surface the current state in a reusable UI component wired into both detail pages.

## Included

### Database — `apps/api/src/db/schema/explicit-feedback.ts` (new file)
- New Drizzle table `explicit_feedback`:
  - `id` UUID PK (default `gen_random_uuid()`)
  - `profileId` UUID NOT NULL FK → `profiles.id ON DELETE CASCADE`
  - `mediaType` `pgEnum('MOVIE' | 'SERIES')` (reuse or extend the existing mediaType enum)
  - `mediaId` UUID NOT NULL
  - `feedback` `pgEnum('LIKE' | 'DISLIKE' | 'NOT_INTERESTED')` NOT NULL
  - `createdAt` timestamp NOT NULL default now()
  - `updatedAt` timestamp NOT NULL default now()
  - Unique constraint on `(profileId, mediaType, mediaId)`
- Export the schema from `apps/api/src/db/schema/index.ts`

### Migration
- Run `db:generate` to produce a new numbered migration (`0016_*.sql`); commit the generated SQL file.

### API contracts — `packages/api-contracts/src/user-state.ts`
- Add `FeedbackType` enum (`LIKE | DISLIKE | NOT_INTERESTED`)
- Add `SetFeedbackBody` (`{ mediaType, mediaId, feedback }`)
- Add `FeedbackItem` response type (`{ mediaType, mediaId, feedback, updatedAt }`)

### API routes — `apps/api/src/routes/feedback.ts` (new file)
- `GET /feedback` — list all feedback rows for DEFAULT_PROFILE_ID
- `PUT /feedback/:mediaType/:mediaId` — upsert (insert or update) a feedback row; body `{ feedback }`. Validate `mediaType ∈ {MOVIE, SERIES}` and that the referenced movie/series id exists.
- `DELETE /feedback/:mediaType/:mediaId` — delete the row if it exists (idempotent; 204 whether it existed or not)
- Register the router in the main Fastify app alongside watchlist/follow-release.

### Frontend — new component `apps/web/src/components/content/FeedbackButtons.tsx`
- Props: `mediaType`, `mediaId`, `currentFeedback: FeedbackType | null`
- Three toggle buttons: Like / Dislike / Not Interested (mutually exclusive)
- On click: call PUT or DELETE (if clicking the active state) via the existing API client
- Follow the same query-invalidation pattern as `WatchlistButton.tsx`

### Frontend — wire into detail pages
- `apps/web/src/pages/MovieDetailPage.tsx`: fetch current feedback from `GET /feedback` (filter client-side by mediaId) and render `<FeedbackButtons>`
- `apps/web/src/pages/SeriesDetailPage.tsx`: same

### Tests — `apps/api/src/routes/feedback.test.ts` (new file)
- Set feedback on a movie → stored, returned
- Change feedback (LIKE → DISLIKE) → only one row remains, updatedAt advances
- Clear feedback (DELETE) → row gone, 204
- Repeated identical PUT → idempotent, 200
- DELETE on non-existing row → 204 (idempotent)
- Two profiles → each profile's feedback is independent
- Setting feedback does not touch watchlist, follow_release, or viewing_progress tables

## Excluded

- Recommendation scoring or taste-profile aggregation
- Star ratings or free-text reviews
- Importing external ratings (Netflix, Trakt, etc.)
- Surfacing feedback on media cards / `PosterCard.tsx` (detail pages only for now)
- Multi-profile auth (DEFAULT_PROFILE_ID remains hardcoded, as in the rest of the codebase)
- Pagination on `GET /feedback`

## Acceptance criteria

- `explicit_feedback` table exists after migration with the unique constraint enforced at DB level.
- `PUT /feedback/MOVIE/:id` with `{ feedback: "LIKE" }` returns 200 and subsequent `GET /feedback` contains exactly one entry for that id.
- Changing feedback via a second `PUT` leaves exactly one row (no duplicate); `updatedAt` is greater than `createdAt`.
- `DELETE /feedback/MOVIE/:id` returns 204 and the row is gone; a second identical DELETE also returns 204.
- `PUT /feedback/MOVIE/:nonExistentId` returns 4xx (profile/media validation).
- Watchlist, follow_release, and viewing_progress tables are unaffected by any feedback mutation (verified by test assertions).
- `MovieDetailPage` and `SeriesDetailPage` render `<FeedbackButtons>` showing the correct active state for the loaded media.
- All new tests pass under `vitest run`.
- `drizzle-kit generate` produces no additional diff after the migration is committed.
