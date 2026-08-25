## Objective

Create `apps/live-tv`, a standalone React/Vite application in the monorepo with its own build and Railway deploy target, featuring an orange-accented TV-first shell (sidebar, VOD/TV switch, 5 nav sections). Add `ChannelResponse` to `packages/api-contracts` and a stub `GET /channels` route in the API so the app is independently buildable and deployable without duplicating auth/profile contracts.

## Included

### `packages/api-contracts/src/channels.ts` (new)
- Export `ChannelResponse`: `{ id: string; name: string; logoUrl?: string; category?: string }`.
- Re-export from `packages/api-contracts/src/index.ts` via `export * from './channels.js'`.

### `apps/api/src/routes/channels.ts` (new)
- `GET /channels` — JWT-protected; returns `ChannelResponse[]` (initially empty array).
- Registered in `apps/api/src/index.ts` alongside existing route registrations.

### `apps/live-tv/` scaffold (new app)

**Root config files:**
- `package.json` — name `@iptvflix/live-tv`; scripts: `dev` (vite, port 5174), `build` (tsc && vite build), `start` (serve -s dist), `typecheck`, `lint`, `test` (vitest run); dependencies mirror `apps/web` minus hls.js/mpegts.js; `@iptvflix/api-contracts: workspace:*` as devDependency.
- `tsconfig.json` — extends `../../tsconfig.base.json`.
- `vite.config.ts` — `@vitejs/plugin-react`, `@tailwindcss/vite`; dev server on port 5174; proxy `/api → http://localhost:3000`.
- `index.html` — standard Vite SPA entry.

**CSS/Theme (`src/index.css`):**
- Same dark tokens as `apps/web`: `--color-background: #0a0a0f`, `--color-surface: #111118`, `--color-surface-elevated: #1a1a24`.
- Orange accent: `--color-accent: #f97316` (replaces VOD red `#e50914`).
- Import Tailwind v4: `@import "tailwindcss"`.

**Auth + API client (`src/lib/api.ts`):**
- Thin fetch wrapper; stores JWT in `localStorage` under key `iptvflix_token` (same key as `apps/web` — enables same-origin seamless auth without re-login).
- On app load, reads `?token=` query param and stores it, then strips the param from the URL (supports the VOD→LiveTV cross-app handoff redirect).
- Methods: `login()`, `getMe()`, `logout()`, `listProfiles()`, `setActiveProfile()`, `listChannels()`.

**Contexts:**
- `src/context/AuthContext.tsx` — mirrors `apps/web/src/context/AuthContext.tsx`; exposes `{ token, login, logout, isAuthenticated }`.
- `src/context/ProfileContext.tsx` — exposes `{ currentProfile, profiles, selectProfile, isLoading }`.

**Layout shell:**
- `src/components/layout/AppShell.tsx` — renders `<Sidebar>` left + `<TopBar>` top + `<Outlet>` for page content.
- `src/components/layout/Sidebar.tsx` — 5 nav items with orange active highlight:
  - Accueil TV → `/`
  - Favoris → `/favorites`
  - Récemment regardées → `/recent`
  - Guide TV → `/guide`
  - Toutes les chaînes → `/channels`
  - IPTVFlix wordmark at top; collapsed icon mode at narrow widths.
- `src/components/layout/TopBar.tsx` — IPTVFlix logo; **VOD / TV mode toggle** (TV tab highlighted orange, VOD tab links to `import.meta.env.VITE_VOD_URL ?? '/'` with `?token=<jwt>` appended); profile avatar pill.

