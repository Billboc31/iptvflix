All four review fixes are implemented and passing. Here's a summary:

---

**Files modified:**

- **`apps/api/src/services/sync-runs-service.ts`**
  - Added imports for `MetadataEnrichmentService` and `CanonicalResolver`
  - Added `createOptionalCanonicalResolver()` factory (returns `undefined` when `TMDB_API_KEY` is absent)
  - Passed `canonicalResolver` into all three `syncCatalog`/`syncPlexCatalog`/`syncM3UCatalog` calls

- **`apps/api/src/services/episode-backfill-service.ts`**
  - Added imports for `TMDB_API_KEY`, `TmdbClient`, `MetadataEnrichmentService`, `CanonicalResolver`
  - Instantiated and passed `canonicalResolver` into the `syncCatalog` call

- **`apps/api/src/services/catalog-sync-service.ts`** (line 361–373)
  - Removed the `if (meta) { updates... }` block inside `if (existingEpisode)` — existing episodes are now returned as-is without mutating canonical fields

- **`apps/api/src/services/__tests__/canonical-resolver.test.ts`**
  - Replaced the stub test with 2 real DB integration tests: one verifying season/episode creation, one verifying idempotency (second call returns same ID, canonical title not overwritten)

**Test result: 706/710 pass** — same 4 pre-existing `vertical-slice.test.ts` failures, nothing new.
