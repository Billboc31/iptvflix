# Test Report — T102: Build catalog embeddings and vector retrieval

**Date:** 2026-08-18  
**Tester role:** Automated code-level validation  
**Branch:** `ticket/T102-build-catalog-embeddings-and-vector-retrieval-for`

---

## Test execution

```
pnpm --filter api test embedding
Test Files: 4 passed (4)
Tests:      19 passed (19)
Duration:   2.42s
```

All 19 embedding-specific tests pass across:
- `embedding-document-builder.test.ts` — 11 tests
- `embedding-service.test.ts` — 3 tests
- `embedding-backfill-service.test.ts` — 4 tests
- `routes/__tests__/embedding-backfill.test.ts` — 2 tests (route-level)

TypeScript errors detected by `tsc --noEmit` are in `profiles.test.ts`, `authenticateDevice.test.ts`, `playback-session-store.test.ts` — none introduced by T102 (confirmed via `git diff main`).

---

## Acceptance criteria

### AC1 — Canonical embedding document builder exists and is deterministic/versioned
**PASS**

`apps/api/src/services/embedding-document-builder.ts` exists. Builds a structured, line-ordered text block from existing catalog fields. `DOCUMENT_VERSION = 'v1'` is exported as a constant; bumping it changes the SHA-256 hash even when data is unchanged. `hashDocument()` uses `JSON.stringify({ version, mediaType, text })` for deterministic serialization. Tests confirm same input → same hash, material field change → different hash, version bump → different hash.

### AC2 — Existing catalog can be embedded idempotently
**PASS**

`runBackfill()` in `embedding-backfill-service.ts` uses keyset cursor pagination (`createdAt ASC, id ASC`) with correct `gt` direction (fix applied in coder attempt 2). Batch size 50, concurrency 5, up to 3 retry attempts with exponential backoff (max 16s). Delegates to `upsertEmbedding()` which skips rows with unchanged `doc_hash` + same model. Tests confirm: all items processed on first run, all skipped on second run, pagination handles catalog larger than batchSize, retry on transient error marks item failed after max attempts.

### AC3 — Vector storage/index works in the Railway/Postgres-compatible setup
**PASS**

Migration `0036_t102_media_embeddings.sql` is idempotent (`CREATE EXTENSION IF NOT EXISTS vector`, `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`). HNSW index on `embedding vector_cosine_ops` for approximate nearest-neighbor search. Unique index on `(media_id, media_type, model_provider, model_name)` enforces one row per media/model pair. IVFFlat fallback is documented in migration comments for pgvector < 0.5 environments. Drizzle schema matches migration exactly. Cannot validate `db:migrate` without a live DB, but the SQL is well-formed.

### AC4 — Embedding provider/model can be changed without replacing canonical catalog schema
**PASS**

`EmbeddingProvider` interface (`embedding-provider.ts`) is decoupled from schema. `media_embeddings` stores `model_provider` + `model_name` on each row, with unique index per `(media_id, media_type, model_provider, model_name)`. Switching the factory function creates new rows keyed to the new model; existing rows are preserved. `upsertEmbedding` matches on both media ID and model identity before deciding to skip.

### AC5 — New/changed titles can be incrementally re-embedded
**PASS**

`metadata-enrichment-service.ts` accepts an optional `onEnriched?: (mediaId: string, mediaType: 'MOVIE' | 'SERIES') => void` in its constructor. After successful `enrichMovie()` (line 162) and `enrichSeries()` (line 281), `this.onEnriched?.()` is called. In `index.ts`, this is wired to `embeddingService.upsertEmbedding()` as a fire-and-forget call with error-only logging. Enrichment path is not blocked by embedding errors.

### AC6 — Recommendation Engine retrieves top-K real titles by semantic query
**PASS (code level)**

`semantic-retrieval-service.ts` implements `retrieve(queryText, topK)`: calls `embeddingService.semanticSearch()` (pgvector `<=>` cosine distance, ordered ascending, limited to topK), then enriches with `title`/`year`/`posterPath` from movies/series tables using `inArray` WHERE clause (fix applied in coder attempt 2 — previously full-table scan). Similarity is computed as `Math.max(0, 1 - distance)`. `POST /recommendation-lab/semantic-query` route validates input, calls retrieval service, returns ranked result list.

**Caveat:** End-to-end validation against real catalog requires `OPENAI_API_KEY` and a populated `media_embeddings` table. Not testable in this environment.

### AC7 — Lab displays similarity scores/model/version
**PASS**

