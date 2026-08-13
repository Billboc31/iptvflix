## Objective

Reconcile all existing IPTVFlix movies and series created under the provider-first model into canonical TMDB-identified records, merge duplicates, preserve all user state, and expose an observable verification report. After migration, application read paths reference only canonical identities and old provider-first identity paths are removed or deprecated.

## Included

### `apps/api/src/services/media-reconciliation-service.ts`

Cursor-based batch processor for movies and series whose `match_status` is PENDING or UNMATCHED.

Resolution strategy per record:
- Existing `tmdb_id` → link directly via canonical resolver; mark MATCHED.
- No `tmdb_id` → run `TitleMatchingService.matchBatch` against raw titles from availability records.
  - Confidence above threshold, single canonical ID agreed → merge into canonical; mark MATCHED.
  - Two top candidates too close → count as AMBIGUOUS; leave PENDING; do not delete.
  - No match → mark UNMATCHED; do not delete.

Deduplication per merge (transactional):
- `movie_availabilities` / `series_availabilities`: UPDATE non-conflicting rows to canonical ID; DELETE remaining rows under old ID.
- `movie_genres` / `series_genres`: INSERT … ON CONFLICT DO NOTHING; DELETE old ID rows.
- `discovery_candidates`, `media_credits`, `media_videos`, `title_match_results`: UPDATE to canonical ID.
- User state (`watchlist`, `viewing_progress` for MOVIE, `explicit_feedback`, `shelf_members`, `follow_release`, `profile_taste`): INSERT … ON CONFLICT DO NOTHING; DELETE old ID rows.
- `release_events` + `media_arrivals`: migrate non-conflicting events and their arrivals; delete arrivals whose event conflicts, then delete conflicting events.
- Old record hard-deleted; canonical row updated to `match_status = 'MATCHED'`.

Controls:
- `dryRun: true` counts without mutating.
- `batchSize`, `concurrency`, `mediaType` (MOVIE | SERIES | BOTH) configurable per run.
- Cursor (`cursor_movie_id`, `cursor_series_id`) persisted to `reconciliation_runs` after each batch, enabling resume from interruption.
- Race condition on concurrent POSTs handled via partial unique index on RUNNING status + catch of `23505`.

### `apps/api/src/services/episode-backfill-service.ts`

After series reconciliation, episode availabilities under merged series are cascade-deleted with the old series row. The backfill service re-fetches episode data from Xtream for all MATCHED series with zero seasons and creates `episode_availabilities` records via `CatalogSyncService.syncCatalog`. Triggered independently via `POST /admin/episode-backfill`.

### `apps/api/src/routes/reconcile.ts`

- `POST /admin/reconcile` — start a reconciliation run (accepts `mediaType`, `batchSize`, `dryRun`); returns 202 with `runId`; executes async.
- `GET /admin/reconcile/:runId` — poll `reconciliation_runs` row; returns status and all counters.
- `POST /admin/episode-backfill` — trigger episode availability backfill (`force` flag re-processes series with existing seasons).
- `GET /admin/episode-backfill/latest` — return latest backfill state.

### `apps/api/src/db/schema/reconciliation-runs.ts`

`reconciliation_runs` table with: `status` (RUNNING / COMPLETED / FAILED), `media_type`, cursors, counters (`processed_count`, `matched_count`, `merged_count`, `ambiguous_count`, `unmatched_count`, `skipped_count`, `failed_count`), timestamps, `error_message`.

### `apps/api/src/index.ts`

Both services instantiated under the protected scope (requires `TMDB_API_KEY` for reconciliation service) and routes registered.

### `apps/api/src/services/__tests__/media-reconciliation-service.test.ts`

15 integration tests covering:
1. Single movie: PENDING resolves to MATCHED.
2. Series type isolation: SERIES run does not touch movies.
3. Multi-row merge: two PENDING movies for same TMDB ID collapse to one; both availabilities migrate.
4. Watchlist migration: entry on old ID points to canonical after merge.
5. Viewing progress conflict: canonical row survives; no duplicate; canonical progress preserved.
6. Ambiguous match: two equally-scored candidates leave record PENDING.
7. No availabilities: record skipped, counted.
8. Already MATCHED: excluded from query; no TMDB call made.
9. Idempotency: re-run produces 0 matched + 0 merged + no duplicate rows.
10. TMDB failure mid-batch: failing item counted as failed; rest of batch continues.
11. Cursor resumability: `executeRun` resumes from persisted cursor; only unprocessed records touched.
12. `explicit_feedback` migration: feedback on old ID migrates to canonical.
13. `shelf_members` migration: shelf membership on old ID migrates to canonical.
14. `follow_release` migration: follow entry on old ID migrates to canonical.
15. `release_events` + `media_arrivals` FK chain: non-conflicting events migrate with arrivals; conflicting events delete their arrivals then self.

### `apps/api/src/services/__tests__/episode-backfill-service.test.ts`

Integration tests for episode availability backfill covering Xtream client invocation, season/episode creation, and `force` mode.

## Excluded

- Manual review UI for ambiguous/unresolved records (retained in DB with `match_state` for programmatic retry).
- Before-snapshot counts (reconciliation_runs accumulates incremental counters; a separate point-in-time before-snapshot is not captured).
- EPISODE-level viewing progress migration (episode progress is keyed by episode ID, not series ID; episodes under merged series are restored by the backfill, not migrated individually).
- New TMDB ingestion beyond what TitleMatchingService needs for matching candidates.
- Multi-tenant / multi-installation coordination.
- Provider-first identity read paths in routes (routes already use canonical `movie_id` / `series_id`; no legacy lookup layer to remove).

## Acceptance criteria

- `POST /admin/reconcile` with `mediaType: "BOTH"` runs to COMPLETED on a populated installation; `GET /admin/reconcile/:runId` returns `status: "COMPLETED"`.
- Movies and series whose `tmdb_id` was already set are marked MATCHED without issuing any TMDB search calls.
- Two PENDING records resolving to the same TMDB ID collapse to one canonical row; both `movie_availabilities` / `series_availabilities` rows are present under the canonical ID.
- Watchlist, viewing_progress (MOVIE), explicit_feedback, shelf_members, follow_release, and release_events on old media IDs all reference canonical IDs after merge.
- Ambiguous records remain PENDING; `reconciliation_runs.ambiguous_count` reflects them; no data is silently deleted.
- Re-running the service on an already-reconciled catalog produces `matchedCount = 0`, `mergedCount = 0`, `failedCount = 0` with no duplicate rows.
- `POST /admin/episode-backfill` restores episode availabilities for series that were merged (i.e. series with zero seasons after reconciliation).
- All 15 reconciliation service tests pass; all episode backfill tests pass.
