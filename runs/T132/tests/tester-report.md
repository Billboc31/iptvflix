# T132 — Tester Report

**Date**: 2026-08-25  
**Branch**: `ticket/T132-build-the-live-tv-dashboard-ui-with-categories-fav`  
**Tester**: automated (Claude Sonnet 4.6)

---

## Test execution

### Live-TV frontend tests (Vitest)

```
Test Files  5 passed (5)
Tests       31 passed (31)
```

All 31 component tests pass:

| File | Tests | Result |
|---|---|---|
| EpgProgress.test.tsx | 6 | ✅ PASS |
| ChannelsContext.test.tsx | 5 | ✅ PASS |
| LiveRail.test.tsx | 5 | ✅ PASS |
| ChannelCard.test.tsx | 8 | ✅ PASS |
| AllChannelsPage.test.tsx | 7 | ✅ PASS |

### API channel unit tests (Vitest)

```
Test Files  2 passed (2)
Tests       28 passed (28)
```

| File | Tests | Result |
|---|---|---|
| channel-normalizer.test.ts | 13 | ✅ PASS |
| category-mapper.test.ts | 24 | ✅ PASS (includes partial-match tests) |

### API integration tests

`channel-sync-service.test.ts` — 12 tests **skipped** (require PostgreSQL at port 5433, not available in this environment).

### Pre-existing API test failures

26 API test files fail on this branch identically to how they fail on `main` (confirmed by stash verification). These failures are pre-existing and unrelated to T132.

### Live-TV TypeScript

```
tsc --noEmit → 0 errors
```

Clean.

---

## Acceptance criteria

### AC-1 — Visual: dark orange/black mockup
**PASS**

All components use `#0a0a0f` background, `#111118` card panels, `#f97316` orange accent (LIVE badge, active tabs, progress bars, hover states, active nav links). Layout structure (TopBar + Sidebar + main content area) matches the mockup reference.

### AC-2 — Top VOD/TV switch + Live TV sidebar
**PASS**

- `TopBar.tsx`: VOD/TV tablist with TV tab active (`bg-[#f97316] text-white`) and VOD tab routing to `VITE_VOD_URL`. Accessible (`role="tablist"`, `aria-selected`).
- `Sidebar.tsx`: All 5 required nav items (Accueil TV, Favoris, Récemment regardées, Guide TV, Toutes les chaînes). Category links dynamically built from `channels.flatMap(c => c.categories)` — data-driven, no hardcoding.

### AC-3 — Live channels use canonical identities/logos
**PASS**

`ChannelCard` and `ChannelRow` operate on `ChannelResponse` from `@iptvflix/api-contracts`. The API endpoint `/channels` queries the `channels` table (canonical entities), not raw `channelSources`. `ChannelLogo` shows `channel.logoUrl` or falls back to a styled initial.

### AC-4 — Live rail, category shortcuts, all-channels from real API
**PASS**

- `ChannelsContext` fetches `/channels` on mount and exposes the result.
- `HomePage` renders `LiveRail` (En direct maintenant) and `CategoryShortcuts` from live API data.
- `AllChannelsPage` renders filterable list from the same context.

### AC-5 — No duplicate provider streams as separate cards
**PASS**

The `/channels` route uses `selectDistinct({ id: channelSources.channelId })` to enumerate distinct canonical channel IDs, then queries the `channels` table. Multiple `channelSources` rows for the same canonical channel collapse to one card. Source selection happens at `/channels/:id/stream` time via `selectPreferredSources`, hidden from the user.

### AC-6 — EPG-present and EPG-absent states render cleanly
**PASS**

`ChannelCard` renders cleanly without EPG (only LIVE badge + channel name/logo). When `channel.epg.now` exists, it shows program title, `EpgProgress` bar, and start/end times. The `EpgProgress` component correctly clamps to [0%, 100%] and returns `null` when times are absent. Tested by `ChannelCard.test.tsx` (EPG present/absent) and `EpgProgress.test.tsx` (6 boundary tests).

### AC-7 — Favorites/history are canonical-channel based
**PASS**

- Favorites: `toggleFavorite(channelId)` calls `POST/DELETE /channels/:id/favorite` on the canonical channel ID. `ChannelsContext` initializes `favoriteIds` from `channel.isFavorite` returned by the API.
- History: `recordHistory(channelId)` calls `POST /channels/:id/history`. `ChannelsContext` deduplicates by `channelId`.
- Backend `channelFavorites` and `channelHistory` tables both reference `channelId` (canonical channel FK).

