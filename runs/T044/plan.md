# T044 — Add refresh semantics for generated and recommendation-backed Shelves

## Objective

Close the remaining gaps in the GENERATED shelf refresh feature: expose `generatedAt` diagnostics in API responses, and add the four missing test scenarios (unchanged refresh, changed candidate pool, changed availability, changed taste) required by the acceptance criteria.

The core service logic (`refreshGeneratedShelf`), the route (`POST /shelves/:id/refresh`), and the manual-Shelf guard are already implemented in the bootstrap checkpoint. This plan covers only what is absent.

## Included

### 1. Expose `generatedAt` in the refresh and generate responses

**`packages/api-contracts/src/shelves.ts`**
- Add `generatedAt: string` to `GenerateShelfResponse.explanation` (currently `{ inferredGenreIds, seedTitles }`).

**`apps/api/src/services/shelf-generation-service.ts`**
- In `generateShelfFromSeeds`: include `generatedAt` (the value written to `rules.generatedAt`) in the returned `explanation`.
- In `refreshGeneratedShelf`: include `updatedRules.generatedAt` in the returned `explanation`.

### 2. Expose `generatedAt` in the GET shelf response

**`packages/api-contracts/src/shelves.ts`**
- Add optional `generatedAt?: string` to `ShelfResponse`.

**`apps/api/src/services/shelf-service.ts`**
- In `getShelf()`, when `shelf.type === 'GENERATED'`, read `(shelf.rules as GeneratedShelfRules).generatedAt` and populate it on the returned `ShelfResponse`. Leave the field absent for all other shelf types.

### 3. Add four missing test scenarios

**`apps/api/src/services/__tests__/shelf-generation-service.test.ts`**

Add a new `describe('refresh — semantic scenarios')` block with:

- **Unchanged refresh**: mock `rankRecommendations` to return the same candidates on both calls; assert member IDs and positions are identical across two successive refresh calls, and that `generatedAt` is updated each time.
- **Changed candidate pool**: first refresh returns `[MOVIE_ID_C]`; second refresh returns `[MOVIE_ID_C, MOVIE_ID_D]` (new candidate entered the pool); assert the second refresh writes two members and `MOVIE_ID_D` appears at position 1.
- **Changed availability**: shelf has `availableToMe: true` in stored rules; first refresh returns `[MOVIE_ID_C]` (available); second refresh returns `[]` because `rankRecommendations` (which enforces the `availableToMe` filter) finds no available candidates; assert the second refresh writes zero members.
- **Changed taste**: first refresh scores `MOVIE_ID_C` above `MOVIE_ID_D`; second refresh inverts scores; assert member order flips after the second refresh (position 0 changes).

All four scenarios exercise `refreshGeneratedShelf` only (no `generateShelfFromSeeds` calls needed).

## Excluded

- Background scheduler or cron-based automatic refresh.
- Push notifications of any kind.
- Natural-language prompt editing.
- Changes to the member-update strategy: the replace-all approach (delete all members, rank fresh, insert) is intentional — it guarantees that no stale members survive and that ordering is always derived from the current ranked snapshot. A positional merge would require a stable identity key across ranking runs that does not exist.
- UI / frontend changes.
- Any change to the recommendation ranking service or discovery candidate materialization logic.

## Acceptance criteria

- `POST /shelves/:id/refresh` response body includes `explanation.generatedAt` as a non-empty ISO 8601 string.
- `POST /shelves/generate` response body includes `explanation.generatedAt` as a non-empty ISO 8601 string.
- `GET /shelves/:id` response for a GENERATED shelf includes a top-level `generatedAt` field with the same value that was last written by generate or refresh.
- `GET /shelves/:id` for a MANUAL, DYNAMIC, or SYSTEM shelf does **not** include a `generatedAt` field.
- `POST /shelves/:id/refresh` on a MANUAL shelf returns HTTP 400 with `validationError: true` (existing guard, verified by existing test).
- `vitest` passes for all existing tests and the four new scenarios (unchanged refresh, changed candidate pool, changed availability, changed taste).
