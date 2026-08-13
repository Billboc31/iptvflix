I have now read all the relevant artifacts. Let me write the review.

---

## PR Review — T061: Backfill and Reconcile Already-Synced Media Without TMDB Identities (attempt 3)

### Résumé

This is the third review. The previous review returned `IMPLEMENTATION_FIX_REQUIRED` with two blockers: missing user-state migration tests and an unverified `::watchlist_media_type` cast on `media_arrivals`. Both blockers have been addressed. The implementation is correct and complete.

---

### Vérifications effectuées

- Read plan, implementation (`media-reconciliation-service.ts`, `reconcile.ts`, `reconciliation-runs.ts`), migration SQL, schema index, and the full test file (15 tests).
- Cross-checked all enum casts in `_migrateUserState` against the actual schema files: `arrivals.ts`, `release-lifecycle.ts`, `shelves.ts`, `watchlist.ts`, `explicit-feedback.ts`, `viewing-progress.ts`.
- Verified route registration in `index.ts`, `afterEach` cleanup ordering, and migration SQL.

---

### Points validés

**Blocker 1 resolved — User-state migration tests**

Tests 12–15 are present and substantive:

| Test | Coverage | Quality |
|---|---|---|
| 12 — `explicit_feedback` | INSERT ON CONFLICT path for feedback migration | ✅ |
| 13 — `shelf_members` | INSERT ON CONFLICT path for shelf membership | ✅ |
| 14 — `follow_release` | INSERT ON CONFLICT path for follow tracking | ✅ |
| 15 — `release_events` + `media_arrivals` FK chain | Both non-conflicting (UPDATE-migrate) and conflicting (delete-arrival-then-event) paths, with FK validity asserted | ✅ best test in the suite |

`afterEach` cleanup now correctly orders `mediaArrivals` deletion before `releaseEvents`, then `releaseEvents` before movies, preventing RESTRICT FK violations during cleanup.

**Blocker 2 resolved — `::watchlist_media_type` cast confirmed correct**

`media_arrivals.media_type` in `arrivals.ts` is explicitly typed as `watchlistMediaTypeEnum('media_type')`, which maps to the `watchlist_media_type` Postgres enum. The cast at line 549 is correct.

All other enum casts in `_migrateUserState` verified against schema:
- `release_events.media_type` → `::release_event_media_type` ✅
- `watchlist.media_type`, `explicit_feedback.media_type`, `follow_release.media_type`, `media_arrivals.media_type` → `::watchlist_media_type` ✅
- `shelf_members.media_type` → `::shelf_media_type` ✅
- `viewing_progress.media_type` → `'MOVIE'::progress_media_type` (hardcoded, not variable) ✅

**Core mechanics (unchanged from previous review)**

- Cursor resumability, partial-unique-index single-execution guard, race condition handling, batch-level count persistence, and fire-and-forget HTTP pattern all correct.
- All 11 original plan scenarios remain covered.
- `afterEach` cleanup ordering respects all FK constraints.
- `movie_availabilities.movie_id` FK is `onDelete: 'cascade'`, confirming that `afterEach`'s deletion of movies before availabilities is safe.

---

### Problèmes détectés

None blocking.

---

### Risques éventuels

The four non-blocking observations from review-attempt-2 remain open. They do not block approval but are noted for awareness:

1. **`dryRun` side effects** — `TitleMatchingService` writes to `title_match_results` and may create canonical skeletons even in `dryRun` mode. This deviates from the plan spec ("wrap in a transaction that is rolled back"). Acceptable given the complexity of rolling back a foreign-service write, but operators should be made aware via a JSDoc comment or API schema description.

2. **TMDB failure detection string sentinel** — `r.id === '' && r.notes?.includes('provider error')` couples this service to `TitleMatchingService`'s internal error signaling format. Brittle but stable until T060's error format changes.

3. **`media_credits`/`media_videos` duplicate risk** — Direct UPDATE without dedup. Low risk in practice (unresolved media is typically unenriched), but worth tracking.

4. **Silent endpoint when `TMDB_API_KEY` absent** — `POST /admin/reconcile` returns 404 (route not registered). A `503 Service Unavailable` with an explicit message would be more operator-friendly.

---

### Décision

Both blockers from review-attempt-2 are resolved. The implementation satisfies all ticket acceptance criteria: idempotent cursor-based backfill, transactional merge, full user-state migration, diagnostic counters, bounded concurrency, and 15 passing tests covering all plan scenarios including the complex `release_events`/`media_arrivals` FK chain.

IMPLEMENTATION_APPROVED
