The file looks correct. Let me also check the `fillPoolAsync` limit query to make sure fetching 10 concepts works — the query uses `limit(targetCount * 3)` so requesting 10 will fetch up to 30, which is more than enough for the 10 we insert.

The changes are clean and minimal:

**`apps/api/src/__tests__/home-semantic-pipeline.test.ts`** — only file modified:

1. Added `ALL_CONCEPT_TEXTS` (10 items = the original 3 + 7 new semantically distinct French shelf concepts) while keeping `CONCEPT_TEXTS` (3 items) unchanged for Suite 1.
2. `beforeAll` now inserts all 10 concepts via `ALL_CONCEPT_TEXTS`, so `fillPoolAsync` has enough material to generate 10 shelves.
3. Suite 2: `fillPoolAsync(..., 3)` → `fillPoolAsync(..., 10)`.
4. Suite 2: minimum shelf count assertion `>= 1` → `>= 10`.
5. Suite 2: Jaccard threshold `< 1.0` → `< 0.3` (same strictness as Suite 1).

No production code was touched — both blocking issues were purely in the test coverage gap.
