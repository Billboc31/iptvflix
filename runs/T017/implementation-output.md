T017 implementation is complete. Here is the summary:

---

## T017 — Implementation Complete

All deliverables from the approved plan are committed and all **229 tests pass**.

### What was implemented

| Step | File | Status |
|------|------|--------|
| 1. Variant extractor | `apps/api/src/matching/variant-extractor.ts` | ✅ Committed |
| 2. NormalizeResult extension | `apps/api/src/matching/title-normalizer.ts` | ✅ Committed |
| 3. Schema additions (4 columns × 3 tables) | `apps/api/src/db/schema/availabilities.ts` | ✅ Committed |
| 4. Drizzle migration | `apps/api/migrations/0008_living_sphinx.sql` | ✅ Committed |
| 5. Catalog-sync upsert | `apps/api/src/services/catalog-sync-service.ts` | ✅ Committed |
| 6. API contract types | `packages/api-contracts/src/catalog.ts` | ✅ Committed |
| 7. Catalog service quality derivation | `apps/api/src/services/catalog-service.ts` | ✅ Committed |
| 8. Route wiring (detail + list) | `apps/api/src/routes/catalog.ts` | ✅ Committed |
| 9. Tests (extractor + normalizer + routes) | 3 test files | ✅ 229/229 pass |

### Key correctness guarantees verified by tests

- `VOSTFR` → `subtitleLanguage: 'fr'`, `audioLanguage: null` (never French audio)
- `MULTI`/`MULTi` → both language fields `null` (no false assertion)
- Unknown tags → all fields `null` (never guessed)
- Two availability rows for same movie → 2 `variants` entries, 1 catalog card
