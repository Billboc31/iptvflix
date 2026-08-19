# T112 — Production Topology Decision

**Date**: 2026-08-19  
**Status**: DECIDED

## Selected topology: single PostgreSQL + pgvector database

All IPTVFlix relational data (movies, series, profiles, watch progress, My List, sources) AND vector embeddings (`media_embeddings`) live in **one** PostgreSQL database with the `vector` extension enabled.

## Evidence from codebase

| Signal | Finding |
|--------|---------|
| `apps/api/src/config/env.ts` | One `DATABASE_URL` required field; no second DB URL |
| `apps/api/src/db/client.ts` | Single drizzle `db` instance created from `DATABASE_URL` |
| `apps/api/src/db/schema/media-embeddings.ts` | `media_embeddings` table in same schema as `movies`, `series`, `profiles` |
| `apps/api/src/db/ensure-pgvector.ts` | Reads from same `db` client; upgrades `media_embeddings.embedding` column in-place |
| `apps/api/src/services/embedding-service.ts` | Takes `db` parameter; no separate vector DB client |
| `apps/api/scripts/migrate-safe.mjs` | Warns if `movies = 0` — explicitly expects catalog in the same DB as embeddings |

No dual-DB abstraction exists anywhere in the repository. There is no "vector database URL" env var, no separate connection pool for embeddings, and no routing logic that would split catalog queries from vector queries.

## Consequences

- The new pgvector-capable PostgreSQL database **must receive all relational data** via `pg_restore` before it becomes production.
- Setting `DATABASE_URL` to the new DB while it is still empty would break the entire application (login, catalog, profiles, playback).
- The `ensure-pgvector.ts` startup routine runs idempotently on the new DB on first deploy: it creates the `vector` extension, upgrades `media_embeddings.embedding` from `float8[]` to `vector(1536)`, and creates the HNSW cosine index.

## Migration path

```
Current DB (relational data, float8[] embeddings)
    │
    │  pg_dump → pg_restore (scripts/migrate-pgvector-db.sh)
    ▼
New DB (relational data restored, then vector extension activated by ensure-pgvector.ts on startup)
    │
    │  POST /admin/embedding-backfill
    ▼
New DB (relational data + vector(1536) embeddings + HNSW index)
    │
    │  Update DATABASE_URL in Railway
    ▼
Production (single DB, full pgvector stack)
```