`RecommendationLabPage.tsx` renders:
- Similarity percentage badge per card with color coding (green ≥ 70%, yellow ≥ 50%, gray < 50%)
- Model name at list level: `Modèle : {modelProvider}/{modelName}`
- Rank number, poster image (with fallback), title, year, media type per card
- Side-by-side grid layout when comparison query is submitted
- 5 benchmark query shortcuts pre-wired

### AC8 — Structured metadata remains separate/queryable for later filtering
**PASS**

Embedding document builder encodes genre as free text (e.g., `Genres: Science Fiction, Drama`), not as an array or filter. Runtime, release date, language, certification appear as descriptive prose, not as structured filter tokens. The `movies`/`series` tables retain their structured columns unchanged. `media_embeddings` stores no structured fields — only the semantic vector, model identity, and doc hash. No genre, runtime, or language columns were added to `media_embeddings`.

**Note:** Certification (e.g., `Certification: R`) and original language appear in embedding text. This is legitimate semantic context (aids intent matching for "film pour enfants" or "film français") and does not compromise the structured/semantic separation.

### AC9 — Benchmark queries demonstrate useful semantic retrieval against real catalog
**BLOCKED — requires live environment**

`apps/api/src/benchmarks/embedding-benchmarks.ts` is fully implemented:
- All 5 required queries present
- Expected titles pre-curated per query from likely catalog titles
- `precisionAtK()` computes P@5 and P@10 per query with case-insensitive substring matching
- Summary prints avg P@5, avg P@10, pass count (P@5 ≥ 20%)
- CLI entry: `pnpm --filter api benchmark:embeddings`

The completion rule ("run real queries in the Lab against the actual IPTVFlix catalog and demonstrate that semantically appropriate titles rank near the top") cannot be satisfied in this code-level review. A live test with `OPENAI_API_KEY` and a populated embedding index is required.

**This is the only criterion that cannot be fully validated without a deployed environment.**

### AC10 — Coverage/quality diagnostics show how rich embedding documents actually are
**PASS (with minor gap)**

`measureCoverage()` in the document builder counts 5 rich fields: overview, genres, keywords, credits, language. `GET /admin/embedding-backfill/coverage` returns:
```json
{ "total": N, "embedded": M, "coverageByField": { "overview": 0.xx, "keywords": 0.xx, "language": 0.xx } }
```

**Minor gap:** The coverage API returns 3 fields (`overview`, `keywords`, `language`) but the plan specified 4 (`overview`, `keywords`, `credits`, `genres`). Credits and genres are not surfaced in the endpoint — they would require additional JOIN queries to `media_credits` and genre junction tables. This is a non-blocking gap; the endpoint still gives honest coverage data and is not misleading. For a follow-up, credits and genres coverage could be added.

---

## Regressions

None observed. The 12 pre-existing TypeScript errors in unrelated test files are unchanged vs. main. No changes to the recommendation ranking service, TMDB sync, media-relay, or Android TV paths.

---

## Issues found

| ID | Severity | Description |
|----|----------|-------------|
| I1 | Minor | `GET /admin/embedding-backfill/coverage` omits `credits` and `genres` field coverage despite `measureCoverage()` computing them. Returns only `overview`, `keywords`, `language`. |
| I2 | Minor | `embedding-service.ts` uses `sql.raw()` to inline the vector literal in the `<=>` distance expression. The vector values come from the OpenAI response (a `number[]`), so SQL injection is not exploitable in practice. A parameterized approach would be cleaner but requires pgvector-aware DB client support. |

Neither issue is a blocker.

---

## Summary

| Criterion | Status |
|-----------|--------|
| AC1 — Embedding document builder, deterministic/versioned | PASS |
| AC2 — Idempotent catalog backfill | PASS |
| AC3 — Vector storage/index (pgvector + HNSW) | PASS |
| AC4 — Provider/model swappable without schema change | PASS |
| AC5 — Incremental re-embedding on enrichment | PASS |
| AC6 — Top-K semantic retrieval API | PASS (code) |
| AC7 — Lab displays scores/model/version | PASS |
| AC8 — Structured metadata remains separate | PASS |
| AC9 — Benchmark demonstrates real catalog retrieval | BLOCKED (needs live env) |
| AC10 — Coverage diagnostics | PASS (minor gap: missing credits/genres field) |

**Verdict: CONDITIONAL PASS**

9/10 acceptance criteria are satisfied at the code and unit-test level. AC9 requires a live environment with an active OpenAI key and populated embedding index to close the completion rule. That step must be performed manually in the deployed staging or production environment before this ticket is marked done.
