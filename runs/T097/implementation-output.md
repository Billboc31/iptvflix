No TypeScript errors in the modified files. Here's a summary of all changes made:

---

**BLOQUANT 1 — `filterUnsynced` now provider-aware** (`segment-sync-service.ts:259-281`)

Changed from "skip any episode with ANY segment in `media_segments`" to "skip only episodes where ALL configured providers have contributed at least one segment row." Episodes enriched only by IntroDB (T096) are now re-processed on the next backfill so TheIntroDB can enrich them — without needing `--force`.

**BLOQUANT 2 — Network access documented + TheIntroDB smoke test coverage** 

Created `runs/T097/network-access-statement.md` explicitly stating that the environment has no public internet access (NXDOMAIN), explains the mock-server validation approach used, and gives the exact `curl` commands for live verification from a connected environment.

Extended `smoke-test-segments.ts` with a full mock TheIntroDB server (`GET /media?tmdb_id=...`) and a T097 section that verifies: both providers contribute raw segments, `mergeSegments` produces `segment_selections`, and the client API returns a clean normalized payload without provider fields.

**OBSERVATION 1 — Unimplemented metrics are now `null`** (`segment-admin.ts:91-93`)

`identifierMismatchRate`, `animeEpisodes`, and `animeWithAnySegment` now return `null` with inline comments explaining they require infrastructure not yet in the schema (`isAnime` field, per-lookup mismatch tracking).

**New test** (`segment-sync-service.test.ts`)

Added `backfillCatalog — provider-aware filterUnsynced` test that seeds both test episodes with IntroDB-only data, runs a two-provider backfill without `--force`, and asserts both episodes are re-processed and TheIntroDB segments are stored.
