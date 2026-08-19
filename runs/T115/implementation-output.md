Here's a summary of all fixes applied in this coder attempt:

---

**3 additional fixes beyond what coder-attempt-5 had:**

1. **Migration rename** — `0045_t115_enrichment_failures.sql` → `0047_t115_enrichment_failures.sql`  
   Two files shared the `0045` prefix. The T114 migration already owns that slot; the T115 migration is moved to `0047`.

2. **Journal update** — `migrations/meta/_journal.json` (4 new entries, idx 44–47)  
   `migrate-safe.mjs` is journal-driven — files not listed in it are silently skipped. All 4 new migrations (T107, T114, and the two T115 ones) were unregistered. Added entries for all of them. Validated: all 48 journal entries have matching SQL files.

3. **Bug fix in `catalog-stats.ts:20`** — `staleThreshold` `.toISOString()`  
   A bare `new Date()` inside a `sql\`...\`` template literal caused a `TypeError` in the postgres.js driver. Fixed by calling `.toISOString()` to pass a string. The endpoint now returns 200.

**Local validation run** confirms end-to-end correctness: 5 TMDB-matched items enriched (3 movies + 2 series), 0 terminal failures, 444 episodes fetched, before/after stats captured in `runs/T115/local-validation-run-20260819.md`.

**The only remaining gap** is a full production run (~60k movies / ~5k series). That requires access to the production environment to deploy the branch and execute the endpoints.
