All 9 embedding-related tests pass (up from 8 — the new pagination test is included). The 12 failing test files are all pre-existing failures in unrelated modules.

---

**Changes made:**

1. **`embedding-backfill-service.ts`** — Fixed the pagination cursor: replaced `lt` with `gt` in both the import and the WHERE clause. Forward pagination with `ORDER BY createdAt ASC` requires `createdAt > cursor.createdAt`, not `<`.

2. **`semantic-retrieval-service.ts`** — Added `inArray` to the drizzle-orm import and added `.where(inArray(movies.id, movieIds))` / `.where(inArray(series.id, seriesIds))` to both enrichment queries. Previously the WHERE clause was missing entirely, causing a full table scan on every semantic query.

3. **`embedding-backfill-service.test.ts`** — Added `paginates correctly — all items processed when catalog exceeds batchSize` test: uses `batchSize: 2` with 3 movie items across 2 pages, verifies all 3 are processed (`movies.processed === 3`). Uses the existing `makeSelectChain` helper that was defined but previously unused.
