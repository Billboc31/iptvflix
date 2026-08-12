## Objective

Wire `SOURCE_APPEARED` and `SOURCE_DISAPPEARED` release events into the existing `syncNormalized()` catalog synchronization path so that availability state transitions for movies and series generate durable, idempotent lifecycle events consumable by the Follow Release timeline. Expose those events via a new `GET /release-lifecycle/:mediaType/:mediaId` HTTP endpoint.

## Included

### `apps/api/src/services/catalog-sync-service.ts`

Three availability transition points inside `syncNormalized()` must emit release events. All emissions must run inside the existing `db.transaction()` so events are rolled back if the sync fails.

**1. First appearance — movie (lines 355–368)**

After `resolveMovieId(tx, movie)` is called and the insert succeeds, call:
```
tx.insert(releaseEvents).values({ mediaType: 'MOVIE', mediaId: movieId, eventType: 'SOURCE_APPEARED', occurredAt: snapshot.fetchedAt, sourceId }).onConflictDoNothing()
```
`movieId` is already computed at that point.

**2. Reappearance — movie (lines 371–388)**

In the `else` branch (existing row), extend the opening `select` to also return `movieId` and `status`:
```
select({ id: movieAvailabilities.id, movieId: movieAvailabilities.movieId, status: movieAvailabilities.status })
```
After the update, emit `SOURCE_APPEARED` only when `existing.status === 'UNAVAILABLE'` (i.e. the item was not in `previouslyAvailableMovieIds`). When the item was already `AVAILABLE` (metadata refresh), emit nothing.

**3. Disappearance — movie (lines 449–461)**

Add `.returning({ movieId: movieAvailabilities.movieId })` to the bulk UPDATE that sets `status: 'UNAVAILABLE'`. For each returned row, emit `SOURCE_DISAPPEARED`.

**4–6. Series (lines 407–477)**

Apply the identical three-point pattern using `seriesAvailabilities.seriesId` and `mediaType: 'SERIES'`.

**Episode events: out of scope for this ticket.**

Import `releaseEvents` from `'../db/schema/release-lifecycle.js'` at the top of the service.

---

### `apps/api/src/routes/release-lifecycle.ts` (new file)

Expose `getTimeline()` via Fastify:

```
GET /release-lifecycle/:mediaType/:mediaId
```

- Validate that `mediaType` is `'MOVIE'` or `'SERIES'`; return 400 otherwise.
- Call `getTimeline(mediaType, mediaId)` from `release-lifecycle-service.ts`.
- Return the result as JSON (200).
- Export `releaseLifecycleRoutes` following the pattern of existing route files.

---

### `apps/api/src/index.ts`

- Import `releaseLifecycleRoutes` from the new route file.
- Register it with `app.register(releaseLifecycleRoutes)` alongside the existing route registrations.

---

### Tests

Add or extend a test file (e.g., `apps/api/src/__tests__/catalog-sync-source-events.test.ts` or inside the existing `catalog-sync-service.test.ts`) with cases that call `syncNormalized()` and then query `releaseEvents` directly:

| Case | Expected |
|---|---|
| First sync of a movie/series on a source | Exactly one `SOURCE_APPEARED` event per item |
| Second sync with identical snapshot | No additional events (idempotent) |
| Sync that omits a previously AVAILABLE item | Exactly one `SOURCE_DISAPPEARED` event per removed item |
| Subsequent sync that re-adds the removed item | New `SOURCE_APPEARED` event for the reappearance |
| Sync that only updates metadata (title, audio language) for an AVAILABLE item | Zero new lifecycle events |

---

## Excluded

- Episode `SOURCE_APPEARED` / `SOURCE_DISAPPEARED` events (deferred to when authoritative episode lifecycle handling exists).
- Push, email, or browser notifications.
- Predicting or aggregating future provider availability.
- UI changes.
- Refactoring `recordReleaseEvent()` signature — the new code emits via `tx.insert(releaseEvents)` directly inside the transaction rather than through the existing service function (which uses the global `db` and cannot participate in `tx`).

## Acceptance criteria

1. First sync of a movie on a source records exactly one `SOURCE_APPEARED` event for that source; `sourceId` on the event equals the provider's `sourceId`.
2. Running `syncNormalized()` a second time with the same snapshot records no additional lifecycle events.
3. A sync that removes a previously-AVAILABLE movie records exactly one `SOURCE_DISAPPEARED` event for that movie/source pair.
4. A subsequent sync that re-adds the same movie records a new `SOURCE_APPEARED` event.
5. A sync that only changes metadata (e.g. `rawTitle`, `audioLanguage`) for an already-AVAILABLE item records zero lifecycle events.
6. All four criteria above apply symmetrically to series.
7. `GET /release-lifecycle/MOVIE/:id` and `GET /release-lifecycle/SERIES/:id` return a JSON body whose `timeline` array contains the recorded `SOURCE_APPEARED` / `SOURCE_DISAPPEARED` events in chronological order.
8. Automated tests cover all five sync scenarios (ACs 1–5).
9. No provider credentials or secret stream URLs appear in `releaseEvents.sourceId` — only the stable provider identifier already used in `movieAvailabilities.providerId`.
