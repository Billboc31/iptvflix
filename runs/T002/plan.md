## Objective

Add a typed, migration-driven PostgreSQL persistence layer to `apps/api` using Drizzle ORM and postgres.js, and establish the schema, migration, environment, and health-check conventions that all future domain features will share.

## Included

### Dependencies (`apps/api/package.json`)
- Runtime: `drizzle-orm`, `postgres` (postgres.js), `dotenv`
- Dev: `drizzle-kit`

### Docker Compose (`docker-compose.yml`, repo root)
- `postgres` service: image `postgres:16-alpine`, named volume `pgdata`, port `5432:5432`, healthcheck `pg_isready -U iptvflix`, env vars `POSTGRES_USER=iptvflix`, `POSTGRES_PASSWORD=iptvflix`, `POSTGRES_DB=iptvflix`

### Environment configuration
- `.env.example`: add `DATABASE_URL=postgres://iptvflix:iptvflix@localhost:5432/iptvflix`
- `apps/api/src/config/env.ts`: parse and validate `DATABASE_URL`, `PORT`, `CORS_ORIGIN` on module load; throw `Error("DATABASE_URL is not configured")` when absent — no credential string in the message
- `.env` added to `.gitignore` if not already present

### Drizzle config (`apps/api/drizzle.config.ts`)
- Schema glob: `src/db/schema/**/*.ts`
- Migrations output: `migrations/`
- Driver: `postgres-js`
- Reads `DATABASE_URL` from `process.env`

### DB client (`apps/api/src/db/client.ts`)
- Creates and exports the `postgres()` pool and the `drizzle(pool, { schema })` instance
- Imports `DATABASE_URL` from `env.ts` (validation already performed there)

### Schema (`apps/api/src/db/schema/`)
- `app_config.ts`: table `app_config` — columns `key text PRIMARY KEY`, `value text NOT NULL`; serves as the minimal initial migration target
- `index.ts`: re-exports all table definitions (convention for adding future tables)

### Initial migration (`apps/api/migrations/`)
- Generated via `pnpm --filter api db:generate`; SQL file committed; reproducible from a clean checkout

### npm scripts (`apps/api/package.json`)
```
"db:generate": "drizzle-kit generate",
"db:migrate":  "drizzle-kit migrate",
"db:studio":   "drizzle-kit studio"
```

### Health check extension (`apps/api/src/routes/health.ts`)
- Extend the existing `GET /health` handler to run `SELECT 1` via the Drizzle client
- Success response: `{ status: "ok", db: "ok" }`
- DB unreachable response: `{ status: "ok", db: "unavailable" }` — no error details, no connection string exposed
- HTTP status remains 200 in both cases (liveness vs. readiness distinction is out of scope)

### Tests (`apps/api/src/`)
- `config/env.test.ts` — unit: when `DATABASE_URL` is absent from `process.env`, importing the module throws the sanitized error message (no real DB needed)
- `routes/health.test.ts` — extend existing test: mock the DB probe to assert the `db` field is present in the JSON response for both success and failure paths

### Local dev documentation (`docs/local-dev.md`)
1. `cp .env.example .env` and fill credentials if changed
2. `docker compose up -d postgres` — starts Postgres; wait for healthcheck
3. `pnpm --filter api db:migrate` — applies migrations
4. `pnpm --filter api dev` — starts the API
5. `pnpm --filter api db:generate` — regenerate after schema changes

## Excluded

- Domain schema tables: channels, sources, profiles, history, recommendations (T003+)
- Redis, BullMQ, or any job-queue infrastructure
- Production or staging database hosting
- Repository pattern / data-access abstractions beyond the DB client export
- Transaction helper utilities
- Database seeding scripts
- CI pipeline changes for Postgres service
- Any changes to `apps/web`, `android-tv`, or `packages/api-contracts`

## Acceptance criteria

1. `docker compose up -d postgres` starts a Postgres 16 container that passes its own healthcheck.
2. `pnpm --filter api db:generate` runs without error and produces a SQL file under `apps/api/migrations/`.
3. `pnpm --filter api db:migrate` applies that migration to a fresh database, creating the `app_config` table.
4. Running steps 2 and 3 again on a clean database (no prior state) reproduces the current schema without manual SQL.
5. `GET /health` returns `{ "status": "ok", "db": "ok" }` when Postgres is running.
6. `GET /health` returns `{ "status": "ok", "db": "unavailable" }` when Postgres is unreachable — response body contains no connection string or credentials.
7. Starting `apps/api` with `DATABASE_URL` unset logs a sanitized error and exits; no credential appears in stdout/stderr.
8. `pnpm --filter api test` passes, covering the missing-env guard and the health `db` field for both probe outcomes.
9. `docs/local-dev.md` covers Docker startup, env file setup, migration commands, and dev server start.
10. No domain tables are introduced; the only new schema object is `app_config`.
