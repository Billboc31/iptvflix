The existing test mocks `OPENAI_API_KEY` as `undefined`, so `provider` will be `null` → `embeddingModel`/`embeddingDimension` return `null`. The test only asserts `body.total`, `body.embedded`, and `body.coverageByField`, so the new fields are additive and won't break it. `getEmbeddingIndexMode` has no external dependencies so it needs no mock.

---

## Changes made

**`apps/api/src/routes/embedding-backfill.ts`**
- Added import for `getEmbeddingIndexMode`
- Enriched `GET /admin/embedding-backfill/coverage` response with:
  - `totalMovies` / `totalSeries` (separate counts, previously only `total` combined)
  - `missing` (`total - embedded`)
  - `vectorIndexMode` (from `getEmbeddingIndexMode()` — `'pgvector'` or `'float8'`)
  - `embeddingModel` / `embeddingDimension` (from the provider, or `null` if key absent)

**`scripts/migrate-pgvector-db.sh`**
- Added one-line warning after the success message reminding the operator that `/tmp/` is ephemeral and the dump must be copied to durable storage before ending the session.
