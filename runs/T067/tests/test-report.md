---

# Test Report — T067

**Verdict: APPROVED** — 706/710 tests pass, all 8 acceptance criteria satisfied, no regressions introduced by T067.

## Criteria summary

| # | Criterion | Status |
|---|-----------|--------|
| 1 | Valid TMDB IDs attach to canonical entities | **PASS** |
| 2 | Missing local canonical entities are imported before linking | **PASS** |
| 3 | Missing provider IDs use normalized matching and remote resolution | **PASS** |
| 4 | Languages/qualities become variants on one card | **PASS** |
| 5 | Canonical titles remain clean | **PASS** |
| 6 | Ambiguous records are observable/retryable | **PASS** |
| 7 | Movie and TV ingestion use the same separation | **PASS** |
| 8 | Re-sync is idempotent and tracks stale availability | **PASS** |

## Evidence

- **AC1/2**: `CanonicalResolver.resolveMovieCanonical` / `resolveSeriesCanonical` call `MetadataEnrichmentService.importMovieByTmdbId` on cache miss; fallback placeholder created when no TMDB key. `parseTmdbId()` rejects out-of-range values.
- **AC3**: Title-match pre-pass stores results in `titleMatchResults`; `prePassId` semantics (string/null/undefined) gate availability creation correctly.
- **AC4**: All three availability tables have `audioLanguage`, `subtitleLanguage`, `videoQuality`, `rawTitle`, `containerExtension` — confirmed in schema and migration `0031`.
- **AC5**: `resolveEpisodeId` fixed to return existing episode ID without mutation; DB test confirms second call with dirty title does not overwrite canonical title.
- **AC6**: `sync_runs.resolved_count` / `ambiguous_count` / `unresolved_count` columns present in schema and migration.
- **AC7**: `CanonicalResolver` injected into all three provider paths (Xtream, Plex, M3U) and episode backfill.
- **AC8**: `onConflictDoNothing()` on all availability inserts; `unavailableAt` / `status` lifecycle tracked per-item.

## Regressions

None. The 4 failing tests in `vertical-slice.test.ts` (status: RUNNING instead of DONE/FAILED) are pre-existing and confirmed unrelated to T067.

## Non-blocking observations

- `resolveEpisodeCanonical` uses the global `db` pool outside the enclosing transaction — orphaned rows possible on rollback, self-correcting on next sync.
- M3U episode variant extraction absent, but M3U is outside T067 scope.

Full report saved to `runs/T067/tests/test-report.md`.
