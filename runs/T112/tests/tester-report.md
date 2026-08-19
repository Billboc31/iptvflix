# T112 — Tester Report

**Date**: 2026-08-19 (updated with tester-attempt-3 execution)  
**Branch**: ticket/T112-activate-production-pgvector-database-and-backfill  
**Tester**: automated (role: tester)

---

## Scope

Validation of T112 acceptance criteria against:
- committed code on the branch (4 files changed vs `main`)
- static analysis / TypeScript compilation
- unit test suite
- artifact review

Production execution steps (pg_dump/pg_restore, Railway cutover, embedding backfill, Recommendation Lab queries) are operator-gated and **cannot be validated without Railway credentials**. These are marked `OPERATOR REQUIRED`.

---

## Code delta vs `main`

| File | Change |
|------|--------|
| `apps/api/scripts/diagnose-db.mjs` | New — read-only diagnostic script |
| `apps/api/src/routes/embedding-backfill.ts` | Modified — coverage endpoint enriched |
| `apps/api/package.json` | Modified — `postgres` dependency added |
| `scripts/migrate-pgvector-db.sh` | New — pg_dump/pg_restore migration script |

---

## Static checks

| Check | Result |
|-------|--------|
| `tsc --noEmit` (apps/api) | **PASS** — zero errors |
| `bash -n scripts/migrate-pgvector-db.sh` | **PASS** — valid syntax |
| `node --check apps/api/scripts/diagnose-db.mjs` | **PASS** — valid syntax |

---

## Unit tests

```
npx vitest run src/routes/__tests__/embedding-backfill.test.ts
```

```
✓ POST /admin/embedding-backfill > returns 503 when OPENAI_API_KEY is not configured
✓ GET /admin/embedding-backfill/coverage > returns coverage summary

Test Files  1 passed (1)
Tests       2 passed (2)
```

**PASS** — both T112 tests pass.

### Pre-existing failures (unrelated to T112)

The full API suite has 15 failures (tester-attempt-3 observed), all pre-existing and confirmed unrelated to T112 changes:

| File | Count | Related to T112? |
|------|-------|-----------------|
| `src/routes/__tests__/shelves.test.ts` | 13 | No |
| `src/services/__tests__/shelf-concept-generator-service.test.ts` | 1 | No |
| `src/services/__tests__/title-matching-service.test.ts` | 1 | No |

**No regressions introduced by T112.**

---

## Acceptance criteria

### AC-1 — Empty new pgvector DB is never treated as production source of truth before migration

**PASS**

Evidence:
- `scripts/migrate-pgvector-db.sh` lines 37–43: pre-flight check verifies source (`movies > 0`) before any restore.
- `scripts/migrate-pgvector-db.sh` lines 48–57: destination empty check with interactive abort.
- `runs/T112/topology.md`: documents that setting `DATABASE_URL` to an empty DB breaks the application; cutover only after row-count validation.
- `runs/T112/diagnostics.md`: decision gate section lists explicit checkboxes before cutover.

---

### AC-2 — Existing production relational data is backed up and preserved

**OPERATOR REQUIRED**

Code is correct:
- `scripts/migrate-pgvector-db.sh`: `pg_dump --format=custom` → `pg_restore --list` integrity check → `pg_restore --clean --if-exists --exit-on-error`.
- Row-count comparison loop covers: `movies`, `series`, `profiles`, `user_watch_progress`, `my_list`, `media_sources`, `media_embeddings`.
- `/tmp/` ephemeral warning present at line 116.

Pending: operator must run the script against Railway prod URLs and fill in `runs/T112/diagnostics.md`.

---

### AC-3 — New production DB has pgvector enabled and correct vector schema/index

**PASS** (code path verified)

`apps/api/src/db/ensure-pgvector.ts` (run on startup):
1. `CREATE EXTENSION IF NOT EXISTS vector` — idempotent.
2. `ALTER TABLE media_embeddings ALTER COLUMN embedding TYPE vector(1536) USING embedding::vector` — only if column is `float8[]`.
3. `CREATE INDEX IF NOT EXISTS media_embeddings_hnsw_idx ON media_embeddings USING hnsw (embedding vector_cosine_ops)` — idempotent.
4. Sets in-process `EmbeddingIndexMode` to `'pgvector'` after confirming column type.

Fallback to `float8` mode is safe on non-pgvector Postgres.

Pending: operator must verify `\d media_embeddings` after deploy shows `vector(1536)` column + HNSW index.

---

### AC-4 — Application can read/write normal relational data after migration

**OPERATOR REQUIRED**

No code change affects relational queries. `pg_restore` preserves schema + data + IDs/FKs. Validation requires a live smoke check (login, catalog, Continue Watching, My List, playback) against the new Railway DB.

---

### AC-5 — OpenAI embedding provider configuration works without secret leakage

**PASS**

