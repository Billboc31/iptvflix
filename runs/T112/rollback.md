# T112 — Rollback Procedure

**Status**: Keep this document until the new DB has been stable in production for ≥ 72 h.

## When to roll back

Roll back if any of the following occur after switching `DATABASE_URL` to the new pgvector DB:

- Login fails or profiles are missing
- Home/catalog returns 0 results or wrong titles
- Continue Watching or My List data is absent
- Playback source resolution fails (no `media_sources` rows)
- API crashes on startup (migration failure)
- Embedding backfill unrecoverable failures > 5%

## Rollback steps

### 1. Revert DATABASE_URL in Railway

1. Open the Railway dashboard → your project → the API service → **Variables**.
2. Find `DATABASE_URL`.
3. Change its value back to the original production DB connection string (the one that was in use before T112 cutover).
4. The original connection string is stored in your secure credential store (1Password / Railway secret note) — **not in this file**.
5. Click **Save** → Railway triggers a redeploy automatically.

### 2. Verify the revert

After redeployment (typically 60–120 s):

```bash
# Health check
curl https://your-api.railway.app/health

# Login smoke test
curl -X POST https://your-api.railway.app/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"<admin>","password":"<pass>"}'
```

Check Railway logs for:
```
[migrate-safe] postgres host=<old-host>
[ensure-pgvector] mode=float8   ← expected on old DB (no pgvector)
```

### 3. New DB remains intact

The new pgvector DB is **never dropped** as part of rollback. Its data remains intact for re-attempt.

If the issue is a missing migration on the new DB, re-run after fix:
```bash
DATABASE_URL=$NEW_DB_URL node apps/api/scripts/migrate-safe.mjs
```

### 4. Root-cause and re-attempt

Document the failure in `runs/T112/diagnostics.md` before re-attempting cutover.

Common causes and fixes:

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| `movies = 0` in logs | `DATABASE_URL` still points at empty pgvector DB | Verify URL value in Railway |
| Column type error on insert | `ensure-pgvector.ts` migration ran against wrong DB | Re-check startup logs, re-run migration |
| HNSW index missing | pgvector version < 0.5 (no HNSW support) | Upgrade pgvector or fall back to ivfflat |
| Embedding backfill 503 | `OPENAI_API_KEY` not set in Railway env | Add key to Railway variables |

## Old DB retention policy

The original production DB must remain accessible (not suspended, not dropped) until:

- [ ] New DB has been stable for ≥ 72 h
- [ ] A full embedding backfill has completed (coverage ≥ 90%)
- [ ] Recommendation Lab semantic queries confirmed via pgvector path
- [ ] A full backup of the new DB has been taken as successor snapshot

Only then may the old DB be suspended/archived (not deleted).
