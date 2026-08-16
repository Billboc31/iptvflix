# Staging Deployment Guide

This guide covers the full Railway + Vercel staging setup from scratch.

## Prerequisites

- GitHub repository connected to your Railway and Vercel accounts
- Railway account with a project created
- Vercel account

## Environment Variables

### Railway (API)

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | **Yes** | Injected automatically by the Railway PostgreSQL plugin |
| `CORS_ORIGIN` | **Yes** | Full origin of the Vercel frontend, e.g. `https://your-app.vercel.app` |
| `NODE_ENV` | **Yes** | Set to `production` (Railway injects this in deployed environments) |
| `PORT` | No | Injected by Railway; the API reads it via `process.env.PORT` |
| `TMDB_API_KEY` | No | Required only if the TMDB sync feature is active |
| `TMDB_STALE_DAYS` | No | Overrides the default cache TTL for TMDB data |
| `NIXPACKS_PKGS` | No | Optional fallback: set to `ffmpeg` if HLS remux binaries are missing at runtime |

Do not commit secret values. Use the Railway dashboard to set `DATABASE_URL` and `TMDB_API_KEY`.

### ffmpeg / ffprobe (API, for HLS playback)

1. Prefer `apps/api/nixpacks.toml` (`nixPkgs = ["...", "ffmpeg"]`) with API **Root Directory** = `apps/api`, then **Redeploy**.
2. If the API service Root Directory is the **monorepo root** instead, either set Config `nixpacksConfigPath = apps/api/nixpacks.toml` or add service variable `NIXPACKS_PKGS=ffmpeg` and **Redeploy**.
3. In deploy logs, confirm ffmpeg is installed; at runtime `ffmpeg -version` must succeed (otherwise resolve may pick `HLS_REMUX` and fail with session 410).

### Railway (Web SPA) or Vercel (Web)

| Variable | Required | Description |
|---|---|---|
| `VITE_API_BASE` | **Yes** | Full Railway API origin, e.g. `https://your-api.railway.app` (injected at **build** time) |

When hosting the web app on Railway, also set `CORS_ORIGIN` on the **API** service to the Railway web URL.

## Railway Setup

### API service

1. Create a new Railway project and connect the GitHub repository.
2. Add a **PostgreSQL** plugin to the project — Railway injects `DATABASE_URL` into the API service automatically.
3. Set the service **Root Directory** to `apps/api` so Railway reads `apps/api/railway.toml`.
4. Set the required environment variables listed above via the Railway dashboard.
5. Trigger the first deploy (push to `main` or click **Deploy** in the dashboard).

On each API deploy Railway will:
- Run `pnpm install --frozen-lockfile && pnpm --filter api build` to compile TypeScript output into `dist/`.
- Run `pnpm --filter api start:railway`, which executes `drizzle-kit migrate` before starting the server. If the migration fails, the process exits non-zero and Railway aborts the deploy.
- Poll `GET /health` after startup. A 503 response (DB unreachable) marks the deploy unhealthy and Railway rolls back.

### Web service (optional alternative to Vercel)

1. Add a second Railway service from the same GitHub repo.
2. Keep **Root Directory** empty (monorepo root) so the pnpm workspace resolves.
3. Set **Config-as-code** / railway config path to `apps/web/railway.toml`.
4. Set build-time env vars on the **web** service:
   - `VITE_API_BASE` = public API URL **without** a path, e.g. `https://iptvflixapi-production.up.railway.app` (not `/api`)
5. On the **API** service set `CORS_ORIGIN` to the web origin **without** trailing slash, e.g. `https://iptvflix-production-dfc4.up.railway.app`
6. Deploy / Redeploy the web service after changing `VITE_API_BASE` (restart alone is not enough — Vite inlines the value at build).

Do **not** rely on Railpack auto-detect at the monorepo root: there is no root `start` script and Vite lives under `apps/web`, which produces `No start command detected`.

## Vercel Setup

1. Create a new Vercel project and import the GitHub repository.
2. Vercel auto-detects the `apps/web/vercel.json` configuration, which sets:
   - `buildCommand`: `pnpm --filter web build`
   - `outputDirectory`: `apps/web/dist`
   - `framework`: `vite`
   - `git.deploymentEnabled`: only `main` triggers deployments (`*` / `**` are disabled) so ticket/feature branches do not consume Preview build quota
3. Set `VITE_API_BASE` to the Railway API URL (e.g. `https://your-api.railway.app`) in the Vercel dashboard under **Environment Variables**.
4. Trigger a deploy. Vercel injects `VITE_API_BASE` at build time via Vite's env handling.

## Redeployment After Environment Variable Changes

Environment variable changes in Railway or Vercel do not automatically trigger a redeploy.

- **Railway**: Click **Redeploy** in the latest deployment, or push a new commit to `main`.
- **Vercel**: Click **Redeploy** on the latest deployment (select "Redeploy with existing build cache" for speed, or without cache to pick up `VITE_API_BASE` changes at build time).

## Health Check

`GET /health` returns:

```json
{ "status": "ok", "db": "ok" }
```

with HTTP 200 when the database is reachable. When the database probe fails:

```json
{ "status": "ok", "db": "unavailable" }
```

with HTTP 503, causing Railway to mark the deployment unhealthy without exposing credentials.