- `apps/api/src/routes/embedding-backfill.ts:15-17`: returns `503` if `OPENAI_API_KEY` absent — catalog/API availability unaffected.
- `apps/api/src/services/embedding-provider.ts`: `apiKey` is only passed to `OpenAI` constructor, never serialized or logged.
- `apps/api/scripts/diagnose-db.mjs:17-23`: URL masking strips credentials, outputs only `host:port/dbname`.
- No API key appears in any committed artifact.
- `GET /admin/embedding-backfill/coverage`: returns `embeddingModel`/`embeddingDimension` as `null` (not the key) when `OPENAI_API_KEY` is absent.

---

### AC-6 — Real catalog embedding backfill is resumable/idempotent

**PASS** (pre-existing #205 code, reviewed in implementation-review.md)

- `embedding-backfill-service.ts`: cursor-paginated (50 items/batch, 5 concurrent).
- `embedding-service.ts:53-68`: `docHash` check — skips rows where hash + provider + model unchanged.
- Restartable: on restart, only rows with missing/stale embeddings are processed.
- `POST /admin/embedding-backfill` triggers via existing `runBackfill()`.

---

### AC-7 — Coverage counts are reported

**PASS**

`GET /admin/embedding-backfill/coverage` response verified against ticket §7 requirements:

| Required field | Present | Source |
|---------------|---------|--------|
| `totalMovies` | Yes | line 66 |
| `totalSeries` | Yes | line 67 |
| `total` | Yes | line 68 |
| `embedded` | Yes | line 69 |
| `missing` | Yes | line 70 (`total - embedded`) |
| `coverageByField.overview` | Yes | line 72 |
| `coverageByField.keywords` | Yes | line 73 |
| `coverageByField.language` | Yes | line 74 |
| `vectorIndexMode` | Yes | line 76 (`'pgvector'` or `'float8'`) |
| `embeddingModel` | Yes | line 77 (or `null`) |
| `embeddingDimension` | Yes | line 78 (or `null`) |

`runs/T112/coverage.json`: **ABSENT** — operator must capture this after production backfill.

---

### AC-8 — Semantic retrieval uses pgvector path in production

**OPERATOR REQUIRED**

Code path for pgvector retrieval exists in `embedding-service.ts` (pre-existing #205). `EmbeddingIndexMode` is set to `'pgvector'` by `ensure-pgvector.ts` after confirming the column type. Proof requires running three Recommendation Lab queries in production and confirming the log line `mode=pgvector`.

---

### AC-9 — Recommendation Lab returns sensible real results from vectors

**OPERATOR REQUIRED**

Requires production backfill to be complete. Three queries must be executed:
- `SF qui fait réfléchir`
- `thriller en huis clos où personne n'est fiable`
- `comédie légère familiale`

`runs/T112/semantic-validation.md`: **ABSENT** — operator must capture.

---

### AC-10 — Login, profiles, catalog, Continue Watching and playback-related relational state survive migration

**OPERATOR REQUIRED**

Requires production cutover + manual smoke check. No code path change affects these; all depend on `pg_restore` preserving relational state correctly.

---

### AC-11 — Old production DB remains available for rollback until validation is complete

**PASS**

- `scripts/migrate-pgvector-db.sh` never touches the source DB after dump.
- `runs/T112/rollback.md`: complete rollback procedure documented (Railway Variables revert, health check commands, root-cause table, retention policy checklist).

---

## Summary

| # | Criterion | Status |
|---|-----------|--------|
| 1 | Empty pgvector DB never used as source of truth before migration | **PASS** |
| 2 | Production data backed up and preserved | **OPERATOR REQUIRED** |
| 3 | pgvector enabled + correct schema/index on new DB | **PASS** (code verified) |
| 4 | Application reads/writes relational data after migration | **OPERATOR REQUIRED** |
| 5 | OpenAI config works without secret leakage | **PASS** |
| 6 | Backfill is resumable/idempotent | **PASS** |
| 7 | Coverage counts reported | **PASS** |
| 8 | Semantic retrieval uses pgvector path | **OPERATOR REQUIRED** |
| 9 | Recommendation Lab returns sensible results | **OPERATOR REQUIRED** |
| 10 | User/catalog state survives migration | **OPERATOR REQUIRED** |
| 11 | Old DB remains available for rollback | **PASS** |

**6 PASS — 5 OPERATOR REQUIRED — 0 FAIL**

---

## Blocking issues

None. The implementation is correct and complete within the scope accessible to a tester without production credentials.

## Operator checklist (before ticket closure)

Per ticket completion rule: *"Do not close because CREATE EXTENSION vector succeeds."*

- [ ] Run `diagnose-db.mjs` against both Railway DBs → fill `runs/T112/diagnostics.md`
- [ ] Run `scripts/migrate-pgvector-db.sh` → row counts match
- [ ] Update `DATABASE_URL` in Railway → deploy
- [ ] Smoke check: login / Home / catalog / Continue Watching / My List / playback
- [ ] `POST /admin/embedding-backfill` → zero unrecoverable failures
- [ ] `GET /admin/embedding-backfill/coverage` → save as `runs/T112/coverage.json` (embedded ≥ 90% of eligible)
- [ ] Recommendation Lab × 3 queries → logs confirm `mode=pgvector` → save `runs/T112/semantic-validation.md`
- [ ] Confirm old DB not dropped
