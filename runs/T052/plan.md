# T052 — Surface followed-media arrivals and newly available items in the Web app

## Objective

Create a durable per-profile arrivals inbox that records one entry whenever a followed Movie or Series transitions to available on a configured source, expose it through a REST API, and surface recent unread arrivals on the Home page and a dedicated Arrivals page with read/dismiss semantics.

## Included

### 1. Database schema — `apps/api/src/db/schema/arrivals.ts`

New table `media_arrivals`:

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `profileId` | UUID FK → profiles (cascade delete) | |
| `mediaType` | `watchlistMediaTypeEnum` (MOVIE \| SERIES) | |
| `mediaId` | UUID | |
| `sourceId` | UUID FK → sources (set null on delete) | |
| `releaseEventId` | UUID FK → release_events (restrict) | The SOURCE_APPEARED event that triggered this arrival |
| `arrivedAt` | timestamptz | copied from release_event.occurredAt |
| `readAt` | timestamptz nullable | null = unread |
| `createdAt` | timestamptz default now | |

Unique constraint: `(profileId, releaseEventId)` — one arrival per profile per event; prevents duplicate arrivals from repeated idempotent syncs that produce the same release_event row.

Migration file: `apps/api/migrations/NNNN_media_arrivals.sql`

### 2. Service — `apps/api/src/services/arrival-service.ts`

- `recordArrivalsForFollowers(mediaType, mediaId, sourceId, releaseEventId, arrivedAt)` — queries `follow_release` for all profiles following the media, then bulk-inserts into `media_arrivals` with `ON CONFLICT (profileId, releaseEventId) DO NOTHING`.
- `listArrivals(profileId, filter: 'unread' | 'all')` — joins `media_arrivals` with source name and (via mediaId + mediaType) movie/series title; returns newest-first.
- `markRead(profileId, arrivalId)` — sets `readAt = now()`, verifies ownership.

### 3. Integration — `apps/api/src/services/release-lifecycle-service.ts`

In `recordReleaseEvent`, after a successful SOURCE_APPEARED insert (i.e., when the row is newly created, not skipped by ON CONFLICT), call `recordArrivalsForFollowers` with the newly created event id, mediaType, mediaId, sourceId, and occurredAt.

Reappearance after disappearance is already handled naturally: the release-lifecycle service emits a new SOURCE_APPEARED event after a SOURCE_DISAPPEARED, producing a distinct `releaseEventId`, which generates a new arrival row.

Non-followed media does not produce arrivals (only profiles that follow the media receive entries).

### 4. API routes — `apps/api/src/routes/arrivals.ts`

- `GET /arrivals?filter=unread` — list arrivals for `DEFAULT_PROFILE_ID` (unread by default).
- `PATCH /arrivals/:id/read` — mark one arrival read; returns 204.

Register under protected routes in `apps/api/src/index.ts`.

### 5. API contracts — `packages/api-contracts/src/arrivals.ts`

Types: `ArrivalItem { id, mediaType, mediaId, mediaTitle, sourceName, arrivedAt, readAt }`, `ArrivalListResponse { arrivals: ArrivalItem[] }`. Export from `packages/api-contracts/src/index.ts`.

### 6. Frontend API client — `apps/web/src/lib/api.ts`

Add `fetchArrivals(filter?)` and `markArrivalRead(id)` functions following existing helper pattern.

### 7. Home page shelf — `apps/web/src/pages/HomePage.tsx`

Fetch arrivals alongside existing home data. If unread arrivals exist, render a "New Arrivals" `ShelfRow` above other shelves. Each item links to the media detail page. Include a dismiss (mark-read) button on the card.

### 8. Arrival card component — `apps/web/src/components/content/ArrivalCard.tsx`

Displays: media poster/title, source name, relative arrival date ("arrived 2 hours ago"), and a mark-read button. Follows existing `PosterCard` visual conventions.

### 9. Dedicated page — `apps/web/src/pages/ArrivalsPage.tsx`

Full list of arrivals (all, with unread highlighted). Mark-all-read action optional but out of scope for the service layer; route: `/arrivals`. Link added to `LeftNav`.

### 10. Routing — `apps/web/src/App.tsx`

Register `/arrivals` → `ArrivalsPage` under protected routes.

### 11. Tests

- `apps/api/src/services/__tests__/arrival-service.test.ts`
  - First SOURCE_APPEARED for followed media → one arrival created per following profile.
  - Repeated sync (same release_event) → no duplicate arrival (ON CONFLICT).
  - SOURCE_DISAPPEARED then SOURCE_APPEARED → new release_event → new arrival.
  - `markRead` sets `readAt` and subsequent `listArrivals(filter='unread')` excludes the item.
  - Unfollowed media SOURCE_APPEARED → no arrival.

- `apps/api/src/routes/__tests__/arrivals.test.ts`
  - `GET /arrivals` returns only unread arrivals.
  - `PATCH /arrivals/:id/read` returns 204 and marks the row.
  - `PATCH /arrivals/:other-profile-id/read` returns 404 (ownership check).

## Excluded

- Native mobile push notifications, browser push (service workers / Web Push API).
- Email or SMS delivery.
- "New on your sources" surface for non-followed media.
- Mark-all-read bulk endpoint (no UI requirement in this ticket).
- Real-time delivery (WebSocket / SSE); page load fetch is sufficient.
- Any change to the automatic synchronization schedule (T051 / #100).

## Acceptance criteria

- When a followed media's SOURCE_APPEARED event is recorded, exactly one `media_arrivals` row is created per following profile.
- A second call to `recordReleaseEvent` with the same arguments (idempotent sync) produces no additional `media_arrivals` row.
- A SOURCE_DISAPPEARED followed by a new SOURCE_APPEARED generates a fresh arrival row and is visible as unread.
- `GET /arrivals` returns arrivals with `mediaTitle`, `sourceName`, `arrivedAt`, and `readAt` fields.
- `PATCH /arrivals/:id/read` sets `readAt`; the item no longer appears in the default unread list.
- The Home page renders a "New Arrivals" shelf when unread arrivals exist; each card links to the media detail page.
- The `/arrivals` page lists arrivals and allows dismissal.
- Arrivals state survives API restart (persisted in DB).
- All service-level unit tests pass (`pnpm test` in `apps/api`).
- No arrivals are created for media that is not followed by any profile.
