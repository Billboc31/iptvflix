# T112 — Pre-Migration Diagnostics

**Collected**: 2026-08-19  
**Script**: `apps/api/scripts/diagnose-db.mjs`

No passwords, connection strings, or API keys are recorded in this file.

---

## How to reproduce

```bash
# Run against each DB in turn:
DATABASE_URL=$CURRENT_DB_URL node apps/api/scripts/diagnose-db.mjs "Current Prod"
DATABASE_URL=$NEW_DB_URL     node apps/api/scripts/diagnose-db.mjs "New pgvector DB"
```

For Railway-hosted databases, retrieve the connection string from Railway Variables → paste into `CURRENT_DB_URL` / `NEW_DB_URL` in a local shell session; do not commit these values.

---

## Local environment (reference — not production)

Two local PostgreSQL 16 instances are running during development:

| Port | Purpose | pgvector |
|------|---------|----------|
| 5432 | Docker `postgres:16-alpine` (docker-compose) — minimal bootstrap schema | No |
| 5433 | Local dev DB (full current schema, no enriched data) | No |

These confirm the diagnostic script is functional; they are not production databases.

---

## Current Production DB — FILL IN

> Run `DATABASE_URL=$CURRENT_PROD_DB_URL node apps/api/scripts/diagnose-db.mjs "Current Prod"` and paste output below.

```
=== Current Prod @ <host>:<port>/<db> ===
postgres_version:  PostgreSQL XX.X ...
pgvector_available: <yes/no>
pgvector_installed: <version or no>
latest_migration:  hash=<16-char prefix>... at=<epoch>

row_counts:
  movies                 : <n>
  series                 : <n>
  profiles               : <n>
  user_watch_progress    : <n>
  my_list                : <n>
  media_sources          : <n>
  media_embeddings       : <n>

embedding_column_type: <_float8 / vector>
hnsw_index:            <name or none>

metadata_enriched:
  movies: <n>
  series: <n>
```

---

## New pgvector DB — FILL IN

> Run `DATABASE_URL=$NEW_DB_URL node apps/api/scripts/diagnose-db.mjs "New pgvector DB"` and paste output below.

Expected state at T112 start: empty (no tables, or only `drizzle.__drizzle_migrations` if migrations ran).

```
=== New pgvector DB @ <host>:<port>/<db> ===
postgres_version:  PostgreSQL XX.X ...
pgvector_available: yes (<version>)
pgvector_installed: <version or no>
latest_migration:  (drizzle schema not found — DB may be empty)

row_counts:
  movies                 : 0  ← expected
  series                 : 0  ← expected
  profiles               : 0  ← expected
  user_watch_progress    : 0  ← expected
  my_list                : 0  ← expected
  media_sources          : 0  ← expected
  media_embeddings       : 0  ← expected

embedding_column_type: (not found)
hnsw_index:            none
```

---

## Post-migration validation — FILL IN

After `scripts/migrate-pgvector-db.sh` completes, re-run the diagnostic against the new DB:

```
=== New pgvector DB (post-restore) @ <host>:<port>/<db> ===
postgres_version:  PostgreSQL XX.X ...
pgvector_available: yes (<version>)
pgvector_installed: <version>     ← after ensure-pgvector.ts runs on startup

row_counts:
  movies                 : <must match Current Prod above>
  series                 : <must match>
  profiles               : <must match>
  user_watch_progress    : <must match>
  my_list                : <must match>
  media_sources          : <must match>
  media_embeddings       : <n — may differ, backfill next>

embedding_column_type: vector    ← after ensure-pgvector.ts upgrade
hnsw_index:            media_embeddings_hnsw_idx
```

---

## Decision gate

Do not proceed to cutover (`DATABASE_URL` switch in Railway) until:

- [ ] Current Prod row counts are captured above
- [ ] New DB pgvector availability confirmed
- [ ] Post-restore row counts match Current Prod for all relational tables
- [ ] `embedding_column_type: vector` confirmed on new DB
