All fixes are clean. Here's a summary of what was changed:

**Files modified:**

| File | Fix |
|---|---|
| `src/pipeline/stages/text-search.ts` | **[BLOQUANT]** DB error message in catch block replaced with generic `'Database query error'` — full error still logged server-side. **[MINEUR]** `durationMs` captured once before log + return. |
| `src/routes/query.ts` | **[MOYEN]** `stages` field removed from Zod schema (was accepted but fully ignored). **[MINEUR]** Profile 404 message no longer echoes the UUID. |
| `src/routes/health.ts` | **[RECOMMANDÉ]** Added `SELECT 1` DB probe — returns HTTP 503 if DB is unreachable. |
| `README.md` | Health check and stages field documented accurately. |