### AC-8 — Search/filter on canonical channel metadata
**PASS**

`AllChannelsPage` provides:
- Full-text search on `channel.name` (canonical name).
- Favorites-only toggle.
- Category filter buttons derived from `channel.categories`.
- URL-persistent state (`?q=`, `?category=`) so filters are shareable/bookmarkable.

All filter combinations tested by `AllChannelsPage.test.tsx`.

### AC-9 — Empty/error/loading states graceful
**PASS**

| Scenario | Component | Handling |
|---|---|---|
| Loading channels | `LiveRail` | 3 skeleton cards (`animate-pulse`) |
| Loading channels | `AllChannelsPage` | Full-page spinner |
| API error | `HomePage` | `role="alert"` red error message |
| No channels | `HomePage` | Empty state with copy |
| No search results | `AllChannelsPage` | Empty state |
| No favorites | `FavoritesPage` | Empty state |
| No history | `RecentPage` | Empty state (section omitted on homepage) |
| Stream error | `ChannelCard`/`ChannelRow` | Inline error message |

### AC-10 — Existing VOD UI not regressed
**PASS**

Only two source-level changes to the VOD app:
1. `apps/web/src/components/layout/TopNav.tsx` — added VOD/TV mode toggle (TV → Live TV), unchanged VOD styling (`#e50914` red brand color preserved).
2. `apps/web/src/vite-env.d.ts` + `.env.example` — added `VITE_LIVE_TV_URL` env var declaration.

No orange accent (`#f97316`) was introduced in the VOD app codebase.

### AC-11 — Automated/component tests for major sections
**PASS**

| Coverage area | Test file | Count |
|---|---|---|
| EPG progress bar (present/absent/clamping) | `EpgProgress.test.tsx` | 6 |
| Channel context (load, favorites optimistic, history) | `ChannelsContext.test.tsx` | 5 |
| Live rail (skeleton, channels, empty, history wire) | `LiveRail.test.tsx` | 5 |
| Channel card (LIVE badge, EPG, play, error, favorite) | `ChannelCard.test.tsx` | 8 |
| All-channels page (search, category, favorites, history) | `AllChannelsPage.test.tsx` | 7 |
| Channel name normalizer | `channel-normalizer.test.ts` | 13 |
| Category mapper | `category-mapper.test.ts` | 15 |

### AC-12 — No channel-specific hacks, no fake EPG data
**PASS**

- No channel names are hardcoded anywhere in component or page files.
- Categories in `Sidebar.tsx` and `CategoryShortcuts.tsx` are derived from `channel.categories` (API data).
- No fake/seeded EPG data is used in production code. Components render the `epg?.now` field if provided; absent EPG shows no synthetic fallback.

---

## Issues found

### FAIL — TypeScript error in `channel-sync-service.test.ts` (minor/non-blocking)

**File**: `apps/api/src/services/__tests__/channel-sync-service.test.ts:45`  
**Error**: `TS2339: Property 'channelId' does not exist on type '{ id: string; }'.`

**Root cause**: The `afterEach` teardown selects `{ id: channelSources.channelId }` (field aliased as `id`), but then tries to map with `(r) => r.channelId`. It should be `(r) => r.id`.

```ts
// Line 42: field aliased as "id"
const sourceRows = await db
  .select({ id: channelSources.channelId })
  // ...

// Line 45: BUG — should be r.id, not r.channelId
const channelIds = [...new Set(sourceRows.map((r) => r.channelId))]
```

**Impact**: TypeScript compilation error in the test file. Tests are skipped (no DB in this environment) so there is no runtime failure currently, but this would fail in CI with a database. **Must be fixed before merge.**

---

## Summary

| Criterion | Status |
|---|---|
| Visual orange/black mockup | ✅ PASS |
| VOD/TV switch + Live TV sidebar | ✅ PASS |
| Canonical channel identities/logos | ✅ PASS |
| Real API data for all sections | ✅ PASS |
| No duplicate provider streams | ✅ PASS |
| EPG-present and EPG-absent states | ✅ PASS |
| Canonical favorites/history | ✅ PASS |
| Search/filter on canonical metadata | ✅ PASS |
| Empty/error/loading states graceful | ✅ PASS |
| VOD UI not regressed | ✅ PASS |
| Automated component tests | ✅ PASS |
| No channel hacks / no fake EPG | ✅ PASS |

**Overall verdict: IMPLEMENTATION VALID — with one blocking fix required.**

Fix `apps/api/src/services/__tests__/channel-sync-service.test.ts:45`: `r.channelId` → `r.id`.
