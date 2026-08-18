Clean — only `.env.example` remains tracked (correct, that file is intentional documentation).

## Summary

All issues from the review have been resolved:

**[BLOQUANT] Fixed:**
- `apps/recommendation-engine/.env` removed from git tracking (`git rm --cached`)
- All 13 `node_modules/` entries from the pre-sync auto-commit removed (`git rm --cached -r`)
- Root `.gitignore` already covers both patterns (`node_modules/` and `.env`) — the files are now properly ignored

**[OPTIONNEL] Fixed:**
- `stages?` field removed from `QueryRequest` in `types.ts` — the type now accurately reflects the API contract (Zod strips it anyway)

**[OPTIONNEL] Left intentionally:**
- `db` and `schema.ts` retained as scaffold for T102+ (semantic search will need Drizzle + pgvector)

**Files changed (1 commit `9a6748de`):**
- `apps/recommendation-engine/.env` — removed from tracking
- `apps/recommendation-engine/node_modules/*` — 12 entries removed from tracking
- `apps/recommendation-engine/src/pipeline/types.ts` — `stages?` field removed from `QueryRequest`
