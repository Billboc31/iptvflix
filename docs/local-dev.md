# Local Development

## Prerequisites

- Node.js ≥ 20
- pnpm ≥ 9
- Docker (for PostgreSQL)

## First-time setup

```bash
# 1. Copy the environment file and adjust credentials if needed
cp .env.example .env

# 2. Start PostgreSQL
docker compose up -d postgres

# 3. Wait for the healthcheck to pass (5–10 seconds), then apply migrations
pnpm --filter api db:migrate

# 4. Start the API
pnpm --filter api dev
```

## Schema changes

After modifying files under `apps/api/src/db/schema/`:

```bash
# Regenerate the migration SQL
pnpm --filter api db:generate

# Apply the new migration
pnpm --filter api db:migrate
```

## Available database commands

| Command | Description |
|---|---|
| `pnpm --filter api db:generate` | Generate a SQL migration from schema changes |
| `pnpm --filter api db:migrate` | Apply pending migrations to the database |
| `pnpm --filter api db:studio` | Open Drizzle Studio (visual DB browser) |

## Health check

Once the API is running, verify the database connection:

```bash
curl http://localhost:3000/health
# {"status":"ok","db":"ok"}
```

If `db` is `"unavailable"`, PostgreSQL is not reachable — check that the container is running and the `DATABASE_URL` in `.env` is correct.
