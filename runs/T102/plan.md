## Objective

Build the semantic retrieval layer for the IPTVFlix recommendation engine: deterministic embedding document generation from existing TMDB catalog metadata, pgvector storage with provider abstraction, idempotent backfill, incremental updates on enrichment, a top-K semantic retrieval API stage, Recommendation Lab exposure, and a repeatable benchmark suite demonstrating useful semantic ranking against the real catalog.

## Included

### 1. pgvector migration and Drizzle schema

- New SQL migration enabling the `vector` extension on the project Postgres instance.
- New migration creating `media_embeddings` table:
  - `id uuid PK`
  - `media_id uuid NOT NULL` (FK to movies or series)
  - `media_type text NOT NULL` (MOVIE | SERIES)
  - `embedding vector(1536)` (dimension parameterised; not hardcoded in logic)
  - `model_provider text NOT NULL`
  - `model_name text NOT NULL`
  - `embedding_dimension integer NOT NULL`
  - `doc_hash text NOT NULL` (SHA-256 of the serialised embedding document)
  - `generated_at timestamptz NOT NULL`
  - Unique index on `(media_id, media_type, model_provider, model_name)`.
  - HNSW approximate index on `embedding` (cosine operator class); IVFFlat fallback documented if pgvector version < 0.5.
- New Drizzle schema file `/apps/api/src/db/schema/media-embeddings.ts` matching the migration; exported from `/apps/api/src/db/schema/index.ts`.

### 2. Embedding document builder

**File:** `/apps/api/src/services/embedding-document-builder.ts`

- `buildEmbeddingDocument(media: MovieRow | SeriesRow, genres: Genre[], credits: MediaCredit[]): EmbeddingDocument`
  - Output: structured text block combining title, type, genres, overview, keywords (from existing `keywords` jsonb), director + top cast (from `media_credits` table), original language, release year, runtime/episodes, collection name, vote average + popularity bucket, certification.
  - Only includes fields present in existing schema — no new TMDB fetches.
  - Deterministic field ordering; `null`/missing fields omitted from text (not written as "N/A").
- `hashDocument(doc: EmbeddingDocument): string` — SHA-256 of canonical JSON serialisation.
- `DOCUMENT_VERSION` constant — bump to force global re-embed without changing the schema.
- `measureCoverage(doc: EmbeddingDocument): CoverageReport` — counts which rich fields (keywords, credits, genres, overview) are present for diagnostics.

### 3. Embedding provider abstraction

**File:** `/apps/api/src/services/embedding-provider.ts`

- `EmbeddingProvider` interface:
  ```ts
  interface EmbeddingProvider {
    readonly modelProvider: string;
    readonly modelName: string;
    readonly dimension: number;
    embed(text: string): Promise<number[]>;
    embedBatch(texts: string[], batchSize?: number): Promise<number[][]>;
  }
  ```
- `OpenAIEmbeddingProvider` implementation using `text-embedding-3-small` (1536d) via the `openai` npm package; reads `OPENAI_API_KEY` from env.
- `createDefaultProvider(): EmbeddingProvider` factory returning the OpenAI provider.
- No other providers in-scope; interface is the only extension point required.

### 4. Embedding service

**File:** `/apps/api/src/services/embedding-service.ts`

- `upsertEmbedding(mediaId, mediaType, provider): Promise<UpsertResult>`:
  - Loads movie/series row + genres + credits.
  - Builds document + hash.
  - Skips (returns `{ action: 'skipped' }`) if existing row in `media_embeddings` has same `doc_hash` and same model.
  - Calls `provider.embed(document.text)`.
  - Upserts `media_embeddings` row.
- `semanticSearch(queryText, topK, opts): Promise<SemanticCandidate[]>`:
  - Embeds query text with provider.
  - SQL: `ORDER BY embedding <=> $queryVector LIMIT $topK` (cosine distance).
  - Returns: `{ mediaId, mediaType, similarity, modelProvider, modelName, rank }`.