**Pages:**
- `src/pages/LoginPage.tsx` — standard username/password form; redirects to `/profiles/choose` on success.
- `src/pages/ProfileChoosePage.tsx` — lists profiles, writes `currentProfileId` to localStorage, redirects to `/`.
- `src/pages/HomePage.tsx` ("Accueil TV") — calls `GET /channels`; renders channel cards grid; shows empty-state message when list is empty.
- `src/pages/AllChannelsPage.tsx` — same channel grid at `/channels`; category filter bar (disabled while catalog is empty).
- `src/pages/FavoritesPage.tsx` — empty-state stub at `/favorites`.
- `src/pages/RecentPage.tsx` — empty-state stub at `/recent`.
- `src/pages/GuidePage.tsx` — empty-state stub at `/guide` ("Guide TV — coming soon").
- `src/pages/HealthPage.tsx` — unauthenticated, at `/health`; renders `{ "status": "ok" }` visually; HTTP 200.

**Routing (`src/App.tsx`):**
- Public routes: `/login`, `/health`.
- Protected routes (redirect to `/login` if unauthenticated): `/profiles/choose`, and all nav pages under `<AppShell>`.

**Deployment config (`apps/live-tv/nixpacks.toml`):**
```toml
[phases.build]
cmds = ["pnpm --filter @iptvflix/live-tv build"]

[start]
cmd = "pnpm --filter @iptvflix/live-tv start"
```

### Root `package.json` updates
- Add `@iptvflix/live-tv` to the `build`, `typecheck`, and `lint` filter lists so CI picks it up.

### `apps/web/` changes (VOD/TV switch)
- In the VOD app's navigation component (`src/components/layout/AppShell.tsx` or equivalent): add a "TV" tab/button that navigates to `import.meta.env.VITE_LIVE_TV_URL ?? 'http://localhost:5174'` and appends `?token=<current-jwt>` so the Live TV app can pick up auth without re-login.
- Add `VITE_LIVE_TV_URL` to `apps/web/.env.example` (not `.env` — no secrets).

### Smoke tests (`e2e/tests/live-tv-smoke.spec.ts`)
- `GET /health` on live-tv base URL returns HTTP 200.
- Unauthenticated `GET /` redirects to `/login`.
- Login form authenticates and navigates to profile chooser.
- After profile selection, sidebar renders all 5 nav items.
- VOD/TV toggle is visible in the top bar; TV tab has orange styling.
- Clicking "Toutes les chaînes" navigates to `/channels` with a channel grid (or empty-state) visible.

## Excluded

- Channel catalog ingestion: parsing M3U playlists into channel entities, category mapping, stream URL resolution — separate ticket.
- Live TV playback: embedding a player in the Live TV app to play a channel stream.
- EPG / Guide TV grid data and display.
- Favorites and Recently Watched persistence in the DB for Live TV.
- Full cross-domain SSO (cookie-based shared session across different Railway hostnames).
- Profile preferences scoped to Live TV (audio/subtitle language, quality).
- Android TV integration for Live TV.
- Recommendation features in Live TV.
- New DB tables or Drizzle migrations — `GET /channels` returns an empty array until the channel catalog ticket is completed.

## Acceptance criteria

- `pnpm --filter @iptvflix/live-tv build` exits 0 from repo root; no TypeScript errors.
- `pnpm --filter @iptvflix/web build` and `pnpm --filter @iptvflix/api build` still exit 0 unchanged.
- `pnpm --filter @iptvflix/live-tv dev` starts a dev server on port 5174 independently.
- `GET /health` on the live-tv app returns HTTP 200 without authentication.
- Authenticated user sees the sidebar with exactly 5 nav items; active item is highlighted in orange (`#f97316`).
- VOD/TV mode toggle is visible in both the VOD web app (links out to live-tv) and the Live TV app (links back to VOD).
- `GET /channels` on the API (with valid JWT) returns HTTP 200 with a JSON array.
- `ChannelResponse` is importable from `@iptvflix/api-contracts`.
- `apps/live-tv/nixpacks.toml` is present and specifies a valid build and start command for Railway.
- Playwright suite `live-tv-smoke.spec.ts` passes all 6 checks.
- `pnpm test` (API vitest) and `pnpm test:e2e` (existing Playwright suite) pass with no regressions.
- No DB migrations were written or applied.
