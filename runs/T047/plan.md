## Objective

Add `railway.toml`, `apps/web/vercel.json`, a `start:railway` npm script, updated `.env.example` files, a 503-returning `/health` on DB failure, and `docs/staging-deployment.md` so that a merge to `main` reliably rebuilds and redeploys API + Web with automatic Drizzle migrations — and so a failing migration or unreachable DB prevents traffic from ever reaching the new deployment.

## Included

### `apps/api/railway.toml` — CREATE
Railway service config (monorepo root):
```toml
[build]
builder = "NIXPACKS"
buildCommand = "pnpm install --frozen-lockfile && pnpm --filter api build"

[deploy]
startCommand = "pnpm --filter api start:railway"
healthcheckPath = "/health"
healthcheckTimeout = 30
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 3
```
The healthcheck tells Railway to poll `GET /health` after startup; a non-200 response marks the deploy unhealthy.

### `apps/api/package.json` — MODIFY
Add one script next to the existing `start`:
```json
"start:railway": "pnpm db:migrate && node dist/index.js"
```
`db:migrate` (`drizzle-kit migrate`) exits non-zero on failure, which causes Railway to abort the deploy before binding to the port.

### `apps/api/src/routes/health.ts` — MODIFY
When `dbStatus === 'unavailable'`, reply with HTTP 503 instead of 200.  
Fastify route reply must call `reply.status(503).send(...)` explicitly so Railway's health check detects DB outages and marks the running instance unhealthy.

### `apps/api/src/routes/health.test.ts` — MODIFY
Update the second test case (`db: unavailable`) to assert `response.statusCode` is `503` instead of `200`.

### `apps/web/vercel.json` — CREATE
```json
{
  "buildCommand": "pnpm --filter web build",
  "outputDirectory": "apps/web/dist",
  "framework": "vite"
}
```
Tells Vercel how to build the monorepo frontend without requiring dashboard-only configuration.

### `apps/api/.env.example` — MODIFY
Add `NODE_ENV=production` (Railway injects this automatically in deployed environments; documenting it makes the contract visible in the repository).

### `apps/web/.env.example` — MODIFY
Add an inline comment on `VITE_API_BASE` clarifying that it must be set to the Railway API origin in staging (e.g. `https://your-api.railway.app`); the `/api` default is dev-only and relies on Vite's proxy.

### `docs/staging-deployment.md` — CREATE
Concise guide covering:
- Prerequisites (Railway account, Vercel account, GitHub repo connected)
- Railway setup: create project, connect repo, PostgreSQL plugin (auto-injects `DATABASE_URL`), required env vars table (`CORS_ORIGIN`, `NODE_ENV`, `TMDB_API_KEY` optional), trigger first deploy
- Vercel setup: create project, connect repo, set framework to Vite or let `vercel.json` drive it, set `VITE_API_BASE` to Railway API URL, trigger deploy
- Redeployment after env var changes (redeploy button / re-push)
- Environment variable table with required/optional flags and no hard-coded values

## Excluded

- Authentication (tracked separately, must remain compatible)
- Custom domain configuration
- Multi-region or HA infrastructure
- Backup / point-in-time recovery
- Changes to the GitHub Actions CI pipeline
- Any change to Drizzle schema or existing migration files
- Modifications to `build`, `start`, `test`, or `typecheck` scripts

## Acceptance criteria

- `apps/api/railway.toml` exists, declares `buildCommand`, `startCommand` (`pnpm --filter api start:railway`), `healthcheckPath = "/health"`.
- `apps/api/package.json` contains `"start:railway": "pnpm db:migrate && node dist/index.js"` and no other script is modified.
- `GET /health` returns HTTP 503 (not 200) when the DB probe throws; returns 200 when it succeeds.
- `health.test.ts` passes: DB-down case asserts 503.
- `apps/web/vercel.json` exists with `buildCommand`, `outputDirectory`, and `framework`.
- `apps/api/.env.example` includes `NODE_ENV=production`; no secret values are committed.
- `apps/web/.env.example` has a comment explaining that `VITE_API_BASE` must be the Railway API origin in staging.
- `docs/staging-deployment.md` exists and documents Railway + Vercel setup end-to-end, including all env vars.
- `pnpm --filter api test` passes with no regressions.
- `pnpm --filter api build` continues to exclude test sources (tsconfig.build.json unchanged).