### 5. Idempotent backfill service

**File:** `/apps/api/src/services/embedding-backfill-service.ts`

- `runBackfill(opts: BackfillOpts): Promise<BackfillResult>`:
  - Queries movies and series where `metadataEnrichedAt IS NOT NULL`, paginated by cursor (ordered by `createdAt ASC, id ASC`).
  - Batch size: 50; concurrency: 5 (p-limit or manual semaphore).
  - Skips items whose `doc_hash` is unchanged (delegates to `upsertEmbedding`).
  - Retry with exponential backoff (3 attempts) on provider rate-limit/transient errors.
  - Progress counters: `processed`, `embedded`, `skipped`, `failed`.
  - Writes a `BackfillResult` summary (not persisted to DB; returned and logged).
- Entire backfill is re-runnable safely; never deletes existing embeddings.

### 6. Backfill admin route (replace stub)

**File:** `/apps/api/src/routes/embedding-backfill.ts` (replace 501 stub)

- `POST /admin/embedding-backfill` → triggers `runBackfill` synchronously (for now; no job queue needed), returns `BackfillResult` JSON.
- `GET /admin/embedding-backfill/coverage` → returns per-field coverage aggregate across embedded catalog.

### 7. Incremental update hook in enrichment pipeline

**File:** `/apps/api/src/services/metadata-enrichment-service.ts` (modify)

- After successful enrichment of a movie or series, fire-and-forget call to `upsertEmbedding`.
- Errors are logged but do not propagate to the caller or fail the enrichment.
- The hook checks `doc_hash` inside `upsertEmbedding`; no embedding call is made if nothing changed.

### 8. Semantic retrieval stage

**File:** `/apps/api/src/services/semantic-retrieval-service.ts`

- `SemanticRetrievalService` class:
  - `retrieve(queryText: string, topK: number): Promise<SemanticResult[]>`
  - Returns: `{ mediaId, mediaType, similarity, modelProvider, modelName, docHash, generatedAt }`.
- Callable from the recommendation pipeline as an optional pre-filter stage; not integrated into `recommendation-ranking-service.ts` scoring yet (that is a follow-up combining semantic + taste).

### 9. Recommendation Lab API endpoint

**File:** `/apps/api/src/routes/recommendation-lab.ts` (new file; registered in `index.ts`)

- `POST /recommendation-lab/semantic-query`
  - Body: `{ query: string; topK?: number; compareQuery?: string; }`
  - Response: primary result list + optional comparison list, each entry with `{ mediaId, mediaType, title, year, posterPath, similarity, modelProvider, modelName }`.
- Requires admin JWT (same guard as other admin routes).

### 10. API contracts

**File:** `/packages/api-contracts/src/embeddings.ts` (new)

- Export: `SemanticQueryRequest`, `SemanticQueryResponse`, `SemanticCandidate`.
- Referenced by both API route and web Lab page.

### 11. Recommendation Lab UI

**File:** `/apps/web/src/` (locate existing Lab page from T204 context; add semantic tab)

- Text input for free-text query and optional comparison query.
- Ranked card list showing title, year, poster, similarity score, model name/version.
- Side-by-side layout when comparison query is provided.
- No new design system components; reuse existing card components.

### 12. Benchmark suite

**File:** `/apps/api/src/benchmarks/embedding-benchmarks.ts`

- Five benchmark queries (as defined in ticket):
  1. `SF qui fait réfléchir`
  2. `thriller en huis clos où personne n'est fiable`
  3. `anime à binge-watcher`
  4. `comédie légère familiale`
  5. `film sombre sur l'intelligence artificielle`
- Each entry carries a manually curated list of expected/reasonable titles from the real catalog (filled after backfill runs).
- `runBenchmark()` function: executes each query → prints top-10 results → marks hits against expected list → prints precision@5 and precision@10 qualitative scores.
- CLI entry point: `pnpm --filter api benchmark:embeddings` (add to `package.json` scripts).

