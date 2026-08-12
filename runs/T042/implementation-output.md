All changes are implemented and verified. Here's a summary:

---

## Changes made

### Backend — BLOQUANT 2: atomicity (+ minor fixes)

**`apps/api/src/services/shelf-generation-service.ts`**
- Wrapped `SELECT MAX(position)` + `INSERT shelves` + `INSERT shelfMembers` in `db.transaction` inside `generateShelfFromSeeds` — matches the pattern already used in `refreshGeneratedShelf`
- Added deduplication validation: rejects `seedMediaIds` with duplicate `mediaId` values
- Fixed `!rules.limit` → `rules.limit == null` for precision with zero-value limit

### Backend — RECOMMANDÉ: route-level HTTP tests

**`apps/api/src/routes/__tests__/shelves.test.ts`**
- Added hoisted mocks for `generateShelfFromSeeds` and `refreshGeneratedShelf`
- Added 44 total tests (was 30): 5 new tests for `POST /shelves/generate` (201 happy path, missing title, < 3 seeds, invalid seed mediaType, invalid top-level mediaType) and 3 for `POST /shelves/:id/refresh` (200 happy path, 400 non-GENERATED, 404 not found)

### Frontend — BLOQUANT 1: web flow

**`apps/web/src/lib/api.ts`** — Added `generateShelf()` and `refreshShelf()` calling the two new endpoints

**`apps/web/src/hooks/useGenerateShelf.ts`** (new) — Mutation hook wrapping `generateShelf` with `loading`/`error` state

**`apps/web/src/hooks/useShelves.ts`** — Added `refetch` callback (same pattern as `useMovies`)

**`apps/web/src/components/content/GenerateShelfDialog.tsx`** (new) — Dialog with: title input, search-and-select seed media UI (movies + series from `searchContent`), selected seeds list with removal, Generate button (enabled only with title + ≥ 3 seeds)

**`apps/web/src/pages/HomePage.tsx`** — Wired the dialog with a "+ Créer une sélection" button; on success calls `refetchShelves()` to reload the shelf list

All 17 service tests and 44 route tests pass. The pre-existing `title-matching-service.test.ts` failure (duplicate Postgres row in integration DB) is unrelated to these changes.
