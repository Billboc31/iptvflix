Now I have everything I need. Let me write the plan.

## Objective

Add a `GET /home` endpoint that composes a personalized Home in a single backend call — combining existing utility shelves (Continue Watching, My List) with recommendation-backed shelves (personalized picks, discovery/upcoming) — and wire the web `HomePage` to consume it via a new `useHome` hook while reusing the existing `ShelfRow` rendering.

## Included

**`packages/api-contracts/src/home.ts`** (new)
- `HomeResponse`: `{ coldStart: boolean; shelves: ShelfResponse[] }`

**`packages/api-contracts/src/index.ts`**
- Add `export * from './home.js'`

**`apps/api/src/services/home-service.ts`** (new)
- `buildHome(profileId: string): Promise<HomeResponse>`
  1. Resolve Continue Watching and My List in parallel by calling the existing `getShelf()` resolvers for `sys_continue_watching` and `sys_my_list`.
  2. Call `rankRecommendations(profileId, { limit: 60, includeSeen: false })`.
     - Pass the in-progress media IDs from Continue Watching as an exclusion list (to avoid showing active items in rec shelves).
  3. Partition the ranked candidate list into two ephemeral shelves:
     - **"Recommandé pour toi"** (`sys_rec_for_you`): top 20 candidates where `available === true`.
     - **"À découvrir"** (`sys_rec_upcoming`): top 10 candidates where `available === false`; omit shelf entirely if fewer than 3 candidates remain.
  4. Convert each `RecommendationCandidate` to `ShelfItem` (`{ mediaType, mediaId, title, posterUrl }`).
  5. Assemble shelves in position order: Continue Watching (if non-empty) → Recommended for You → My List (if non-empty) → Discovery Picks (if data supports).
  6. Return `{ coldStart, shelves }` — `coldStart` is propagated from `rankRecommendations`.
- Dedup contract to document in a code comment: a single `rankRecommendations` call is partitioned; no candidate can appear in both rec shelves; utility shelves are independent by intent.

**`apps/api/src/routes/home.ts`** (new)
- `GET /profiles/:profileId/home` → calls `buildHome(profileId)` → returns `HomeResponse`
- Validates that `profileId` exists (reuse the pattern from the existing `recommendations.ts` route — 404 on unknown profile).

**`apps/api/src/index.ts`**
- Import `homeRoutes` from `./routes/home.js` and register it with `app.register(homeRoutes)`.

**`apps/web/src/hooks/useHome.ts`** (new)
- `useHome(profileId: string)`: fetches `GET /profiles/:profileId/home`, returns `{ data: HomeResponse | undefined; isLoading; error }`.

**`apps/web/src/pages/HomePage.tsx`**
- Replace the current `useShelves()` + per-shelf `useShelf(id)` waterfall with a single `useHome(profileId)` call.
- Keep all `ShelfRow` / `ShelfRowLoader` rendering unchanged — pass `HomeResponse.shelves` as the shelf list.
- Show a cold-start-aware empty state if `coldStart === true` and no shelves have items.

**`apps/api/src/services/__tests__/home-service.test.ts`** (new)
- Mocks: `rankRecommendations`, `getShelf` resolvers for `sys_continue_watching` / `sys_my_list`.
- Test cases:
  - **Warm profile**: non-empty Continue Watching + ranked available candidates → `sys_rec_for_you` populated, `sys_rec_upcoming` omitted when < 3 unavailable.
  - **Cold start**: `coldStart: true` from ranking → shelves still returned (popularity-based), `HomeResponse.coldStart` is `true`.
  - **Availability filtering**: candidates with `available === false` never appear in `sys_rec_for_you`; candidates with `available === true` never appear in `sys_rec_upcoming`.
  - **Duplicate suppression**: in-progress media IDs from Continue Watching do not appear in `sys_rec_for_you` (exclusion list propagated correctly).
  - **Discovery threshold**: fewer than 3 unavailable candidates → `sys_rec_upcoming` shelf absent from response.

## Excluded

- Drag-and-drop home customization.
- Natural-language shelf generation.
- Android TV UI.
- Removing or repositioning the existing system shelves (`sys_recently_added_movies`, `sys_recently_added_series`) — they remain in `GET /shelves` but are not included in the new `/home` composition (that endpoint is additive).
- Changes to the recommendation ranking algorithm itself or taste-building logic.
- A unified `/shelves` + `/home` merge — the two endpoints remain independent.
- Frontend tests for `HomePage` or `useHome` (the existing `ShelfRow` component tests remain sufficient for rendering).

## Acceptance criteria

- `GET /profiles/:profileId/home` returns HTTP 200 with `HomeResponse` for a profile with taste data; `coldStart` is `false` and `shelves` contains at least one `sys_rec_for_you` entry with items.
- For a cold-start profile (no `profile_taste` row), the endpoint returns HTTP 200 with `coldStart: true` and a non-empty `sys_rec_for_you` shelf (popularity-ranked).
- No candidate with `available === false` appears in the items of `sys_rec_for_you`.
- No candidate with `available === true` appears in the items of `sys_rec_upcoming`.
- `sys_rec_upcoming` is absent from the response when fewer than 3 unavailable candidates are ranked.
- Media IDs present in the Continue Watching shelf are absent from `sys_rec_for_you` items.
- The web Home page loads and renders all returned shelves using the existing `ShelfRow` component with no bespoke recommendation row added to the frontend.
- `home-service.test.ts` passes for warm profile, cold start, availability filtering, and duplicate suppression cases.
- `GET /profiles/:profileId/home` returns HTTP 404 for an unknown `profileId`.
