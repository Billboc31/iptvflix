# Plan — T132: Live TV dashboard UI

## Objective

Replace the placeholder channel grid in the Live TV app with a full production dashboard — featured live rail, category shortcuts, recently-watched rail, and a dense searchable all-channels view — wired to canonical channel data and EPG-ready from day one, with backend seams for favorites and history.

## Included

### API contracts (`packages/api-contracts/src/channels.ts`)

- Add optional `EpgProgram` type: `{ title: string; startTime: string; endTime: string }`.
- Extend `ChannelResponse` with optional `epg?: { now?: EpgProgram; next?: EpgProgram }` and `isFavorite?: boolean`.
- Add `ChannelFavoriteRequest` type: `{ channelId: string }`.
- Add `ChannelHistoryEntry` type: `{ channelId: string; name: string; logoUrl?: string | null; watchedAt: string }`.
- Export all new types from the package index.

### Backend — DB schema

- `apps/api/src/db/schema/channel-favorites.ts`: table `channel_favorites (id uuid pk, profileId uuid fk, channelId uuid fk, addedAt timestamptz default now())` — unique on `(profileId, channelId)`.
- `apps/api/src/db/schema/channel-history.ts`: table `channel_history (id uuid pk, profileId uuid fk, channelId uuid fk, watchedAt timestamptz default now())` — no duplicate constraint (last-write wins; dedup on query).
- `apps/api/src/db/schema/index.ts`: re-export both new tables.
- Drizzle migration: `apps/api/src/db/migrations/` — add migration file for the two new tables.

### Backend — routes

- `apps/api/src/routes/channel-favorites.ts`:
  - `GET /channels/favorites` — list canonical channels favorited by the current profile (join with `channel_favorites`).
  - `POST /channels/:id/favorite` — add to favorites; returns 204.
  - `DELETE /channels/:id/favorite` — remove; returns 204.
- `apps/api/src/routes/channel-history.ts`:
  - `GET /channels/history` — list up to 20 most-recently distinct channels watched by profile, ordered by `watchedAt` desc.
  - `POST /channels/:id/history` — upsert/insert a history entry (called when playback starts).
- `apps/api/src/routes/channels.ts`: extend `GET /channels` to accept optional `?favorites=1` query param that filters to favorited channels only; include `isFavorite` boolean in each `ChannelResponse` when the profile is identified.
- Register new route files in the Fastify app entry point.

### Frontend — API client (`apps/live-tv/src/lib/api.ts`)

Add typed functions:
- `getChannelStream(id: string): Promise<ChannelStreamResponse>`
- `listFavoriteChannels(): Promise<ChannelResponse[]>`
- `addFavorite(id: string): Promise<void>`
- `removeFavorite(id: string): Promise<void>`
- `listHistory(): Promise<ChannelHistoryEntry[]>`
- `recordHistory(id: string): Promise<void>`

### Frontend — shared channel components (`apps/live-tv/src/components/channel/`)

**`ChannelLogo.tsx`** — canonical logo with initials fallback; accepts `logoUrl`, `name`, `size` prop.

**`EpgProgress.tsx`** — thin orange progress bar; accepts `startTime`, `endTime`; computes live percentage from `Date.now()`; renders nothing if either is absent.

**`ChannelCard.tsx`** — EPG-ready card used in rails and grids.
- Props: `channel: ChannelResponse`, `onPlay: () => void`, `onToggleFavorite?: () => void`, `isFavorite?: boolean`.
- Renders: `ChannelLogo`, `LIVE` badge (orange), program title from `channel.epg?.now?.title`, start/end time, `EpgProgress`, play button, favorite toggle heart.
- EPG-absent state: renders channel identity and LIVE badge cleanly without program fields.
- Playback: calls `getChannelStream(channel.id)` then navigates to stream URL or triggers player; surfaces error state inline.
- Favorite toggle: calls `addFavorite`/`removeFavorite`, updates local optimistic state.

**`LiveRail.tsx`** — horizontal overflow scroll of `ChannelCard` instances with section title.
- Props: `title: string`, `channels: ChannelResponse[]`, `isLoading: boolean`.
- Loading: skeleton placeholders (3 animated cards).
- Empty: hidden (no render).

**`CategoryShortcuts.tsx`** — grid of category shortcut cards.
- Derives categories and per-category channel counts from the full channel list prop.
- Each card: category label + count badge, clicking navigates to `/channels?category=<name>`.
- Categories list is purely data-driven from `channel.categories`.

**`ChannelRow.tsx`** — single row for the dense all-channels list.
- Logo, name, category badge, EPG now/next titles, progress bar, favorite toggle, play button.

### Frontend — pages

