All tasks complete. Here is a summary of every file created or modified:

---

## Summary

### Files created
- **`apps/api/migrations/0019_generated_shelf.sql`** — Drizzle-generated migration: `ALTER TYPE "public"."shelf_type" ADD VALUE 'GENERATED'`
- **`apps/api/migrations/meta/0019_snapshot.json`** — Drizzle snapshot (auto-generated)
- **`apps/api/src/services/shelf-generation-service.ts`** — New service with:
  - `generateShelfFromSeeds(profileId, body)` — validates 2–10 seeds, infers genres, ranks via existing engine, filters seeds, materializes discovery candidates, persists shelf + members + rules intent
  - `materializeDiscoveryCandidate(candidateId, mediaType)` — private helper: checks for existing canonical link, otherwise creates canonical Movie/Series with zero availability and writes FK back
  - `refreshGeneratedShelf(shelfId, profileId)` — replaces members and updates `generatedAt` in rules
- **`apps/api/src/services/__tests__/shelf-generation-service.test.ts`** — 14 tests covering all plan scenarios: seed count validation, unknown seed rejection, determinism, seed exclusion, deduplication, materialization, `availableToMe` constraint, persistence, refresh, and explanation metadata

### Files modified
- **`packages/api-contracts/src/shelves.ts`** — Added `GENERATED` to `ShelfType`; added `SeedMediaRef`, `GeneratedShelfRules`, `GenerateShelfBody`, `GenerateShelfResponse` types
- **`apps/api/src/db/schema/shelves.ts`** — Added `'GENERATED'` to `shelfTypeEnum`
- **`apps/api/src/services/recommendation-ranking-service.ts`** — Added `positiveMediaIds?: string[]` to `RankOpts`; merged with taste `positiveMediaIds` for scoring
- **`apps/api/src/services/shelf-service.ts`** — `getShelf` resolves `GENERATED` shelves via stored `shelfMembers` (same as MANUAL); updated type casts throughout
- **`apps/api/src/routes/shelves.ts`** — Added `POST /shelves/generate` (creates generated shelf, 201) and `POST /shelves/:id/refresh` (refreshes existing GENERATED shelf); server-side validation of seed count, mediaType, and each seed entry
