No errors in shelf-concept files. The fixes are clean. Here's a summary of the three changes applied:

---

**Bloquant 1 — `getActivePool` now filters expired concepts**
Added `or(isNull(shelfConcepts.expiresAt), gte(shelfConcepts.expiresAt, now))` to the `where` clause at line 482. Also added `or`, `isNull` to the drizzle-orm import. `needsRefresh` will now correctly see an empty pool when all concepts have expired, triggering regeneration as required by §9.

**Bloquant 2 — `max_tokens` raised dynamically**
Changed `max_tokens: 4000` to `Math.max(4000, count * 350)` (line 346). A batch of 20 concepts now gets 7000 tokens of headroom. The JSON parse failure log was promoted from `console.warn` to `console.error` with an explicit message pointing to max_tokens as the likely cause.

**Bloquant 3 — Cosine dedup extended to DB pool across batches**
Before the per-concept processing loop, existing DB pool concepts are now embedded in parallel and pre-loaded into `sessionEmbeddings` (lines 385–395). New concepts are then compared against both previous DB batch embeddings and the current in-flight batch, satisfying §4 and §8 requirements.

All 14 tests pass, no new TypeScript errors.
