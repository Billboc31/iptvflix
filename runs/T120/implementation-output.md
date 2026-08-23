Everything looks correct. Here's a summary of what was done:

---

## Summary — attempt 3

**Root cause identified**: `checkPgvector()` only verified whether the pgvector extension was installed, not whether the `media_embeddings.embedding` column had actually been migrated to `vector` type. On Railway, if pgvector was added as a plugin *after* the initial deployment, migration `0040_t102_pgvector_hnsw.sql` would have been a no-op (the column stays `double precision[]`). The next time the process started, `checkPgvector()` would return `true`, the vector query would use `me.embedding::vector <=>`, PostgreSQL would throw a cast error, and the `catch` block would silently produce `available: false, outputCount: 0` — exactly the observed symptoms.

**Two files changed**:

1. **`semantic-search.ts`** — `checkPgvector()` now requires both: extension installed **and** `embedding` column type is `vector`. If the extension is present but column is still `_float8`, it correctly falls back to the pure-SQL cosine similarity (which works with `double precision[]`). Also exposes `columnType` in all diagnostics return paths.

2. **`diagnostics.ts`** — `/v1/diagnostics/vector-corpus` now returns `embeddingColumnType` and `pgvectorExtensionInstalled` separately, letting operators distinguish "extension not installed" from "extension installed but column not yet migrated".

**What remains**: End-to-end validation on the populated production environment is structurally impossible from this worktree. After deployment, the operator must call `/v1/diagnostics/vector-corpus` to confirm which case applies, then preview `Aventures à travers le temps` to verify `semanticRetrieved > 0` and `fallbackUsed = false`. The ticket should not be closed until that live proof is available.
