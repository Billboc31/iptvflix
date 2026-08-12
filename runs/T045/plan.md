## Objective

Add two shell scripts — one destructive reset and one non-destructive start — plus root `package.json` shortcuts, readiness checks, and a README section covering clean-reset and remote-test workflows. No application code changes are required: both the API and the web dev server already bind `0.0.0.0`.

## Included

**`scripts/reset-local.sh`** (new, destructive):
- Stop all Compose services and remove the `pgdata` named volume (`docker compose down -v`).
- Start `postgres` service and poll `pg_isready` until the healthcheck passes.
- Run Drizzle migrations: `pnpm --filter api db:migrate`.
- Start API + Web: `pnpm dev`.
- Print the reachable LAN IP at start (macOS: `ipconfig getifaddr en0`; Linux: `hostname -I | awk '{print $1}'`).
- Script must error-exit (`set -euo pipefail`) and refuse to run if `DATABASE_URL` is unset.

**`scripts/start-local.sh`** (new, non-destructive):
- Bring up `postgres` only if not already running (`docker compose up -d postgres`).
- Poll `pg_isready` for readiness.
- Start API + Web: `pnpm dev`.
- Print the reachable LAN IP.

**`package.json`** (root, modified):
- Add `"reset-local": "bash scripts/reset-local.sh"`.
- Add `"start-local": "bash scripts/start-local.sh"`.

**`README.md`** (modified):
- Add a "Local Reset & Remote Testing" section documenting:
  - `pnpm reset-local` for a clean wipe-and-rebuild.
  - `pnpm start-local` for routine restarts without data loss.
  - How to find the host LAN/Tailscale IP.
  - How to reach the web app from another device (`http://<host-ip>:5173`).
  - Note that `/api` proxy works transparently; no extra CORS config is needed for remote web access.
  - How to verify: `curl http://<host-ip>:3000/health` and open the web URL.

**Readiness checks inside both scripts:**
- Postgres: loop `docker compose exec postgres pg_isready -U iptvflix` (max 30 iterations, 1 s sleep).
- API: loop `curl -sf http://localhost:3000/health` after `pnpm dev` is backgrounded (informational only; scripts print the URL once it responds).
- Web: similar `curl` loop on `http://localhost:5173`.

**No changes to:**
- `docker-compose.yml` — already correct (`pgdata` volume, healthcheck present).
- `apps/api/src/index.ts` — already binds `0.0.0.0:3000`.
- `apps/web/vite.config.ts` — already binds `host: '0.0.0.0'`.
- Any `.env` files — scripts read them without mutating them.
- Drizzle config or migrations.

## Excluded

- Production or cloud deployment.
- Public internet / port forwarding setup.
- Tailscale installation or configuration.
- Creating Xtream/Plex credentials or seeding media after reset.
- Changing CORS configuration (not needed for remote web access via Vite proxy).
- Android TV app or e2e test integration.
- Any migration authoring or schema changes.

## Acceptance criteria

- `pnpm reset-local` drops the `pgdata` volume, recreates it, runs all 17 migrations to completion, and starts API + Web.
- `pnpm start-local` starts (or resumes) Postgres + API + Web without touching existing data.
- The two commands are named distinctly enough that a typo cannot trigger a destructive reset instead of a normal start.
- After `pnpm reset-local`, `curl http://localhost:3000/health` returns `{"status":"ok","db":"ok"}`.
- The web app loads at `http://localhost:5173`; `/api` calls succeed (proxied correctly).
- From a second device on the same LAN or Tailscale network, the web app loads at `http://<host-ip>:5173` and `/api` calls succeed through the Vite proxy.
- Scripts contain no hard-coded developer-specific paths or IP addresses.
- Running `pnpm reset-local` preserves `apps/api/.env` and `apps/web/.env` (only the Docker volume is deleted).
- README section explains how to find the host IP and how to use both commands; no machine-specific values are embedded in the docs.
