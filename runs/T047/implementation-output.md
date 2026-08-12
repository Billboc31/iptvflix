All changes are correct and all 507 tests pass. Here's a summary:

## Changes made

**Created:**
- `apps/api/railway.toml` — Railway service config: NIXPACKS build, `start:railway` as start command, `/health` healthcheck at 30s timeout, restart on failure (max 3 retries)
- `apps/web/vercel.json` — Vercel config: `pnpm --filter web build`, output dir `apps/web/dist`, framework `vite`
- `docs/staging-deployment.md` — End-to-end staging guide covering Railway + Vercel setup, all env vars, redeployment, and health check behavior

**Modified:**
- `apps/api/package.json` — Added `"start:railway": "pnpm db:migrate && node dist/index.js"` (only this script; no other scripts touched)
- `apps/api/src/routes/health.ts` — Returns HTTP 503 when `dbStatus === 'unavailable'`; 200 otherwise
- `apps/api/src/routes/health.test.ts` — Updated DB-down assertion from `200` to `503`
- `apps/api/.env.example` — Added `NODE_ENV=production`
- `apps/web/.env.example` — Added inline comment explaining `VITE_API_BASE` must be the Railway API origin in staging

**Verification:** `pnpm --filter api test` — 507 tests, 35 files, all passed.
