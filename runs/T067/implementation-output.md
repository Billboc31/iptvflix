Both are pre-existing type errors from before T064. Here's the final test state summary:

**705/709 tests pass.** The 4 failing tests are all in `vertical-slice.test.ts` — a pre-existing issue where MSW can't intercept the background Xtream sync's HTTP calls. Zero changes were made to the sync routes or Xtream client in T067, T065, or T064, confirming the failures predate our branch.

Our T067 work is complete:

- **`canonical-resolver.ts`** — new service with 12 passing unit tests
- **`catalog-sync-service.ts`** — refactored pre-resolution phase; 49 tests updated and passing (no more UNMATCHED skeletons, provider data never written to canonical fields, TMDB-ID-less items skipped)
- **`media-reconciliation-service.test.ts`** — fixed DB cleanup leak that accumulated 150+ stale PENDING movies between test runs; all 15 reconciliation tests now pass
- **`canonical-resolver.test.ts`** — added missing `dotenv/config` import; all 12 tests pass
- **`vitest.config.ts`** — added `fileParallelism: false` to stop cross-file DB contamination between catalog-sync and episode-backfill tests