**`apps/live-tv/src/pages/HomePage.tsx`** — full dashboard (replaces current placeholder grid):
1. Fetch `listChannels()` once; derive featured/all/category data from a single response.
2. Render `<LiveRail title="En direct maintenant" channels={channels} isLoading />`.
3. Render `<CategoryShortcuts channels={channels} />`.
4. Fetch `listHistory()`; if non-empty, render `<LiveRail title="Récemment regardées" channels={recentChannels} />` (map history entries back to matching channels); omit section if empty.
5. Error state per section is isolated (one section failing does not blank the page).

**`apps/live-tv/src/pages/AllChannelsPage.tsx`** — wire existing skeleton:
- Add controlled text search input in the page header (filters by `channel.name` case-insensitively).
- Make category filter buttons functional (active state + filter logic).
- Add "Favorites only" toggle filter.
- Replace inline card markup with `<ChannelRow>`.
- Wire play and favorite actions.

**`apps/live-tv/src/pages/FavoritesPage.tsx`** — implement:
- Fetch `listFavoriteChannels()`.
- Render `<ChannelRow>` list; empty state if none.

**`apps/live-tv/src/pages/RecentPage.tsx`** — implement:
- Fetch `listHistory()`.
- Render `<ChannelRow>` list ordered by recency; empty state if none.

### Frontend — layout

**`apps/live-tv/src/components/layout/Sidebar.tsx`**:
- Below existing nav items, add a collapsible "Catégories" section.
- Categories fetched lazily from `listChannels()` result (via a shared React context or prop drill from App-level state); rendered as nav links to `/channels?category=<name>`.
- On narrow viewport (icon-only mode), categories section is hidden.

**`apps/live-tv/src/components/layout/TopBar.tsx`**:
- Add a search input that routes to `/channels?q=<term>` on submit (or on input change with debounce).
- On mobile, search icon expands the input inline.

### Frontend — shared channel context (`apps/live-tv/src/context/ChannelsContext.tsx`)

- Wraps the app; fetches `listChannels()` once on mount.
- Provides `{ channels, isLoading, error }` to avoid duplicate fetches across pages.
- Provides `{ favorites, toggleFavorite }` backed by the favorites API with optimistic updates.
- Provides `recordHistory(id)` which calls the history API fire-and-forget.

### Frontend — tests (`apps/live-tv/src/`)

- `__tests__/ChannelCard.test.tsx`: EPG-present and EPG-absent rendering; favorite toggle calls correct handler; LIVE badge visible.
- `__tests__/EpgProgress.test.tsx`: progress width correct; renders nothing when times absent.
- `__tests__/LiveRail.test.tsx`: skeleton in loading state; nothing rendered when channels empty; cards rendered when data present.
- `__tests__/AllChannelsPage.test.tsx`: search filter; category filter; favorites-only filter; play action fires.
- `__tests__/ChannelsContext.test.tsx`: optimistic favorite toggle; history recording.

## Excluded

- XMLTV/EPG ingestion pipeline and actual program schedule data (separate ticket).
- TV/remote-control focus navigation and keyboard traversal beyond baseline tab order.
- HLS/DASH in-page player; the playback action opens the stream URL (existing behavior); a dedicated player component is a follow-up.
- Android TV app.
- Recommendation engine integration.
- Viewing-progress persistence for partial-watch resume (VOD pattern; not applicable to live TV).
- Profile management UI changes.
- VOD app restyling.
- E2E tests (Playwright/Cypress); only Vitest component tests are included.
- Pagination or infinite scroll for the channel list; all channels are loaded in a single API call.
- Multi-profile favorites isolation beyond what the existing profile JWT already provides.

## Acceptance criteria

- Dashboard (`/`) renders three sections from real API data: featured live rail, category shortcuts, recently-watched rail (omitted when history is empty).
- `ChannelCard` renders cleanly in both EPG-present and EPG-absent states with no console errors; `EpgProgress` shows correct percentage when times are provided and renders nothing when absent.
- `AllChannelsPage` text search, category filter, and favorites-only toggle all narrow the visible channel list correctly.
- Favorite toggle on any card/row calls `POST /channels/:id/favorite` or `DELETE /channels/:id/favorite` and updates UI optimistically without full page reload.
- Play action on any card fetches `GET /channels/:id/stream` and proceeds to the stream URL; a graceful inline error is shown if the stream is unavailable (404 / network error).
- `FavoritesPage` shows favorited channels from the API; shows a "no favorites" empty state when none exist.
- `RecentPage` shows recently-watched channels from the API; section is omitted (not an error state) when history is empty.
- No raw `ChannelSource` records appear as separate cards; only canonical channel identities are displayed.
- Category shortcuts are derived from `channel.categories` data; no category name is hardcoded.
- Existing VOD app (web app, `apps/web`) has no visual regressions introduced by this ticket.
- All new Vitest tests pass (`pnpm --filter live-tv test`).
- TypeScript compilation succeeds with no new errors across the monorepo (`pnpm build` or `pnpm typecheck`).
