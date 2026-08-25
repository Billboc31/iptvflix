All 29 tests pass, live-tv typecheck is clean. Here's a summary of everything implemented:

---

## Changes Summary

### API Contracts (`packages/api-contracts/src/channels.ts`)
- Added `EpgProgram` type with `title`, `startTime`, `endTime`
- Extended `ChannelResponse` with optional `epg?: { now?, next? }` and `isFavorite?`
- Added `ChannelFavoriteRequest` and `ChannelHistoryEntry` types

### Backend — DB
- **`apps/api/src/db/schema/channel-favorites.ts`** — new table, unique on `(profileId, channelId)`
- **`apps/api/src/db/schema/channel-history.ts`** — new table (no unique constraint, last-write wins)
- **`apps/api/src/db/schema/index.ts`** — exports both new tables
- **`apps/api/migrations/0054_t132_channel_favorites_history.sql`** — migration with FKs to `profiles` and `channels`

### Backend — Routes
- **`apps/api/src/routes/channel-favorites.ts`** — `GET /channels/favorites`, `POST/DELETE /channels/:id/favorite`
- **`apps/api/src/routes/channel-history.ts`** — `GET /channels/history` (deduped, top 20), `POST /channels/:id/history`
- **`apps/api/src/routes/channels.ts`** — extended with `?favorites=1` filter and `isFavorite` per-channel field
- **`apps/api/src/index.ts`** — registered both new route handlers in `profileScope`

### Frontend — Components (`apps/live-tv/src/components/channel/`)
- **`ChannelLogo.tsx`** — logo with initials fallback, `sm/md/lg` sizes
- **`EpgProgress.tsx`** — orange progress bar from `startTime`/`endTime`, renders nothing when absent
- **`ChannelCard.tsx`** — EPG-ready card with LIVE badge, play action, inline error, favorite toggle
- **`LiveRail.tsx`** — horizontal scroll rail with 3 skeleton cards while loading, hidden when empty
- **`CategoryShortcuts.tsx`** — data-driven grid from `channel.categories`, links to `/channels?category=`
- **`ChannelRow.tsx`** — dense list row with EPG now/next, progress bar, favorite, play

### Frontend — Context
- **`apps/live-tv/src/context/ChannelsContext.tsx`** — single fetch for channels/favorites/history, optimistic favorite toggle, fire-and-forget history recording

### Frontend — Pages
- **`HomePage.tsx`** — En direct rail + category shortcuts + recently watched (omitted when empty)
- **`AllChannelsPage.tsx`** — functional search (via URL `?q=`), category filter, favorites-only toggle, `ChannelRow` list
- **`FavoritesPage.tsx`** — shows favorited channels from context; empty state when none
- **`RecentPage.tsx`** — shows recent channels from context; empty state when none

### Frontend — Layout
- **`Sidebar.tsx`** — collapsible categories section (desktop only) derived from channel data
- **`TopBar.tsx`** — search icon that expands inline, routes to `/channels?q=`
- **`App.tsx`** — `ChannelsProvider` wraps `AppShell` so all pages share the same channel data

### Tests (29 passing)
- `EpgProgress.test.tsx` — 6 tests: percentage math, clamping, absent times
- `ChannelCard.test.tsx` — 8 tests: EPG-present/absent, play action, error state, favorite toggle
- `LiveRail.test.tsx` — 4 tests: loading skeletons, empty suppression, data rendering
- `AllChannelsPage.test.tsx` — 6 tests: search, category filter, favorites-only, toggleFavorite wiring
- `ChannelsContext.test.tsx` — 5 tests: data loading, optimistic add/remove favorite, history recording
