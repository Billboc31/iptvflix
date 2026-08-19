## Objective

Safely migrate all existing IPTVFlix relational production data into the new PostgreSQL+pgvector database, activate the pgvector extension and HNSW index, backfill semantic embeddings for the canonical catalog, and validate that real recommendation queries execute via the pgvector distance path — without losing any user or catalog state.

## Included

### Step 1 — Pre-migration diagnostics (read-only, no secrets committed)

- Connect to both production databases and collect: schema migration version (`drizzle_migrations` latest), row counts for `movies`, `series`, `profiles`, `user_watch_progress`, `my_list`, `media_sources`, `media_embeddings`; PostgreSQL version; pgvector extension availability + version.
- Record results in `runs/T112/diagnostics.md` (no passwords, no connection strings).

### Step 2 — Topology decision

- Confirm the codebase uses a single `DATABASE_URL`; `apps/api/src/config/env.ts` has one `DATABASE_URL` required field. No dual-DB abstraction exists.
- Selected topology: **single PostgreSQL+pgvector DB** containing both relational IPTVFlix data and vector columns. Document this in `runs/T112/topology.md`.

### Step 3 — Backup current production DB

- `pg_dump` current production DB to a timestamped `.dump` file stored outside the repo (Railway volume or S3). Verify dump integrity with `pg_restore --list`.
- Do not restore or touch the new pgvector DB until backup is verified.

### Step 4 — Restore relational data into new pgvector DB

- `pg_restore` into the new empty pgvector DB.
- Validate row counts match diagnostics from Step 1.
- Keep old DB live; do not change `DATABASE_URL` yet.

### Step 5 — Activate pgvector schema in new DB

- Run `CREATE EXTENSION IF NOT EXISTS vector` on the new DB.
- The existing `apps/api/src/db/ensure-pgvector.ts` startup routine auto-converts the `embedding` column from `float8[]` to `vector(1536)` and creates the HNSW index (cosine). This runs automatically on first app start against the new DB.
- Verify with `\d media_embeddings` that the column type is `vector(1536)` and the HNSW index exists.

### Step 6 — Validate OpenAI configuration

- Confirm `OPENAI_API_KEY` is set in the Railway service environment (no console print, no commit).
- Check `apps/api/src/config/env.ts` that `OPENAI_API_KEY` is present and the default model is `text-embedding-3-small` (1536 dims) matching the schema column.

### Step 7 — Switch `DATABASE_URL` to new pgvector DB

- Update `DATABASE_URL` in Railway environment to point to the new DB.
- Deploy. Verify login, Home, catalog, Continue Watching, My List, and playback source resolution all work (manual smoke check).

### Step 8 — Incremental embedding backfill

- POST `/admin/embedding-backfill` to trigger the existing `EmbeddingBackfillService.runBackfill()`.
  - Already cursor-paginated, 50 items/batch, 5 concurrent, retries with exponential backoff, idempotent via `docHash`.
  - Only processes rows where `metadataEnrichedAt IS NOT NULL` and hash differs.
- Monitor progress via logs; restart is safe (backfill resumes from missing rows).

### Step 9 — Coverage diagnostics

- GET `/admin/embedding-backfill/coverage` to capture: total movies, total series, embedded count, missing/failed count, overview/keywords/language coverage ratios, vector index mode (`pgvector` vs `float8`), embedding model + dimension.
- Save response to `runs/T112/coverage.json`.

### Step 10 — Semantic validation

- POST `/recommendation-lab/semantic-query` with:
  - `"SF qui fait réfléchir"`
  - `"thriller en huis clos où personne n'est fiable"`
  - `"comédie légère familiale"`
- Confirm index mode logged by the API is `pgvector` (not `float8`).
- Collect `EXPLAIN` output on one representative query (via `apps/api/src/db/embedding-service.ts` semanticSearch pgvector branch) and save to `runs/T112/semantic-validation.md` (no user data, no secrets).

### Step 11 — Rollback path documentation

- Document in `runs/T112/rollback.md`: how to revert `DATABASE_URL` to old DB on Railway if regression is detected. Old DB remains untouched.

## Excluded

- TMDB metadata re-enrichment or catalog expansion (belongs to #211 follow-up).
- Any change to embedding model, dimensions, or document builder logic.
- Automated backup scheduling or backup infrastructure beyond the one-time pre-migration dump.
- Multi-database topology implementation; single `DATABASE_URL` is the confirmed design.
- CI/CD pipeline changes.
- Embedding generation for rows without `metadataEnrichedAt` (existing backfill service constraint, unchanged).
- Any changes to the recommendation ranking algorithm.

## Acceptance criteria

- `runs/T112/diagnostics.md` exists with pre-migration row counts from both DBs (no secrets).
- `pg_dump` backup is verified (`pg_restore --list` succeeds) before any restore.
- New pgvector DB row counts match old DB row counts for all tables listed in Step 1.
- `CREATE EXTENSION vector` reports success; `\d media_embeddings` shows `vector(1536)` column + HNSW index.
- Application startup log reports index mode `pgvector`.
- Login, profile list, Home catalog, Continue Watching, My List, and a playback-trigger all succeed on the new DB.
- `OPENAI_API_KEY` confirmed present in Railway env (not logged, not committed).
- `/admin/embedding-backfill` completes with zero unrecoverable failures; coverage endpoint reports embedded count ≥ 90% of eligible rows.
- `runs/T112/coverage.json` saved with all fields populated.
- All three test queries return sensible results from the Recommendation Lab.
- Logs confirm queries used the `pgvector` distance path, not the `float8` fallback.
- `runs/T112/rollback.md` documents the revert procedure referencing the old `DATABASE_URL`.
- Old production DB is not dropped; connection string kept in a secure note outside the repo.
