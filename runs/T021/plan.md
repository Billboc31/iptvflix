Now I have enough context to write the plan.

## Objective

Introduce a `Shelf` abstraction that groups canonical Media into typed rows (system, manual, dynamic), recompose the web Home page through a single reusable `ShelfRow` component, and expose profile-scoped CRUD for user-created shelves — without changing the behavior of Continue Watching or My List.

## Included

### 1. Database — new migration (`0009_shelves.sql`)

New Drizzle schema file `/apps/api/src/db/schema/shelves.ts`:

- **`shelves` table** — `id` (uuid pk), `profile_id` (uuid, nullable FK → `profiles`, null = system shelf), `title` (text), `type` enum(`SYSTEM` | `MANUAL` | `DYNAMIC`), `system_key` (text, nullable, e.g. `continue_watching`), `rules` (jsonb, nullable — dynamic shelves only), `position` (integer, for ordering user shelves), `layout_hint` enum(`ROW` | `GRID`, default `ROW`), `created_at`, `updated_at`.
- **`shelf_members` table** — `id` (uuid pk), `shelf_id` (uuid FK → shelves), `media_type` enum(`MOVIE` | `SERIES`), `media_id` (uuid), `position` (integer), `added_at`. Unique on `(shelf_id, media_type, media_id)`. No FK into `movies`/`series` to preserve flexibility.

Export new tables from `/apps/api/src/db/schema/index.ts`.

### 2. API contracts — `/packages/api-contracts/src/shelves.ts`

New types, exported from the package index:

- `ShelfType` — `'SYSTEM' | 'MANUAL' | 'DYNAMIC'`
- `LayoutHint` — `'ROW' | 'GRID'`
- `ShelfItem` — `{ mediaType: 'MOVIE' | 'SERIES'; mediaId: string; title: string; posterUrl: string | null; progressSeconds?: number; durationSeconds?: number }`
- `ShelfResponse` — `{ id: string; title: string; type: ShelfType; layoutHint: LayoutHint; items: ShelfItem[] }`
- `ShelfSummaryResponse` — `{ id: string; title: string; type: ShelfType; layoutHint: LayoutHint; position: number }` (list view, no items)
- `ShelfRuleDefinition` — `{ mediaType?: 'MOVIE' | 'SERIES'; genreIds?: string[]; yearFrom?: number; yearTo?: number; availableToMe?: boolean; watchState?: 'UNWATCHED' | 'IN_PROGRESS' | 'COMPLETED' }` — the exhaustive whitelist of allowed filter fields
- `CreateShelfBody` — `{ title: string; type: 'MANUAL' | 'DYNAMIC'; rules?: ShelfRuleDefinition; layoutHint?: LayoutHint }`
- `UpdateShelfBody` — `{ title?: string; layoutHint?: LayoutHint }`
- `AddShelfMemberBody` — `{ mediaType: 'MOVIE' | 'SERIES'; mediaId: string }`
- `ReorderShelfMembersBody` — `{ members: Array<{ mediaType: 'MOVIE' | 'SERIES'; mediaId: string }> }` — full ordered list

### 3. Backend service — `/apps/api/src/services/shelf-service.ts`

Functions:

- `listShelves(profileId)` — returns system shelves (hardcoded definitions resolved dynamically) followed by user shelves ordered by `position`.
- `getShelf(shelfId, profileId)` — fetches shelf + resolves items (dispatches to the right resolver by type).
- `createShelf(profileId, body)` — inserts MANUAL or DYNAMIC shelf; for DYNAMIC, validates rules before insert (see validation below).
- `updateShelf(shelfId, profileId, body)` — patches title / layoutHint; owner-only.
- `deleteShelf(shelfId, profileId)` — deletes user shelf + cascade members; rejects SYSTEM shelves.
- `addMember(shelfId, profileId, body)` — inserts into `shelf_members` for MANUAL shelves only; validates media exists (query `movies` or `series`).
- `removeMember(shelfId, profileId, mediaType, mediaId)` — deletes row from `shelf_members`.
- `reorderMembers(shelfId, profileId, orderedList)` — updates `position` column for each member in a transaction.
- `validateDynamicRules(rules)` — pure function; rejects unknown fields, invalid enums, non-integer years, negative values; returns typed `ShelfRuleDefinition` or throws.
- `evaluateDynamicShelf(rules, profileId)` — builds a Drizzle query over `movies`/`series` filtered by the validated rules; joins `movie_availabilities`/`series_availabilities` for `availableToMe`; joins `viewing_progress` for `watchState`; returns `ShelfItem[]`.

System shelf resolution (no DB rows needed):

- `resolveSystemShelf('continue_watching', profileId)` — delegates to existing `listContinueWatching(profileId)`, maps to `ShelfItem[]`.
- `resolveSystemShelf('my_list', profileId)` — delegates to existing `listWatchlist(profileId)`, maps to `ShelfItem[]`.
- `resolveSystemShelf('recently_added_movies', profileId)` — queries `movies` ordered by `created_at` desc, limit 20.
- `resolveSystemShelf('recently_added_series', profileId)` — same for `series`.

### 4. API routes — `/apps/api/src/routes/shelves.ts`

Register in `/apps/api/src/index.ts` with prefix `/shelves`.

Endpoints:

