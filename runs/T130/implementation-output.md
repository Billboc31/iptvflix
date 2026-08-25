All files are in place. The implementation is complete. Here's a summary of what was done:

---

## Summary of changes

### New files created

**API contracts:**
- `packages/api-contracts/src/channels.ts` — exports `ChannelResponse` type

**API route:**
- `apps/api/src/routes/channels.ts` — `GET /channels` JWT-protected, returns empty `ChannelResponse[]`

**Live TV app (`apps/live-tv/`):**
- `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `nixpacks.toml`, `.env.example`
- `src/vite-env.d.ts`, `src/index.css` (dark theme + orange `#f97316` accent), `src/main.tsx`
- `src/lib/api.ts` — thin fetch wrapper using same `iptvflix_auth_token` key as VOD; handles `?token=` handoff param on load
- `src/context/AuthContext.tsx`, `src/context/ProfileContext.tsx`
- `src/components/layout/AppShell.tsx`, `Sidebar.tsx` (5 nav items, orange active highlight), `TopBar.tsx` (VOD/TV toggle)
- `src/pages/` — LoginPage, ProfileChoosePage, HomePage, AllChannelsPage, FavoritesPage, RecentPage, GuidePage, HealthPage
- `src/App.tsx` — public: `/login`, `/health`; protected: all nav pages under AppShell

**E2E:**
- `e2e/tests/live-tv-smoke.spec.ts` — 6 smoke checks

### Modified files
- `packages/api-contracts/src/index.ts` — re-exports `channels.js`
- `apps/api/src/index.ts` — registers `channelsRoutes` in protected scope
- `apps/web/src/components/layout/TopNav.tsx` — adds VOD/TV mode toggle linking to `VITE_LIVE_TV_URL`
- `apps/web/src/vite-env.d.ts` — adds `VITE_LIVE_TV_URL` to env types
- `apps/web/.env.example` — documents `VITE_LIVE_TV_URL`
- `package.json` (root) — adds `--filter './apps/live-tv'` to lint and typecheck
- `e2e/playwright.config.ts` — adds live-tv server (`pnpm --filter @iptvflix/live-tv dev` on port 5174)

### Verified
- `pnpm --filter @iptvflix/live-tv build` exits 0 ✓
- `pnpm --filter @iptvflix/live-tv typecheck` exits 0 ✓
- Pre-existing build failures in `apps/web` (PlayerPage hls.js) and `apps/api` (watchlist-service) confirmed as not introduced by this ticket ✓
