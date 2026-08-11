T021 implementation is complete. Here's a summary:

## Files created

| File | Purpose |
|---|---|
| `apps/api/migrations/0008_shelves.sql` | DB migration — `shelves` + `shelf_members` tables with 3 new enums |
| `apps/api/src/db/schema/shelves.ts` | Drizzle schema for both tables |
| `packages/api-contracts/src/shelves.ts` | Shared types: `ShelfType`, `ShelfResponse`, `ShelfRuleDefinition`, etc. |
| `apps/api/src/services/shelf-service.ts` | Full service: list/get/create/update/delete, member CRUD, `validateDynamicRules`, `evaluateDynamicShelf` |
| `apps/api/src/routes/shelves.ts` | 8 endpoints under `/shelves` |
| `apps/web/src/hooks/useShelves.ts` | React hook for list |
| `apps/web/src/hooks/useShelf.ts` | React hook for single shelf |
| `apps/web/src/components/content/ShelfRow.tsx` | Reusable row component with progress bar support |
| `apps/api/src/routes/__tests__/shelves.test.ts` | 24 backend tests |
| `apps/web/src/components/content/ShelfRow.test.tsx` | 5 frontend tests |

## Files modified

- `apps/api/src/db/schema/index.ts` — export shelves schema
- `apps/api/src/errors.ts` — `ForbiddenError`, `ValidationError`
- `apps/api/src/index.ts` — register `shelvesRoutes`
- `packages/api-contracts/src/index.ts` — export shelves types
- `apps/web/src/lib/api.ts` — 8 new shelf API functions
- `apps/web/src/pages/HomePage.tsx` — recomposed using `useShelves` + per-shelf `ShelfRowLoader`
- `apps/web/src/test/handlers.ts` — 10 new MSW handlers + mock data

## Test results

- Backend: **219 tests passed** (24 new shelf tests)
- Frontend: **58 tests passed** (5 new ShelfRow tests)
- TypeScript: no new errors (only pre-existing unrelated errors)