| Method | Path | Description |
|---|---|---|
| `GET` | `/shelves` | List profile shelves (summaries) |
| `POST` | `/shelves` | Create MANUAL or DYNAMIC shelf |
| `GET` | `/shelves/:id` | Get shelf with resolved items |
| `PATCH` | `/shelves/:id` | Update title/layoutHint |
| `DELETE` | `/shelves/:id` | Delete user shelf |
| `POST` | `/shelves/:id/members` | Add member (MANUAL only) |
| `DELETE` | `/shelves/:id/members/:mediaType/:mediaId` | Remove member |
| `PUT` | `/shelves/:id/members/order` | Reorder members |

Constraints: SYSTEM shelf CRUD operations (create/delete/reorder on system shelves) return 403. Invalid dynamic rules return 400 with a `validationError` field.

### 5. Frontend hooks

- `/apps/web/src/hooks/useShelves.ts` — `GET /shelves` → `ShelfSummaryResponse[]`
- `/apps/web/src/hooks/useShelf.ts` — `GET /shelves/:id` → `ShelfResponse`

Add corresponding fetch functions to `/apps/web/src/lib/api.ts`:
- `fetchShelves()`, `fetchShelf(id)`, `createShelf(body)`, `updateShelf(id, body)`, `deleteShelf(id)`, `addShelfMember(id, body)`, `removeShelfMember(id, mediaType, mediaId)`, `reorderShelfMembers(id, body)`

### 6. Frontend component — `ShelfRow`

`/apps/web/src/components/content/ShelfRow.tsx`:

- Props: `shelf: ShelfResponse` (already resolved with items)
- Renders title + horizontal scrollable row of `PosterCard` items (reuse existing component)
- For items with `progressSeconds`/`durationSeconds`, overlays the existing progress bar (extract from `ContinueWatchingRow` or pass as prop)
- No provider-specific fields; purely `ShelfItem` data

### 7. Home page recomposition

`/apps/web/src/pages/HomePage.tsx`:

- Replace `useMovies()` + `useSeries()` + `useContinueWatching()` with `useShelves()` + per-shelf `useShelf(id)`
- Hero section: fetch first available movie separately (keep existing `useMovies` call scoped to hero only, or use the first item from a recently-added shelf)
- Render one `<ShelfRow />` per shelf returned by `GET /shelves`
- Existing CW and My List behavior preserved because system shelf resolvers delegate to unchanged service functions

### 8. Tests

**Backend unit — `/apps/api/src/routes/__tests__/shelves.test.ts`**:
- `validateDynamicRules` rejects unknown fields, invalid enums
- `listShelves` returns system + user shelves in order
- Creating a DYNAMIC shelf with valid rules succeeds
- Creating a DYNAMIC shelf with invalid rules returns 400
- Adding a member to a SYSTEM shelf returns 403
- Manual shelf ordering round-trip

**Frontend unit — `/apps/web/src/components/content/ShelfRow.test.tsx`**:
- Renders shelf title and items
- Shows progress bar when `progressSeconds`/`durationSeconds` present
- Renders empty state when `items` is empty

**MSW handlers update — `/apps/web/src/test/handlers.ts`**:
- Add handlers for `GET /shelves`, `GET /shelves/:id`

## Excluded

- LLM / natural-language shelf creation.
- Recommendation scoring or taste-based ranking.
- Sharing shelves between profiles or users.
- A visual shelf-editor UI (drag-and-drop reorder in a dedicated settings page beyond the basic API).
- Android TV frontend changes.
- Persisting system shelf definitions in the database (they remain code-defined).
- Dynamic filters on language/quality or availability from Xtream/Plex variant data (deferred to when #33/#34 land; the `ShelfRuleDefinition` shape reserves the fields but the evaluator ignores absent/unsupported ones gracefully).
- My List as a shelf row on the Home page (My List has its own dedicated page; it can be added in a follow-up once shelf ordering UI exists).
- E2E test coverage for shelves (existing smoke tests must remain green; new shelf E2E is a follow-up).

## Acceptance criteria

1. `GET /shelves` returns at least the four system shelves (`continue_watching`, `recently_added_movies`, `recently_added_series`, and if the profile has watchlist entries, `my_list`) with correct `type: 'SYSTEM'`.
2. `GET /shelves/:id` for a system shelf returns items whose `mediaId` values are canonical movie/series UUIDs — no Xtream/Plex item IDs.
3. `POST /shelves` with `type: 'MANUAL'` creates a shelf; subsequent `POST /shelves/:id/members` and `PUT /shelves/:id/members/order` correctly persist and reorder members; `DELETE /shelves/:id` removes the shelf and all members.
4. `POST /shelves` with `type: 'DYNAMIC'` and a rule containing an unknown field (e.g. `{ sql: "DROP TABLE movies" }`) returns HTTP 400.
5. `POST /shelves` with `type: 'DYNAMIC'` and valid rules (e.g. `{ mediaType: 'MOVIE', availableToMe: true }`) returns 201 and `GET /shelves/:id` returns only matching catalog items.
6. The Home page renders one `<ShelfRow />` per shelf; the Continue Watching row shows progress bars; existing behavior (empty state, hero section) is unchanged.
7. Shelves belonging to profile A are not visible to profile B (`listShelves` is profile-scoped).
8. `PATCH /shelves/:id` on a SYSTEM shelf returns 403; `DELETE /shelves/:id` on a SYSTEM shelf returns 403.
9. All new backend unit tests pass (`vitest run` in `apps/api`); all new frontend unit tests pass (`vitest run` in `apps/web`); existing test suites remain green.
10. TypeScript compilation passes (`tsc --noEmit`) across all packages.