### 13. Coverage diagnostics

- `GET /admin/embedding-backfill/coverage` (from §6) returns:
  ```json
  {
    "total": 1200,
    "embedded": 950,
    "coverageByField": {
      "overview": 0.98,
      "keywords": 0.62,
      "credits": 0.88,
      "genres": 0.99
    }
  }
  ```
- `measureCoverage` in document builder drives per-document metrics; backfill aggregates.

### 14. Tests

- `/apps/api/src/services/__tests__/embedding-document-builder.test.ts`:
  - Determinism: same input → same hash across two calls.
  - Hash changes when a material field changes.
  - `DOCUMENT_VERSION` bump changes hash even when data is identical.
  - Coverage report counts correctly.
- `/apps/api/src/services/__tests__/embedding-service.test.ts`:
  - `upsertEmbedding` skips when hash is unchanged (provider not called).
  - `semanticSearch` returns ordered results by distance.
  - Uses mock provider (no real API calls).
- `/apps/api/src/services/__tests__/embedding-backfill-service.test.ts`:
  - Idempotency: second run skips all items with unchanged hashes.
  - Retry on transient provider error.
  - Progress counters accurate.

## Excluded

- LLM query planning, intent parsing, or natural-language query rewriting (planned follow-up).
- Combining semantic scores with profile taste/genre affinity into a final ranked blend (follow-up; `recommendation-ranking-service.ts` is not modified beyond the optional retrieval stage hook).
- External vector SaaS (Pinecone, Weaviate, Qdrant); pgvector is the only target.
- Additional embedding providers beyond OpenAI `text-embedding-3-small`; the abstraction is in place but only one implementation is delivered.
- New TMDB API calls or scraping to enrich keywords/credits beyond what is already stored in the database.
- Android TV, media-relay, or Plex/Xtream changes.
- Anime classification (mentioned in ticket as optional); no special handling added.
- Embedding of `discovery_candidates` (not yet canonical catalog entries).
- Production infrastructure changes (Railway configuration, env var management).

## Acceptance criteria

1. **Migration applies cleanly** — `pnpm --filter api db:migrate` succeeds on a fresh database; `media_embeddings` table and HNSW index exist; pgvector extension is enabled.
2. **Document builder is deterministic** — unit tests pass; identical inputs produce identical text and hash; `DOCUMENT_VERSION` bump changes hash.
3. **Backfill is idempotent** — running `POST /admin/embedding-backfill` twice produces no duplicate rows; second run reports all items `skipped`; row count in `media_embeddings` is stable.
4. **Provider is replaceable** — changing `modelName` in the factory function creates new embedding rows under the new model key; old rows are preserved.
5. **Incremental update fires** — after a manual enrichment of one title, a new or updated row appears in `media_embeddings` for that title without a manual backfill trigger.
6. **Semantic retrieval returns ranked results** — `POST /recommendation-lab/semantic-query` with `{ "query": "SF qui fait réfléchir" }` returns 10+ results with `similarity` scores between 0 and 1, ordered descending.
7. **Lab UI renders results** — the Recommendation Lab page displays query input, result cards with title/year/poster/similarity/model, and side-by-side comparison when two queries are submitted.
8. **Structured metadata remains separate** — no genre, runtime, language, or availability filters are encoded into the embedding vector text; structured columns on `movies`/`series` remain the source of truth for those filters.
9. **Benchmark suite passes qualitatively** — running `pnpm --filter api benchmark:embeddings` prints precision@5 results; at least 3 of 5 benchmark queries return at least one expected/reasonable title in top-5 against the actual catalog.
10. **Coverage report is visible** — `GET /admin/embedding-backfill/coverage` returns field-level coverage percentages; the response is honest (does not claim rich embeddings if keywords or credits are absent for most titles).
