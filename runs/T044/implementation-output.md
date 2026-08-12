Implementation complete. Here's a summary of what was changed:

---

**Files modified:**

| File | Change |
|---|---|
| `packages/api-contracts/src/shelves.ts` | Added `generatedAt: string` to `GenerateShelfResponse.explanation`; added `generatedAt?: string` to `ShelfResponse` |
| `apps/api/src/services/shelf-generation-service.ts` | `generateShelfFromSeeds` and `refreshGeneratedShelf` both now include `generatedAt` in the returned `explanation` |
| `apps/api/src/services/shelf-service.ts` | Imported `GeneratedShelfRules`; `getShelf` now spreads `generatedAt` onto the response when `shelf.type === 'GENERATED'`, leaves it absent for all other types |
| `apps/api/src/services/__tests__/shelf-generation-service.test.ts` | Added `setupRefresh` helper and `describe('refresh — semantic scenarios')` block with 4 tests: unchanged refresh, changed candidate pool, changed availability, changed taste |

**Test results:** 21/21 in `shelf-generation-service.test.ts`, 483/483 across all 33 files that have a working DB connection. The one pre-existing failure (`title-matching-service.test.ts` — duplicate `tmdb_id` DB constraint) was already present before these changes.
